/**
 * Cohort enrollment.
 *
 *   - Free, no GoFunnelAI account required to enroll (account created on Day 2
 *     when the participant generates their funnel).
 *   - Enrollment opens any time the next-month cohort is `scheduled`.
 *   - On enrollment, we add the participant to the cohort and bump the count.
 *   - Idempotent on (cohort, email).
 */

import type { ChallengeStore } from "./store.js";
import type { Cohort, Participant } from "./types.js";

export interface EnrollInput {
  email: string;
  phone_e164?: string | null;
  sms_opt_in?: boolean;
  industry?: string | null;
  timezone?: string | null;
  user_id?: string | null;
  enrollment_source?: string | null;
}

export interface EnrollDeps {
  store: ChallengeStore;
  newId: (entity: "request") => string;
  clock?: { iso(): string };
  emit?: (
    name: "challenge_enrolled",
    payload: Record<string, unknown>,
  ) => Promise<void>;
}

const defaultClock = { iso: () => new Date().toISOString() };

/**
 * Enroll into the next scheduled cohort. Returns the existing record if the
 * (cohort, email) pair already enrolled (idempotent).
 */
export async function enrollParticipant(
  input: EnrollInput,
  deps: EnrollDeps,
): Promise<{ participant: Participant; cohort: Cohort }> {
  const cohort = await deps.store.getNextScheduledCohort();
  if (!cohort) throw new Error("no cohort is currently open for enrollment");

  const existing = await deps.store.getParticipantByEmail(cohort.id, input.email);
  if (existing) return { participant: existing, cohort };

  const now = (deps.clock ?? defaultClock).iso();
  const participant: Participant = {
    id: deps.newId("request"),
    cohort_id: cohort.id,
    user_id: input.user_id ?? null,
    email: input.email,
    phone_e164: input.phone_e164 ?? null,
    sms_opt_in: input.sms_opt_in ?? false,
    industry: input.industry ?? null,
    timezone: input.timezone ?? null,
    enrolled_at: now,
    enrollment_source: input.enrollment_source ?? null,
    days_completed: [],
    funnel_id: null,
    first_lead_at: null,
    certificate_url: null,
    paid_at: null,
    plan_at_conversion: null,
  };
  const inserted = await deps.store.insertParticipant(participant);
  await deps.store.incrementCohortCounter(cohort.id, "enrolled_count", 1);

  if (deps.emit) {
    await deps.emit("challenge_enrolled", {
      user_id: input.user_id ?? null,
      email: input.email,
      cohort_id: cohort.id,
      enrollment_source: input.enrollment_source ?? null,
    });
  }
  return { participant: inserted, cohort };
}
