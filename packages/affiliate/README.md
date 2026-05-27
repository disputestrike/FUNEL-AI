# @funnel/affiliate

40% recurring lifetime affiliate program for GoFunnelAI. Implements
docs/16-viral-loops-spec.md §LOOP 2.

## What it does

- **Auto-enrollment**: any GoFunnelAI user becomes an affiliate on first visit
  to `affiliate.gofunnelai.com`. No approval. Idempotent.
- **Short links**: `gofunnelai.com/r/<code>` 302s with UTM injection and a
  90-day first-click cookie. Up to 100 sub-IDs per affiliate.
- **Commission accrual**: 40% of subscription MRR and voice overages,
  recurring for the customer's lifetime. Refunds claw back. Chargebacks
  count strikes (3 → terminate).
- **Weekly payouts**: Monday 09:00 UTC via PayPal Mass Pay, $50 minimum,
  rollover otherwise. Idempotent.
- **Dream Car bonus**: 100/200/500 active-paying referrals → $500/$1000/$2500
  monthly, accrued and paid quarterly.
- **Public leaderboard**: top 50 by trailing-30d earnings, opt-out toggle,
  refreshed every 15 minutes.
- **Fraud detection**: real-time + nightly cluster scan covering same-IP,
  device fingerprint, velocity, disposable emails, geo mismatch,
  self-referral, refund/chargeback clawback.
- **Dashboard payload**: one call returns everything the affiliate UI needs.

## Wiring

```ts
import {
  enrollAffiliate,
  createLink,
  recordClick,
  recordSignup,
  recordCommissionForPayment,
  runPayouts,
  runMonthlySnapshot,
  refreshLeaderboard,
  evaluateNewSignup,
  buildDashboardStats,
  InMemoryAffiliateStore,
} from "@funnel/affiliate";
```

The package is storage-agnostic — implement `AffiliateStore` against
Postgres/Drizzle in your app. Use `InMemoryAffiliateStore` in tests.

## Events emitted

`affiliate_activated`, `affiliate_link_click`, `affiliate_signup`,
`affiliate_trial_started`, `affiliate_conversion_paid`,
`affiliate_commission_earned`, `affiliate_commission_clawed_back`,
`affiliate_payout_sent`, `affiliate_payout_failed`,
`affiliate_fraud_flagged`, `affiliate_dream_car_tier_hit`,
`affiliate_dream_car_paid`.

All optional — pass `emit` to the deps blocks if you want them. The
canonical schemas live in `@funnel/events`.

## Brand & infra

Branding is **GoFunnelAI** (single `n`). Email rails are **Resend**. Payouts
go through **PayPal Mass Pay** in Phase 1; the `PaypalMassPayAdapter`
interface lets you slot in Wise / Stripe Connect later without changing
callers.
