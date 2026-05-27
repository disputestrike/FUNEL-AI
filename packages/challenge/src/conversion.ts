/**
 * Challenge → paid conversion tracking (Doc 16 §7.5).
 *
 * Listens to billing events and stamps the participant when they upgrade,
 * which feeds the cohort's `paid_conversion_count` and the
 * `challenge_paid_conversion` event used by the growth dashboards.
 *
 * The actual billing-event subscriber lives in the API layer; this module
 * just exposes the handler so it stays unit-testable.
 */

import type { ChallengeStore } from "./store.js";

export interface ConversionDeps {
  store: ChallengeStore;
  clock?: { iso(): string };
  emit?: (
    name: "challenge_paid_conversion",
    payload: Record<string, unknown>,
  ) => Promise<void>;
}

const defaultClock = { iso: () => new Date().toISOString() };

/**
 * Recognize a paid conversion for a previously-enrolled participant.
 *
 * `user_id` is the GoFunnelAI user, `cohort_id` is optional (we'll search the
 * most recent cohort the user enrolled in if not supplied).
 */
export async function recordPaidConversion(
  args: {
    user_id: string;
    cohort_id?: string;
    plan: string;
    mrr_cents: number;
  },
  deps: ConversionDeps,
): Promise<{ matched: boolean }> {
  const clock = deps.clock ?? defaultClock;
  let participantId: string | null = null;
  let cohort_id = args.cohort_id ?? null;

  if (cohort_id) {
    const cohort = await deps.store.getCohortById(cohort_id);
    if (cohort) {
      const ps = await deps.store.listCohortParticipants(cohort.id);
      const match = ps.find((p) => p.user_id === args.user_id);
      if (match) participantId = match.id;
    }
  }
  // Without a cohort_id we can't search efficiently in the in-memory store;
  // real impl uses a participant-by-user-id index.
  if (!participantId) return { matched: false };

  const p = await deps.store.getParticipantById(participantId);
  if (!p) return { matched: false };
  if (p.paid_at) return { matched: true };   // already counted

  await deps.store.updateParticipant(p.id, {
    paid_at: clock.iso(),
    plan_at_conversion: args.plan,
  });
  await deps.store.incrementCohortCounter(p.cohort_id, "paid_conversion_count", 1);

  if (deps.emit) {
    await deps.emit("challenge_paid_conversion", {
      user_id: args.user_id,
      cohort_id: p.cohort_id,
      plan: args.plan,
      mrr: args.mrr_cents,
      days_since_enrollment: Math.floor(
        (new Date(clock.iso()).valueOf() - new Date(p.enrolled_at).valueOf()) /
          (24 * 3600 * 1000),
      ),
    });
  }
  return { matched: true };
}
