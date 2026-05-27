# 07a â€” Trust & Safety Policy

Owner: Head of Trust & Safety
Status: Day-90 launch baseline
Related: `07b-human-review-queue.md`, `07c-cost-governor.md`, `02a-kb-pack-template.md`
Review cadence: Monthly (policy), quarterly (thresholds), annually (public report)

---

## 1. Purpose & scope

FunelAI publishes marketing assets (pages, ads, emails, SMS, voice, video, lead magnets) on behalf of customers at autonomous scale. Every published asset is a potential attack surface for fraud, regulatory exposure, and platform abuse. This policy defines the controls, signals, thresholds, and workflows that gate generation and publication.

Scope: every workspace, every customer, every generation, every published asset, every paid send (SMS/email/voice), every ad spend, every customer-of-customer (CoC) transaction processed through a Funnel-hosted funnel.

This document is enforceable through the **Trust & Safety Service** (`ts-svc`), a Python/TypeScript microservice that exposes synchronous classifiers + an async event bus consumed by the orchestrator, publisher, and billing services.

---

## 2. Risk taxonomy

| Risk class | Primary harm | Owner control |
|---|---|---|
| R1 Phishing / impersonation | User defrauds end-consumers via Funnel-hosted pages/email | Pre-publish classifier + block |
| R2 Fake business | Shell entity laundering ad spend or fraud proceeds | KYB + anomaly score |
| R3 Adult / illegal offer | Platform liability, payment processor risk | Pre-generation + pre-publish classifier |
| R4 Affiliate fraud | Funnel's affiliate program drained | Cluster analysis, payout holds |
| R5 SMS spam | TCPA exposure (uncapped statutory damages), carrier de-listing | Per-recipient opt-in proof + DNC |
| R6 Voice consent violation | State recording-law exposure (felony in 2-party states) | RevTry preamble + consent ledger |
| R7 Ad-policy abuse | Ad account bans, platform-of-platform risk | Pre-flight classifier vs Meta/Google policy |
| R8 Payment fraud (CoC) | Chargebacks, processor termination | 3DS/SCA + velocity + BIN risk |
| R9 KYC evasion | Sanctions, AML, tax-reporting failures | Volume-triggered KYC/KYB |
| R10 Domain reputation decay | Funnel-hosted subdomain ecosystem getting blocked | Monthly Safe Browsing scan |

---

## 3. R1 â€” Phishing & impersonation detection

### 3.1 Trigger surface
Every text artifact produced by any generation agent (page copy, email body, SMS body, voice script, ad creative text) is passed through `ts-svc.classify_phishing` before being persisted as `approved` status.

### 3.2 Signals (combined, weighted)

| Signal | Detection | Weight |
|---|---|---|
| Brand impersonation (text) | Named-entity match against a curated brand list (Microsoft, Apple, Amazon, IRS, SSA, USPS, FedEx, UPS, Chase, BofA, Wells Fargo, Citi, PayPal, Venmo, CashApp, Zelle, Coinbase, Binance, Norton, McAfee, Geek Squad + top 200 global brands) where the customer's verified business is not that entity | +50 |
| Brand impersonation (visual) | Logo CLIP-similarity â‰¥ 0.85 against brand-logo gallery + brand not owned | +50 |
| Government impersonation | Regex/NER match on `IRS`, `Internal Revenue`, `Social Security Admin`, `Medicare.gov`, `USCIS`, `DMV`, state revenue depts, "federal agent" | +60 |
| Urgency phrasing | "act within 24 hours", "final notice", "account will be suspended", "verify now or lose access", "limited time to claim" | +15 |
| Credential request | Any form field labeled / prompted for: password, SSN, full DOB + SSN combo, full card PAN + CVV outside checkout context, online banking login, MFA code, recovery phrase, seed phrase | +40 |
| Urgency + credential combo | Both above present in same artifact | +30 (additive bonus) |
| Lookalike domain | Customer's published domain is a Levenshtein â‰¤2 / homoglyph match of any protected brand domain | +60 |
| Punycode/IDN domain | Domain contains xn-- or mixed-script | +30 |

### 3.3 Action thresholds
- Score < 40 â†’ `pass`, log only.
- Score 40â€“69 â†’ `human_review` (route to 07b queue, severity = phishing-suspect).
- Score â‰¥ 70 â†’ `block` + flag user account (`user.flags += phishing_attempt`), notify ops Slack `#ts-alerts`, freeze all in-flight generations for that workspace pending review.
- Repeat (â‰¥2 confirmed phishing blocks within 30 days) â†’ permanent ban, all domains taken down, payment refunds withheld pending investigation, report to ic3.gov and the impersonated brand's abuse contact.

### 3.4 Implementation notes
- Brand list versioned at `ts-svc/brands.yaml`, edited via PR (ops team) with security review.
- Logo classifier: CLIP ViT-B/32 + cosine on cached brand-logo embeddings. Re-index nightly.
- All artifacts persisted in S3 + R2 with `phishing_score` and `phishing_signals[]` in metadata for audit.

---

## 4. R2 â€” Fake business detection (KYB-lite, every account)

### 4.1 Cross-check at signup + first publish
On signup, capture: business name, business domain (if any), claimed city/state/country, claimed monthly revenue band, vertical.

`ts-svc.kyb_check(workspace_id)` aggregates:

| Source | Used for |
|---|---|
| WhoisXML | Domain age, registrant country, registrar, privacy-proxy flag |
| LinkedIn Company API (or scraping fallback via Bright Data) | Company exists, employee count, founded date, headcount-vs-revenue sanity |
| Google Business Profile (Places API) | Physical presence, review count, claim status, photo count |
| Secretary of State registry (US only, top 10 states programmatically; rest manual) | Entity exists, status active |
| Have-I-Been-Pwned domain breach record | Domain previously used in fraud |
| Spamhaus DROP + EDROP | IP/ASN blocklist of registrant |

### 4.2 Anomaly score components

| Signal | Points |
|---|---|
| Domain registered < 30 days ago | +25 |
| Domain registered < 7 days ago | +40 (replaces above) |
| WHOIS privacy proxy + new domain + high ad spend declared | +20 |
| No GBP found + claimed local-services vertical (dental, legal, medical) | +30 |
| No LinkedIn presence + claimed >$1M revenue band | +20 |
| Claimed location â‰  WHOIS registrant country | +15 |
| IP/ASN on Spamhaus | +50 |
| Business name â‰  domain root + â‰  DBA pattern | +10 |
| SoS lookup returns "not found" or "inactive" (US only) | +30 |

### 4.3 Action thresholds
- Score < 30 â†’ auto-approve, re-check at 30 / 90 days.
- Score 30â€“59 â†’ `kyb_required`: customer must upload (a) gov-issued ID of an officer + (b) EIN letter or equivalent + (c) recent utility/bank statement for business address. Persona or Stripe Identity is the verification vendor (see Â§9 for KYC stack).
- Score â‰¥ 60 â†’ `manual_review` by Trust & Safety analyst before any ad publishing or paid send is enabled. Free-tier non-paid features remain available.
- Score â‰¥ 60 **AND** declared/observed ad spend â‰¥ $5K/mo â†’ freeze ad publishing entirely until cleared.

---

## 5. R3 â€” Adult / illegal offer blocking

### 5.1 Prohibited categories (hard block, no review override)

| Category | Definition | Detection |
|---|---|---|
| Adult content (sexual) | Pornography, escort, sugar-dating, OnlyFans funnels | NSFW image classifier (NudeNet >0.6) + keyword list |
| Weapons | Firearms, ammunition, suppressors, tactical kits sold without FFL verification | Keyword + image classifier (Roboflow gun model) |
| Illegal drugs | Schedule I-II controlled substances, "research chemicals", kratom/kava in banned states, marijuana funnels in non-licensed states | Keyword list + DEA scheduling lookup |
| Gambling outside licensed jurisdictions | Sports betting, casino, fantasy where customer can't show state license | Keyword + license-document requirement |
| MLM / pyramid | "Recruit downline", "passive income from your team's sales" + multi-level commission structures | Keyword + structural language patterns |
| Get-rich-quick guarantees | "$10K/month guaranteed", "passive income on autopilot $X" with numeric guarantee | Regex on $-amount + guarantee verbs |
| Fake credentials / diploma mills | "Buy a degree", "verified PhD in 30 days", unaccredited cert sales | Keyword + accreditor lookup |
| Unlicensed financial advice | Investment advice, securities, crypto pumps where customer not RIA / Series 7 / SEC-registered | License-document requirement triggered by keyword |
| Unlicensed medical | Rx-claim language + customer not licensed prescriber | License lookup against NPI registry |
| Unlicensed legal | "We will represent you in court" + customer not bar-licensed | Bar-number lookup |

### 5.2 Detection ensemble
- Tier 1 keyword/regex (sub-50ms, runs on every artifact pre-persistence).
- Tier 2 LLM classifier (Haiku, prompt-cached system prompt with category definitions) on artifacts that pass tier 1 but contain ambiguous flagged terms.
- Tier 3 image classifier on all generated/uploaded images (NudeNet, weapon detector, currency-pile detector for get-rich-quick).
- Tier 4 license verification: NPI registry (medical), state bar lookups (legal), FINRA BrokerCheck + SEC IAPD (financial), state gaming commission lookups (gambling).

### 5.3 Action
- Tier 1/3 positive â†’ `blocked`, generation aborted, no charge to user's per-generation budget, user shown a structured reason ("Your industry/offer requires verification we cannot complete: X. Contact support to appeal.").
- Tier 2 ambiguous â†’ route to 07b queue, severity = category-suspect.
- Tier 4 license check fails for a regulated vertical the user opted into â†’ block until license uploaded + verified.

---

## 6. R4 â€” Affiliate fraud detection

FunelAI runs an affiliate / partner program. The affiliate tracker (`aff-svc`) emits events: `click`, `signup`, `trial_start`, `paid_conversion`.

### 6.1 Fraud patterns

| Pattern | Detection |
|---|---|
| Cookie stuffing | Affiliate's referral cookie set with no observable referrer landing pageview, or set via iframe injection from unrelated domain |
| Self-referral | Affiliate signs up an account using same IP / device fingerprint / payment instrument / phone / email-root as their affiliate account |
| Fake email signup loops | Burst of N signups within T minutes from same IP /24 or same email provider domain or same fingerprint, none converting |
| Click spoofing | Server-to-server click events with no corresponding browser session, mismatched UA chains, click â†’ conversion < 3 seconds |
| Conversion stuffing | Bulk imports of conversions just before payout window |

### 6.2 Cluster analysis (nightly batch)
For each affiliate, compute over rolling 30 days:
- Distinct referred IPs / total referrals (low = suspicious).
- Distinct device fingerprints / total referrals.
- Distinct email TLD+root patterns.
- Inter-arrival time variance (regular intervals = bot).
- Conversion / trial ratio vs program median (outlier on the high side, especially for new affiliates, is suspicious).
- Geo-spread of referred users vs affiliate's claimed audience country.

Score â†’ quarantine_payout if score â‰¥ 60. Review by ops within 7 days. Permanent ban if confirmed; clawback unpaid commissions; freeze the referred accounts pending separate review.

### 6.3 Affiliate ToS hooks
- All commissions held 30 days minimum.
- Payouts denied for fraud-flagged referrals; no appeal on confirmed clusters.

---

## 7. R5 â€” SMS spam prevention

### 7.1 Per-recipient opt-in proof
Before any SMS is sent to a phone number from any Funnel workspace:
1. Workspace must have an attached opt-in record for that exact E.164 number: (`source` âˆˆ {form-submission, double-opt-in-link-click, imported-with-attestation}, `timestamp`, `consent-text-shown`, `ip`, `user-agent`).
2. Opt-in record stored in `consent_ledger` table, immutable, retained 5 years past last contact.
3. Imported lists require customer to attest in writing (e-sig event captured) to having collected opt-in. Imports > 5K numbers route to T&S review.

### 7.2 Twilio Lookup verification (first SMS to a number)
`twilio.lookups.v2.phoneNumbers(e164).fetch({fields: 'line_type_intelligence,identity_match'})`:
- `line_type` âˆˆ {landline, voip-non-mobile-fixed} â†’ block, prompt user to remove from list.
- `line_type` = "tollFree" or "sharedCost" â†’ block.
- Number in carrier-flagged blocklist â†’ block.
- Lookup result cached 30 days.

### 7.3 DNC integration
- Federal DNC list synced daily (cost: ~$70/area-code/year via dnc.gov subscription).
- State DNC for states that maintain separate registries.
- Internal DNC: any number that has STOP'd to any Funnel-originated SMS is added globally â€” a STOP to one customer's campaign blocks all future Funnel SMS to that number regardless of customer or opt-in claim.
- DNC check at queue-time AND at send-time (numbers can be added between queue and send).

### 7.4 Content rules
- Required: brand identification + opt-out instructions ("Reply STOP to opt out") in first message and any campaign-restart message.
- Banned: SHAFT (Sex, Hate, Alcohol, Firearms, Tobacco) content unless customer has carrier-approved SHAFT campaign.
- Throughput caps per number per day per workspace: 200 (Free not allowed to SMS / Starter 200 / Growth 2K / Scale 10K), elevated only after carrier 10DLC registration verified.

### 7.5 10DLC / Toll-free verification
Before any volume sending: A2P 10DLC brand + campaign registration completed via Twilio. Toll-free numbers require verified-sender registration. Unregistered = sending blocked.

---

## 8. R6 â€” Voice consent (RevTry)

### 8.1 Preamble (every outbound or inbound-recorded call)
First 7 seconds of every call, before any agent dialogue:
> "Hi, this is [agent name] calling on behalf of [customer business]. This call is being recorded for quality and compliance. If you'd prefer not to be recorded, say 'opt out' now and I'll end the call."

Implementation: hard-coded preamble in the RevTry TTS pipeline, prepended in audio pipeline (not in the LLM prompt â€” model cannot remove it). A preamble-played event is logged to `consent_ledger` before the LLM is allowed to speak.

### 8.2 Consent record per called number
`consent_ledger.voice` row per call: `e164`, `direction`, `preamble_played_at`, `opt_out_detected` (bool, from speech classifier in first 15s), `state_law` ({one-party, two-party, mixed}), `call_recording_url`, `retention_until`.

### 8.3 State-specific rules
- One-party-consent states (federal default + 39 states): preamble + customer's consent suffices.
- Two-party-consent states (CA, CT, DE, FL, IL, MD, MA, MT, NV, NH, PA, WA, OR for electronic comm): preamble must elicit affirmative continued engagement. If callee does not affirm or says "opt out", recording is terminated and call ends; no transcript retained beyond the consent decision.
- State determined by called number's area-code-to-state mapping AND callee-declared state if asked. If mismatch, apply stricter (two-party).
- Federal calls to mixed-state participants: apply two-party rules.

### 8.4 DNC for voice
- Federal Do-Not-Call list checked at queue-time.
- State DNC lists for outbound calls to those states.
- Internal voice-DNC: any callee who said "stop calling" / "remove me" / "do not call" â†’ permanent voice block across all workspaces.

### 8.5 Hours-of-day
- No outbound calls before 8am or after 9pm called-party local time (TCPA).
- Sunday calls disabled by default per workspace; opt-in required.

---

## 9. R7 â€” Ad-policy pre-flight

### 9.1 Pre-publish classifier chain
Every ad creative (image, video, copy, headline, CTA, landing-page URL) routed through `ad-policy-svc.classify` before being pushed to Meta / Google / TikTok / LinkedIn / Microsoft Ads APIs.

Classifiers:
1. **Meta policy classifier** â€” LLM (Haiku) prompted with the current Meta Advertising Standards, fed (image, copy, landing-page snapshot). Returns: `{verdict: pass|warn|fail, categories: [...], explanation: ...}`.
2. **Google Ads policy classifier** â€” same pattern, Google's policy.
3. **Sensitive-vertical hard rules** (codified):
   - Personalized attributes ban (Meta): copy implies knowledge of the viewer's race, religion, sexual orientation, health condition, criminal history, financial status.
   - Before/after imagery ban (Meta + Google healthcare): pairs of images implying body-weight/cosmetic change.
   - Negative self-perception ban (Meta): copy that exploits self-image insecurities.
   - GLP-1 / weight-loss claims: outcome promises, weight-amount claims, "Ozempic for everyone".
   - Crypto / financial: must be on Meta's pre-approved advertiser list.
4. **Landing-page consistency**: ad copy claims vs landing-page content (LLM-judged), to prevent bait-and-switch.

### 9.2 Verdict handling
- `pass` â†’ publish.
- `warn` â†’ publish allowed only if user tier â‰¥ Growth AND customer acknowledges the warning (logged); otherwise â†’ human review (07b).
- `fail` â†’ reject, do not push to ad platform. User sees structured reason + suggested edits.

### 9.3 Account-level signals
- Track per-workspace ad-platform rejection rate. If > 30% of submitted ads are platform-rejected over rolling 14 days, throttle ad creation and require human review until rate < 10%.

---

## 10. R8 â€” Payment fraud (customer-of-customer)

When Funnel-hosted checkout / payment forms collect end-consumer payments (via Stripe Connect on behalf of customers), the **Funnel platform is the processor of record** and inherits the risk.

### 10.1 Required at every CoC checkout
- 3DS / SCA: forced for all transactions â‰¥ $50, all EEA/UK cards regardless of amount, all transactions where any velocity/geo/BIN signal trips.
- Stripe Radar enabled with custom rule set (10.2).
- Device fingerprint (Stripe.js `riskCorrelationId` + our own canvas-fingerprint).

### 10.2 Custom Radar / `ts-svc.payment_check` rules

| Rule | Action |
|---|---|
| Same card used on > 3 distinct CoC checkouts across different Funnel customers within 24h | Review |
| Card BIN country â‰  billing country â‰  IP country (any 2 mismatch) | Review |
| Card BIN in BIN-risk score top decile (Stripe-provided) | 3DS forced + review if amount > $250 |
| Velocity: > 5 distinct cards from same IP within 1h | Block |
| Email domain on disposable-email list (Mailcheck) + first purchase + amount > $100 | Review |
| Customer (Funnel customer) themselves on T&S watchlist | Hold payout 7 days |

### 10.3 Chargeback handling
- Chargeback ratio per workspace tracked rolling 60 days. Threshold > 0.75% â†’ payout hold + investigation. > 1% â†’ CoC payments suspended.

---

## 11. R9 â€” KYC / KYB triggers

### 11.1 Volume triggers (any one fires KYC)

| Trigger | Threshold (rolling 30 days) |
|---|---|
| Ad spend through Funnel-managed ad accounts | > $10,000 |
| Leads generated | > 5,000 |
| CoC payments processed | > $25,000 gross |
| Outbound SMS volume | > 50,000 messages |
| Outbound voice minutes | > 5,000 minutes |
| Domain count | > 10 distinct published domains under one workspace |

### 11.2 KYC stack
- **Individual** (workspace owner + any officer >25% control): Persona (govt-ID + selfie liveness + watchlist screen against OFAC, EU, UK, UN sanctions + PEP).
- **Business** (KYB): EIN/VAT, formation doc, beneficial-owner list per FinCEN BOI requirements (â‰¥25%), MCC code declared, expected processing volume.
- Sanctions re-screen monthly.

### 11.3 Action on failure
- Verification failed (ID mismatch, sanctions hit) â†’ workspace frozen, payouts held, ops escalation. SAR filing via Stripe Connect if Stripe acts as payment processor.
- Verification incomplete > 14 days after trigger â†’ premium features auto-paused (downgrade to Free-tier limits) until completed.

---

## 12. R10 â€” Domain reputation monitoring

### 12.1 Monthly scan
Cron `domain-rep-scan` runs first day of each month (and on-demand when a domain is reported):
- Google Safe Browsing API v4 â€” every published apex + subdomain.
- Microsoft SmartScreen via Defender feed.
- Spamhaus DBL.
- SURBL.
- PhishTank.
- VirusTotal URL lookup (premium tier, batched).
- abuse.ch URLhaus.

### 12.2 Action on positive
- Auto-pull domain from publishing (DNS unchanged, but funnel returns 410 Gone).
- Notify customer, route to 07b for investigation.
- If confirmed malicious (after review): permanent domain block across the Funnel infra (cannot be re-used by any workspace), customer suspended pending Â§13.

### 12.3 Subdomain hygiene
- Funnel-owned shared subdomain pools (e.g., `*.funnel.page`) treated as one reputation surface. A single confirmed phishing subdomain triggers an immediate full-pool rescan within 1 hour.

---

## 13. Suspension workflow

### 13.1 Stages

| Stage | Trigger | Customer-visible | Time-bound |
|---|---|---|---|
| **Warning** | First medium-severity violation (e.g., one phishing-suspect block, one ad-policy fail repeat) | Email + in-app banner with specific reason + remediation steps | 24-hour response window |
| **Auto-suspend** | No response in 24h OR second medium violation OR any high-severity (R1 confirmed, R3 hard category, R6 two-party violation, R8 chargeback >1%) | Generation paused, scheduled sends paused, ads paused, hosted funnels returned with 503 + branded message | Open until resolved |
| **Manual appeal** | Customer files appeal via form | Confirmation email; reviewed by tier-2 T&S analyst | 5 business days to decision |
| **Reinstate** | Appeal granted, remediation verified | All services resumed; flag retained on account | â€” |
| **Permanent ban** | Appeal denied OR repeat post-reinstate violation OR R1/R3/R9 confirmed severe | Account closed; data export window 30 days; refund per ToS; domains removed | Final |

### 13.2 Audit log
Every state transition writes to immutable append-only `ts_audit` table: `actor` (system|human:user_id), `workspace_id`, `from_state`, `to_state`, `reason_code`, `evidence_refs[]` (URLs to artifacts), `timestamp`. Retained 7 years.

### 13.3 Refund posture
- Auto-suspend: prorated refund of unused subscription on a confirmed wrongful suspend.
- Permanent ban for confirmed fraud (R1/R3/R8): no refund; chargebacks defended.

---

## 14. Annual public Trust & Safety report

Published Q1 each year for the prior year. Aggregated, no PII.

Contents:
1. Total accounts created / total accounts suspended / total accounts permanently banned (with % breakdown by category).
2. Total artifacts generated / total artifacts blocked at gen-time / total blocked at publish-time / total taken down post-publish.
3. Breakdown by risk class (R1â€“R10) and by industry.
4. SMS / voice DNC compliance metrics: opt-in proof rate, STOP honor latency, complaint volume.
5. Ad-platform rejection rates per platform.
6. Human review queue metrics (from 07b): volume, SLA adherence, reviewer accuracy.
7. Appeals: filed / granted / denied; median time-to-decision.
8. Notable policy changes during the year.
9. Cooperation with law enforcement: number of valid requests received, number complied with, number declined, by jurisdiction.

Format: hosted at `funelai.com/trust-report/<year>`. PDF + machine-readable JSON.

---

## 15. Engineering interfaces (summary)

```
ts-svc.classify_phishing(artifact_id) -> {score, signals[], action}
ts-svc.kyb_check(workspace_id) -> {score, sources_used[], action}
ts-svc.classify_offer(artifact_id) -> {category|null, tier_hit, action}
ts-svc.payment_check(payment_intent_id) -> {action, rules_fired[]}
aff-svc.cluster_score(affiliate_id) -> {score, components}
ad-policy-svc.classify(ad_id) -> {verdict, categories[], explanation}
consent_ledger.record_sms_optin(workspace_id, e164, source, evidence) -> id
consent_ledger.record_voice_consent(call_id, â€¦) -> id
domain-rep-scan.run(domain) -> {flags[], action}
```

All emit events on `ts.events` Kafka topic for downstream consumers (07b queue, 07c cost-governor, ops dashboards).

---

## 16. Open items (track for Day-180 review)

- Brand list curation pipeline (currently manual PR â€” does not scale past ~500 brands).
- Two-party-consent recording-state list needs legal-counsel sign-off quarterly (laws change).
- KYB SoS coverage is US-only top-10 states programmatically; international expansion needs vendor (Middesk or Trulioo) selection.
- Affiliate cluster analysis is nightly batch; consider near-real-time for high-value referrals.
