/**
 * Affiliate enrollment.
 *
 * Per Doc 16 §2.1: "Open to any authenticated GoFunnelAI user (free or paid).
 * No application, no approval — automatically eligible on account creation."
 *
 * Enrollment is idempotent: re-calling for an already-enrolled user is a no-op
 * and returns the existing affiliate row.
 */

import { LINK_CODE_CHARS, LINK_CODE_LEN } from "./constants.js";
import type { AffiliateStore } from "./store.js";
import type { Affiliate } from "./types.js";

export interface EnrollInput {
  user_id: string;
  workspace_id?: string | null;
  email: string;
  display_name?: string | null;
  country_iso2?: string | null;
  tos_accepted: boolean;
  /** "affiliate.gofunnelai.com/signup" | "dashboard_widget" | "challenge_completion". */
  activation_source?: string;
}

export interface EnrollDeps {
  store: AffiliateStore;
  /** Unique-ID generator — usually `newId('affiliate')` from @funnel/db/ids. */
  newId: (entity: "affiliate") => string;
  /** Random bytes / source for the referral code; deterministic in tests. */
  random?: () => number;
  /** Emit `affiliate_activated`. Optional. */
  emit?: (event: "affiliate_activated", payload: Record<string, unknown>) => Promise<void>;
  clock?: { now(): number; iso(): string };
}

const defaultClock = { now: () => Date.now(), iso: () => new Date().toISOString() };

/**
 * Generate a referral code. We use a 7-char base31 (no l/o/0/1) — collision
 * probability is 31^7 ≈ 27.5B, more than enough for the first many millions of
 * affiliates. On collision we retry up to 5 times then bail with an error.
 */
export async function generateReferralCode(
  store: AffiliateStore,
  rand: () => number = Math.random,
): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    let code = "";
    for (let i = 0; i < LINK_CODE_LEN - 1; i++) {
      code += LINK_CODE_CHARS[Math.floor(rand() * LINK_CODE_CHARS.length)];
    }
    // Probe both as referral code AND as link code (single global namespace
    // collapses the URL surface for the customer).
    const [a, l] = await Promise.all([
      store.getAffiliateByReferralCode(code),
      store.getLinkByCode(code),
    ]);
    if (!a && !l) return code;
  }
  throw new Error("could not generate unique referral code after 5 attempts");
}

export async function enrollAffiliate(input: EnrollInput, deps: EnrollDeps): Promise<Affiliate> {
  if (!input.tos_accepted) {
    throw new Error("affiliate ToS must be accepted to enroll");
  }
  const clock = deps.clock ?? defaultClock;
  const rand = deps.random ?? Math.random;

  // Idempotent — existing rows win.
  const existing = await deps.store.getAffiliateByUserId(input.user_id);
  if (existing) return existing;

  const code = await generateReferralCode(deps.store, rand);
  const now = clock.iso();
  const id = deps.newId("affiliate");

  const a: Affiliate = {
    id,
    user_id: input.user_id,
    workspace_id: input.workspace_id ?? null,
    status: "active",
    referral_code: code,
    display_name: input.display_name ?? null,
    payout_email: input.email,
    payout_method: "paypal",
    country_iso2: input.country_iso2 ?? null,
    leaderboard_visible: true,
    attribution_model: "first_click",
    tos_accepted_at: now,
    strikes: 0,
    created_at: now,
    updated_at: now,
  };
  const inserted = await deps.store.insertAffiliate(a);

  if (deps.emit) {
    await deps.emit("affiliate_activated", {
      affiliate_id: inserted.id,
      user_id: inserted.user_id,
      activation_source: input.activation_source ?? "unknown",
    });
  }
  return inserted;
}
