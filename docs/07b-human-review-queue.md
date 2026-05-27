# 07b â€” Human Review Queue

Owner: Head of Trust & Safety + Head of Operations
Status: Day-90 launch baseline
Related: `07a-trust-and-safety-policy.md`, `07c-cost-governor.md`, `02a-kb-pack-template.md`
Review cadence: Weekly metrics, monthly calibration, quarterly staffing model

---

## 1. Purpose

Some generations are not auto-approvable and not auto-blockable. They need a trained human in the loop â€” for legal exposure, brand risk, or borderline policy calls. This document specifies which generations route to that human, how the queue operates, what reviewers can do, what customers see, and how we measure reviewer quality.

This is the operational counterpart to 07a's classifier system. Where 07a says "route to human review", this document says exactly how.

---

## 2. Auto-routing rules (a generation enters the queue if **any** trigger fires)

### 2.1 Industry triggers (vertical-based)
Workspace's declared industry âˆˆ regulated set. Configured in `industries.yaml`:

```
regulated_industries:
  healthcare:
    - general_medical
    - dental
    - mental_health
    - addiction_treatment
    - hair_restoration
    - cosmetic_surgery
    - weight_loss
    - glp1_specifically
    - supplements_otc
  financial:
    - financial_advisors
    - mortgage
    - insurance_life
    - insurance_health
    - insurance_pc
    - debt_relief
    - bankruptcy
    - tax_relief
    - credit_repair
    - investing_securities
  legal:
    - personal_injury
    - family_law
    - dui_defense
    - employment_law
    - immigration
    - criminal_defense
    - estate_planning
  other_regulated:
    - cannabis_licensed_state_only
    - gambling_licensed_state_only
    - firearms_licensed_dealer
```

If the workspace's industry is in this list, **every** customer-facing published artifact for that workspace routes to review before first publish. After the workspace passes 10 consecutive clean reviews in the same industry, the workspace moves to "fast lane" â€” only the content-based triggers (2.2) and edge triggers (2.3) apply going forward. Fast-lane status is revoked on any rejection.

### 2.2 Content triggers (language/imagery-based, run on every generation regardless of industry)

| Trigger | Detector |
|---|---|
| Income claims | Regex on $ amounts paired with earn/make/generate/passive verbs; also "replace your salary", "fire your boss", "financial freedom" + numeric. |
| Weight-loss claims | "lose X lbs/kg", "drop X sizes", "in X days/weeks" + body-related noun. |
| Medical outcome claims | "cure", "treat", "reverse", "eliminate" + medical condition; "FDA-approved" without licensure proof. |
| Guarantee language | "guaranteed", "100% guarantee", "money-back guarantee" â€” context-classified (some are OK e.g. refund policy; outcome guarantees are not). |
| Before/after imagery | Image classifier detects paired body-shot / face-shot composition + same-subject heuristic via face-embedding similarity. |
| Superlative claims | "best", "#1", "top-rated", "leading", "proven", "world-class" without substantiating disclaimer in same artifact. |
| Testimonial with specific outcome | LLM-classified: "I lost 40 lbs in 30 days usingâ€¦" â€” testimonial + specific numeric outcome. |
| Sensitive demographic targeting | Copy implies awareness of viewer's age, weight, health, debt, sexual orientation, race, religion. |

### 2.3 Edge / risk triggers

| Trigger | Threshold |
|---|---|
| Funnel daily ad spend | > $1,000/day at the funnel level (high stakes â€” a bad ad burns money fast) |
| Quality score borderline | 80â€“85 inclusive (above 85 auto-pass; below 80 auto-reject for re-gen) |
| Compliance agent flag raised, not auto-blocked | Any `severity=medium` flag from compliance pipeline |
| New domain | Published domain < 30 days old (WHOIS) |
| New customer first publish in regulated vertical | Customer's first-ever publish + industry âˆˆ Â§2.1 |
| Compliance KB version mismatch | The KB pack referenced in the generation is > 30 days stale relative to the current published version |
| Repeat-suspend customer | Customer previously suspended and reinstated (per 07a Â§13) â€” every publish for 90 days post-reinstate routes to review |

### 2.4 Customer-tier interaction
- Free tier: any publish triggers review for the first 3 funnels regardless of triggers (training-data + quality-control window).
- 7-Day Pro Boost: triggers apply normally; SLA priority is the user's paid SLA (see Â§5).
- Scale / Agency: triggers apply normally, but tier-2 reviewer assigned for regulated verticals (legal/medical/financial).

---

## 3. State machine

```
[draft] â”€generateâ”€â–¶ [generating] â”€completeâ”€â–¶ [auto_check]
[auto_check] â”€passâ”€â”€â–¶ [approved] â”€publishâ”€â–¶ [published]
[auto_check] â”€routeâ–¶ [review_required] â”€reviewer_actionâ”€â–¶ {approved | approved_with_edits | rejected | escalated}
[approved_with_edits] â”€system_applies_editsâ”€â–¶ [auto_check_2]   # re-runs auto checks, max 2 cycles
[auto_check_2] â”€passâ”€â–¶ [approved] â”€publishâ”€â–¶ [published]
[rejected] â”€customer_appealâ”€â–¶ [appeal_review] â”€{appeal_granted|appeal_denied}
[escalated] â”€legal_counsel_reviewâ”€â–¶ {approved | rejected | rejected_permanent}
```

Persisted in `generation.state` with full history in `generation_state_history`. Transitions are append-only.

A generation in `review_required` is **paused** â€” agents in the orchestrator stop; downstream publish-, ad-push-, send- jobs are not enqueued. Cost meter (07c) is paused too.

---

## 4. Reviewer pool & staffing

### 4.1 Day-90 launch composition

| Role | Headcount | Responsibility |
|---|---|---|
| Tier-1 Reviewer | 3 | Standard reviews. Trained on KB packs + policy. Decisions on approve/edit/reject for non-escalated cases. |
| Tier-2 Lead | 1 | Calibration, escalations, edge cases, training. Reviews 100% of tier-1 rejections in week 1 (calibration), 10% sampled thereafter. |
| Fractional outside legal counsel | retainer | Escalated cases involving regulated medical/legal/financial advice that the lead can't resolve. SLA: 1 business day. |

### 4.2 Scale plan

| Milestone | Tier-1 | Tier-2 | Notes |
|---|---|---|---|
| Day 90 (launch) | 3 | 1 | Cover US business hours, Pacific bias |
| Month 3 | 5 | 1 | Add overnight coverage (US PT 18:00â€“02:00) |
| Month 6 | 8 | 2 | 24Ã—5 coverage, weekends on-call rotation |
| Month 12 | 15 | 3 | True 24Ã—7, specialized vertical reviewers (medical, legal, financial) |

Staffing model in Â§11; recompute monthly using queue volume + SLA adherence + accuracy targets.

### 4.3 Training & onboarding (every new reviewer)
- 2-week paid training: policy doctrine (07a), KB packs (02a) for top 10 industries, calibration set of 200 historical decisions with rubric, shadow live queue under tier-2 supervision.
- Certification: reviewer must hit â‰¥ 95% agreement with tier-2 on a 50-case held-out test set before taking live decisions unsupervised.
- Recertification: quarterly.

---

## 5. SLA

| Window | Free / Starter | Growth | Scale / Agency |
|---|---|---|---|
| Business hours (Monâ€“Fri 8amâ€“6pm PT) | 4 hours | 2 hours | 1 hour |
| After-hours / weekends | 24 hours | 12 hours | 4 hours |
| Escalated to legal counsel | +1 business day on top | +1 business day | +1 business day |
| Appeal review | 5 business days | 3 business days | 2 business days |

SLA clock starts when the generation enters `review_required` and pauses if customer info is requested.

Customer-facing UI shows an actual estimated time, refreshed every 5 minutes from queue depth and current per-reviewer throughput:

> "Your funnel is in expert review. Estimated time: ~2 hours. We review everything in regulated industries to keep you and your customers protected."

NEVER show "blocked", "flagged for risk", or "in moderation" as the only message â€” these read as accusatory or opaque. Wording is positive and explanatory.

---

## 6. Reviewer dashboard

Web app at `review.funelai.com` (internal SSO via Google Workspace + WebAuthn).

### 6.1 Queue view
- Filterable by industry, trigger reason, customer tier, SLA risk (red = <30min to breach), reviewer assignment.
- Auto-assignment: round-robin among available reviewers; lock-on-claim; auto-release if reviewer idle > 15min on an item; tier-2 review queue separate.

### 6.2 Item view (single generation under review)
Side-by-side layout:

| Left pane | Right pane |
|---|---|
| Current generation rendered as customer will see it (page preview, ad preview, email preview, SMS preview, voice script with TTS playback button) | Compliance rules from the relevant KB pack (02a), filterable to "rules potentially triggered". Each rule shows source citation, expected language, banned language. |

Below the side-by-side:

- **Trigger panel**: which routing rules fired, with the specific text/image excerpt highlighted.
- **Suggested edits**: AI-generated proposed redlines that would resolve each trigger. Reviewer can accept/edit/reject each suggestion.
- **History**: every previous generation by this customer + outcome (approved / approved with edits / rejected / appealed).
- **Customer context**: workspace age, vertical, KYB status, ad spend, prior violation flags, current quality score.

### 6.3 Actions panel

| Action | Effect |
|---|---|
| **Approve as-is** | Generation â†’ `approved` â†’ publishes. |
| **Approve with edits** | Reviewer commits edits inline; system re-runs `auto_check_2`; if it passes, publishes; if it fails, reviewer is asked to revise further or reject. Max 2 cycles before mandatory reject or escalate. |
| **Reject** | Pick a reason from the structured list (Â§6.4). Optional free-text up to 500 chars (shared with customer). Generation â†’ `rejected`. |
| **Request changes** | Send back to customer with specific structured requests (e.g., "remove specific weight-loss claim on line X, add disclaimer Y"). Customer revises, generation re-routes to same reviewer if available. |
| **Escalate** | Choose: `tier_2_lead` (default), `legal_counsel`, `t&s_policy_question`. Item moves to corresponding queue with notes. |

### 6.4 Structured rejection reasons (required selection)
Reviewers must select at least one; multiple allowed. The selection is what the customer sees verbatim in the rejection message.

```
- unsubstantiated_outcome_claim
- unsupported_superlative
- guarantee_language_not_permitted_in_industry
- before_after_imagery_not_permitted
- protected_class_targeting
- impersonation_brand_or_government        (also flags 07a R1)
- missing_required_disclaimer
- missing_state_license_proof              (regulated vertical)
- ad_platform_policy_violation_meta
- ad_platform_policy_violation_google
- testimonial_without_substantiation
- testimonial_implying_typical_result
- consent_proof_insufficient                (SMS/voice)
- domain_age_or_reputation_concern
- offer_category_not_supported             (also flags 07a R3)
- other_see_details                         (free-text required)
```

### 6.5 Keyboard shortcuts
`a` approve Â· `e` approve-with-edits Â· `r` reject Â· `c` request-changes Â· `g` escalate Â· `n`/`p` next/prev Â· `?` help.

---

## 7. Audit logging

Every reviewer action persists to `review_audit`:

```
review_audit:
  id: uuid
  generation_id: fk
  workspace_id: fk
  reviewer_id: fk
  action: enum(approve, approve_with_edits, reject, request_changes, escalate)
  reasons: text[]           # structured rejection-reason codes
  free_text: text            # optional, customer-visible portion separated
  edits_diff: jsonb          # for approve_with_edits
  time_to_decision_seconds: int
  triggers_that_fired: text[]
  kb_rules_referenced: text[]   # rule IDs from KB pack
  outcome_post_publish: text     # filled later: published, taken_down, appealed_then_â€¦
  created_at: ts (immutable)
```

Append-only. Retained 7 years. PII (customer-end content) lives in the linked generation record under standard data-retention; review_audit holds references not copies.

---

## 8. Customer-facing communication

### 8.1 In-product banners

| State | Banner text |
|---|---|
| `review_required` | "Your funnel is in expert review. Estimated time: ~2 hours. We review every funnel in [healthcare/legal/financial/â€¦] before it goes live to protect you from FTC + state penalties. We'll notify you the moment it's ready." |
| `approved` | "Approved â€” you're live." |
| `approved_with_edits` | "Approved. Our reviewer made small edits to keep you compliant â€” [link to diff]." |
| `request_changes` | "We need a couple of changes before this can go live: [structured list]." |
| `rejected` | "We can't publish this funnel as written because [reason]. [Suggested next steps]. You can appeal within 7 days." |
| `escalated_to_legal` | "This funnel raises a question we want our legal counsel to look at. Expected resolution: 1 business day." |

NEVER: "your account is flagged", "compliance violation", "we don't trust your business", "human moderator", "blocked".

ALWAYS: positive framing, specific actionable reason, time estimate, path forward.

### 8.2 Email notifications
Same content, plus a deep-link to the funnel + (for rejects) appeal CTA.

---

## 9. Appeal flow

### 9.1 Eligibility
Customer can appeal any `rejected` decision within 7 calendar days. After 7 days, the rejection is final (but customer can re-generate a new funnel addressing the issues).

### 9.2 Appeal form
- Customer states why they believe the decision was wrong, max 2000 chars.
- Customer can attach evidence: license documents, FDA filings, FTC substantiation, prior-published similar content from competitors, etc.
- Customer can request specific reviewer-not (recuse the original reviewer).

### 9.3 Appeal review
- Routed to a **different** reviewer at tier-2 or higher.
- Reviewer sees: original generation, original decision + reasons, appeal submission, evidence, original reviewer's notes.
- Decision options:
  - `appeal_granted` â†’ generation moves to `approved` (or `approved_with_edits` if minor changes resolve the issue) â†’ publishes. Customer notified. Original rejection annotated with the reversal.
  - `appeal_denied` â†’ final. Detailed explanation sent. Customer can re-generate but cannot re-appeal the same content.
  - `escalate_to_legal_counsel` â†’ outside counsel makes final call.

### 9.4 Reviewer reversal tracking
Reversal rate per original-reviewer tracked. Persistent high reversal rate (> 10% on appealed decisions over 60 days, with â‰¥ 5 appeals) triggers reviewer re-calibration.

---

## 10. Quality assurance on reviewers

### 10.1 Audit sampling
- **10% random sample** of every reviewer's decisions audited by tier-2 lead each week.
- **100% sample** of escalated cases.
- **100% sample** of decisions on workspaces with > $5K/mo ad spend (high-stakes).
- **Adversarial set**: 5 synthetic test cases per reviewer per month, planted into queue â€” gold-labeled by tier-2. Reviewer doesn't know which are tests.

### 10.2 Metrics tracked per reviewer

| Metric | Target | Action if missed |
|---|---|---|
| Decision accuracy (vs audit gold) | â‰¥ 95% | < 95% â†’ re-calibration + 100% audit for 2 weeks |
| Median time-to-decision | â‰¤ 8 minutes | > 12 min sustained â†’ training refresh |
| SLA breach rate | < 5% | > 5% â†’ schedule review |
| Appeal-reversal rate | < 8% | > 10% â†’ re-calibration |
| Inter-rater agreement (on shared cases) | â‰¥ 90% | < 90% â†’ group calibration |

### 10.3 Calibration sessions
Monthly 90-min session: tier-2 lead walks the team through 10 hard cases from the prior month, group-discussed, decisions reconciled. Outputs feed back into training material + KB pack updates.

### 10.4 Reviewer wellbeing
- Mandatory break every 90 minutes (enforced in dashboard).
- Max 6 hours/day reviewing.
- Adult/illegal content (07a R3 tier-3 image classifier positives) routed only to opted-in reviewers; mental-health support program in place; rotation requirement.

---

## 11. Capacity model

Inputs:
- Average decision time: 8 min (target).
- Effective hours per reviewer per shift: 5 (8h shift minus breaks, admin, calibration).
- Decisions per reviewer per shift: ~37.
- Day-90 expected queue volume: 80 generations/day routed to review (estimate: 1,000 active workspaces Ã— 10% in regulated Ã— 0.8 publishes/day = 80). Sensitivity: linear in active workspaces.

Required reviewer-shifts/day = ceil(volume / 37). 80 â†’ 3 shifts â†’ 3 reviewers + 1 tier-2 lead at Day 90. Recompute monthly.

If queue depth grows such that SLA risk is > 25% of items, auto-escalate to ops Slack for surge staffing (overflow contractor pool, gated by trust + calibration).

---

## 12. Engineering interfaces

```
review-svc.enqueue(generation_id, triggers[], priority) -> review_item_id
review-svc.claim(reviewer_id) -> review_item   # round-robin
review-svc.act(review_item_id, action, payload) -> {next_state}
review-svc.reassign(review_item_id, to_reviewer_id, reason) -> ok
review-svc.metrics(reviewer_id, window) -> {accuracy, ttd, sla, â€¦}
appeals-svc.file(generation_id, customer_id, payload) -> appeal_id
appeals-svc.decide(appeal_id, decision, payload) -> {next_state}
```

Events emitted on `review.events` Kafka topic: `enqueued`, `claimed`, `acted`, `sla_at_risk`, `sla_breached`, `appealed`, `appeal_decided`.

Consumed by: orchestrator (to resume paused generations), 07c cost-governor (to resume the meter), customer notifications service, ops dashboards.

---

## 13. Open items (Day-180 review)

- Reviewer self-service rubric updates (currently tier-2 lead curates; team-wide proposal flow needed).
- Auto-routing of escalated legal cases to specific outside counsel firm by state (Day 90: single firm).
- Bilingual review (Spanish first) â€” estimated needed by Month 6 based on customer geo.
- Reviewer compensation model: salary + accuracy bonus (under design with finance).
- Inter-rater statistical methodology â€” currently simple pairwise agreement; consider Cohen's kappa once N > 10 reviewers.
