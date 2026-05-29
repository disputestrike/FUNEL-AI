# GoFunnelAI — Industry Knowledge Base (KB) Pack Template

> **Document type:** Canonical template
> **Owner:** GoFunnelAI KB Editorial Council
> **Version:** 1.0
> **Status:** Locked — fill in every section, do not rename headings, do not skip fields.

---

## 0. How to use this template

This document is the **single source of truth** that every domain expert fills in for their industry. The completed pack is ingested by GoFunnelAI's multi-agent generation engine (Hook agent, Page agent, Compliance agent, RevTry voice agent, Sequence agent, Score agent) via pgvector retrieval. Inconsistency between packs creates inconsistent funnels — therefore:

### Rules of the road

1. **Do not rename, reorder, or delete sections.** The generation engine uses heading anchors as retrieval keys (e.g. `#7-common-objections`). Renaming breaks retrieval.
2. **Fill every field.** If a field truly does not apply, write `N/A — [one-sentence reason]`. Never leave blank.
3. **Use the exact subsection schemas.** Each persona, objection, ad angle, etc. must follow the prescribed bullet structure. The Hook agent, for example, fans out over `### Ad angle N` blocks — missing fields cause null prompts.
4. **One claim, one citation.** Every benchmark number (CPL, conversion rate, close rate, TAM) must cite a source in the format `[Source: <name>, <year>]`. If proprietary, write `[Source: GoFunnelAI internal, <quarter>]`. The Compliance agent rejects unsourced numerics.
5. **Voice and tense.** Write in present tense, second person ("you, the installer") for buyer-facing language; third person for analytical sections. Avoid hedges ("maybe", "could be") — be definitive. The pack is a generation prompt, not an essay.
6. **No emoji, no marketing fluff, no exclamation points.** This document is a structured database, not a brochure.
7. **Length floors.** Each major section has a minimum word/item count noted in `[brackets]`. Going under signals incomplete research and the pack is rejected.
8. **Compliance is non-negotiable.** Sections 11 (Prohibited claims) and 12 (Compliance rules) are reviewed by GoFunnelAI legal before the pack ships. Be specific — cite statute, FTC guide, or state administrative code.
9. **Update cadence.** Packs are versioned quarterly. Mark every benchmark with `[updated: YYYY-QN]`.
10. **Anonymization.** Section 21 example funnels must be either (a) public URLs of competitors, or (b) anonymized clones of GoFunnelAI customer funnels with PII and brand names scrubbed.

### Filling order (recommended)

1. Sections 1–4 (market and personas) — frames everything.
2. Section 12 (compliance) — sets the guardrails for everything that follows.
3. Sections 5–6 (pain points, urgency) — feed Hook agent.
4. Sections 7–10 (objections, proof, offers, lead magnets) — feed Page agent.
5. Sections 13–18 (ad angles, forms, scoring, scripts, sequences) — operational.
6. Sections 19–21 (benchmarks, seasonality, examples) — calibration data.

---

## 1. Market overview

> **Floor:** 400 words minimum. Every numeric requires a citation.

### 1.1 Vertical definition
- **Industry name:**
- **NAICS / SIC code(s):**
- **Sub-segments included in this pack:** (e.g. "residential rooftop, not commercial, not utility-scale")
- **Sub-segments explicitly excluded:** (and why — usually buyer mismatch)
- **Geographic scope of this pack:** (country, regions, regulatory zones)

### 1.2 TAM / SAM / SOM
- **TAM (Total Addressable Market):** $[X] [year]. [Source]
- **SAM (Serviceable Addressable Market for a single installer/operator):** $[X]
- **SOM (realistic share for a GoFunnelAI customer in year 1):** $[X]
- **Number of operators in market:** [N]
- **Annual new-customer demand:** [N units or $X spend]

### 1.3 Deal economics
- **Average deal size (median, not mean):** $[X]
- **Range (10th / 90th percentile):** $[X] / $[X]
- **Gross margin per deal:** [X]%
- **Customer LTV (if recurring):** $[X]
- **Acceptable CAC for a healthy operator:** $[X] (= LTV / [N]x)
- **Acceptable CPL (cost per lead) implied by CAC:** $[X] (assumes [Y]% lead-to-close)

### 1.4 Sales cycle
- **First-touch to closed-won median:** [N days]
- **Range:** [N] – [N] days
- **Critical path stages:** (e.g. lead â†’ call â†’ in-home consult â†’ proposal â†’ contract â†’ install)
- **Where deals stall most:** [stage], [reason]
- **Single biggest accelerant:** (e.g. "in-home appointment within 48 hours of lead")

### 1.5 Buying triggers
List the top 7 events that cause a prospect to move from passive to active buying. Format each as:
- **Trigger:** [event]
  - **Search behavior change:** [what they Google]
  - **Time horizon to purchase:** [days/weeks]
  - **GoFunnelAI signal source:** [how we detect it — intent data, season, news, etc.]

---

## 2. Buyer personas

> **Floor:** 3–5 personas. Each persona must include every sub-field. No "miscellaneous" persona.

For each persona, use this exact template:

### Persona N — [Short name, e.g. "Refi Rachel"]

- **One-line summary:**
- **Share of vertical's deal volume:** [X]%
- **Demographics:**
  - Age range:
  - Household income:
  - Education:
  - Geography (urban/suburban/rural, regions):
  - Home/business ownership status:
  - Family structure:
- **Psychographics:**
  - Core identity (how they see themselves):
  - Media diet (channels, publications, influencers):
  - Trust hierarchy (who they believe — friends > Google > sales rep, etc.):
  - Decision style (analytical / emotional / consensus / impulsive):
  - Risk tolerance:
- **Jobs-to-be-done (JTBD):**
  - Functional job:
  - Emotional job:
  - Social job:
- **What they say out loud (verbatim phrases to mirror in copy):** [5 examples in quotes]
- **What they secretly fear (subtext for hooks):** [3 examples]
- **What "winning" looks like 12 months after purchase:**
- **Disqualifiers — do not target if:**

---

## 3. Pain points (top 10, ranked)

> **Floor:** Exactly 10. Ranked by frequency Ã— intensity. Each pain gets a stable ID `P1`–`P10` referenced by other sections.

For each pain:

### P[N] — [Short name]
- **Rank:** [1–10]
- **Frequency (% of buyers who feel this):** [X]%
- **Intensity (1–5):** [N]
- **The pain in the buyer's own words:** "[verbatim quote]"
- **Root cause:**
- **Status-quo cost of doing nothing:** [$ or qualitative]
- **Adjacent pains it triggers:** [P-IDs]
- **Best hook framing for this pain:** [one sentence]

---

## 4. Urgency triggers

> **Floor:** 3 seasonal + 3 financial + 3 regulatory = 9 minimum. More is better.

### 4.1 Seasonal
For each: **Trigger | Window | Why urgency spikes | How to surface in copy**

### 4.2 Financial
For each: **Trigger | Window | $ at stake | How to quantify in copy**

### 4.3 Regulatory
For each: **Trigger | Effective date | Penalty for inaction | Compliance-safe phrasing**

### 4.4 Competitive / supply
Capacity, price, or competitor moves that create urgency (e.g. "panel tariffs increase Jan 1", "rebate pool depletes by Q3").

---

## 5. Common objections (top 10 with rebuttals)

> **Floor:** Exactly 10. Each objection must have a primary rebuttal and a backup rebuttal. Format:

### O[N] — [Objection name]
- **What the buyer says verbatim:** "[quote]"
- **Underlying real fear:**
- **Worst response (do not say):**
- **Primary rebuttal (1–2 sentences):**
- **Proof element that closes it:** [reference to Section 6 proof type]
- **Backup rebuttal if primary fails:**
- **Disqualify if:** [conditions under which the objection is real and the prospect is not a fit — don't waste reps' time]

---

## 6. Proof types that work

> **Floor:** Rank the top 8 proof types by lift in this vertical. Each must include format spec for Page agent.

### 6.1 Testimonials
- Format that works best (video / written / quote-card):
- Length: [N seconds or N words]
- Required elements: (name, location, before/after metric, install date, etc.)
- Verification standard: (do you require signed release? video review?)
- Top 3 testimonial angles for this vertical:

### 6.2 Photos / before-after
- What to show:
- What to never show:
- Resolution / format requirements:

### 6.3 Certifications / licenses
- List every certification a credible operator should display:
- Required vs. nice-to-have:
- Verification URLs (consumers can validate):

### 6.4 Third-party badges
- BBB, Google, Yelp, industry-specific (e.g. SolarReviews, GuildQuality, HomeAdvisor):
- Minimum rating threshold to display:

### 6.5 Press / media mentions
- Tier 1 outlets that move the needle:

### 6.6 Case studies
- Length, structure, required metrics:

### 6.7 Live counters / social proof widgets
- E.g. "X installs this month in [city]" — what's allowed under FTC?

### 6.8 Authority figures
- Trade-group endorsements, government program participation:

---

## 7. Offer archetypes

> **Floor:** Cover all 5 archetypes below with at least one concrete example each.

For each archetype:

### 7.1 Lead magnet (free download)
- Best-performing format:
- Example titles:
- Friction level:
- Lead quality (1–5):
- When to use:

### 7.2 Tripwire (low-cost paid commitment)
- Best price point:
- Example offers:
- Refund policy norm in this vertical:

### 7.3 Free consult / discovery call
- Length:
- Format (phone / video / in-home):
- What the rep does on the call:
- Show rate norm:

### 7.4 Free audit / inspection / assessment
- What is audited:
- Time required:
- On-site vs. remote:
- Conversion to paid norm:

### 7.5 Instant quote / estimate
- Inputs required:
- Accuracy disclosure required (legal):
- Conversion to consult norm:

---

## 8. Lead magnets (5–10 concrete examples)

> **Floor:** 5–10. For each:

### LM[N] — [Title]
- **Format:** (PDF guide / calculator / quiz / video / checklist / template)
- **Length / time-to-consume:**
- **What's inside (table of contents):**
- **Pain points addressed:** [P-IDs]
- **Personas it converts best:** [Persona names]
- **Promised outcome:**
- **Headline that sells it:**
- **Page conversion benchmark:** [X]% opt-in

---

## 9. Funnel archetypes (3 layouts, ranked)

> **Floor:** Exactly 3, ranked by historical conversion lift. Each described as a page-by-page wireframe.

### FA1 — [Name, e.g. "Quiz â†’ Quote â†’ Call"]
- **Rank / why it wins:**
- **Page sequence:** [page 1 â†’ 2 â†’ 3 â†’ ...]
- **For each page, list:**
  - Goal:
  - Headline pattern:
  - Hero element:
  - Trust elements:
  - CTA:
  - Form fields (reference Section 14):
  - Exit-intent treatment:
- **Best traffic source for this archetype:**
- **Worst persona fit:**
- **Benchmark end-to-end conversion (visitor â†’ booked call):** [X]%

(Repeat for FA2, FA3.)

---

## 10. Ad angles (10–15 proven hooks)

> **Floor:** 10–15. The Hook agent fans out over these. Each gets a stable ID `AA1`–`AA15`.

### AA[N] — [Angle name]
- **One-line angle:**
- **Pain it taps:** [P-ID]
- **Emotional register:** (fear / aspiration / curiosity / anger / belonging / FOMO)
- **3 headline examples:**
- **3 primary-text openers (50–80 chars):**
- **Best visual concept:**
- **Best CTA:**
- **Best persona:** [Persona]
- **Channel fit:** (Meta / TikTok / YouTube / Google search / native — rank top 2)
- **Compliance risk level:** (Low / Med / High) and why
- **Historical CTR / CPL range:** [X]% / $[X]

---

## 11. Prohibited claims (FTC + state + industry compliance)

> **Floor:** This is the compliance agent's hard-block list. Be specific. Cite statute or guide.

### 11.1 Universal prohibitions (FTC)
- "Free" when it isn't truly free — FTC Guide Â§251
- "Guaranteed" savings, returns, results — FTC Endorsement Guides 16 CFR Part 255
- Unsubstantiated quantitative claims (any "X%" requires citation)
- Hidden material connections in endorsements
- Fake scarcity / countdowns that reset

For each, list:
- **Banned phrase / pattern:**
- **Why it's banned (statute):**
- **Acceptable alternative phrasing:**

### 11.2 Industry-specific prohibitions
List every claim category that this specific industry's regulators (DOE, FDA, HUD, state AGs, state licensing boards, etc.) restrict. Format identically.

### 11.3 State-by-state variances
Table: **State | Claim | Restriction | Penalty | Source**

### 11.4 Phrases the GoFunnelAI Compliance agent will hard-block
List exact strings (regex-friendly) that will fail generation. Minimum 20.

---

## 12. Compliance rules (HIPAA / TCPA / state licensing / disclosures)

> **Floor:** Be exhaustive. Cite every rule.

### 12.1 TCPA (calls and SMS)
- Required consent language:
- Quiet hours:
- DNC scrub cadence:
- Reassigned-number safe-harbor process:
- Penalty per violation:

### 12.2 CAN-SPAM (email)
- Required physical address:
- Unsubscribe SLA:
- Subject-line honesty rule:

### 12.3 HIPAA (if applicable)
- N/A if not health-adjacent.

### 12.4 State licensing
- Required license types for the operator:
- Required license display on funnel pages (number, expiration, issuing body):
- States that require pre-disclosure of pricing methodology:

### 12.5 Financing / APR disclosures
- TILA / Reg Z language if financing is mentioned:
- "Subject to credit approval" placement:

### 12.6 Energy / health / financial disclaimers (industry-specific)
- Required boilerplate at bottom of every page:

### 12.7 Accessibility (ADA / WCAG)
- Minimum WCAG conformance level:
- Specific failure modes regulators have sued for in this vertical:

---

## 13. Form fields (recommended vs. avoid)

> **Floor:** Cover at least 15 candidate fields. For each:

### 13.1 Recommended fields
Table: **Field | Type | Required? | Rationale (predicts close / disqualifies / routes) | Lead-score weight**

### 13.2 Avoid fields
Table: **Field | Why avoiding it lifts conversion**

### 13.3 Progressive profiling order
For multi-step forms, the optimal order is: [list]. Rationale per step.

### 13.4 Hidden / passive fields
- UTM capture:
- IP geo:
- Device:
- Referrer:
- Time-on-page before submit:

---

## 14. Lead scoring rules

> **Floor:** Define a 0–100 score with at least 12 signal rules. The Score agent applies these in real time.

### 14.1 Demographic signals
Table: **Signal | Condition | Points | Rationale**

### 14.2 Behavioral signals
Table: **Signal | Condition | Points | Decay**

### 14.3 Intent / source signals
Table: **Source | Points | Notes**

### 14.4 Negative signals (auto-disqualify or score below 20)
List every hard disqualifier (e.g. "renter checkbox = true" in a homeowner vertical).

### 14.5 Score thresholds
- 80–100 — [route to: top closer, call within 5 min]
- 60–79 — [route to: standard rep queue]
- 40–59 — [nurture sequence, call after 24h]
- 20–39 — [email-only nurture]
- 0–19 — [drop or low-cost broadcast]

### 14.6 Predicts-closure correlation table
Top signals correlated with closure in this vertical, ranked.

---

## 15. RevTry voice call script

> **Floor:** Full script with branches. GoFunnelAI's RevTry voice agent reads this as a state machine.

### 15.1 Opener (first 15 seconds)
- Greeting:
- Permission-to-continue line:
- Reason-for-call line:
- Pattern interrupt if prospect is cold:

### 15.2 Qualifying questions (BANT-equivalent for this vertical)
List in exact order with branch logic:
- Q1: [question] — if [answer X], go to Q2; if [answer Y], go to disqualify branch.
- Q2: ...
- (Minimum 6 questions.)

### 15.3 Discovery / pain dig
- Pain-confirmation questions:
- Cost-of-inaction questions:
- "Tell me more about that" probes:

### 15.4 Objection handlers (one per O1–O10 from Section 5)
For each: trigger phrase â†’ response â†’ fallback â†’ escalation cue.

### 15.5 Booking close
- Soft close phrasing:
- Direct close phrasing:
- Assumptive calendar phrasing:
- Two-yes options:

### 15.6 If prospect won't book
- Nurture-tag branch:
- Callback-scheduling branch:
- Polite exit:

### 15.7 Voicemail script
- 22-second voicemail with call-back hook:

### 15.8 Compliance disclosures inside the call
- Recording disclosure:
- TCPA-required language if applicable:
- "Stop calling me" handling:

---

## 16. SMS sequences (3-touch with timing)

> **Floor:** 3 SMS, timing relative to lead-create.

For each touch:

### SMS [N] — [Purpose]
- **Send at:** [T+N min/hours]
- **Body (â‰¤160 chars, no shortened links unless brand-registered):**
- **STOP / HELP compliance footer:**
- **Trigger to halt sequence:** (replied, booked, opted out)
- **A/B variant:**

Also include:
- 10DLC registration prerequisites
- Carrier-filter risky words to avoid in this vertical
- Sender-name pattern (e.g. "Solar — Reply STOP to opt out")

---

## 17. Email sequences (7-touch with subject lines and timing)

> **Floor:** Exactly 7 emails. Each with subject, preview, send-time, body outline, CTA.

For each email:

### Email [N] — [Purpose]
- **Send at:** [T+N hours/days]
- **Subject line A:**
- **Subject line B (A/B):**
- **Preview text (â‰¤90 chars):**
- **Body outline (4–6 bullets):**
- **Primary CTA:**
- **Secondary CTA:**
- **Halt trigger:**
- **Compliance footer reminders:**

Also include:
- Sender-identity strategy (rep name vs. company name) and why
- Best send-times for this vertical's persona
- Re-engagement branch for non-openers after Email 4

---

## 18. Benchmark CPL (lower / median / upper, by geography)

> **Floor:** Provide a table per channel Ã— geo. Cite source quarter.

### 18.1 By channel
Table: **Channel | Lower (10th %ile) | Median | Upper (90th %ile) | Source**

### 18.2 By geography
Table: **Geo tier | Median CPL | Notes**
- Tier 1 (top-10 metros)
- Tier 2 (11–50 metros)
- Tier 3 (rural / low population)
- International (if applicable)

### 18.3 CPL drivers (what moves the number up or down)
Bulleted list with directional magnitude (e.g. "+30% in Q4 due to political ad crowding").

---

## 19. Benchmark conversion rates

> **Floor:** Full funnel benchmarks. Cite quarter.

### 19.1 Stage conversion rates
Table:
- **Stage | Lower | Median | Upper**
- Visitor â†’ form-start
- Form-start â†’ form-submit
- Lead â†’ call-connected
- Call-connected â†’ appointment-booked
- Appointment-booked â†’ appointment-held
- Appointment-held â†’ proposal-sent
- Proposal-sent â†’ closed-won

### 19.2 Channel-mix variance
How median rates change by source (paid social, paid search, organic, referral, outbound).

### 19.3 Speed-to-lead correlation
"Call within X min lifts close rate by Y%." Cite GoFunnelAI data or industry source.

---

## 20. Seasonal cycles (best/worst months)

> **Floor:** Month-by-month index. 100 = annual median.

### 20.1 Demand seasonality
Table: **Month | Demand index | Driver**

### 20.2 CPL seasonality
Table: **Month | CPL index | Driver**

### 20.3 Close-rate seasonality
Table: **Month | Close-rate index | Driver**

### 20.4 Calendar of action
- When to scale spend:
- When to launch new creative:
- When to harvest existing list:
- When to cut budget:

---

## 21. Top 20 example funnels

> **Floor:** Exactly 20. Mix of public-URL competitor funnels and anonymized internal references.

For each:

### EX[N] — [Brand or "Anonymized — [archetype]"]
- **URL or internal ID:**
- **Archetype used:** [FA1/FA2/FA3]
- **Primary persona:**
- **Hero hook (verbatim or paraphrased):**
- **Lead magnet / offer:**
- **Form length:**
- **Notable trust elements:**
- **What it does well:**
- **What it does poorly:**
- **Estimated monthly traffic:**
- **Estimated CR:** [X]%
- **Why it's in this list:**

---

## 22. Glossary (industry terms)

> **Floor:** 20+ terms. The retrieval engine uses this for term-expansion in user queries.

Format: **Term | Definition | Synonyms | Avoid-in-buyer-copy?**

---

## 23. Sources and citations

> **Floor:** Bibliography in plain list. Every `[Source: ...]` reference in the pack resolves here.

- [Source N] — Author, "Title", Publisher, Year, URL or DOI

---

## 24. Pack metadata (do not edit by hand)

```yaml
pack_id: <industry-slug>
version: 1.0
last_updated: YYYY-QN
editor: <name>
reviewer_legal: <name>
reviewer_ops: <name>
embedding_model: text-embedding-3-large
chunk_strategy: by_section_heading
retrieval_keys:
  - section: 1
    anchor: "#1-market-overview"
  # ...one entry per section
```

---

**End of template. Do not delete this footer line.**
