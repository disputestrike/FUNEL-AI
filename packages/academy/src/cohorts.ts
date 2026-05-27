/**
 * Cohort management for cohort-delivered programs.
 *
 * A cohort is a group of students who progress through a paid program
 * together with synchronous live sessions. Each cohort has:
 *   - a fixed start and end date
 *   - a capacity (default 50)
 *   - a recurring lecture schedule (ICS-able)
 *   - a community channel (Slack / Discord) â€” stored as an opaque URL string.
 *
 * The state machine: `open â†’ full â†’ in_session â†’ completed`.
 */

import { ulid } from "ulid";
import { z } from "zod";
import { type Cohort } from "./types.js";

export interface CohortStore {
  insertCohort(c: Cohort): Promise<void>;
  getCohort(id: string): Promise<Cohort | null>;
  updateCohort(id: string, patch: Partial<Cohort>): Promise<Cohort>;
  listCohortsForProgram(programId: string): Promise<Cohort[]>;
  incrementEnrolledCount(id: string, delta: number): Promise<Cohort>;
}

const CreateCohortSchema = z.object({
  program_id: z.string().min(1),
  course_id: z.string().min(1),
  name: z.string().min(1),
  starts_at: z.string().datetime(),
  ends_at: z.string().datetime(),
  capacity: z.number().int().positive().default(50),
  schedule: z
    .array(
      z.object({
        at: z.string().datetime(),
        topic: z.string().min(1),
        zoom_url: z.string().url().optional(),
      }),
    )
    .default([]),
  community_channel: z.string().nullable().optional(),
});
export type CreateCohortInput = z.infer<typeof CreateCohortSchema>;

export async function createCohort(
  input: CreateCohortInput,
  store: CohortStore,
): Promise<Cohort> {
  const parsed = CreateCohortSchema.parse(input);
  if (new Date(parsed.starts_at) >= new Date(parsed.ends_at)) {
    throw new Error("Cohort starts_at must be before ends_at");
  }
  const cohort: Cohort = {
    id: `coh_${ulid()}`,
    program_id: parsed.program_id,
    course_id: parsed.course_id,
    name: parsed.name,
    starts_at: parsed.starts_at,
    ends_at: parsed.ends_at,
    capacity: parsed.capacity,
    enrolled_count: 0,
    schedule: parsed.schedule,
    community_channel: parsed.community_channel ?? null,
    status: "open",
  };
  await store.insertCohort(cohort);
  return cohort;
}

/** Join: bumps the counter, flips to `full` when capacity hits. */
export async function joinCohort(
  id: string,
  store: CohortStore,
): Promise<Cohort> {
  const cohort = await store.getCohort(id);
  if (!cohort) throw new Error(`Cohort ${id} not found`);
  if (cohort.status !== "open") throw new Error(`Cohort ${id} is not open (status=${cohort.status})`);
  const next = await store.incrementEnrolledCount(id, 1);
  if (next.enrolled_count >= next.capacity) {
    return store.updateCohort(id, { status: "full" });
  }
  return next;
}

export async function leaveCohort(
  id: string,
  store: CohortStore,
): Promise<Cohort> {
  const cohort = await store.getCohort(id);
  if (!cohort) throw new Error(`Cohort ${id} not found`);
  if (cohort.status === "completed") {
    throw new Error("Cannot leave a completed cohort");
  }
  const next = await store.incrementEnrolledCount(id, -1);
  if (cohort.status === "full" && next.enrolled_count < next.capacity) {
    return store.updateCohort(id, { status: "open" });
  }
  return next;
}

/**
 * Tick the lifecycle. Caller (a scheduled job) invokes this nightly per
 * cohort; it advances state based on the wall clock.
 */
export async function tickCohortLifecycle(
  id: string,
  store: CohortStore,
  now: () => Date = () => new Date(),
): Promise<Cohort> {
  const c = await store.getCohort(id);
  if (!c) throw new Error(`Cohort ${id} not found`);
  const n = now();
  if (c.status === "open" || c.status === "full") {
    if (new Date(c.starts_at) <= n) {
      return store.updateCohort(id, { status: "in_session" });
    }
  }
  if (c.status === "in_session") {
    if (new Date(c.ends_at) <= n) {
      return store.updateCohort(id, { status: "completed" });
    }
  }
  return c;
}

/** Emit an ICS calendar string for the cohort's lectures. */
export function renderCohortICS(cohort: Cohort): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//GoFunnelAI Academy//Cohort//EN",
  ];
  for (const ev of cohort.schedule) {
    const dt = new Date(ev.at).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
    lines.push(
      "BEGIN:VEVENT",
      `UID:${cohort.id}-${dt}@gofunnelai.com`,
      `DTSTAMP:${dt}`,
      `DTSTART:${dt}`,
      `SUMMARY:${ev.topic}`,
      ev.zoom_url ? `URL:${ev.zoom_url}` : "",
      `DESCRIPTION:${cohort.name} â€” ${ev.topic}`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.filter(Boolean).join("\r\n");
}

export async function listCohortsForProgram(
  programId: string,
  store: CohortStore,
): Promise<Cohort[]> {
  return store.listCohortsForProgram(programId);
}

export { CreateCohortSchema };
