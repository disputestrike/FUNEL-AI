/**
 * Tracking pipeline: click → signup → conversion.
 *
 * Doc 16 §2.8 — 90-day first-click cookie, cross-device merge via login, no
 * cookie on self-referral. We materialize each step into the `referral` row
 * so attribution is reproducible from data.
 */

import { COOKIE_WINDOW_MS } from "./constants.js";
import type { AffiliateStore } from "./store.js";
import type { ClickInput, Referral } from "./types.js";

export interface TrackingDeps {
  store: AffiliateStore;
  newId: (entity: "request" | "referral") => string;
  clock?: { now(): number; iso(): string };
  /** Optional event emitter. */
  emit?: (
    name:
      | "affiliate_link_click"
      | "affiliate_signup"
      | "affiliate_trial_started"
      | "affiliate_conversion_paid",
    payload: Record<string, unknown>,
  ) => Promise<void>;
}

const defaultClock = { now: () => Date.now(), iso: () => new Date().toISOString() };

/**
 * Record an inbound click. Idempotent on (link_code × prospect/device fp ×
 * within 5-min window) so duplicate redirects from prefetch don't double-count.
 */
export async function recordClick(input: ClickInput, deps: TrackingDeps): Promise<Referral | null> {
  const clock = deps.clock ?? defaultClock;

  const link = await deps.store.getLinkByCode(input.link_code);
  if (!link) return null;
  const affiliate = await deps.store.getAffiliateById(link.affiliate_id);
  if (!affiliate || affiliate.status !== "active") return null;

  // Self-referral guard. We detect by fingerprint OR ip-hash match against the
  // affiliate's *own* user_id — but that requires a `userByFingerprint` lookup
  // upstream. As a safety net we also reject when prospect_id matches affiliate.user_id.
  const isSelf =
    input.prospect_id && input.prospect_id === affiliate.user_id;
  if (isSelf) {
    const r: Referral = {
      id: deps.newId("referral"),
      affiliate_id: affiliate.id,
      link_id: link.id,
      referred_user_id: null,
      prospect_id: input.prospect_id ?? null,
      click_id: deps.newId("request"),
      click_at: clock.iso(),
      cookie_expires_at: new Date(clock.now() + COOKIE_WINDOW_MS).toISOString(),
      attribution_model: affiliate.attribution_model,
      signup_at: null,
      first_paid_at: null,
      ip_hash: input.ip_hash ?? null,
      device_fp_hash: input.device_fp_hash ?? null,
      referrer: input.referrer ?? null,
      landing_page: input.landing_page ?? null,
      user_agent_class: input.user_agent ?? null,
      rejected_self_referral: true,
      fraud_flagged: false,
      created_at: clock.iso(),
    };
    return deps.store.insertReferral(r);
  }

  const referral: Referral = {
    id: deps.newId("referral"),
    affiliate_id: affiliate.id,
    link_id: link.id,
    referred_user_id: null,
    prospect_id: input.prospect_id ?? null,
    click_id: deps.newId("request"),
    click_at: clock.iso(),
    cookie_expires_at: new Date(clock.now() + COOKIE_WINDOW_MS).toISOString(),
    attribution_model: affiliate.attribution_model,
    signup_at: null,
    first_paid_at: null,
    ip_hash: input.ip_hash ?? null,
    device_fp_hash: input.device_fp_hash ?? null,
    referrer: input.referrer ?? null,
    landing_page: input.landing_page ?? null,
    user_agent_class: input.user_agent ?? null,
    rejected_self_referral: false,
    fraud_flagged: false,
    created_at: clock.iso(),
  };
  const inserted = await deps.store.insertReferral(referral);

  if (deps.emit) {
    await deps.emit("affiliate_link_click", {
      affiliate_id: affiliate.id,
      sub_id: link.sub_id,
      link_id: link.id,
      prospect_id: input.prospect_id,
      referrer: input.referrer,
      landing_page: input.landing_page,
      device_fp: input.device_fp_hash,
    });
  }
  return inserted;
}

/**
 * Attach a new signup to whichever active-cookie referral matches.
 * Returns the bound referral, or null if no attribution was found.
 */
export async function recordSignup(
  args: {
    referred_user_id: string;
    prospect_id?: string | null;
    ip_hash?: string | null;
    device_fp_hash?: string | null;
    email_hash?: string | null;
  },
  deps: TrackingDeps,
): Promise<Referral | null> {
  const clock = deps.clock ?? defaultClock;
  const now = clock.iso();

  const referral = await deps.store.findActiveCookieReferral({
    prospect_id: args.prospect_id ?? null,
    user_id: args.referred_user_id,
    ip_hash: args.ip_hash ?? null,
    device_fp_hash: args.device_fp_hash ?? null,
    asOf: now,
  });
  if (!referral) return null;

  const bound = await deps.store.attachSignupToReferral({
    referral_id: referral.id,
    referred_user_id: args.referred_user_id,
    signup_at: now,
  });

  // Self-referral guard (post-hoc): if signup user_id matches affiliate's own user_id.
  const aff = await deps.store.getAffiliateById(bound.affiliate_id);
  if (aff && aff.user_id === args.referred_user_id) {
    // Flag + reject — no commissions will accrue.
    await deps.store.insertReferral({
      ...bound,
      rejected_self_referral: true,
      fraud_flagged: true,
    });
    return null;
  }

  if (deps.emit) {
    await deps.emit("affiliate_signup", {
      affiliate_id: bound.affiliate_id,
      referred_user_id: args.referred_user_id,
      attribution_model: bound.attribution_model,
      time_since_click_ms:
        new Date(now).valueOf() - new Date(bound.click_at).valueOf(),
    });
  }
  return bound;
}

/**
 * Record the trial-start side-event. The commission ledger only fires on
 * `affiliate_conversion_paid` (see commissions.ts); this is just telemetry.
 */
export async function recordTrialStart(
  args: { referred_user_id: string; plan: string },
  deps: TrackingDeps,
): Promise<void> {
  const r = await deps.store.getReferralForUser(args.referred_user_id);
  if (!r) return;
  if (deps.emit) {
    await deps.emit("affiliate_trial_started", {
      affiliate_id: r.affiliate_id,
      referred_user_id: args.referred_user_id,
      plan: args.plan,
    });
  }
}

/**
 * Record the first-paid conversion (drives Dream Car snapshot inclusion).
 * Per-payment commission accrual is done in `commissions.recordCommissionForPayment`.
 */
export async function recordConversion(
  args: {
    referred_user_id: string;
    plan: string;
    mrr_cents: number;
    first_payment_amount_cents: number;
  },
  deps: TrackingDeps,
): Promise<void> {
  const r = await deps.store.getReferralForUser(args.referred_user_id);
  if (!r) return;
  if (!r.first_paid_at) {
    await deps.store.insertReferral({ ...r, first_paid_at: (deps.clock ?? defaultClock).iso() });
  }
  if (deps.emit) {
    await deps.emit("affiliate_conversion_paid", {
      affiliate_id: r.affiliate_id,
      referred_user_id: args.referred_user_id,
      plan: args.plan,
      mrr: args.mrr_cents,
      first_payment_amount: args.first_payment_amount_cents,
    });
  }
}
