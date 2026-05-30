/**
 * Affiliate fraud detection (Doc 16 §2.10).
 *
 * Two surfaces:
 *   1. Real-time check on each new signup/conversion (called from tracking.ts
 *      via `evaluateNewSignup`).
 *   2. Nightly cluster job (`runDailyClusterScan`) that re-evaluates each
 *      affiliate over a 30-day window.
 *
 * Severity → action mapping:
 *   - low      → log only
 *   - medium   → flag, route to T&S queue, payouts continue
 *   - high     → flag + pause payouts pending review
 *   - critical → terminate affiliate, freeze referred accounts, no payout
 */

import {
  CHARGEBACK_STRIKES_TO_TERMINATE,
  DISPOSABLE_EMAIL_DOMAINS,
  VELOCITY_SIGNUPS_24H_THRESHOLD,
} from "./constants.js";
import type { AffiliateStore } from "./store.js";
import type {
  Affiliate,
  FraudFlag,
  FraudRuleId,
  FraudSeverity,
  Referral,
} from "./types.js";

export interface FraudDeps {
  store: AffiliateStore;
  newId: (entity: "request") => string;
  clock?: { iso(): string };
  emit?: (name: "affiliate_fraud_flagged", payload: Record<string, unknown>) => Promise<void>;
}

const defaultClock = { iso: () => new Date().toISOString() };

export interface FraudCheckSubject {
  affiliate: Affiliate;
  referral: Referral;
  /** Email domain (lowercase) of the referred user. */
  email_domain?: string;
  /** Email username (lowercase) used to detect cluster patterns (bob1, bob2…). */
  email_local?: string;
  /** Card BIN of the first paid purchase, if any. */
  card_bin?: string;
  /** Affiliate's own ip_hash, for self-IP detection. */
  affiliate_ip_hash?: string;
  /** Affiliate's own device fp_hash. */
  affiliate_device_fp_hash?: string;
  /** Geo from IP at conversion time. */
  ip_country_iso2?: string;
  /** Billing country at conversion time. */
  billing_country_iso2?: string;
}

interface RuleHit {
  rule: FraudRuleId;
  severity: FraudSeverity;
  evidence: Record<string, unknown>;
  auto_action: FraudFlag["auto_action"];
}

const SEVERITY_ORDER: Record<FraudSeverity, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

export async function evaluateNewSignup(
  subject: FraudCheckSubject,
  deps: FraudDeps,
): Promise<FraudFlag[]> {
  const hits: RuleHit[] = [];

  // Rule 1: same IP / fingerprint as affiliate themself.
  if (
    subject.affiliate_ip_hash &&
    subject.referral.ip_hash === subject.affiliate_ip_hash
  ) {
    hits.push({
      rule: "same_ip",
      severity: "medium",
      evidence: { ip_hash: subject.referral.ip_hash },
      auto_action: "none",
    });
  }
  if (
    subject.affiliate_device_fp_hash &&
    subject.referral.device_fp_hash === subject.affiliate_device_fp_hash
  ) {
    hits.push({
      rule: "same_device_fingerprint",
      severity: "high",
      evidence: { device_fp_hash: subject.referral.device_fp_hash },
      auto_action: "reject_conversion",
    });
  }

  // Rule 2: velocity > 50 signups in 24h.
  const signupsLast24h = await deps.store.countSignupsLast24h(
    subject.affiliate.id,
    (deps.clock ?? defaultClock).iso(),
  );
  if (signupsLast24h > VELOCITY_SIGNUPS_24H_THRESHOLD) {
    hits.push({
      rule: "velocity_signup",
      severity: "high",
      evidence: { signups_24h: signupsLast24h, threshold: VELOCITY_SIGNUPS_24H_THRESHOLD },
      auto_action: "pause_payouts",
    });
  }

  // Rule 3: disposable email domain.
  if (subject.email_domain && DISPOSABLE_EMAIL_DOMAINS.has(subject.email_domain)) {
    hits.push({
      rule: "disposable_email",
      severity: "medium",
      evidence: { email_domain: subject.email_domain },
      auto_action: "reject_conversion",
    });
  }

  // Rule 4: geo mismatch (IP country vs billing country).
  if (
    subject.ip_country_iso2 &&
    subject.billing_country_iso2 &&
    subject.ip_country_iso2 !== subject.billing_country_iso2
  ) {
    hits.push({
      rule: "geo_mismatch",
      severity: "low",
      evidence: {
        ip_country: subject.ip_country_iso2,
        billing_country: subject.billing_country_iso2,
      },
      auto_action: "none",
    });
  }

  // Rule 5: self-referral (already enforced upstream, but double-flag if it slipped in).
  if (
    subject.referral.referred_user_id &&
    subject.referral.referred_user_id === subject.affiliate.user_id
  ) {
    hits.push({
      rule: "self_referral",
      severity: "critical",
      evidence: { referred_user_id: subject.referral.referred_user_id },
      auto_action: "reject_conversion",
    });
  }

  const flags: FraudFlag[] = [];
  for (const hit of hits) {
    const flag = await writeFlag(subject, hit, deps);
    flags.push(flag);
  }
  return flags;
}

/**
 * Nightly cluster scan — looks across the affiliate's 30-day referral window
 * for patterns no single signup can detect: card BIN clustering, email pattern
 * clusters, low distinct-IP ratios, regular inter-arrival times.
 */
export async function runDailyClusterScan(
  affiliate_id: string,
  deps: FraudDeps,
): Promise<FraudFlag[]> {
  const clock = deps.clock ?? defaultClock;
  const aff = await deps.store.getAffiliateById(affiliate_id);
  if (!aff) return [];
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const refs = await deps.store.listReferralsForAffiliateSince(affiliate_id, since);
  if (refs.length < 5) return []; // not enough signal

  const hits: RuleHit[] = [];

  // Distinct IPs / total — low ratio = bot.
  const ips = new Set(refs.map((r) => r.ip_hash).filter(Boolean));
  const ipRatio = ips.size / refs.length;
  if (ipRatio < 0.3 && refs.length >= 10) {
    hits.push({
      rule: "same_ip",
      severity: "high",
      evidence: { distinct_ips: ips.size, total_refs: refs.length, ratio: ipRatio },
      auto_action: "pause_payouts",
    });
  }
  // Distinct device fingerprints / total.
  const fps = new Set(refs.map((r) => r.device_fp_hash).filter(Boolean));
  const fpRatio = fps.size / refs.length;
  if (fpRatio < 0.3 && refs.length >= 10) {
    hits.push({
      rule: "same_device_fingerprint",
      severity: "high",
      evidence: { distinct_fps: fps.size, total_refs: refs.length, ratio: fpRatio },
      auto_action: "pause_payouts",
    });
  }
  // Regular inter-arrival pattern → likely bot.
  if (refs.length >= 20) {
    const sorted = [...refs].sort(
      (a, b) => new Date(a.click_at).valueOf() - new Date(b.click_at).valueOf(),
    );
    const deltas: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const cur = sorted[i];
      const prev = sorted[i - 1];
      if (!cur || !prev) continue;
      deltas.push(new Date(cur.click_at).valueOf() - new Date(prev.click_at).valueOf());
    }
    const mean = deltas.reduce((a, b) => a + b, 0) / deltas.length;
    const variance =
      deltas.reduce((acc, d) => acc + (d - mean) ** 2, 0) / deltas.length;
    const stddev = Math.sqrt(variance);
    const cv = mean > 0 ? stddev / mean : 0; // coefficient of variation
    if (cv < 0.2) {
      hits.push({
        rule: "velocity_signup",
        severity: "high",
        evidence: { coefficient_of_variation: cv, samples: deltas.length },
        auto_action: "pause_payouts",
      });
    }
  }

  const flagged: FraudFlag[] = [];
  for (const hit of hits) {
    const f = await writeFlag(
      { affiliate: aff, referral: refs[0]! },
      hit,
      deps,
    );
    flagged.push(f);
  }
  // If the highest hit is critical or two highs, auto-pause payouts.
  const max = hits.reduce<FraudSeverity>(
    (acc, h) => (SEVERITY_ORDER[h.severity] > SEVERITY_ORDER[acc] ? h.severity : acc),
    "low",
  );
  if (max === "critical") {
    await deps.store.updateAffiliate(affiliate_id, { status: "terminated" });
  } else if (max === "high") {
    await deps.store.updateAffiliate(affiliate_id, { status: "paused" });
  }
  return flagged;
}

/**
 * Strike management. Increments strike count and terminates at 3.
 * Used by refund + chargeback handlers in commissions.ts.
 */
export async function recordStrike(
  args: { affiliate_id: string; reason: "chargeback" | "fraud_confirmed" },
  deps: FraudDeps,
): Promise<{ strikes: number; terminated: boolean }> {
  const aff = await deps.store.getAffiliateById(args.affiliate_id);
  if (!aff) return { strikes: 0, terminated: false };
  const strikes = aff.strikes + 1;
  const terminated = strikes >= CHARGEBACK_STRIKES_TO_TERMINATE;
  await deps.store.updateAffiliate(args.affiliate_id, {
    strikes,
    status: terminated ? "terminated" : aff.status,
  });
  if (terminated && deps.emit) {
    await deps.emit("affiliate_fraud_flagged", {
      affiliate_id: args.affiliate_id,
      rule_id: args.reason === "chargeback" ? "chargeback_clawback" : "refund_clawback",
      severity: "critical",
      auto_action: "terminate",
    });
  }
  return { strikes, terminated };
}

async function writeFlag(
  subject: { affiliate: Affiliate; referral: Referral },
  hit: RuleHit,
  deps: FraudDeps,
): Promise<FraudFlag> {
  const clock = deps.clock ?? defaultClock;
  const flag: FraudFlag = {
    id: deps.newId("request"),
    affiliate_id: subject.affiliate.id,
    referral_id: subject.referral.id ?? null,
    rule_id: hit.rule,
    severity: hit.severity,
    evidence: hit.evidence,
    auto_action: hit.auto_action,
    status: "open",
    opened_at: clock.iso(),
    resolved_at: null,
  };
  const inserted = await deps.store.insertFraudFlag(flag);
  if (deps.emit) {
    await deps.emit("affiliate_fraud_flagged", {
      affiliate_id: inserted.affiliate_id,
      rule_id: inserted.rule_id,
      severity: inserted.severity,
      auto_action: inserted.auto_action,
    });
  }
  // Apply auto-action.
  if (hit.auto_action === "reject_conversion") {
    await deps.store.insertReferral({ ...subject.referral, fraud_flagged: true });
  } else if (hit.auto_action === "pause_payouts") {
    await deps.store.updateAffiliate(subject.affiliate.id, { status: "paused" });
  } else if (hit.auto_action === "terminate") {
    await deps.store.updateAffiliate(subject.affiliate.id, { status: "terminated" });
  }
  return inserted;
}
