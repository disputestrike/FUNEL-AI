/**
 * Tunable constants for the affiliate program.
 *
 * Per docs/16-viral-loops-spec.md §LOOP 2:
 *   - Commission rate: 40% (4000 bps) recurring lifetime
 *   - Voice overage commission: 40% (4000 bps)
 *   - Cookie window: 90 days
 *   - Payout: weekly Mon 09:00 UTC, $50 minimum, PayPal Mass Pay
 *   - Dream Car: 100/200/500 referrals → $500/$1000/$2500 monthly, paid quarterly
 *   - Refund clawback window: 30 days
 *   - Fraud strike limit: 3
 */

export const COMMISSION_RATE_BPS = 4000;            // 40%
export const VOICE_OVERAGE_RATE_BPS = 4000;         // 40%

export const COOKIE_WINDOW_DAYS = 90;
export const COOKIE_WINDOW_MS = COOKIE_WINDOW_DAYS * 24 * 60 * 60 * 1000;

export const MIN_PAYOUT_CENTS = 50_00;              // $50.00
export const PAYOUT_CRON_DOW = 1;                   // Monday
export const PAYOUT_CRON_HOUR_UTC = 9;

export const REFUND_CLAWBACK_WINDOW_DAYS = 30;
export const CHARGEBACK_STRIKES_TO_TERMINATE = 3;

export const DREAM_CAR_TIERS = [
  { tier: "t100", min_active_referrals: 100, monthly_bonus_cents: 500_00 },
  { tier: "t200", min_active_referrals: 200, monthly_bonus_cents: 1_000_00 },
  { tier: "t500", min_active_referrals: 500, monthly_bonus_cents: 2_500_00 },
] as const;

/** Referrals are "active paying" if subscription state is active or past_due < 14 days. */
export const PAST_DUE_GRACE_DAYS = 14;

/** Public leaderboard top N. */
export const LEADERBOARD_SIZE = 50;
export const LEADERBOARD_REFRESH_MS = 15 * 60 * 1000;

/** Anti-fraud thresholds. */
export const VELOCITY_SIGNUPS_24H_THRESHOLD = 50;
export const DISPOSABLE_EMAIL_DOMAINS = new Set<string>([
  "mailinator.com",
  "tempmail.com",
  "10minutemail.com",
  "yopmail.com",
  "guerrillamail.com",
  "trashmail.com",
  "throwawaymail.com",
  "fakeinbox.com",
  "maildrop.cc",
  "sharklasers.com",
  "getairmail.com",
  "dispostable.com",
]);

/** Short-link code charset/length — generated to be URL-safe + low-collision. */
export const LINK_CODE_LEN = 8;
export const LINK_CODE_CHARS = "abcdefghjkmnpqrstuvwxyz23456789"; // no l/o/0/1
