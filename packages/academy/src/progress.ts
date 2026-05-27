/**
 * Progress tracking.
 *
 * Per-(user, course, module, lesson) row. The dashboard reads aggregate
 * progress through `getCourseProgress`; the lesson player calls
 * `recordLessonHeartbeat` every ~10s so we can resume mid-video.
 *
 * Progress writes are idempotent — re-applying the same heartbeat must not
 * regress `watched_pct` or move `position_seconds` backwards.
 */

import { ulid } from "ulid";
import { z } from "zod";
import {
  type Enrollment,
  type Lesson,
  type LessonPlaybackSession,
  type Progress,
} from "./types.js";

export interface ProgressStore {
  upsertProgress(row: Progress): Promise<Progress>;
  getProgress(args: {
    user_id: string;
    lesson_id: string;
  }): Promise<Progress | null>;
  listProgressByUserCourse(args: {
    user_id: string;
    course_id: string;
  }): Promise<Progress[]>;

  insertPlaybackSession(session: LessonPlaybackSession): Promise<void>;
  updatePlaybackSession(
    id: string,
    patch: Partial<LessonPlaybackSession>,
  ): Promise<void>;

  updateEnrollment(id: string, patch: Partial<Enrollment>): Promise<Enrollment>;
  getEnrollmentByUserCourse(args: {
    user_id: string;
    course_id: string;
  }): Promise<Enrollment | null>;
}

/* ===== Heartbeat ======================================================= */

const HeartbeatSchema = z.object({
  user_id: z.string().min(1),
  course_id: z.string().min(1),
  module_id: z.string().min(1),
  lesson_id: z.string().min(1),
  /** Furthest position observed in this heartbeat (seconds). */
  position_seconds: z.number().int().nonnegative(),
  /** Lesson total length, for computing %. Pass 0 for non-video. */
  duration_seconds: z.number().int().nonnegative(),
});
export type Heartbeat = z.infer<typeof HeartbeatSchema>;

/**
 * Record a player heartbeat. Monotonic: never moves backwards.
 * Marks the lesson `completed` when >= 95% watched (industry threshold).
 *
 * Also updates `Enrollment.last_lesson_id` so "Resume" works on the dashboard.
 */
export async function recordLessonHeartbeat(
  hb: Heartbeat,
  store: ProgressStore,
  now: () => string = isoNow,
): Promise<Progress> {
  const parsed = HeartbeatSchema.parse(hb);
  const existing = await store.getProgress({
    user_id: parsed.user_id,
    lesson_id: parsed.lesson_id,
  });

  const watchedPct =
    parsed.duration_seconds > 0
      ? Math.min(100, Math.round((parsed.position_seconds / parsed.duration_seconds) * 100))
      : 0;
  const ts = now();

  const next: Progress = {
    id: existing?.id ?? `pg_${ulid()}`,
    user_id: parsed.user_id,
    course_id: parsed.course_id,
    module_id: parsed.module_id,
    lesson_id: parsed.lesson_id,
    // Monotonic: take the max of stored vs new.
    position_seconds: Math.max(existing?.position_seconds ?? 0, parsed.position_seconds),
    watched_pct: Math.max(existing?.watched_pct ?? 0, watchedPct),
    status:
      watchedPct >= 95
        ? "completed"
        : (existing?.status ?? "not_started") === "completed"
          ? "completed" // never regress
          : "in_progress",
    best_score_pct: existing?.best_score_pct ?? null,
    started_at: existing?.started_at ?? ts,
    completed_at:
      watchedPct >= 95
        ? (existing?.completed_at ?? ts)
        : (existing?.completed_at ?? null),
    updated_at: ts,
  };
  const saved = await store.upsertProgress(next);

  // Update the enrollment's resume pointer.
  const enrollment = await store.getEnrollmentByUserCourse({
    user_id: parsed.user_id,
    course_id: parsed.course_id,
  });
  if (enrollment) {
    await store.updateEnrollment(enrollment.id, {
      last_lesson_id: parsed.lesson_id,
    });
  }

  return saved;
}

/**
 * Mark a non-video lesson (text, exercise) as completed by the user.
 * Quizzes use `recordQuizResult` instead; capstones use the capstone module.
 */
export async function markLessonCompleted(args: {
  user_id: string;
  course_id: string;
  module_id: string;
  lesson_id: string;
}, store: ProgressStore, now: () => string = isoNow): Promise<Progress> {
  const existing = await store.getProgress({
    user_id: args.user_id,
    lesson_id: args.lesson_id,
  });
  const ts = now();
  const next: Progress = {
    id: existing?.id ?? `pg_${ulid()}`,
    user_id: args.user_id,
    course_id: args.course_id,
    module_id: args.module_id,
    lesson_id: args.lesson_id,
    position_seconds: existing?.position_seconds ?? 0,
    watched_pct: 100,
    status: "completed",
    best_score_pct: existing?.best_score_pct ?? null,
    started_at: existing?.started_at ?? ts,
    completed_at: existing?.completed_at ?? ts,
    updated_at: ts,
  };
  return store.upsertProgress(next);
}

/** Record best-of quiz score against the lesson. */
export async function recordQuizResult(args: {
  user_id: string;
  course_id: string;
  module_id: string;
  lesson_id: string;
  score_pct: number;
  passed: boolean;
}, store: ProgressStore, now: () => string = isoNow): Promise<Progress> {
  const existing = await store.getProgress({
    user_id: args.user_id,
    lesson_id: args.lesson_id,
  });
  const ts = now();
  const best = Math.max(existing?.best_score_pct ?? 0, args.score_pct);
  const next: Progress = {
    id: existing?.id ?? `pg_${ulid()}`,
    user_id: args.user_id,
    course_id: args.course_id,
    module_id: args.module_id,
    lesson_id: args.lesson_id,
    position_seconds: existing?.position_seconds ?? 0,
    watched_pct: existing?.watched_pct ?? 0,
    status: args.passed ? "completed" : "in_progress",
    best_score_pct: best,
    started_at: existing?.started_at ?? ts,
    completed_at: args.passed ? (existing?.completed_at ?? ts) : existing?.completed_at ?? null,
    updated_at: ts,
  };
  return store.upsertProgress(next);
}

/* ===== Aggregate reads ================================================= */

export interface CourseProgressSummary {
  course_id: string;
  total_lessons: number;
  completed_lessons: number;
  progress_pct: number;
  /** Lesson the user should jump to on "Resume". null = course not started. */
  resume_lesson_id: string | null;
  /** All quiz attempts that have a recorded score, latest-first. */
  best_scores: Array<{ lesson_id: string; pct: number }>;
}

export async function getCourseProgress(args: {
  user_id: string;
  course_id: string;
  all_lessons: Lesson[];
}, store: ProgressStore): Promise<CourseProgressSummary> {
  const rows = await store.listProgressByUserCourse({
    user_id: args.user_id,
    course_id: args.course_id,
  });
  const requiredLessons = args.all_lessons.filter((l) => l.required);
  const completedSet = new Set(
    rows.filter((r) => r.status === "completed").map((r) => r.lesson_id),
  );
  const completed = requiredLessons.filter((l) => completedSet.has(l.id)).length;
  const total = requiredLessons.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Resume = first lesson (in order) the user hasn't completed.
  const ordered = [...args.all_lessons].sort((a, b) => a.order - b.order);
  const resume = ordered.find((l) => !completedSet.has(l.id))?.id ?? null;

  const best = rows
    .filter((r) => r.best_score_pct !== null)
    .map((r) => ({ lesson_id: r.lesson_id, pct: r.best_score_pct as number }));

  return {
    course_id: args.course_id,
    total_lessons: total,
    completed_lessons: completed,
    progress_pct: pct,
    resume_lesson_id: resume,
    best_scores: best,
  };
}

/* ===== Playback session telemetry ====================================== */

export async function openPlaybackSession(args: {
  user_id: string;
  lesson_id: string;
  watermark_token: string | null;
}, store: ProgressStore, now: () => string = isoNow): Promise<LessonPlaybackSession> {
  const session: LessonPlaybackSession = {
    id: `lp_${ulid()}`,
    user_id: args.user_id,
    lesson_id: args.lesson_id,
    started_at: now(),
    ended_at: null,
    max_position_seconds: 0,
    dropped_off: false,
    watermark_token: args.watermark_token,
  };
  await store.insertPlaybackSession(session);
  return session;
}

export async function closePlaybackSession(
  sessionId: string,
  args: { max_position_seconds: number; dropped_off: boolean },
  store: ProgressStore,
  now: () => string = isoNow,
): Promise<void> {
  await store.updatePlaybackSession(sessionId, {
    ended_at: now(),
    max_position_seconds: args.max_position_seconds,
    dropped_off: args.dropped_off,
  });
}

function isoNow(): string {
  return new Date().toISOString();
}
