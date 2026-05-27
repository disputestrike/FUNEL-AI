# 07c â€” Cost Governor

Owner: Head of Platform Engineering + Head of Finance
Status: Day-90 launch baseline
Related: `07a-trust-and-safety-policy.md`, `07b-human-review-queue.md`, `02a-kb-pack-template.md`
Review cadence: Weekly cost-vs-revenue dashboard, monthly thresholds, quarterly tier-pricing review

---

## 1. Purpose

FunelAI's autonomous generation pipeline calls expensive APIs (LLMs, image gen, video gen, voice/TTS, SMS, email, storage) and orchestrates customer ad spend across platforms. Without governance, a single buggy loop or one bad-actor account can spend thousands per hour. The cost-governor service (`cg-svc`) enforces per-generation, per-account, per-channel limits in real time, with graceful degradation rather than hard failure where possible.

This document specifies:
1. Per-generation budgets by tier Ã— industry Ã— complexity.
2. Per-account monthly ledgers and alert thresholds.
3. Degradation paths when budgets are reached.
4. Ad-spend caps for new accounts.
5. Abuse caps (rate limits, IP-based).
6. Reporting and unit-economics review cadence.

---

## 2. Cost meter â€” per-generation

### 2.1 Generation lifecycle and the meter

When a generation starts, the orchestrator:
1. Computes a **budget ceiling** for this generation (Â§3) and records it on `generation.budget_cents`.
2. Initializes a cost meter `generation.cost_cents = 0`.
3. Each agent invocation logs (via callback into `cg-svc.charge`) its measured cost before returning output to the orchestrator.
4. After each charge, `cg-svc` returns `{remaining_cents, status: ok|near_limit|exhausted}`.
5. The orchestrator's next-agent-picker reads `status` to decide whether to use premium / standard / cheap / cached / skip per the degradation policy (Â§5).
6. On terminal state (`complete`/`rejected`/`failed`/`reviewed`), generation row is finalized; lifetime cost is added to the workspace ledger (Â§4).

### 2.2 What counts toward the meter

| Category | Unit | Source of truth for cost |
|---|---|---|
| LLM | per 1M input + output tokens, per model | Anthropic/OpenAI/Google billing API or our token counter Ã— posted rates (we use cached rates updated weekly via `pricing.yaml`) |
| Image generation | per image, per model + resolution | Flux/Ideogram/DALL-E posted rate Ã— count |
| Video generation | per second of output, per model | Veo / Runway / Sora posted rate |
| Voice TTS (synthesis) | per character, per model | ElevenLabs / Cartesia / OpenAI TTS posted rate |
| Voice ASR (transcription, RevTry) | per minute | Deepgram / AssemblyAI posted rate |
| Voice telephony minutes | per minute outbound + per minute inbound | Twilio / Telnyx |
| SMS | per segment per destination country | Twilio / Telnyx |
| Email | per send | SendGrid / Postmark (tiered) |
| Storage | per GB-month accrued at end of cycle | R2 / S3 |
| Outbound webhook + scraping | per call | Bright Data / Apify metered |
| Search / web fetch | per query | Brave / Tavily / Serper posted rate |

Ad spend is **not** part of the per-generation meter â€” it's separately governed in Â§6.

### 2.3 Charging contract

```
cg-svc.charge(
  generation_id,
  agent_id,
  category,            # llm | image | video | voice_tts | voice_asr | voice_telephony | sms | email | storage | scraping | search
  unit_count,          # tokens, seconds, characters, etc.
  unit_rate_cents,     # from pricing.yaml lookup at charge time
  metadata             # model, resolution, country, ...
) -> {
  remaining_cents,
  status,              # ok | near_limit_80 | exhausted | overrun
  recommendation       # one of: continue | downgrade_next | cache_if_possible | skip_optional | halt
}
```

`unit_rate_cents` is the **list rate**, not the negotiated rate. We meter at list rates so that downstream margin analysis is consistent; the difference between list and negotiated lands in margin reporting, not in the generation budget.

---

## 3. Per-generation budget ceilings

### 3.1 Tier defaults (industry & complexity multipliers in Â§3.2)

| Tier | Base ceiling | Allowed agents | Allowed image models | Allowed video | Voice ceiling | Notes |
|---|---|---|---|---|---|---|
| **Free** | $0.50 | Cheap agents only (Haiku, Sonnet for short calls), no Opus. | Flux Schnell only. No Ideogram. | None | RevTry 2 min/generation max | Ad publishing disabled (must Pro Boost or upgrade). |
| **Starter** | $0.80 | Haiku, Sonnet; Opus disabled. | Flux + Ideogram standard. | None | RevTry 5 min/generation | |
| **Growth** | $1.50 | Full agent suite; Sonnet default, Opus allowed for regulated verticals only. | Full image suite. | Up to 15 sec of video per generation. | RevTry 15 min/generation | |
| **Scale / Agency** | $3.00 | All agents; Opus default for regulated verticals. | Full image + image-to-image + inpainting. | Up to 60 sec of video. | RevTry 30 min/generation; concurrent calls supported. | |

7-Day Pro Boost grants Growth-tier ceilings for the 7-day window. After expiry, ceilings revert; in-flight generations finish at the higher ceiling but are not re-charged retroactively.

### 3.2 Multipliers applied to base ceiling

Final ceiling = base Ã— industry_multiplier Ã— complexity_multiplier, capped at `tier_hard_max`:

| Factor | Multiplier |
|---|---|
| Regulated industry (per 07b Â§2.1) | Ã— 1.30 (more compliance LLM calls + reviewer-suggestion prep) |
| Multi-asset generation (page + ads + email seq + SMS seq + voice script) | Ã— 1.50 |
| Re-generation after rejection (regen #2) | Ã— 0.80 (favor cached + cheaper) |
| Re-generation #3+ | Ã— 0.60 (force cheap path) |
| New customer's first ever publish | Ã— 1.15 (give it a little headroom for quality) |

`tier_hard_max` = base Ã— 1.75. Hard ceiling that no multiplier combination can exceed; protects against config errors.

### 3.3 Example
A Growth customer generating their first full multi-asset funnel in healthcare:
- Base: $1.50
- Industry (regulated): Ã— 1.30
- Multi-asset: Ã— 1.50
- First publish: Ã— 1.15
- Computed: $1.50 Ã— 1.30 Ã— 1.50 Ã— 1.15 = $3.37
- Hard max: $1.50 Ã— 1.75 = $2.625 â†’ capped at $2.625.

---

## 4. Per-account ledger

### 4.1 Schema

```
workspace_ledger:
  workspace_id: fk
  cycle: yyyy-mm
  expected_cost_cents: int     # set at cycle start from tier + plan
  actual_cost_cents: int       # incremented continuously
  by_category: jsonb            # {llm, image, video, voice_tts, voice_asr, voice_telephony, sms, email, storage, scraping, search}
  ad_spend_cents: int          # separate axis, see Â§6
  revenue_cents: int           # MRR + overage + Pro Boost revenue attributable to this workspace this cycle
  last_alert_at: ts             # last threshold alert
  state: enum(ok, soft_warn_80, hard_cap_150)
```

### 4.2 Expected cost calculation

`expected_cost_cents` is set at the start of each monthly cycle as a function of plan + historical usage:
- New workspace: `expected = plan_credit_value` (the per-month value of credits included in the plan).
- Established workspace (â‰¥ 2 cycles of history): `expected = max(plan_credit_value, 1.15 Ã— trailing_3mo_avg_cost)`.
- Workspaces with declared ramp (e.g., agency adding 10 sub-accounts): manually adjusted by ops.

### 4.3 Alert thresholds

| Threshold | State | Action |
|---|---|---|
| 80% of expected | `soft_warn_80` | Slack `#cg-alerts` with workspace summary. CSM is notified for Scale/Agency. No customer-facing impact. |
| 100% of expected | log only | No automatic action; this is the contracted limit. |
| 125% of expected | `soft_warn_125` | Ops investigates; usage analysis shared with CSM. |
| 150% of expected | `hard_cap_150` | Premium features paused: generations forced to degradation mode (Â§5). Customer in-app banner: "You've used 1.5Ã— this month's expected resources. Upgrade for more capacity or wait until next cycle." |
| 200% of expected | `hard_freeze` | New generations rejected with a clear upgrade CTA. In-flight finish. Sends + ad-spend continue (customer revenue depends on them). |

Thresholds are per-cycle. Reset on cycle rollover.

### 4.4 Manual overrides
- Ops can grant a temporary lift (e.g., +50% for 7 days) for known-good high-value customers. Logged in `ledger_overrides`. Auto-expires.
- Customers can self-upgrade at any state; upgrade immediately raises `expected_cost_cents` and recomputes state.

---

## 5. Graceful degradation paths

When a generation hits `near_limit_80` (per Â§2.3) or a workspace is in `hard_cap_150`, the orchestrator's agent-picker switches strategies. Degradation is per-agent-call, not per-generation â€” we don't fail; we adapt.

### 5.1 Tactic ladder (in order of preference)

1. **Premium â†’ standard model**: Opus â†’ Sonnet â†’ Haiku for LLM; Ideogram â†’ Flux Dev â†’ Flux Schnell for image; Veo â†’ Runway â†’ skip for video.
2. **Cache lookup**: If a near-identical prompt has been generated for the same vertical + locale within 30 days, reuse the cached output (with provenance markers in metadata).
3. **Prompt compression**: Re-call the same model with a shorter prompt; uses `cg-svc.compress_prompt` (a Haiku-powered summarizer) on the system context.
4. **Skip optional step**: Some agents are optional (e.g., extra A/B variant generation, supplementary lead-magnet generation). They self-declare `optional=true`; the orchestrator skips them under pressure.
5. **Defer**: Push expensive step to a delayed batch (e.g., generate video tomorrow during off-peak when batch pricing is better).

### 5.2 User-visible messaging

Degradation is invisible to the user unless it materially affects output. When it does, frame it as opportunity, not punishment:

| Situation | Customer-facing message |
|---|---|
| Video generation skipped on Free tier | "Want a 15-second hero video? Upgrade to Growth and we'll generate one for this funnel." |
| Used Sonnet instead of Opus on Growth in regulated vertical | (no message â€” quality target met; tracked internally for QA) |
| Skipped extra A/B variants | "Generated 2 variants. Upgrade to Scale for 5 variants per asset." |
| Hard-cap reached mid-cycle | "You're getting incredible mileage from your plan. Upgrade now to unlock the rest of this month without limits." |

NEVER: "Your budget is exhausted", "You've hit your cap", "Service degraded" â€” all read as punishment.

### 5.3 Quality floor
Degradation cannot drop quality below the floor for any regulated industry. If degradation would push expected quality below 80 (the auto-pass threshold per 07b Â§2.3), the generation is paused and the customer is offered a one-click upgrade or a wait-until-next-cycle option. No silent quality collapse in healthcare/legal/financial.

---

## 6. Ad spend governance

Ad spend is the largest financial axis on the platform and most exposed to fraud/runaway. Separate from per-generation costs.

### 6.1 Pre-conditions to publish ads at all
- Workspace has connected ad-platform OAuth (Meta, Google, TikTok, LinkedIn, Microsoft) with `ads_management` scope verified.
- Workspace has a verified payment method on the ad platform itself (not just on Funnel).
- Workspace KYB score (07a Â§4) â‰¤ 30, OR KYB completed.
- Industry passes 07a Â§5 prohibited-category check.
- Free tier: ad publishing **disabled regardless** â€” must Pro Boost or upgrade to a paid tier.

### 6.2 New-account daily caps (first 7 days post-first-ad)

| Day | Daily cap (across all ad platforms combined) |
|---|---|
| 1 | $50 |
| 2 | $75 |
| 3 | $100 |
| 4 | $150 |
| 5 | $250 |
| 6 | $400 |
| 7 | $750 |
| 8+ | Tier-based (below) |

Cap is enforced by Funnel: we set the daily-budget field on each ad platform via API to the cap value; if customer attempts to set higher via Funnel UI, blocked with explanation; if customer changes it directly on the ad platform UI, our reconciliation job (hourly) detects and re-clamps (and flags for review if it happens repeatedly).

### 6.3 Tier-based daily caps (after Day 7)

| Tier | Default daily cap | Hard ceiling |
|---|---|---|
| Starter | $500 | $1,000 (after 30 days clean) |
| Growth | $2,500 | $10,000 (after 30 days clean) |
| Scale | $25,000 | unlimited (with KYC Â§11 and risk review) |
| Agency | per sub-account: Scale rules | per sub-account |

"Clean" = no T&S flags, no ad-platform policy strikes, no chargeback spikes.

### 6.4 Anomaly detection on ad spend
Daily job compares observed ad spend vs prior 7-day rolling average per workspace:
- Spend > 3Ã— average â†’ soft alert.
- Spend > 5Ã— average + no corresponding rise in lead/conversion volume â†’ throttle to prior average until investigated.
- Spend > 10Ã— average â†’ immediate freeze, ops review within 1 business day.

### 6.5 Customer-of-customer payment vs ad spend ratio
If ad spend in cycle > 3Ã— CoC payments processed in cycle, AND workspace age < 90 days â†’ flag for review (potential ad-arbitrage / money-laundering signal).

---

## 7. Abuse caps

These are the bottom-line rate limits that protect the platform from runaway. They apply regardless of tier (except where noted) and are enforced at the API gateway and at the orchestrator.

### 7.1 Per-IP per-hour (free tier signups + generations)
- Free tier: 3 signups per IP per 24h.
- Free tier generations: 10 per IP per hour, 30 per IP per day.
- Paid tiers: not IP-rate-limited at gateway level (workspace-rate-limited).

### 7.2 Per-account per-day

| Resource | Free | Starter | Growth | Scale | Agency |
|---|---|---|---|---|---|
| Generations | 5/day | 50/day | 500/day | 5,000/day | per sub-account: Scale |
| RevTry voice minutes | 10/day | 100/day | 1,000/day | 10,000/day | per sub-account |
| Concurrent RevTry calls | 0 | 1 | 5 | 25 | per sub-account |
| SMS spend (Twilio cost, not customer-facing pricing) | $0/day | $10/day | $100/day | $1,000/day | per sub-account |
| Email sends | 0/day (only opt-in receipt) | 1,000/day | 25,000/day | 500,000/day | per sub-account |
| Image generations | 20/day | 200/day | 2,000/day | 20,000/day | per sub-account |
| Video seconds generated | 0/day | 0/day | 300 sec/day | 3,000 sec/day | per sub-account |

Caps are soft until 90% utilization (Slack alert to ops), hard at 100%. Customer sees "You've hit today's [resource] cap â€” upgrade or come back tomorrow" with upgrade CTA.

### 7.3 Burst protection
Token-bucket at the API gateway:
- Per workspace: 10 req/sec sustained, burst 30.
- Per IP (anonymous endpoints): 2 req/sec sustained, burst 5.

### 7.4 Sender-domain reputation throttling
If a workspace's sending domain (email) hits > 0.3% complaint rate or > 5% bounce rate over rolling 24h, email throughput is auto-throttled to 10% of cap until rates normalize.

---

## 8. Reporting

### 8.1 Daily cost-vs-revenue (per cohort)

Auto-generated 06:00 PT every morning, posted to `#finops` Slack + persisted to `cohort_unit_econ` table.

For each cohort (signup-week Ã— tier Ã— primary-industry):
- Customers in cohort (count).
- Yesterday's cost (sum by category).
- Yesterday's revenue (subscriptions + Pro Boost + overage).
- Cumulative cost / cumulative revenue (cohort lifetime).
- Gross margin = (revenue âˆ’ COGS) / revenue. COGS = LLM + image + video + voice + SMS + email + storage + scraping + search + reviewer time allocated.

Red-flag cohorts: gross margin < 30% sustained over 14 days â†’ flagged for the weekly review.

### 8.2 Per-customer LTV vs cost-to-serve

Per workspace, monthly:

| Metric | Definition |
|---|---|
| LTV-to-date | Sum of revenue attributable to this workspace since signup. |
| Cost-to-serve-to-date | Sum of metered costs from `workspace_ledger.actual_cost_cents` + allocated platform overhead (fixed cost Ã· active workspaces) + allocated reviewer time Ã— hourly cost. |
| Margin contribution | LTV âˆ’ cost-to-serve. |
| Predicted residual LTV | Simple cohort survival model Ã— current MRR. Refreshed monthly. |

Workspaces with margin contribution < 0 sustained over 3 months: CSM review. Outcome: upgrade, behavior change, or graceful offboarding (with notice).

### 8.3 Per-category cost trends
Daily trend per cost category platform-wide. Drives:
- Vendor renegotiation triggers (e.g., if Twilio cost > 18% of revenue, initiate renegotiation).
- Model switching opportunities (if Sonnet is 60% of LLM cost and Haiku could substitute on 30% of those calls with quality unchanged, route ops + product to evaluate).

### 8.4 Quarterly tier-pricing review
Inputs:
- Realized gross margin per tier over the prior quarter.
- Distribution of usage per tier vs included credits.
- Competitive benchmarks.
- Customer NPS by tier.

Outputs to leadership:
- Recommend price changes (with grandfathering policy).
- Recommend credit-allocation changes per tier.
- Recommend new tier introduction or retirement.

Tier-pricing changes always grandfather existing customers for one full annual cycle (or pro-rated month plans for at least 90 days) with explicit communication.

---

## 9. Implementation: services and data

### 9.1 Services

```
cg-svc            # cost-governor; charges, ledger reads/writes, threshold evaluation
pricing-svc       # versioned pricing.yaml, daily refresh from vendor APIs where available
cohort-econ-svc   # batch job 05:00 PT for daily reports
ad-cap-svc        # cap enforcement against ad-platform APIs, reconciliation
rate-limit-svc    # token-bucket at gateway
```

### 9.2 Tables (additive â€” referenced from 07a/07b)

```
generation:
  + budget_cents: int
  + cost_cents: int
  + degradation_actions: jsonb[]    # what was downgraded/skipped

workspace_ledger: (Â§4.1)

ledger_overrides:
  id, workspace_id, lift_pct, lift_until, reason, created_by, created_at

ad_spend_log:
  id, workspace_id, platform, date, amount_cents, leads, conversions, throttled_bool, cap_at_record_time

pricing.yaml: versioned in git, hot-reloaded by cg-svc on update.

cohort_unit_econ: (Â§8.1)
```

### 9.3 Engineering interfaces (summary)

```
cg-svc.compute_budget(workspace_id, generation_spec) -> {ceiling_cents, multipliers_applied}
cg-svc.charge(generation_id, agent_id, category, unit_count, unit_rate_cents, meta) -> {remaining, status, recommendation}
cg-svc.finalize(generation_id) -> {cost_cents, by_category}
cg-svc.ledger_state(workspace_id, cycle?) -> {expected, actual, state, by_category}
ad-cap-svc.evaluate(workspace_id) -> {daily_cap_cents, hard_ceiling_cents, reasons[]}
ad-cap-svc.reconcile(workspace_id) -> diffs_corrected[]   # hourly job
rate-limit-svc.check(workspace_id|ip, bucket) -> {allowed, retry_after_ms}
```

Events emitted on `cg.events` Kafka topic: `budget_computed`, `charged`, `near_limit`, `exhausted`, `degraded`, `ledger_soft_warn_80`, `ledger_hard_cap_150`, `ledger_hard_freeze`, `ad_throttle_applied`, `cap_reconciled`.

Consumed by: orchestrator (degradation decisions), customer notifications, ops dashboards, FinOps reporting.

---

## 10. Open items (Day-180 review)

- Cached-output policy needs explicit per-vertical opt-in â€” some regulated verticals shouldn't reuse content across customers due to brand/uniqueness obligations.
- Pricing reconciliation: list-rate vs negotiated-rate margin tracking is currently a manual spreadsheet; productize in Q2.
- Multi-currency: ad-spend caps currently USD; add per-currency tables once we have non-US customers > 10% of base.
- Predictive cost model: when ML signal that a workspace will exceed expected cost by week 1 of cycle gets reliable (>80% precision), front-load CSM outreach instead of waiting for 80% threshold.
- Ad-spend velocity-vs-conversion-rate model: current rules are heuristic; train a model on Day-90+ data.
- Carbon footprint reporting (LLM tokens Ã— estimated kWh) for sustainability disclosures â€” likely required by EU customers in 2027; pre-build in Q3.
