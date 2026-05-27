# FunelAI â€” 7 Viral Loops Operational Spec

**Document:** 16-viral-loops-spec
**Version:** 1.0
**Status:** Day 90 Launch Spec
**Owners:** Growth (loops 1, 2, 3, 7), Product (loops 4, 5), Events (loop 6), Engineering (cross-cutting infra)
**Related docs:** 03 (Event Taxonomy), 04 (Integration Matrix / PAL), 06a (Activation), 08 (Eng Ops)

---

## Overview

FunelAI's growth engine is not a single channel â€” it is **seven stacked viral loops** that compound. Each loop is designed to (a) extract value from a satisfied user and (b) feed net-new users into the top of the funnel. The loops share underlying primitives (event taxonomy, attribution, identity, payouts) so they can be built and operated as a single system.

The 7 loops:

| # | Loop | Primary mechanic | Owner |
|---|------|------------------|-------|
| 1 | "Powered by FunelAI" watermark | Embedded brand link on free funnels | Growth |
| 2 | Affiliate program | 40% recurring lifetime + Dream Car bonus | Growth |
| 3 | FunelAI Awards | Bronzeâ†’Diamond milestones + auto case studies | Growth + CS |
| 4 | Template Marketplace | Creator economy, 70/30 split | Product |
| 5 | Community + Gamified Levels | Skool â†’ native, XP + Mentor tier | Product + CS |
| 6 | FunnelCon | Annual event, awards ceremony anchor | Events |
| 7 | 7-Day Funnel Challenge | Monthly free cohort â†’ paid conversion | Growth + Content |

All loops must emit events per Doc 03 taxonomy, route attribution through the PAL (Doc 04), and respect the trust & safety guardrails in Doc 07a.

---

## LOOP 1 â€” "Powered by FunelAI" Watermark

### 1.1 Purpose

Every funnel published on the free tier carries a small, clickable badge in the footer linking back to FunelAI. This converts every published free funnel into a distribution surface. Pro Boost and paid tiers remove it; this is the primary nudge to upgrade for vanity reasons (the second-most-cited upgrade reason in CF benchmarks, after page-load speed).

### 1.2 Placement

**Where it appears:**
- Footer of every page in a free-tier published funnel (landing, optin, sales, upsell, downsell, thank-you, calendar, etc.).
- Bottom-center, ~24px from bottom edge of viewport on mobile, ~32px on desktop.
- Above any customer-set footer content (we render last, in our own slot).
- Never inside the customer's `<footer>` element â€” we render in a dedicated `<div data-funnel-watermark>` slot to prevent CSS injection from breaking it.

**Exact HTML:**

```html
<div data-funnel-watermark
     class="funnel-watermark"
     role="contentinfo"
     aria-label="Built with FunelAI">
  <a href="https://funelai.com/build-yours?utm_source=watermark&utm_medium=funnel_footer&utm_campaign=powered_by&funnel_id={{funnel_id}}&variant={{variant_id}}"
     target="_blank"
     rel="noopener"
     data-fa-event="watermark_clicked"
     data-fa-funnel-id="{{funnel_id}}"
     data-fa-variant="{{variant_id}}">
    <svg class="funnel-watermark__logo" width="16" height="16" aria-hidden="true">...</svg>
    <span class="funnel-watermark__text">Built with <strong>FunelAI</strong></span>
  </a>
</div>
```

**Exact CSS (scoped, !important to defeat customer CSS):**

```css
.funnel-watermark {
  position: relative !important;
  display: flex !important;
  justify-content: center !important;
  align-items: center !important;
  padding: 12px 16px !important;
  background: rgba(255, 255, 255, 0.96) !important;
  border-top: 1px solid rgba(0, 0, 0, 0.06) !important;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
  font-size: 12px !important;
  line-height: 1 !important;
  z-index: 2147483646 !important;
}
.funnel-watermark a {
  display: inline-flex !important;
  align-items: center !important;
  gap: 6px !important;
  color: rgba(0, 0, 0, 0.72) !important;
  text-decoration: none !important;
}
.funnel-watermark a:hover { color: rgba(0, 0, 0, 0.95) !important; }
.funnel-watermark strong { font-weight: 600 !important; }
```

Server-side, the watermark HTML is injected by the funnel renderer immediately before `</body>`. It is **not** part of the customer's editable DOM and cannot be removed via the page editor.

### 1.3 Link target

```
https://funelai.com/build-yours?utm_source=watermark&utm_medium=funnel_footer&utm_campaign=powered_by&funnel_id={funnel_id}&variant={variant_id}
```

- Landing page (`/build-yours`) is a watermark-specific landing optimized for "I just saw this on a funnel â€” what is this?" intent.
- Headline: "This funnel was built in FunelAI. Build yours in under 60 seconds â€” free."
- Hero CTA: "Generate my funnel" â†’ opens the Funnel Grader (Doc 01) pre-populated with the visited funnel's industry signal (we can infer from the referring funnel's KB pack).

### 1.4 Removal trigger

- **Free tier:** watermark always rendered. Cannot be hidden via JS, CSS overrides, or proxying (we periodically scan published URLs for tampering â€” see 1.7 Anti-tamper).
- **Pro Boost (one-time $X to remove for a single funnel):** removed from that `funnel_id` only.
- **Paid tier (Starter and above):** removed across all funnels owned by the workspace.
- Toggle is a `watermark_enabled` flag on the funnel record; flips automatically on subscription state change via a webhook from billing.
- On downgrade (paid â†’ free, or Pro Boost refund), watermark is re-enabled within 60 seconds via cache invalidation on the edge.

### 1.5 A/B test variants

Three variants assigned by `funnel_id` hash â†’ bucket. Bucket is sticky per funnel (so all visitors of a given funnel see the same variant â€” apples-to-apples).

| Variant | Copy | Visual |
|---------|------|--------|
| A (control) | "Built with **FunelAI**" | Logo + text, neutral gray |
| B (curiosity) | "How was this funnel built? â†’" | Text-only, slight underline animation on hover |
| C (social proof) | "Join 50,000+ funnels built on FunelAI" | Logo + text + counter (live count, cached 15min) |

Success metric: **watermark_signup_completed / watermark_impression** (signup-attributed CR per impression). Secondary: CTR (`watermark_clicked / watermark_impression`).

Run 60 days, min 10K impressions per variant, then promote winner and start next round. Variant ID propagates via `?variant=A|B|C` in the URL for end-to-end attribution.

### 1.6 Telemetry

Events emitted (per Doc 03):

| Event | Trigger | Properties |
|-------|---------|------------|
| `watermark_impression` | Funnel page render with watermark visible (server-side, on render) | `funnel_id`, `variant_id`, `page_type`, `viewer_session_id`, `referrer_domain` |
| `watermark_clicked` | Click on watermark link | `funnel_id`, `variant_id`, `page_type`, `viewer_session_id`, `click_timestamp` |
| `watermark_landing_viewed` | `/build-yours` page view with watermark UTMs | inherits + `landing_session_id` |
| `watermark_signup_started` | Grader started from watermark landing | + `prospect_id` |
| `watermark_signup_completed` | Account created with watermark UTMs in attribution chain (90-day cookie) | + `user_id`, `time_to_signup_ms` |
| `watermark_signup_paid` | Watermark-attributed user converts to paid | + `plan`, `mrr` |

All events land in the event bus per Doc 03; attribution stitching done in PAL (Doc 04).

### 1.7 Measurement & ops

- **Monthly review:** signups attributable to watermark, paid conversions, MRR generated, $ saved vs paid CAC equivalent.
- **Dashboard:** `growth/watermark` â€” impressions, CTR, signup CR, paid CR, MRR contribution, per variant.
- **Anti-tamper job:** daily crawler hits a sample of 1,000 published free-tier funnels, runs headless Chromium, asserts watermark DOM is present and link is unmodified. On failure â†’ flag the workspace, alert T&S, force re-publish.
- **Tier gate:** anti-tamper job ignores Pro Boost / paid funnels.

### 1.8 Engineering spec

- Renderer service injects watermark HTML during SSR; cached at edge with `watermark_enabled` as a cache key dimension.
- Edge cache TTL: 60s on free funnels (to make removal-on-upgrade fast).
- Billing webhook â†’ funnel rendering service: `workspace.subscription.updated` â†’ invalidate edge cache for all `funnel_id` in workspace.
- Click tracking: standard `data-fa-event` pixel + redirect tracker on `funelai.com/r/watermark/...` (also enables click counts without JS).

---

## LOOP 2 â€” Affiliate Program (40% Recurring Lifetime)

### 2.1 Eligibility & onboarding

- **Open to:** any authenticated FunelAI user (free or paid). No application, no approval â€” automatically eligible on account creation.
- **Activation:** user visits `app.funelai.com/affiliate` â†’ accepts affiliate ToS â†’ unique referral link issued.
- **Onboarding kit** (delivered on activation):
  - 30-minute video: "How to promote FunelAI" (founder-hosted, covers positioning, hooks that work, what NOT to do per AUP)
  - 7-day email sequence with promotion playbooks (organic post templates, YouTube script templates, paid ad angles)
  - Social asset library: 50+ images, 20 short-form video templates, banner sets in 6 sizes, demo GIFs, comparison charts (FunelAI vs CF/HighLevel/GoHighLevel)
  - Pre-built "swipe file" of high-converting copy (compliant with our AUP â€” no income claims, no medical/financial language)

### 2.2 Commission structure

- **40% of subscription MRR for the lifetime of the customer.** Recurring monthly as long as the referred customer is paying. Tied to the customer, not the time window.
- **40% of voice minute overages** (RevTry overages are a meaningful revenue line; affiliates earn on those too).
- **No commission on:** Pro Boost one-time charges (too small, fraud-prone), refunds, chargebacks, taxes, processing fees.
- **No tiers, no MLM.** Flat 40% for everyone. We avoid multi-level on purpose.

### 2.3 Payout

- **Frequency:** weekly, every Monday, for the prior week's earned commissions.
- **Method:** PayPal Mass Pay (Phase 1). Wise + Stripe Connect added Q2.
- **Minimum payout:** $50. Balances below $50 roll forward.
- **Holding period:** none. We pay immediately and eat the chargeback risk.
- **Clawback:** if a referred customer refunds within 30 days, that commission is reversed from the affiliate's next payout (or balance, if positive).
- **Tax forms:** 1099-NEC issued in January for any US affiliate over $600 lifetime. W-9 collected on first $600 threshold via Stripe Tax / equivalent.

### 2.4 Dream Car bonus

Quarterly bonus paid in addition to commissions. Designed as a viral aspirational hook (the $500/mo car payment is iconic in the CF playbook).

| Active paying referrals | Monthly bonus | Paid quarterly |
|------|------|------|
| 100 | $500 | $1,500/quarter |
| 200 | $1,000 | $3,000/quarter |
| 500 | $2,500 | $7,500/quarter |

- "Active paying" = referred customer's subscription is in `active` or `past_due < 14 days` state on the bonus evaluation date.
- Evaluation: monthly snapshot on the 1st. If snapshot count meets threshold â†’ that month's bonus accrues. Quarterly payout on the 5th business day of Apr/Jul/Oct/Jan.
- **Auto-pause:** if active referrals drop below threshold on any monthly snapshot, that month's bonus is not earned. Bonus auto-resumes the next month they cross threshold.
- Bonus is **paid as a cash bonus** via the same payout rail â€” we don't lease a car for them; they choose.
- Eligibility for higher tier is **strict** (501 referrals = $2,500 tier, not stacked).
- Anti-gaming: bonus only counts referrals that are paying customers themselves and have NOT been auto-flagged by fraud detection.

### 2.5 Public leaderboard

- Public page: `funelai.com/affiliates/leaderboard`
- Shows **top 50 affiliates** by trailing 30-day commission earned.
- Columns: rank, display name (affiliate-chosen), avatar, country (optional), trailing-30 commission, total lifetime commission, active referrals.
- **Opt-out:** affiliate dashboard has "Hide me from public leaderboard" toggle. Hidden affiliates still see their rank privately.
- Updated every 15 minutes.
- Anti-doxxing: country shown only at country level, no city. No revenue from individual referred customers exposed.

### 2.6 Affiliate dashboard

`app.funelai.com/affiliate` â€” single page, components:

- **My link** (with copy button, QR code, short URL generator for sub-campaigns)
- **Sub-campaign links** (affiliate can append `?sub=yt-video-1` to track per-channel performance; up to 100 sub-IDs)
- **Funnel** (the affiliate can build a FunelAI funnel that sells FunelAI â€” meta loop, see 2.8)
- **Stats panel:** clicks, signups, trial starts, paid conversions, churned, active referrals, MRR generated, commission earned (this month, lifetime), commission paid (this month, lifetime), next payout date & amount
- **Referrals table:** rows of referred customers (anonymized as "Customer A4FB"), signup date, current status, MRR, your commission, status (active/churned/refunded)
- **Payouts table:** date, amount, method, status, transaction ID
- **Leaderboard rank** (current rank + delta vs last week)
- **Dream Car tracker:** active paying referrals count + progress bar to next tier
- **Resources tab:** onboarding video, swipe file, social assets, brand guidelines
- **Fraud flags** (if any): notice that account is under review with self-serve appeal flow

### 2.7 Affiliate funnels (meta loop)

Affiliates can use FunelAI itself to build the funnel that sells FunelAI. We provide:
- A pre-built "Affiliate Promo Funnel" template (free, in their workspace on affiliate activation)
- Pre-written copy variants tied to industries (solar, real estate, agency, coach, ecom)
- Their referral link auto-injected on every CTA button on the template
- Conversion events from these funnels are counted against their affiliate stats

This is high leverage: the best affiliates ship a FunelAI funnel that markets FunelAI, with their tracking baked in. Eats own dogfood publicly.

### 2.8 Cookie window & attribution

- **Cookie window: 90 days** (deliberately longer than ClickFunnels' 30 days â€” a competitive differentiator we advertise).
- **First-click attribution** by default. Affiliate can opt their links into last-click via dashboard if they prefer (industry-flexible).
- **Cross-device:** stitched via login-time identity merge. If a visitor clicks an affiliate link, the affiliate cookie is associated with their `prospect_id`. On signup â†’ `user_id` merged. If the same user later signs up on a different device, the merge happens server-side via email match.
- **Tie-breakers** (multiple affiliates in window): first-click wins by default. Audit log retained for disputes.
- **Self-attribution prevention:** if an affiliate clicks their own link, no cookie set. Detection: same `user_id` logged-in or device-fingerprint match.

### 2.9 Multi-tier

**No multi-tier.** Single-level only. We do not want MLM perception or regulatory exposure. This is a competitive choice â€” clearly documented in affiliate ToS.

### 2.10 Fraud rules

Detection runs as a daily job and a real-time stream:

| Rule | Action |
|------|--------|
| Same IP between affiliate and referred customer at signup | Flag for human review |
| Same device fingerprint (FingerprintJS or similar) | Auto-reject conversion |
| Velocity: >50 signups in 24h from one affiliate | Pause payouts, manual review |
| Email pattern: disposable domains (mailinator, etc.) | Auto-reject conversion |
| Email pattern: high similarity within a cluster (e.g., `bob1@`, `bob2@`, `bob3@`) | Flag |
| Card BIN clustering (same first 6 digits across many referred customers) | Flag |
| Geo mismatch (IP country â‰  billing country, repeated) | Flag |
| Self-referral (affiliate's own email or known alt-emails) | Auto-reject |
| Refund clawback | Auto-reverse commission |
| Chargeback | Auto-reverse commission + 1-strike warning |
| 3 strikes (chargebacks or fraud confirmations) | Affiliate account terminated, unpaid balance forfeited per ToS |

All fraud actions are logged with `affiliate_fraud_flagged` event including `rule_id`, `severity`, `auto_action`.

Appeal process: affiliate can submit an appeal via dashboard within 30 days. Reviewed by T&S team within 5 business days.

### 2.11 Telemetry

| Event | Properties |
|-------|------------|
| `affiliate_activated` | `affiliate_id`, `user_id`, `activation_source` |
| `affiliate_link_click` | `affiliate_id`, `sub_id`, `link_id`, `prospect_id`, `referrer`, `landing_page`, `device_fp` |
| `affiliate_signup` | `affiliate_id`, `referred_user_id`, `attribution_model`, `time_since_click_ms` |
| `affiliate_trial_started` | `affiliate_id`, `referred_user_id`, `plan` |
| `affiliate_conversion_paid` | `affiliate_id`, `referred_user_id`, `plan`, `mrr`, `first_payment_amount` |
| `affiliate_commission_earned` | `affiliate_id`, `referred_user_id`, `period`, `amount`, `commission_type` (subscription/overage) |
| `affiliate_commission_clawed_back` | `affiliate_id`, `referred_user_id`, `amount`, `reason` (refund/chargeback) |
| `affiliate_payout_sent` | `affiliate_id`, `amount`, `method`, `transaction_id`, `period` |
| `affiliate_payout_failed` | `affiliate_id`, `amount`, `error_code` |
| `affiliate_fraud_flagged` | `affiliate_id`, `rule_id`, `severity`, `auto_action` |
| `affiliate_dream_car_tier_hit` | `affiliate_id`, `tier`, `active_referrals`, `bonus_amount` |
| `affiliate_dream_car_paid` | `affiliate_id`, `quarter`, `amount` |

### 2.12 Engineering spec

**Core services:**
1. **Short link service** (`funelai.com/r/<code>`): 302 redirects + UTM injection + cookie set + click event emission. Hosted on edge for <50ms p95.
2. **Attribution service:** ingests click â†’ signup â†’ conversion chain; computes attribution per Doc 04 PAL; idempotent on `affiliate_id Ã— referred_user_id`.
3. **Commission ledger:** double-entry ledger (debit: affiliate_payable, credit: revenue_share). Every commission, clawback, and payout is a journal entry. Source of truth for all dashboards and payouts.
4. **Payout job:** cron weekly (Mon 09:00 UTC). Aggregates earned commissions for prior week â†’ minimum threshold check â†’ calls PayPal Mass Pay API â†’ emits `affiliate_payout_sent` / `affiliate_payout_failed`. Retries 3x with backoff on transient failures.
5. **Fraud detection job:** daily cron + real-time stream listener on `affiliate_signup` and `affiliate_conversion_paid`. Writes flags to a moderation queue (Doc 07b).
6. **Dream Car job:** monthly cron on day 1 (00:30 UTC); snapshots active paying referrals per affiliate; quarterly aggregator runs on the 5th business day of quarter close.
7. **Leaderboard job:** every 15 minutes, materialized view refresh, cached to CDN.

**Data model (simplified):**

```
affiliate { id, user_id, status, created_at, payout_email, country, leaderboard_visible }
affiliate_link { id, affiliate_id, code, sub_id, created_at }
affiliate_attribution { affiliate_id, referred_user_id, click_id, model, created_at }
commission_event { id, affiliate_id, referred_user_id, type, amount, period, status, ledger_entry_id }
payout { id, affiliate_id, period, amount, method, status, txn_id }
fraud_flag { id, affiliate_id, rule_id, severity, status, opened_at, resolved_at }
dream_car_snapshot { affiliate_id, month, active_paying_referrals, tier, bonus_amount }
```

---

## LOOP 3 â€” FunelAI Awards (Bronze â†’ Diamond)

### 3.1 Tier definitions

Awards are based on **revenue attributed to a funnel** â€” the gross revenue collected through Stripe/PayPal integrations on that funnel's checkout/payment pages, lifetime-cumulative per funnel.

| Tier | Revenue threshold | Award |
|------|------|------|
| Bronze | $10,000 | Digital badge + announce templates |
| Silver | $100,000 | Digital badge + physical certificate ($25 cost) |
| Gold | $1,000,000 | Physical plaque ($150 cost) + featured customer story |
| Platinum | $10,000,000 | Large plaque + FunnelCon mainstage invite + book feature |
| Diamond | $100,000,000 | Crystal trophy + advisory board seat + lifetime Agency tier |

Tier is per funnel, not per workspace. A workspace with 3 Bronze funnels gets 3 Bronze awards (different funnels, different stories).

### 3.2 Tracking

- Revenue source: `payment.captured` events from the customer-payment lifecycle (Doc 04), filtered to `funnel_id`.
- Currency: normalized to USD at capture time (FX rate from Stripe / PayPal). Refunds subtracted. Chargebacks subtracted.
- Recurring revenue counted: yes, monthly captures from subscription products sold via the funnel count cumulatively.
- Test-mode payments excluded.
- Internal/employee accounts excluded (allow-list scrub).

### 3.3 Award delivery workflow

**Bronze ($10K):**
- Trigger: `milestone_hit` event with `tier=bronze`.
- Auto-actions:
  - Generate digital badge SVG + PNG (1080x1080, 1200x630, square + LinkedIn formats)
  - Email to workspace owner: "You just hit $10K â€” congrats. Here's your Bronze badge."
  - In-app modal celebration with confetti + share buttons
  - Pre-filled tweet/LinkedIn/IG post templates with badge image attached
  - Case study landing page auto-generated (see 3.4)

**Silver ($100K):**
- All Bronze actions, plus:
  - Trigger fulfillment: certificate (custom-printed via print-on-demand partner, e.g., Printful)
  - Mailing address collection in-app (if not already collected)
  - Shipped within 10 business days
  - Cost: ~$25 all-in

**Gold ($1M):**
- All Silver actions, plus:
  - Trigger fulfillment: physical plaque (engraved, ~$150 all-in)
  - CS team manually reaches out for "featured customer story" â€” written profile, photo shoot or video interview (remote)
  - Story published on `funelai.com/customers/[slug]`
  - Promo across our channels (newsletter, social, podcast feature if available)

**Platinum ($10M):**
- All Gold actions, plus:
  - Larger plaque (~$400)
  - FunnelCon mainstage speaker invitation (we cover travel + accommodations)
  - Inclusion in founder's book (Year 2+)

**Diamond ($100M):**
- All Platinum actions, plus:
  - Crystal trophy (~$1,500)
  - Personal call from founder
  - Advisory board seat (quarterly meetings, equity grant TBD)
  - Lifetime Agency tier comped (highest tier, all features)

### 3.4 Auto-generated case study page

**URL:** `funelai.com/wins/[customer-slug]` where slug = `<first-name>-<industry>-<tier>` (e.g., `sarah-solar-gold`). Collisions resolved with numeric suffix.

**Content (auto-rendered from data + customer-prompted fields):**

- Hero: customer name + photo (or industry-generic image) + tier badge
- Stat block: revenue milestone, time-to-milestone, leads generated, conversion rate
- Funnel section: the funnel they used (rendered as anonymized clone â€” copy intact, branding/PII scrubbed)
- "What worked" section: top-performing hooks, offers, ad creatives (auto-extracted from their funnel's analytics, customer can edit)
- Testimonial: customer-submitted quote (we auto-prompt for it on milestone hit; if not provided, page uses a generic "Built with FunelAI" line and prompts the visitor to come back)
- "Try this funnel" CTA: clone the funnel into the visitor's workspace as a template (gated to signed-in users, drives signups)
- "Build your own" CTA â†’ Grader (Doc 01)
- FunelAI branding header and footer

**Sharing:** auto-generated OG image (1200x630 with milestone amount overlay), pre-filled share posts to LinkedIn / X / FB. Customers are encouraged in the milestone email to share the page with their audience â€” driving FunelAI-branded traffic.

**SEO:** every case study page is indexed. Sitemap auto-updated. Schema.org `Review` + `Product` markup. Internal links from `funelai.com/wins` hub.

**Privacy:** customer must approve the page going public. Default state is "draft, visible only to you." One-click "Make public" CTA. Customers can also redact / customize before publishing. Customer can take page down at any time (link returns 410 Gone).

### 3.5 Public Hall of Fame

- `funelai.com/wins` â€” chronological feed of published wins pages, filterable by tier and industry.
- Tier counters at the top: "23 Diamond, 187 Platinum, 1,200 Gold, ..."
- Internal SEO juice + social proof for prospect visits + ongoing share fuel.

### 3.6 Telemetry

| Event | Properties |
|-------|------------|
| `milestone_hit` | `funnel_id`, `workspace_id`, `tier`, `revenue_cumulative_usd`, `time_to_milestone_days` |
| `case_study_generated` | `funnel_id`, `case_study_slug`, `status` (draft/public) |
| `case_study_published` | `case_study_slug`, `published_by`, `published_at` |
| `case_study_viewed` | `case_study_slug`, `viewer_session_id`, `referrer` |
| `case_study_shared` | `case_study_slug`, `channel`, `shared_by` |
| `award_shipped` | `tier`, `workspace_id`, `tracking_number`, `carrier` |
| `award_delivered` | `tier`, `workspace_id`, `delivered_at` |
| `customer_shared_case_study` | `case_study_slug`, `channel`, `external_url` (if detectable) |

### 3.7 Engineering spec

- **Payment ingest:** Stripe + PayPal webhooks land in payment events stream. Per-funnel aggregator service maintains rolling `revenue_cumulative_usd` per `funnel_id` in a fast KV (Redis) and durable store (Postgres).
- **Milestone detector:** stream consumer; on each payment event, checks if cumulative just crossed any tier threshold; if so emits `milestone_hit`. Idempotent (no double-emit on replays).
- **Workflow engine:** receives `milestone_hit` â†’ routes to tier-specific workflow (digital-only / digital+print / digital+print+CS-task).
- **Case study page generator:** Lambda-style job; pulls funnel data, anonymizes, renders MDX, deploys to static hosting; auto-PRs to a CMS-backed wins catalog.
- **Fulfillment integration:** Printful / Sticker Mule / engraving-shop APIs for physical award production + shipment. Status webhooks back into `award_shipped` and `award_delivered`.
- **Anonymization scrubber:** PII filter (names, emails, phone numbers, address, payment data) before publishing any customer funnel as case-study content.

---

## LOOP 4 â€” Template Marketplace

### 4.1 Mechanics

Top-performing funnels can be published as paid templates. A creator economy with quality gates and revenue sharing.

### 4.2 Quality gates

- Funnel must have hit **Bronze ($10K through funnel)** before it can be published as a paid template. Free templates allowed without gating but reviewed for spam.
- Funnel author must have a verified FunelAI account in good standing (no T&S strikes in last 90 days).
- Template must pass automated checks: no broken links, no test content, no PII, no AUP violations.
- Manual review by content ops team before paid templates go live (target: 48-hour SLA).

### 4.3 Revenue share

- **Creator: 70%, FunelAI: 30%** of net revenue (after payment processing fees).
- Paid out monthly to creator's payout email, same payout rail as affiliate program (Loop 2).
- Refunds clawed back from creator's next payout.
- Min payout threshold: $25.

### 4.4 Pricing

- Creator sets price within validated tiers: **$9, $19, $29, $49, $79, $99**.
- Platform may suggest a price based on funnel complexity + benchmark data (advisory only).
- Tier dropdown only â€” no arbitrary amounts.
- Free templates allowed (Creator earns 0$ but builds reputation & marketplace presence).

### 4.5 Template package

A published template includes:
- Full funnel JSON (pages, components, settings, navigation)
- All assets (images, video URLs, downloadable resources) â€” hosted on our CDN, license terms attached
- Email sequences (subject, body, send timing)
- SMS sequences (body, send timing, opt-in/opt-out flow)
- Voice script (RevTry bot script â€” but with placeholder for receiving workspace's voice/persona settings)
- Ad creative variants (headlines, descriptions, primary text, image specs)
- Tracking events & pixels (re-keyed to buyer's workspace on clone)
- KB pack reference (if industry-specific â€” Doc 02a)

### 4.6 Buyer experience

- Marketplace at `funelai.com/marketplace` and `app.funelai.com/marketplace` (signed-in view has clone CTA).
- Browse by category (Industry, Goal, Price), filter, sort by popularity / rating / recent.
- Template detail page: preview funnel (live, sandboxed render), screenshots, stats (anonymized: e.g., "averaged 4.2% CR across creator's deployments"), reviews, creator profile.
- **One-click clone:** "Clone to my workspace" â†’ confirms, pays, clones the entire package into buyer's workspace as a draft. Buyer customizes before publishing.
- Cloned funnel inherits a `template_parent_id` so we can track template-derived funnel performance.

### 4.7 Marketplace SEO

- Every template gets a dedicated, indexable page: `funelai.com/marketplace/<slug>`.
- Schema.org `Product` markup, rich snippets.
- Internal links from category pages and creator pages.
- Sitemap auto-updates daily.
- Target: thousands of pages indexed within 12 months, capturing long-tail funnel-template search intent.

### 4.8 Creator dashboard

`app.funelai.com/marketplace/creator`:
- Templates owned (draft / in-review / published / paused)
- Sales: count, revenue, refunds, net, payout next date
- Per-template stats: views, conversion to purchase, refund rate, avg rating
- Reviews (sortable, with reply capability)
- Payouts table
- Edit / unpublish controls

### 4.9 Reviews

- 5-star rating + comment, only from verified purchasers.
- Buyer must have cloned the template at least 7 days prior (filter out instant-rage reviews).
- Reviews moderated: profanity filter + manual review on flag.
- Creator can reply once per review.
- FunelAI can hide reviews that violate content guidelines (transparent â€” replaced with "Review removed: violates community standards").

### 4.10 Categories

- **By industry** (30 industries â€” mirrors community hubs): solar, real estate, fitness, coaching, e-commerce, agency, info products, SaaS, etc.
- **By goal:** lead generation, webinar registration, product launch, evergreen sales, application funnel, high-ticket sales, ecom DTC, course launch.
- **By price tier:** Free, $9-$29, $29-$79, $79-$99.

### 4.11 Telemetry

| Event | Properties |
|-------|------------|
| `template_published` | `template_id`, `creator_id`, `price`, `category`, `funnel_parent_id` |
| `template_viewed` | `template_id`, `viewer_session_id`, `referrer` |
| `template_purchased` | `template_id`, `buyer_user_id`, `creator_id`, `price`, `payment_id` |
| `template_cloned` | `template_id`, `buyer_user_id`, `new_funnel_id` |
| `template_reviewed` | `template_id`, `reviewer_user_id`, `stars`, `has_comment` |
| `template_review_flagged` | `template_id`, `review_id`, `flagger_user_id`, `reason` |
| `template_refunded` | `template_id`, `buyer_user_id`, `amount`, `reason` |

### 4.12 Anti-fraud

- **Prevent self-buying:** payment user_id â‰  template creator_id; same device fingerprint rejected.
- **Prevent review manipulation:**
  - Only verified purchasers can review.
  - One review per purchaser per template (overwrites prior).
  - Velocity rule: more than 10 5-star reviews in 24h on one template from new accounts â†’ flag.
  - Network detection: reviews from accounts that share IPs / fingerprints with the creator â†’ auto-rejected.
- **Refund abuse:** if a buyer refunds + clones + uses â†’ mark account as abuse, restrict future purchases.

### 4.13 Engineering spec

- Template package = signed JSON blob in object storage + manifest in Postgres.
- Clone operation = deep copy + re-keying of all IDs (funnel_id, page_ids, event pixels) + asset re-hosting under buyer's workspace.
- Payment via Stripe Checkout, immediate clone on `payment.captured`.
- Creator payouts: same payout job as affiliate (Loop 2), separate ledger account.

---

## LOOP 5 â€” Community + Gamified Levels

### 5.1 Platform plan

- **Months 1â€“6:** Hosted on **Skool** (faster time-to-market, proven engagement primitives). Custom branding + domain `community.funelai.com`. XP and levels managed via Skool's native gamification + supplemented by our own dashboards.
- **Months 6â€“18:** Migrate to **native** community (architecture per Doc 16 â€” assume forum + chat + events surface, owned by us). Reasoning: data ownership, deep product integration (XP tied to in-product events), AI features (auto-summarization, mentor matching).
- Migration plan: dual-running for 90 days, with content / member auto-export and onboarding nudges. SSO via FunelAI login from day 1 so transition is seamless.

### 5.2 Hubs

- **30 industry hubs**: solar, real estate, fitness, coaching, agency, e-commerce, info products, SaaS, dentistry, chiropractic, med spa, law firm, accounting, financial advisor, mortgage, insurance, HVAC, plumbing, roofing, pest control, pool service, landscaping, cleaning, auto detailing, automotive sales, RV/boat, home services general, B2B services general, B2C services general, nonprofit. (Final list reviewed quarterly.)
- **5 stage hubs**: `<$10K MRR`, `$10Kâ€“$100K MRR`, `$100Kâ€“$1M MRR`, `$1Mâ€“$10M MRR`, `$10M+ MRR`. Membership gated by self-attestation + (eventually) verified revenue via funnel attribution.
- Members can join multiple hubs.

### 5.3 XP rules

| Action | XP |
|--------|----|
| Ship a funnel (publish) | 10 |
| First lead through a funnel | 50 |
| First $1K revenue through a funnel | 200 |
| Upvoted answer (per upvote) | 5 |
| Mentor a newcomer to their first lead (Mentor + mentee's `first_lead` event) | 100 |
| Win monthly community challenge | 500 |
| Get featured (case study, podcast, etc.) | 250 |

Anti-farming: max +50 XP/day from upvotes alone. Mentor XP requires verified mentor-mentee link via in-product matching (not self-claimed).

### 5.4 Levels & unlocks

| Level | XP threshold (cumulative) | Unlocks |
|-------|------|------|
| L1 | 0 | Basic access, post in industry/stage hubs |
| L2 | 100 | Same + reactions |
| L3 | 300 | Same + DMs |
| L4 | 600 | Monthly community office hours, post in #wins channel |
| L5 | 1,000 | Same + custom flair |
| L6 | 2,000 | Same + ability to start hub events |
| L7 | 4,000 | **Mentor** tag, auto-paired with new users, earns XP from mentees |
| L8 | 7,500 | Beta feature access, early KB pack access |
| L9 | 12,000 | Private Slack-style channels with other L9+ |
| L10 | 20,000 | **Founder's personal Slack + lifetime Scale tier comp** |

L10 is intentionally hard â€” designed as a multi-year goal for the most engaged builders.

### 5.5 Daily themed threads

Auto-posted by a community bot at 09:00 local-to-hub time (US default Eastern):

- **Monday:** Question Mon â€” "Drop your biggest funnel question this week."
- **Tuesday:** AMA Tue â€” guest expert AMA (rotating, see ops calendar).
- **Wednesday:** Win Wed â€” "Share a win, big or small."
- **Thursday:** Tactic Thu â€” "Drop one tactic that's working right now."
- **Friday:** Fail Fri â€” "Share a fail and what you learned."
- **Saturday:** Show-Off Sat â€” "Drop a funnel screenshot, get feedback."
- **Sunday:** Sunday Setup â€” "What are you building this week?"

Each thread auto-pinned for 24h, then unpinned and surfaces in feed for 7 days. Engagement on themed threads earns 2Ã— XP for the first 24h.

### 5.6 Mentor matching

L7+ users opt into Mentor program â†’ eligible to be auto-matched.

**Matching algorithm:**
- New user signup â†’ wait 7 days (mentees who churn early aren't worth matching).
- On day 7, compute match score for each available Mentor:
  - Industry match: +50
  - Geo match (same country): +20, same region: +10
  - Stage match: +30 (Mentor must be at least one stage above mentee)
  - Mentor load: -10 per current active mentee (cap 5)
  - Mentor freshness: +20 if no active mentee, decay over time
- Top match invited via DM with prompt. If decline within 48h â†’ next match.
- Mentor / mentee can end relationship anytime. Mentor earns XP when mentee hits `first_lead`.

### 5.7 Monthly Funnel Games

- Format: themed challenge each month (e.g., "Highest CR on a webinar funnel," "Most leads from a single ad spend < $500"). Theme rotates and ties to a community vote.
- Prizes (escalating with community size):
  - Bronze month (early community): $5K total â€” 1st $2.5K, 2nd $1.5K, 3rd $1K
  - Gold month (mature community): $25K total â€” 1st $10K, 2nd $7K, 3rd $5K, 4th-10th $3K split
- Eligibility: community member L4+ at month start.
- Verification: funnel must be live, results verified via funnel analytics + payment integration data.
- Winners announced live in monthly office hours + featured in newsletter + case study auto-generated (Loop 3 integration).

### 5.8 Retention thesis

Community is not a direct viral loop â€” it's a retention multiplier. Internal model assumes **2â€“3Ã— LTV** for community-active members vs non-active. Mechanism: peers help with funnel iteration, accountability for shipping, identity ("I'm a FunelAI builder"), and pre-emptive answers to questions that would otherwise drive churn.

### 5.9 Telemetry

| Event | Properties |
|-------|------------|
| `community_member_joined` | `user_id`, `platform` (skool/native), `hubs[]` |
| `xp_earned` | `user_id`, `amount`, `source`, `source_id` |
| `level_up` | `user_id`, `from_level`, `to_level` |
| `post_created` | `user_id`, `hub_id`, `post_id`, `thread_type` |
| `post_reacted` | `user_id`, `post_id`, `reaction` |
| `comment_upvoted` | `user_id`, `comment_id`, `voter_id` |
| `mentor_matched` | `mentor_id`, `mentee_id`, `match_score` |
| `mentor_relationship_ended` | `mentor_id`, `mentee_id`, `duration_days`, `ended_by` |
| `mentee_first_lead` | `mentor_id`, `mentee_id` (triggers mentor XP) |
| `challenge_participated` | `user_id`, `challenge_id` |
| `challenge_won` | `user_id`, `challenge_id`, `rank`, `prize_amount` |
| `office_hours_attended` | `user_id`, `session_id`, `duration_minutes` |

---

## LOOP 6 â€” FunnelCon Annual Event

### 6.1 Three-year arc

| Year | Month | Attendees | Ticket | Revenue goal | Strategic goal |
|------|------|------|------|------|------|
| Year 1 | M12 | 300 | $497 | Breakeven (~$150K rev offset by ~$150K costs) | Prove concept, capture testimonials |
| Year 2 | M24 | 1,500 | $997 | $1.5M rev + retention spike | Establish as flagship event |
| Year 3 | M36 | 5,000 | $1,997 | $10M+ rev | Industry-defining event |

### 6.2 Format

- **3 days, in-person.** Live-stream tier available Year 2+ ($297) as upsell + reach.
- **Day 1:** Founder mainstage keynote + state-of-Funnel + Awards ceremony (Bronze/Silver â€” high-volume tiers, lots of names on screen).
- **Day 2:** Mainstage customer-story sessions + industry breakouts + workshops + Awards (Gold tier).
- **Day 3:** Mainstage guest keynote (Y2+) + Platinum + Diamond ceremony + closing party.

### 6.3 Programming

- **Mainstage:** founder, top customer-story speakers, marquee guest (Y2+).
- **Breakouts:** by industry, 6 industries x 4 sessions = 24 breakouts. Run by community Mentor-tier members + invited experts.
- **Workshops:** 12 hands-on (FunelAI feature deep-dives, RevTry voice configuration, KB pack engineering, ad creative).
- **Agency owners track:** scaling teams, hiring, white-label, enterprise sales.
- **Solopreneur track:** automation, time leverage, going from $10K â†’ $100K â†’ $1M.

### 6.4 Awards ceremony

- Headline anchor of the event. Bronze/Silver run as scroll-tape with hundreds of names; Gold + Platinum + Diamond winners brought on stage individually.
- Diamond presentation by founder personally.
- Streamed and clip-able (every winner gets a 30-sec on-stage clip emailed within 24h for sharing â†’ fuels Loop 3 case study traffic).

### 6.5 Speakers

- Year 1: founder + 5 customer stories + 3 industry experts (paid honorarium or comp tickets).
- Year 2+: add keynote from Hormozi / Brunson-alumnus / Stape / category-defining operator. Budget $50Kâ€“$250K for marquee.
- Speaker recruitment starts Month 6.

### 6.6 Pre-conference challenge

- **7-Day Funnel Challenge (Loop 7)** kicks off virtually the week before FunnelCon.
- Cohort winners revealed on FunnelCon day 1 mainstage â†’ drives attendance, drives pre-event engagement, drives upgrade conversions during the event.

### 6.7 Logistics

- Venue scouting: Month 6.
- Recommended Year 1: 500-cap ballroom in Austin / Nashville / Phoenix (cost-effective, easy travel).
- Year 2: 2,000-cap convention venue.
- Year 3: 6,000-cap major venue (LA, Vegas, Orlando).
- Hotel partner negotiated for discounted block.
- AV: full A/V vendor with run-of-show.
- Recording: every mainstage session captured for replay (post-event upsell, evergreen content for socials).

### 6.8 Marketing

- 6-month build cadence:
  - M-6: Announcement + early-bird ($297 for 100 tickets)
  - M-5 to M-3: Speaker reveals weekly
  - M-3 to M-1: Customer-story trailers, FOMO content
  - M-1: Final-call urgency
- Founder content drumbeat: weekly content asset (podcast appearance, Twitter thread, YouTube video).
- Year 1 attendees become testimonial engine for Year 2 â€” every Y1 ticket includes consent to use clip in Y2 marketing.

### 6.9 Telemetry

| Event | Properties |
|-------|------------|
| `funnelcon_landing_viewed` | `viewer_session_id`, `referrer` |
| `ticket_purchased` | `user_id`, `tier` (early-bird/standard/livestream/VIP), `amount`, `year` |
| `ticket_refunded` | `user_id`, `amount`, `reason` |
| `attendee_checked_in` | `user_id`, `arrival_day` |
| `session_attended` | `user_id`, `session_id`, `duration_minutes` |
| `networking_match_made` | `user_a`, `user_b`, `match_source` (industry-hub/serendipity/app) |
| `award_received_onstage` | `user_id`, `tier` |
| `post_event_survey_submitted` | `user_id`, `nps`, `would_attend_again` |

---

## LOOP 7 â€” 7-Day Funnel Challenge (Monthly)

### 7.1 Format

- **Free.** Anyone can join (no FunelAI account required to enroll â€” account auto-created on Day 2 when they generate their funnel).
- **Cohort-based** â€” monthly cohorts of 5,000â€“10,000 at scale (Year 1 cohorts begin smaller, 500â€“2,000).
- **Gamified** â€” cohort dashboard, leaderboards, public wins, completion certificate.
- **Goal:** ship a profitable funnel in 7 days (or at minimum, ship a funnel and get the first lead).

### 7.2 Daily curriculum

Each day: a founder-hosted video (10â€“20 min) + a daily task + a community drop.

| Day | Theme | Task |
|-----|-------|------|
| 1 | Define your offer | Write your offer in 1 sentence, share in community thread |
| 2 | Generate your funnel | Use FunelAI Grader â†’ generate funnel â†’ publish to staging |
| 3 | Set up tracking + first ad | Connect Stripe/PayPal + Meta/Google pixel + launch first ad ($10â€“$50/day) |
| 4 | Connect RevTry voice | Configure RevTry voice agent for inbound leads |
| 5 | Launch | Push funnel live + start ad spend + manual prospecting if desired |
| 6 | Optimize | Review first results, A/B test the weakest step |
| 7 | Scale + share your win | Scale ad spend if profitable + share win in community + claim completion certificate |

### 7.3 Public progress

- **Cohort dashboard:** `funelai.com/challenge/[cohort-id]` â€” visible to all enrolled members; shows aggregate progress (X% on Day 3, Y funnels shipped, Z leads generated cohort-wide).
- **Public leaderboards:**
  - Most leads generated this cohort
  - Highest CR funnel
  - Fastest to first $1K
- **Public wins page** â€” final-day showcase with top performers.

### 7.4 Completion certificate

- Shareable image asset (1080x1080 + LinkedIn-format).
- Includes participant name, cohort number, completion date, FunelAI branding.
- Auto-emailed Day 8.
- Pre-filled share posts.
- Carries `?utm_source=challenge_cert&cohort=...` for attribution on incoming traffic.

### 7.5 Conversion mechanics

- Day 2 onward, the participant has used FunelAI to generate their funnel â€” they're already inside the product. Default state on Day 7: they have a published funnel.
- Free-tier limits apply during the challenge (watermark, lead cap). Day 7's "Scale" message explicitly nudges upgrade to remove watermark, raise lead caps, unlock automation.
- Expected conversion: **25â€“35% of challenge completers** â†’ paid FunelAI (CF benchmark for similar challenges).
- Expected conversion overall: **25â€“35% of enrolled** â†’ paid (assuming 60â€“70% completion rate).

### 7.6 Scale assumptions

- Year 1: 12 cohorts Ã— avg 1,500 enrolled = ~18,000 enrolled. ~25% paid conversion = ~4,500 paid customers from this loop alone.
- Year 2+: cohorts at 5,000â€“10,000 each.

### 7.7 Communications cadence

- **Daily email** (07:00 local time): video link + day's task + community thread link.
- **Daily SMS** (10:00 local time): "Today's task: [headline]. Open the app: [link]." Opt-in at enrollment.
- **Daily community drop:** auto-posted thread in challenge hub.
- **Pre-cohort:** 3-email warmup sequence (T-3, T-1, T-0 morning).
- **Mid-cohort:** Day 4 founder live Q&A.
- **Final-day:** founder + featured cohort wins live stream (Day 7, ~60 min).

### 7.8 Telemetry

| Event | Properties |
|-------|------------|
| `challenge_enrolled` | `user_id` (if exists), `email`, `cohort_id`, `enrollment_source` |
| `challenge_daily_completed` | `user_id`, `cohort_id`, `day` (1-7) |
| `challenge_funnel_shipped` | `user_id`, `cohort_id`, `funnel_id`, `day` |
| `challenge_first_lead` | `user_id`, `cohort_id`, `funnel_id`, `day` |
| `challenge_completed` | `user_id`, `cohort_id`, `days_completed`, `funnels_shipped` |
| `challenge_certificate_issued` | `user_id`, `cohort_id`, `certificate_url` |
| `challenge_paid_conversion` | `user_id`, `cohort_id`, `plan`, `mrr`, `days_since_enrollment` |
| `challenge_streamed_view` | `cohort_id`, `viewer_session_id`, `duration_minutes` |

### 7.9 Engineering spec

- Enrollment portal: `funelai.com/challenge` with form (email, phone optional, industry).
- Cohort assignment: every new enrollee assigned to the next-month cohort; cohort opens 1st of month, runs days 1-7.
- Curriculum delivery: scheduled messaging via the comms platform (Customer.io / Resend + Twilio).
- Progress tracking: `challenge_daily_completed` emitted when day's task done (instrumented per task type â€” Day 1 = post in community thread, Day 2 = funnel published, etc.).
- Cohort dashboard: real-time materialized view, refreshed every 60s.
- Live stream: Day 7 final stream hosted on YouTube Live / Zoom Webinar, embedded in app.

---

## CROSS-CUTTING SECTION â€” Viral Coefficient Math

### How the 7 loops compound

Single-loop K-factors aren't multiplicative in isolation, but they stack across the user journey. A new user who arrived via Watermark may go on to: complete the Challenge, become an Affiliate, hit Bronze, publish a Template, attend FunnelCon. Each subsequent loop reactivates them as a distribution surface.

**Per-loop directional contribution (illustrative â€” refine with actual data post-launch):**

| Loop | Mechanism | Assumption | K contribution |
|------|------|------|------|
| 1. Watermark | Free-funnel viewer â†’ /build-yours signup | ~5% CTR Ã— ~5% signup CR | ~0.0025 per viewer; aggregated, ~0.25 K |
| 2. Affiliates | 5â€“10% of paid users become affiliates, avg 3 referrals each | 0.075 Ã— 3 = | 0.15â€“0.30 K |
| 3. Awards | Case study pages Ã— impressions Ã— ~1% signup | 100+ impressions Ã— pages | ~0.05 K |
| 4. Marketplace | Buyer flow + SEO long-tail | Organic + network | ~0.05 K |
| 5. Community | Indirect â€” retention multiplier | 2â€“3Ã— LTV | Not direct K; lowers churn â†’ higher net |
| 6. FunnelCon | Post-event spike + year-round retention | Concentrated annual boost + content reuse | Burst K + retention |
| 7. Challenge | Monthly net-new acquisition spike | Free cohort â†’ 25â€“35% paid | Direct acquisition + recompounds via L1 |

### Combined K-factor target

- **Month 12: K = 0.3â€“0.5**
- **Month 24: K = 0.5â€“0.8**

A K below 1.0 is still highly valuable when combined with paid acquisition: organic referrals supplement paid, drive blended CAC down materially over time.

### Modeling assumptions

- Each paid customer publishes avg 2.3 funnels/year â†’ those funnels carry watermarks (on free) or generate Awards / case studies (on paid).
- 7% of paid users activate as affiliates within 90 days; 60% of those send at least one referral.
- Bronze milestone median time-to-hit from funnel publish: 90 days; ~12% of active funnels eventually hit Bronze.
- Challenge enrollment costs ~$8 CAC (paid social + organic) vs ~$70 CAC for direct paid (per CF-comparable benchmark).
- LTV / CAC for community-active cohort: 4.5x vs 2x for non-active.

### What we'll measure monthly

Dashboard: `growth/viral-engine`
- Per-loop K-factor estimate
- Combined K
- Signups by attribution source (per Doc 04 PAL)
- $ MRR attributable to each loop
- $ savings vs equivalent paid CAC
- Net retention impact (community member cohort vs control)

### Risks / failure modes

- **Watermark gets blocked at scale** by ad networks or content filters â†’ mitigate with non-iframe-able, semantically clean HTML and a clean URL.
- **Affiliate fraud spike** can torch margins â†’ 2.10 fraud rules + manual review on velocity events.
- **Award milestones gamed** (fake payments routed through funnels) â†’ milestone detector backstop: minimum unique-customer count (>=10) + minimum days-since-funnel-publish (>=14) before Bronze fires.
- **Marketplace race-to-bottom on price** â†’ curated badges + featured shelves to keep high-quality templates visible.
- **Community quality decay** at scale â†’ moderation budget grows with MAUs; Mentor program acts as distributed moderation.
- **FunnelCon Year 1 attendance miss** â†’ contingency: pivot to smaller "founder-and-100-customers" intimate format, capture content for Year 2 ramp.
- **Challenge fatigue** (same audience repeats) â†’ quarterly themed variants (Webinar Challenge, RevTry Challenge, Ecom Challenge) to refresh demand.

---

## Engineering dependencies (cross-loop)

All loops depend on:

1. **Event taxonomy (Doc 03)** â€” every loop emits and consumes these events. Schemas must be locked before instrumentation.
2. **PAL / attribution (Doc 04)** â€” cross-loop attribution stitching; one source of truth for "where did this user come from."
3. **Identity service** â€” `prospect_id` â†’ `user_id` â†’ `workspace_id` resolution. Cross-device merge.
4. **Payment integration (Doc 04)** â€” required for Loops 2, 3, 4, 6 (revenue capture, commissions, payouts).
5. **Notification platform** â€” required for Loops 2, 3, 5, 6, 7 (transactional + lifecycle).
6. **Edge rendering / CDN** â€” required for Loops 1, 3 (watermark, case study pages at scale).
7. **Ledger** â€” single double-entry ledger used by Loops 2 and 4 for commissions, by Loop 6 for ticketing.
8. **Trust & Safety pipeline (Doc 07a / 07b)** â€” fraud, abuse, content moderation across loops.

A growth-engineering squad of 4â€“6 (1 EM, 2 BE, 1 FE, 1 data, 1 ops integration) owns this surface from Day 90 launch through Year 2.

---

## Appendix â€” Launch sequence (Day 90)

| Loop | Day 90 launch status |
|------|------|
| 1. Watermark | Live â€” required for free tier |
| 2. Affiliates | Live â€” open to all users at launch |
| 3. Awards (Bronze/Silver only) | Live â€” Gold+ tooling shipped by Day 180 |
| 4. Template Marketplace | Beta â€” invite-only creators at launch, public by Day 120 |
| 5. Community (Skool) | Live â€” Skool standup by Day 60, fully programmed by Day 90 |
| 6. FunnelCon | Announcement only at Day 90; event held Month 12 |
| 7. 7-Day Challenge | First cohort runs Month 4 (after Day 90 stabilization) |
