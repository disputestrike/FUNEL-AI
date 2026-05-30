/**
 * Lesson CRUD.
 *
 * Lessons come in five flavors (video, text, quiz, exercise, capstone) — the
 * body is a discriminated union and each flavor renders differently in the
 * lesson player. Video lessons must reference a Cloudflare Stream UID;
 * `video-hosting.ts` is responsible for uploading and minting playback URLs.
 */

import { ulid } from "ulid";
import { z } from "zod";
import {
  LessonInputSchema,
  type Lesson,
  type LessonBody,
  type LessonInput,
  type LessonType,
} from "./types.js";

export interface LessonStore {
  insertLesson(lesson: Lesson): Promise<void>;
  getLesson(id: string): Promise<Lesson | null>;
  listLessonsByModule(moduleId: string): Promise<Lesson[]>;
  listLessonsByCourse(courseId: string): Promise<Lesson[]>;
  updateLesson(id: string, patch: Partial<Lesson>): Promise<Lesson>;
  deleteLesson(id: string): Promise<void>;
  bulkUpdateOrder(updates: Array<{ id: string; order: number }>): Promise<void>;
}

export async function createLesson(
  courseId: string,
  moduleId: string,
  input: LessonInput,
  store: LessonStore,
  now: () => string = isoNow,
): Promise<Lesson> {
  const parsed = LessonInputSchema.parse(input);
  const ts = now();
  const lesson: Lesson = {
    id: `les_${ulid()}`,
    course_id: courseId,
    module_id: moduleId,
    title: parsed.title,
    order: parsed.order,
    body: parsed.body,
    required: parsed.required,
    created_at: ts,
    updated_at: ts,
  };
  await store.insertLesson(lesson);
  return lesson;
}

export async function updateLesson(
  id: string,
  patch: Partial<LessonInput>,
  store: LessonStore,
  now: () => string = isoNow,
): Promise<Lesson> {
  // Re-validate the body if present (the discriminated union enforces type×fields).
  const parsed = LessonInputSchema.partial().parse(patch);
  return store.updateLesson(id, { ...parsed, updated_at: now() });
}

export async function deleteLesson(id: string, store: LessonStore): Promise<void> {
  await store.deleteLesson(id);
}

/** Reorder lessons within a single module. Same contract as `reorderModules`. */
export async function reorderLessons(
  moduleId: string,
  orderedIds: string[],
  store: LessonStore,
): Promise<Lesson[]> {
  const existing = await store.listLessonsByModule(moduleId);
  const existingIds = new Set(existing.map((l) => l.id));

  for (const id of orderedIds) {
    if (!existingIds.has(id)) {
      throw new Error(`Lesson ${id} does not belong to module ${moduleId}`);
    }
  }
  if (orderedIds.length !== existing.length) {
    throw new Error(
      `reorderLessons requires all lesson ids — got ${orderedIds.length}, expected ${existing.length}`,
    );
  }

  await store.bulkUpdateOrder(orderedIds.map((id, idx) => ({ id, order: idx })));
  const next = await store.listLessonsByModule(moduleId);
  next.sort((a, b) => a.order - b.order);
  return next;
}

/** Convenience: collect distinct lesson types in a course (catalog badges). */
export async function lessonTypesByCourse(
  courseId: string,
  store: LessonStore,
): Promise<LessonType[]> {
  const lessons = await store.listLessonsByCourse(courseId);
  return Array.from(new Set(lessons.map((l) => l.body.type))) as LessonType[];
}

/** Sum of video durations + reading minutes — used to fill `course.total_minutes`. */
export function estimateCourseMinutes(lessons: Lesson[]): number {
  let seconds = 0;
  for (const l of lessons) {
    const body = l.body as LessonBody;
    if (body.type === "video") seconds += body.duration_seconds;
    else if (body.type === "text") seconds += body.reading_minutes * 60;
    else if (body.type === "quiz") seconds += 5 * 60; // estimate
    else if (body.type === "exercise") seconds += 15 * 60;
    else if (body.type === "capstone") seconds += 90 * 24 * 3600; // 90 days
  }
  return Math.ceil(seconds / 60);
}

function isoNow(): string {
  return new Date().toISOString();
}
