# 21 — Compliance Rules Library

**Document status:** v1.0 — **PENDING COUNSEL REVIEW**
**Owner:** VP Engineering + General Counsel (joint)
**Consumers:** Compliance Agent (Doc 12 Â§4.7, Doc 19 Â§3.4), Fact-Check Agent (Doc 12 Â§4.8), Human Review Queue (Doc 07b)
**Last updated:** 2026-05-25
**Next review:** 2026-08-25 (quarterly cadence — see Part D)

---

## CRITICAL LEGAL NOTICE

This document is a **machine-readable rules library** authored by GoFunnelAI engineering to power the Compliance Agent in the funnel generation pipeline. It is **not legal advice** and does **not** constitute the practice of law. GoFunnelAI is not a law firm.

**Every rule marked `[ATTY-REVIEW]` requires sign-off from licensed counsel in the relevant jurisdiction before being relied upon in production.** The interpretations here represent good-faith engineering reads of public statutes, FTC guidance, and state regulations as of Q2 2026. They will be wrong in some places. The quarterly review process (Part D) is how we correct them.

The Compliance Agent is a **risk-reduction tool, not a guarantee of legal compliance.** Per the Publish Acknowledgment (Doc 05e), the customer remains the publisher of record and is contractually responsible for the legality of content they publish. The Compliance Agent's role is to block obvious violations and surface borderline cases — not to substitute for the customer's own legal counsel.

---

## Table of Contents

- Part A — Cross-Cutting Compliance Rules (10 rules, all industries)
- Part B — 16 Regulated Vertical Rule Sets
- Part C — Compliance Agent Implementation
- Part D — Quarterly Update Process
- Appendix A — Regex Pattern Library
- Appendix B — Disclosure Text Templates
- Appendix C — Severity Taxonomy
- Appendix D — Open Questions for Counsel

---

## Severity Taxonomy (used throughout)

| Code | Severity | Action | Example |
|------|----------|--------|---------|
| **HARD_BLOCK** | Cannot publish | Auto-fix attempted; if fix fails, route to human review; never auto-publish | "Guaranteed cure for cancer" |
| **SOFT_FLAG** | Publishable with disclosure | Auto-insert required disclosure; notify user | Income testimonial without "results not typical" |
| **REVIEW** | Context-dependent | Route to human review queue (Doc 07b) | "Board certified" with no board specified |
| **INFO** | Best practice | Surface as suggestion; user opt-in | Accessibility alt-text missing |

---

# PART A — Cross-Cutting Compliance Rules

These rules apply to **every** funnel regardless of vertical. They run before the vertical-specific pack.

---

## A1 — FTC Truth-in-Advertising (16 CFR Part 251, 255)

**Rule statement:** All claims about products, services, or outcomes must be truthful, non-misleading, and substantiated by competent and reliable evidence at the time the claim is made. Testimonials must reflect typical results or include a clear and conspicuous disclosure of what results consumers generally can expect.

**Statutory basis:**
- 15 U.S.C. Â§ 45 (FTC Act, Section 5 — unfair or deceptive acts)
- 16 CFR Part 251 — Guide Concerning Use of the Word "Free"
- 16 CFR Part 255 — Guides Concerning Use of Endorsements and Testimonials
- *FTC v. Direct Marketing Concepts, Inc.*, 624 F.3d 1 (1st Cir. 2010) — substantiation standard

**Scan for:**
- Outcome claims without substantiation field populated in the funnel KB (Doc 02a Â§7)
- Testimonial blocks (`<testimonial>`, `data-component="testimonial"`) without a `typical_results` disclosure within 200 chars
- Superlatives without basis: `\b(best|#1|number one|top[- ]rated|leading|world['']?s?\s+(best|leading|top))\b`
- Comparative claims: `\b(better than|outperforms?|beats?)\s+\w+` (requires substantiation note)
- "Free" without conditions disclosed: `\bfree\b` (proximity check — must have terms within 300 chars unless truly free with no strings)

**Action:** SOFT_FLAG if substantiation field populated but disclosure missing (auto-insert). HARD_BLOCK if outcome claim with no substantiation in KB.

**Auto-fix:** Append the standard typical-results disclosure (Appendix B-1) below the testimonial; if multiple testimonials, group disclosure at section bottom.

---

## A2 — FTC Endorsement Guides (2023 Updates)

**Rule statement:** Material connections between an endorser and the advertiser must be clearly and conspicuously disclosed. As of June 2023, the FTC explicitly considers AI-generated endorsements deceptive if presented as genuine human endorsements. Fake reviews are categorically prohibited (16 CFR Part 465, effective Oct 2024).

**Statutory basis:**
- 16 CFR Part 255 (revised July 2023)
- 16 CFR Part 465 — Trade Regulation Rule on the Use of Consumer Reviews and Testimonials (effective Oct 21, 2024)
- FTC, *Guides Concerning the Use of Endorsements and Testimonials in Advertising* (2023)
- *FTC v. Lord & Taylor, LLC*, 2016 — material connection enforcement

**Scan for:**
- Testimonials lacking attribution (`testimonial.attribution` field empty)
- Testimonials with `is_employee=true` or `is_affiliate=true` and no disclosure within the testimonial block
- AI-generated avatars/photos in testimonial blocks (check `image.source=="generated"` flag from image gen pipeline)
- Stock photos labeled as customer photos (`image.source=="stock"` AND parent component is testimonial)
- Review aggregator widgets (Yotpo, Trustpilot, Google Reviews) — verify the widget renders only verified reviews; reject any "manual" review-list components

**Action:**
- HARD_BLOCK: AI-generated avatar in a testimonial block (no exceptions — counsel position is this is per-se deceptive after 2023 update)
- HARD_BLOCK: Stock photo presented as customer
- SOFT_FLAG: Employee/affiliate testimonial without disclosure (auto-insert "[GoFunnelAI customer is an employee of [Brand]]" tag)
- REVIEW: Anonymous testimonials (no attribution)

**Reference:** GoFunnelAI's own policy (Doc 07a Â§4) prohibits AI-generated testimonials. Compliance Agent enforces this at the technical layer.

---

## A3 — FTC "No AI Exemption" Doctrine

**Rule statement:** The FTC has stated publicly and repeatedly (Khan 2023, Levine 2024) that AI-generated content receives no exemption from advertising substantiation requirements. Every claim — whether drafted by a human copywriter or an LLM — must be substantiated at the time of publication.

**Authority:**
- Khan, L. (Chair, FTC), *Remarks at the Tech Summit on AI* (Jan 2024)
- FTC Business Blog, "Keep your AI claims in check" (Feb 2023)
- FTC Business Blog, "Chatbots, deepfakes, and voice clones: AI deception for sale" (Mar 2023)
- *In re Automators AI*, FTC complaint Aug 2023 — AI-business-opportunity enforcement

**Scan for:**
- Any factual claim in generated copy that is not backed by an evidence pointer in the funnel's KB (Doc 02a Â§7 evidence array). This is the **primary contract** between the Compliance Agent and the Fact-Check Agent.
- Claims with numbers: `\b\d+(\.\d+)?\s*(%|percent|x|times|years?|months?|days?|hours?|customers?|clients?|users?|leads?)\b` — must have an evidence pointer.
- Claims with proper nouns of awards/certifications: `\b(certified|accredited|awarded|winner of|recipient of)\b` — must have evidence pointer.

**Action:** HARD_BLOCK on any flagged claim without evidence pointer. Fact-Check Agent is responsible for resolving the pointer to a verified source; Compliance Agent verifies the pointer exists and is non-empty.

---

## A4 — CAN-SPAM Act

**Rule statement:** Commercial email must (1) accurately identify the sender, (2) use non-deceptive subject lines, (3) clearly identify the message as an advertisement (where applicable), (4) include a valid physical postal address, and (5) provide a clear and conspicuous opt-out mechanism honored within 10 business days.

**Statutory basis:** 15 U.S.C. Â§Â§ 7701–7713; 16 CFR Part 316

**Scan for (in email funnel components):**
- Missing physical address: every email template must include a `{{brand.postal_address}}` token resolved to a real address (not a PO box if state law requires street address)
- Missing unsubscribe link: `<a [^>]*unsubscribe</a>` must be present
- Subject lines with deceptive patterns: `\b(re:|fwd:|fw:)\s` when the email is not a reply; `\b(your account|payment|invoice|delivery)\b` when no transactional basis exists
- "From" name mismatched with sending domain

**Action:**
- HARD_BLOCK: Missing postal address or unsubscribe link
- HARD_BLOCK: Deceptive "Re:"/"Fwd:" prefix on cold outreach
- SOFT_FLAG: Misleading subject line patterns (route to REVIEW for high-risk verticals)

---

## A5 — TCPA + State Mini-TCPAs + CASL

**Rule statement:** Marketing calls and SMS to wireless numbers require **prior express written consent** (TCPA, 47 U.S.C. Â§ 227; 47 CFR Â§ 64.1200). As of the FCC's one-to-one consent rule (originally effective Jan 2025, vacated by 11th Cir. *Insurance Marketing Coalition v. FCC* Jan 24, 2025 — **see [ATTY-REVIEW]**), the prior interpretation of multi-seller consent forms is back in effect, but state laws have moved aggressively. CASL (Canada) requires express consent and sender identification. Florida Telephone Solicitation Act (FTSA, Fla. Stat. Â§ 501.059) and Oklahoma Telephone Solicitation Act (OTSA, Okla. Stat. tit. 15 Â§ 775C.1) impose stricter standards than federal TCPA.

**[ATTY-REVIEW]** — One-to-one consent doctrine is in flux post-IMC v. FCC. Counsel must confirm current applicability per state.

**Statutory basis:**
- 47 U.S.C. Â§ 227 (TCPA)
- 47 CFR Â§ 64.1200
- Telephone Consumer Protection Act of 1991, as amended
- Fla. Stat. Â§ 501.059 (FTSA)
- Okla. Stat. tit. 15 Â§ 775C.1 (OTSA)
- CASL (S.C. 2010, c. 23) — Canada
- *Facebook, Inc. v. Duguid*, 592 U.S. 395 (2021) — ATDS definition
- *Insurance Marketing Coalition v. FCC*, 11th Cir. Jan 24, 2025 — vacated one-to-one rule

**Scan for (in lead-capture forms and SMS funnel components):**
- Phone-number capture form (`<input type="tel">`) without an adjacent express-consent checkbox
- Consent checkbox pre-checked (defaults to checked)
- Consent language missing required elements: (a) identification of the seller, (b) authorization to deliver autodialed or prerecorded messages, (c) "consent is not a condition of purchase"
- SMS funnels: missing "Reply STOP to opt out" and "Msg & data rates may apply" footer
- Florida funnels: any auto-dialer language must comply with FTSA's stricter consent definition
- Canada funnels: identification of sender + physical address + opt-out mechanism in every commercial message

**Action:**
- HARD_BLOCK: Phone capture without consent checkbox
- HARD_BLOCK: Pre-checked consent box
- HARD_BLOCK: Missing STOP/HELP language in SMS sequences
- SOFT_FLAG: Generic consent language (auto-replace with Appendix B-2 template scoped to state)

**Geo-routing:** When the funnel's target state is FL, OK, MD (MTPA), or WA (CEMA), apply the stricter state-specific consent template.

---

## A6 — ADA / WCAG 2.1 AA Accessibility

**Rule statement:** Public-facing commercial websites are "places of public accommodation" under Title III of the ADA (per *Robles v. Domino's Pizza*, 913 F.3d 898 (9th Cir. 2019)) and must be accessible. The DOJ has stated WCAG 2.1 Level AA is the appropriate standard. EU Accessibility Act (Directive (EU) 2019/882) imposes parallel requirements effective June 28, 2025.

**Statutory basis:**
- 42 U.S.C. Â§Â§ 12181–12189 (ADA Title III)
- 28 CFR Part 36
- WCAG 2.1 (W3C Recommendation, June 2018)
- EU Directive 2019/882

**Scan for:**
- Images without alt text (`<img>` missing `alt` attribute, or `alt=""` for non-decorative)
- Form inputs without labels (`<input>` without associated `<label for>` or `aria-label`)
- Color contrast below 4.5:1 for normal text, 3:1 for large text (computed from generated theme tokens)
- Click targets below 44x44 px on mobile
- Video/audio embeds without captions or transcripts
- Keyboard-trap risk: any custom modal without `Esc` close + focus trap
- Page must have a logical heading hierarchy (H1 â†’ H2 â†’ H3, no skips)

**Action:**
- SOFT_FLAG: Missing alt text (auto-generate via vision model, route for review if confidence < 0.85)
- SOFT_FLAG: Low contrast (auto-adjust theme tokens; preserve brand colors where possible)
- HARD_BLOCK: Form input without label
- INFO: Heading hierarchy violations (suggest fix)

---

## A7 — COPPA (Children's Online Privacy Protection Act)

**Rule statement:** Operators of websites or online services directed to children under 13, or with actual knowledge of collecting information from children under 13, must obtain verifiable parental consent before collecting personal information.

**Statutory basis:** 15 U.S.C. Â§Â§ 6501–6506; 16 CFR Part 312

**[ATTY-REVIEW]** — COPPA reform proposed 2024 may add 13–17 protections. Track FTC final rule.

**Scan for:**
- Funnels targeted at minors (KB.audience field includes "parents", "children", "kids", "k-12", "youth")
- Forms collecting child information (form fields named/labeled with: `child_name`, `kid_age`, `student_age`, `birthdate` where intended for child)
- Persistent identifiers (cookies, device IDs) collected without notice on child-directed content

**Action:**
- HARD_BLOCK: Any funnel flagged as child-directed that collects PII without verifiable parental consent flow
- REVIEW: Funnels for parent-of-child services (e.g., tutoring) — manual review of data collection

---

## A8 — Consumer Reviews Rule (16 CFR Part 465)

**Rule statement:** Effective October 21, 2024, the FTC's final rule prohibits: (1) fake reviews and testimonials, (2) buying positive or negative reviews, (3) insider reviews and consumer testimonials without disclosure, (4) review suppression including unwarranted legal threats, and (5) misrepresentation of independent review platforms.

**Statutory basis:** 16 CFR Part 465 (effective Oct 21, 2024). Civil penalties up to $51,744 per violation.

**Scan for:**
- Reviews/testimonials with no attribution metadata (already covered in A2 — but here we also check for review-platform fraud signals)
- Reviews quoted from third-party platforms (Yelp, Google, Trustpilot) without source link
- "Verified" or "verified buyer" badges without verification logic
- Any component labeled "independent reviews" that pulls from an affiliated source

**Action:**
- HARD_BLOCK: "Verified" badges without verification source
- HARD_BLOCK: AI-generated reviews (overlaps A2)
- SOFT_FLAG: Cross-platform quoted reviews without source link

---

## A9 — AI Content Disclosure (EU AI Act Article 50 + emerging US norms)

**Rule statement:** AI-generated or AI-assisted content interacting with consumers must be disclosed where required by law. EU AI Act Article 50 (effective Aug 2, 2026 for most provisions) requires transparency for AI-generated content including text, image, audio, and video that is deceptively similar to authentic content. California AB 2013 and Colorado AI Act impose related state-level disclosure requirements.

**[ATTY-REVIEW]** — US state laws are evolving rapidly. Confirm current disclosure requirements per state.

**Statutory basis:**
- EU AI Act (Regulation 2024/1689), Article 50
- California AB 2013 (training data disclosure, eff. Jan 2026)
- Colorado AI Act (SB 24-205, eff. Feb 1, 2026)
- Utah AI Policy Act (eff. May 2024)

**Scan for:**
- AI-generated images in funnel without disclosure metadata or visible label
- AI-generated long-form text presented without an "AI-assisted content" footer disclosure
- Funnels deployed to EU jurisdictions (geo-targeting set or domain TLD in EU)

**Action:**
- SOFT_FLAG (EU targets): Auto-insert footer disclosure (Appendix B-9)
- SOFT_FLAG (CA/CO/UT targets): Auto-insert state-specific disclosure
- INFO (US otherwise): Suggest disclosure as best practice (GoFunnelAI default per Doc 07a Â§3 is to disclose)

**GoFunnelAI policy:** Per Doc 07a Â§3.2, every GoFunnelAI-generated funnel includes a small "Made with GoFunnelAI" footer with link to the AI-content policy. The compliance agent verifies this footer is not stripped from generated funnels.

---

## A10 — HIPAA (Conditional)

**Rule statement:** Funnels for Covered Entities (healthcare providers, health plans, healthcare clearinghouses) or their Business Associates must not collect Protected Health Information (PHI) in unencrypted forms, must not transmit PHI to non-BAA-covered services, and must include appropriate Notice of Privacy Practices linkage.

**Statutory basis:**
- 45 CFR Parts 160, 162, 164
- HITECH Act of 2009
- 45 CFR Â§ 164.508 (authorization for marketing)
- HHS OCR guidance on tracking technologies (Dec 2022, updated Mar 2024)

**[ATTY-REVIEW]** — OCR's tracking-technology guidance was partially vacated in *American Hospital Association v. Becerra* (N.D. Tex. June 2024). Confirm current scope.

**Scan for (only when vertical = Healthcare/Dental/MedSpa/etc.):**
- Form fields that could capture PHI: `\b(diagnosis|condition|symptoms?|medication|prescriptions?|treatments?|insurance.+(member|policy|id)|date.+of.+birth|ssn)\b`
- Analytics or pixel scripts on PHI-collecting pages: Meta Pixel, Google Analytics with PHI parameter forwarding, TikTok Pixel
- Form-handler endpoint not on the brand's approved HIPAA-compliant form-provider list (KB.compliance.hipaa_form_provider)

**Action:**
- HARD_BLOCK: PHI-eligible form field routing to non-HIPAA-compliant endpoint
- HARD_BLOCK: Meta Pixel or other ad-network tracker on a page collecting PHI
- HARD_BLOCK: Healthcare funnel without `KB.compliance.hipaa_form_provider` field populated
- REVIEW: Any borderline PHI field

---

# PART B — Regulated Vertical Rule Sets

Each rule set below is implemented as a JSON pack at `funnel-ai/compliance/packs/<vertical>.json` (Part C). Schemas:

```json
{
  "vertical_id": "string",
  "vertical_name": "string",
  "version": "semver",
  "last_counsel_review": "ISO-8601",
  "prohibited_patterns": [
    { "id": "string", "pattern": "regex", "severity": "HARD_BLOCK|SOFT_FLAG|REVIEW", "rationale": "string", "auto_fix": "rewrite-template-id|null", "citation": "string" }
  ],
  "required_disclosures": [
    { "id": "string", "text_template": "string", "placement": "footer|inline|adjacent-to|modal", "trigger": "always|when-pattern|when-state", "states": ["string"], "citation": "string" }
  ],
  "required_information": [
    { "id": "string", "kb_field": "string", "validation": "regex|enum|callable", "severity": "HARD_BLOCK", "citation": "string" }
  ],
  "state_overlays": { "<state-code>": { /* state-specific additions/replacements */ } },
  "human_review_triggers": [ { "id": "string", "description": "string", "pattern": "regex|callable" } ]
}
```

---

## B1 — Healthcare / Dental / Med Spa

**Pack ID:** `healthcare-v1.0` Â· **Counsel review status:** PENDING

### Prohibited claims

| ID | Pattern | Severity | Rationale | Citation |
|----|---------|----------|-----------|----------|
| HC-P1 | `\b(cure|cures|cured|curing)\s+(?!for|cancer-free)\w+` | HARD_BLOCK | Disease cure claims require FDA approval | FDA, 21 CFR Â§ 201.128; FTC Act Â§ 5 |
| HC-P2 | `\b(100%|completely|totally|absolutely)\s+(safe|effective|painless|risk[-\s]free)\b` | HARD_BLOCK | Absolute safety claims unsubstantiable | FTC, *POM Wonderful*, 777 F.3d 478 (D.C. Cir. 2015) |
| HC-P3 | `\bguaranteed?\s+(results?|outcome|success|cure|recovery)\b` | HARD_BLOCK | Health outcome guarantees | FTC substantiation doctrine |
| HC-P4 | `\bbest\s+(doctor|dentist|surgeon|practice|clinic)\s+in\b` | REVIEW | Superlative requires substantiation; some state boards prohibit | Varies by state medical board |
| HC-P5 | `\bpain[-\s]free\s+(procedure|surgery|treatment)\b` | SOFT_FLAG | Requires "minimally invasive" rewording + disclosure | State medical board guidance |
| HC-P6 | `\bspecialist\b` | REVIEW | "Specialist" requires board certification per most state medical practice acts | e.g., Cal. B&P Code Â§ 651 |
| HC-P7 | `\b(miracle|miraculous)\b` | HARD_BLOCK | Per-se deceptive in medical advertising | FTC, *Sunny Health Nutrition* (2010) |
| HC-P8 | `\b(FDA[-\s]approved)\b` | REVIEW | Verify against FDA database; "FDA cleared" â‰  "FDA approved" | 21 USC Â§ 360c |

### Required disclosures

| ID | Trigger | Text | Placement |
|----|---------|------|-----------|
| HC-D1 | Always | Practitioner name + state license number + state | Footer of every page |
| HC-D2 | Before/after photo present | "Individual results may vary. The photos shown are of actual patients of [Practice Name] and are used with permission. Results are not guaranteed." | Adjacent to photo, â‰¤200 px |
| HC-D3 | Testimonial present | "Testimonials reflect the individual experiences of patients and may not be typical." | Adjacent to testimonial block |
| HC-D4 | "Specialist" or "board-certified" claim | "Board-certified by [specific board name], [year]" | Inline with claim |
| HC-D5 | Med spa with prescription services | "Prescription services provided by [Medical Director name, MD/DO, license #]." | Footer |

### Required information (KB fields, HARD_BLOCK if missing)

- `kb.practitioner.full_name`
- `kb.practitioner.license_number`
- `kb.practitioner.license_state`
- `kb.practice.physical_address`
- `kb.compliance.hipaa_form_provider` (if form collects PHI)
- `kb.compliance.medical_director` (if med spa with Rx)

### State overlays

- **California:** Add Cal. B&P Code Â§ 651 specifics — "specialist" must specify the recognized board; "permanent" results claims prohibited for cosmetic procedures.
- **Florida:** Fla. Admin. Code R. 64B8-11.001 — testimonials and before/after photos require additional adjacent disclosure; surgeon's full name must appear on each ad.
- **Texas:** 22 TAC Â§ 164.4 — physician advertising must include name and primary office address; "no scar" claims prohibited.
- **New York:** Education Law Â§ 6530 — "experienced," "leading," "most" require substantiation file retention for 3 years.

### Before/after photos (standardized rules)

Auto-block if any of:
- EXIF metadata indicates different cameras for before vs. after
- Aspect ratio differs > 5%
- Color histogram divergence > threshold (suggests retouching)
- Lighting analysis shows >2 stop EV difference
- No `data-patient-consent-id` attribute on the image (proves consent on file)

### Human review triggers

- Any reference to oncology, fertility, or pediatrics (escalate regardless)
- Mention of off-label drug use
- "Award" or "top doctor" claim (verify source)
- Comparison to competing practice

---

## B2 — GLP-1 / Weight Loss

**Pack ID:** `glp1-weightloss-v1.0` Â· **Counsel review status:** PENDING — **HIGH RISK CATEGORY**

This vertical inherits all Healthcare (B1) rules plus the following.

### Prohibited claims

| ID | Pattern | Severity | Rationale | Citation |
|----|---------|----------|-----------|----------|
| GLP-P1 | `\blose\s+\d+\s*(lbs?|pounds?|kg)\s+in\s+\d+\s+(days?|weeks?|months?)\b` | HARD_BLOCK | FTC weight-loss "gut check" prohibits specific-amount-in-specific-time claims absent rigorous substantiation | FTC, *Gut Check* (2014); FTC v. Sensa (2014) |
| GLP-P2 | `\b(no\s+(diet|exercise|effort|surgery)|without\s+(diet|exercise|surgery))\b` | HARD_BLOCK | One of seven "gut check" claims | FTC, *Gut Check* |
| GLP-P3 | `\b(lose\s+weight\s+for\s+everyone|works?\s+for\s+everyone)\b` | HARD_BLOCK | "Works for everyone" — gut check claim | FTC, *Gut Check* |
| GLP-P4 | `\b(permanent|permanently)\s+weight\s+loss\b` | HARD_BLOCK | "Permanent" weight loss — gut check claim | FTC, *Gut Check* |
| GLP-P5 | `\bblock(s|ing)?\s+(fat|calories)\b` | HARD_BLOCK | Mechanism claim — gut check | FTC, *Gut Check* |
| GLP-P6 | `\beat\s+all\s+you\s+want\b` | HARD_BLOCK | "Eat all you want" — gut check | FTC, *Gut Check* |
| GLP-P7 | `\b(semaglutide|tirzepatide|ozempic|wegovy|mounjaro|zepbound)\b` | REVIEW | Brand name use of FDA-approved drug triggers off-label promotion review | FDA, 21 CFR Â§ 202.1; FDCA Â§ 502(n) |
| GLP-P8 | `\bcompound(ed|ing)?\s+(semaglutide|tirzepatide|GLP-1)\b` | REVIEW | FDA has issued warnings on compounded GLP-1s; state pharmacy laws vary | FDA Drug Safety Communication, multiple 2024–2025 |

### Required disclosures

| ID | Trigger | Text | Placement |
|----|---------|------|-----------|
| GLP-D1 | Any weight-loss outcome claim | "Results are not typical. In clinical studies, [drug] users lost an average of [X]% of body weight over [Y] months. Individual results vary based on diet, exercise, and adherence to the program." | Adjacent to claim |
| GLP-D2 | Use of brand drug name | "[Brand] is a registered trademark of [holder]. [Brand] is FDA-approved for [labeled indication]. Use outside the labeled indication is at the prescriber's discretion." | Footer |
| GLP-D3 | Compounded GLP-1 reference | "Compounded medications are not FDA-approved. Compounded [drug name] is prepared by a state-licensed pharmacy for individual patient prescriptions and may not undergo FDA review for safety, efficacy, or quality." | Adjacent + footer |

### State overlays

- **Louisiana, Mississippi, Texas:** Compounding restrictions tightened 2024–2025 (**[ATTY-REVIEW]** — confirm current statutes).
- **California:** Health & Safety Code Â§ 1367 + DMHC oversight on telehealth weight loss.

### Human review triggers

- Any specific weight-loss number (even with disclosure)
- "Bariatric alternative" or "alternative to surgery" claim
- Pediatric weight loss (under 18)
- Combination with stimulants or thyroid medications

---

## B3 — Cosmetic Surgery / Aesthetics

**Pack ID:** `cosmetic-surgery-v1.0` Â· Inherits B1.

### Prohibited claims

| ID | Pattern | Severity | Citation |
|----|---------|----------|----------|
| CS-P1 | `\bperfect\s+(results?|outcome|smile|face|body)\b` | HARD_BLOCK | FTC + ASPS guidelines |
| CS-P2 | `\bguaranteed?\s+\w+` | HARD_BLOCK | Cosmetic outcome guarantees prohibited universally |
| CS-P3 | `\b(better|superior)\s+than\s+(Dr\.|other surgeons)\b` | HARD_BLOCK | Comparative claims naming competitors |
| CS-P4 | `\bno[-\s]?scar(ring)?\b` | HARD_BLOCK | Per state medical boards (FL, TX, NY) |
| CS-P5 | `\bboard[-\s]certified\b(?!.{0,80}by\s)` | SOFT_FLAG | Must specify the certifying board |
| CS-P6 | `\b(world['']?s?\s+)?(top|best|leading)\s+(surgeon|practice)\b` | REVIEW | Superlative requires substantiation |

### Required disclosures

| ID | Trigger | Text | Placement |
|----|---------|------|-----------|
| CS-D1 | Before/after photos | (same as HC-D2) + "Photos are not retouched. Lighting, angle, and pose are standardized." | Adjacent |
| CS-D2 | "Board-certified" claim | "Board certified by the [specific board, e.g., American Board of Plastic Surgery]" | Inline |
| CS-D3 | All cosmetic surgery funnels | "Cosmetic surgery has risks, including infection, scarring, and complications from anesthesia. Discuss risks with your surgeon. Results vary by individual." | Footer |

### State overlays

- **Florida:** Fla. Admin. Code R. 64B8-9.0092 — surgeon name + photo + office address on every advertisement.
- **California:** B&P Â§ 651 — "specialist" requires ABMS-recognized board.

### Human review triggers

- Any minor (under 18) reference
- "Mommy makeover" or similar packaged-procedure naming (some states require itemized pricing disclosure)
- Discount/financing offers (Truth-in-Lending Reg Z may apply)

---

## B4 — Hair Restoration

**Pack ID:** `hair-restoration-v1.0` Â· Inherits B1, B3.

### Prohibited claims

| ID | Pattern | Severity | Citation |
|----|---------|----------|----------|
| HR-P1 | `\bpermanent\s+(hair\s+)?(restoration|regrowth|results)\b` | REVIEW | Requires clinical evidence; FDA-approved drugs (minoxidil, finasteride) are not permanent if discontinued |
| HR-P2 | `\b(reverses?|stops?)\s+(baldness|hair\s+loss)\s+(?!in\s+\d)` | SOFT_FLAG | Add efficacy disclosure |
| HR-P3 | `\b(painless|no[-\s]surgery)\s+hair\s+transplant\b` | HARD_BLOCK | All transplant procedures involve some discomfort |
| HR-P4 | `\b(finasteride|minoxidil|propecia|rogaine)\b` | REVIEW | Drug-name use triggers FDA labeling review |

### Required disclosures

| ID | Trigger | Text | Placement |
|----|---------|------|-----------|
| HR-D1 | Minoxidil/finasteride mention | "Finasteride and minoxidil are FDA-approved for [labeled indication]. Side effects may include [labeled side effects]. Discuss with your prescriber." | Adjacent + footer |
| HR-D2 | "Permanent" claim | "Hair restoration results are considered durable for transplanted follicles. Non-transplanted hair may continue to thin without ongoing treatment." | Adjacent to claim |

---

## B5 — Personal Injury Law

**Pack ID:** `personal-injury-v1.0` Â· **Counsel review status:** PENDING — **HIGH RISK + 50-STATE VARIATION**

### Cross-state baseline

| ID | Pattern | Severity | Citation |
|----|---------|----------|----------|
| PI-P1 | `\bwe\s+(will|can|always)\s+win\b` | HARD_BLOCK | ABA Model Rule 7.1 (false or misleading) |
| PI-P2 | `\bguaranteed?\s+(settlement|recovery|outcome|win)\b` | HARD_BLOCK | Universal bar rule |
| PI-P3 | `\bno\s+fee\s+(unless\s+you\s+win|guarantee)\b` | SOFT_FLAG | Requires disclosure of costs/expenses distinct from fees |
| PI-P4 | `\bspecialist\b` | REVIEW | Most states limit "specialist" to certified specialists |
| PI-P5 | `\b(\$|usd\s?)?[\d,]+\s+(million|m)\s+(settlement|verdict|recovery)\b` | SOFT_FLAG | Past-results disclosure required |
| PI-P6 | `\bbest\s+(lawyer|attorney|firm)\s+in\b` | REVIEW | Most state bars prohibit |

### Required disclosures

| ID | Trigger | Text | Placement |
|----|---------|------|-----------|
| PI-D1 | Always | "Attorney advertising. [Firm Name], [Address]. [Lead Attorney Name], [Bar Number], licensed in [State(s)]." | Footer |
| PI-D2 | Past results / case values | "Past results do not guarantee future outcomes. Every case is different and depends on its specific facts. Prior results were obtained in [State, year] under [facts]." | Adjacent |
| PI-D3 | Contingent fee mention | "Contingent fees are calculated on the gross/net recovery [per state]. Client may be responsible for costs and expenses even if no recovery is obtained, subject to fee agreement." | Adjacent or footer |
| PI-D4 | Testimonial | "Testimonials are individual experiences and do not constitute a guarantee, warranty, or prediction of outcome." | Adjacent |

### Required information

- `kb.firm.lead_attorney_bar_number` (HARD_BLOCK if missing)
- `kb.firm.jurisdictions` (array of state codes, HARD_BLOCK if empty)
- `kb.firm.physical_address`
- `kb.firm.responsible_attorney_name` (for ad disclosure)

### State overlays (high-friction states)

- **Florida (Rule 4-7 of Rules Regulating The Florida Bar):**
  - "Specialist" requires Florida Bar Board Certification specifically
  - Past results in advertising prohibited or require pre-filing with Bar (Rule 4-7.13)
  - Required: "The hiring of a lawyer is an important decision that should not be based solely upon advertisements."
  - Filing: Many ads must be filed with Florida Bar within 20 days
- **New York (22 NYCRR Â§ 1200, Rule 7.1):**
  - Bar registration number required on attorney ads
  - "Attorney Advertising" label required at the beginning of the communication
  - Specific format for testimonials and past results
- **Texas (TDRPC Rule 7):**
  - Texas Bar Number required
  - "Not Certified by the Texas Board of Legal Specialization" disclosure if "specialist" used without certification
- **California (Rule 7.1, 7.2, 7.4):**
  - Specific bar number formatting
  - "Certified Specialist" requires State Bar certification
- **New Jersey (RPC 7.1):** Pre-publication review for some ad types

### Human review triggers

- Any mass tort or class action reference
- Specific dollar amounts in headlines
- Comparison to opposing counsel or insurance companies
- Photographs of staged accident scenes
- Use of "expert" or "leading"

---

## B6 — Family / Divorce Law

**Pack ID:** `family-law-v1.0` Â· Inherits B5.

### Prohibited claims + tone rules

| ID | Pattern | Severity | Rationale |
|----|---------|----------|-----------|
| FL-P1 | `\b(destroy|crush|annihilate|defeat)\s+(your\s+(ex|spouse))\b` | HARD_BLOCK | ABA Model Rule 7.1; reputational + tone |
| FL-P2 | `\bget\s+(full|sole)\s+custody\s+guaranteed?\b` | HARD_BLOCK | Custody outcomes are court-determined |
| FL-P3 | `\b(fast|quick|easy)\s+divorce\b` | SOFT_FLAG | Misleading; mandatory waiting periods vary by state |
| FL-P4 | Urgency timers / "today only" on family law funnels | HARD_BLOCK | Manipulative practice in emotional context |

### Required disclosures

- (PI-D1, PI-D4 from B5)
- FL-D1: "Family law outcomes depend on individual circumstances and applicable state law. No outcome is guaranteed."

### Human review triggers

- Domestic violence references (sensitivity)
- Child custody outcome claims
- International custody / Hague Convention references

---

## B7 — DUI Defense

**Pack ID:** `dui-defense-v1.0` Â· Inherits B5.

### Prohibited claims

| ID | Pattern | Severity |
|----|---------|----------|
| DUI-P1 | `\bwe\s+(can|will)\s+get\s+(charges\s+)?(dropped|dismissed)\b` | HARD_BLOCK |
| DUI-P2 | `\b(beat|win)\s+your\s+DUI\b` | HARD_BLOCK |
| DUI-P3 | `\bkeep\s+your\s+license\s+guaranteed?\b` | HARD_BLOCK |
| DUI-P4 | `\bno\s+jail\s+time\b` | HARD_BLOCK |

### Required disclosures (in addition to B5)

- DUI-D1: "Outcomes in DUI cases depend on the specific facts, evidence, and applicable law in your jurisdiction. No outcome is guaranteed."

### Human review triggers

- Felony DUI references
- Commercial driver (CDL) DUI
- Underage DUI

---

## B8 — Bankruptcy Law

**Pack ID:** `bankruptcy-v1.0` Â· Inherits B5.

### Required disclosures (CRITICAL)

| ID | Trigger | Text | Placement |
|----|---------|------|-----------|
| BK-D1 | Always (BAPCPA mandatory) | "We are a debt relief agency. We help people file for bankruptcy relief under the Bankruptcy Code." | Footer of every page; must be clearly visible |
| BK-D2 | Always | (PI-D1 attorney disclosure) | Footer |

**Statutory basis:** 11 U.S.C. Â§ 528(a)(4) (BAPCPA debt-relief-agency disclosure).

### Prohibited claims

| ID | Pattern | Severity | Citation |
|----|---------|----------|----------|
| BK-P1 | `\b(eliminate|erase|wipe\s+out)\s+all\s+(debt|debts)\b` | HARD_BLOCK | Misleading per 11 USC Â§ 526(a)(3) |
| BK-P2 | `\b(stop|prevent)\s+(foreclosure|garnishment|repossession)\s+guaranteed?\b` | HARD_BLOCK | Outcome not guaranteed |
| BK-P3 | `\bkeep\s+all\s+your\s+(property|assets)\b` | HARD_BLOCK | Misleading; depends on exemptions |

### Human review triggers

- Chapter 7 vs Chapter 13 eligibility claims
- Means-test references
- Discharge timing claims

---

## B9 — Insurance (Auto / Life / Health)

**Pack ID:** `insurance-v1.0` Â· **HIGH COMPLEXITY — 50+ STATE DOI RULES**

### Cross-line baseline

| ID | Pattern | Severity | Citation |
|----|---------|----------|----------|
| INS-P1 | `\bguaranteed?\s+(coverage|acceptance|approval)\b` | REVIEW | Permitted only for guaranteed-issue products; otherwise misleading |
| INS-P2 | `\bno\s+(medical\s+)?(exam|health\s+questions?)\b` | REVIEW | True only for guaranteed-issue or some final-expense products |
| INS-P3 | `\b(cheapest|lowest)\s+(rates?|premiums?)\b` | REVIEW | Substantiation required |
| INS-P4 | `\bsave\s+(\$|usd\s?)?[\d,]+\s+(on\s+)?(auto|car|home|life|health)\s+insurance\b` | SOFT_FLAG | Requires "actual savings depend on..." disclosure |
| INS-P5 | `\b(best|top|#1)\s+insurance\s+(company|provider|agent)\b` | REVIEW | State DOI rules vary |

### Required information

- `kb.producer.license_number`
- `kb.producer.license_states` (array)
- `kb.producer.lines_of_authority` (array: auto, life, health, P&C, etc.)
- `kb.producer.npn` (National Producer Number)

### Line-of-authority match check

Auto-block if funnel content references a line the producer is not licensed for in the target state. E.g., a producer with only Life authority in Texas cannot publish auto-insurance funnels targeting Texas.

### Health insurance overlay

- Inherits HIPAA (A10) when collecting member info
- ACA compliance: must not deny based on pre-existing conditions in ACA-regulated products
- Must not market non-compliant short-term plans as ACA plans

### Life insurance overlay (state-specific suitability)

- **NY Reg 187:** Best-interest standard for life insurance and annuities
- **California:** Suitability standards under Cal. Ins. Code Â§ 10509.910 et seq.
- Required disclosure for annuity recommendations

### State overlays (selected)

- **California (Cal. Ins. Code Â§ 1725.5):** License number font size â‰¥ "type used for telephone number"; specific format
- **Florida (Fla. Stat. Â§ 626.9541):** Unfair trade practices; specific prohibitions on misrepresentation
- **New York (NY Ins. Law Â§ 2123):** Misrepresentation; agent name and address requirements
- **Texas (TIC Â§ 541):** Unfair settlement practices; advertising filing requirements

### Human review triggers

- Any "Medicare," "Medicare Advantage," or "Medicare Supplement" reference — CMS marketing rules apply (42 CFR Â§ 422.2260 et seq.; MA-PD Communications and Marketing Guidelines)
- ACA Open Enrollment timing references
- Annuity products (state suitability rules)
- Group insurance or employer-sponsored plans

**[ATTY-REVIEW]** — Medicare marketing is a separate regulatory regime under CMS oversight; should likely be a separate vertical pack (B9a) in v2.

---

## B10 — Mortgage Brokers / Lenders

**Pack ID:** `mortgage-v1.0` Â· **Counsel review status:** PENDING — **CFPB SCRUTINY**

### Prohibited claims

| ID | Pattern | Severity | Citation |
|----|---------|----------|----------|
| MTG-P1 | `\bguaranteed?\s+approval\b` | HARD_BLOCK | UDAAP; ECOA |
| MTG-P2 | `\bno\s+credit\s+check\b` | HARD_BLOCK | Misleading for most loan products |
| MTG-P3 | `\b(lowest|best)\s+(rates?|APR)\b` | REVIEW | Reg Z substantiation |
| MTG-P4 | Any specific rate mention without APR: `\b\d+(\.\d+)?%\s+(rate|interest)\b` | HARD_BLOCK | Triggers Reg Z trigger-term advertising requirements |
| MTG-P5 | `\b(free|no\s+cost)\s+(refinance|loan|application)\b` | REVIEW | Reg Z and TILA restrictions on "no cost" |

### Required information

- `kb.broker.nmls_id` (HARD_BLOCK if missing — required on all advertising per SAFE Act)
- `kb.broker.state_licenses` (array of state-specific license IDs)
- `kb.brand.entity_name` (legal entity, not DBA only)

### Required disclosures

| ID | Trigger | Text | Placement |
|----|---------|------|-----------|
| MTG-D1 | Always | "[Brand], NMLS #[ID]. Equal Housing Opportunity / Equal Housing Lender." (plus Equal Housing logo) | Footer |
| MTG-D2 | Any rate mention | Full APR disclosure with terms (loan amount, term, points, fees) — see Reg Z Trigger Term table | Adjacent |
| MTG-D3 | State-specific license disclosures | Per state DOFI / DRE / DBO format (e.g., California: "Licensed by the Department of Financial Protection and Innovation under the California Residential Mortgage Lending Act, License #") | Footer |

### Reg Z trigger-term rule (12 CFR Â§ 1026.24(d))

If the advertisement contains ANY of:
- Amount or percentage of downpayment
- Number of payments or period of repayment
- Amount of any payment
- Amount of any finance charge

Then it MUST disclose:
- Amount or percentage of the downpayment
- Terms of repayment (reflecting the repayment obligations over the full term)
- "Annual Percentage Rate" using that term, or "APR"
- If the APR may be increased after consummation, that fact

Compliance Agent: regex detects trigger terms, then validates that all four disclosures are present in proximity.

### ECOA fair lending

- Scan for prohibited basis language: `\b(young|old|elderly|family\s+status|marital\s+status|childbearing|race|national\s+origin|religion)\b` in any context suggesting eligibility criteria
- Block any imagery selection that discriminates by protected class (this is more of a creative-direction guideline; flag for review)

**Statutory basis:** ECOA 15 U.S.C. Â§ 1691; Reg B 12 CFR Part 1002.

### Human review triggers

- Reverse mortgage products (additional HUD rules, especially for HECM)
- VA loan claims (must include VA-required language; veteran-specific marketing rules)
- FHA loan claims (HUD advertising rules)
- Refinance solicitation to existing customers (RESPA implications)
- Anything mentioning "stated income" (Dodd-Frank QM rules)

---

## B11 — Financial Advisors / Investment

**Pack ID:** `financial-advisor-v1.0` Â· **Counsel review status:** PENDING — **SEC/FINRA OVERSIGHT**

### Cross-pack baseline

| ID | Pattern | Severity | Citation |
|----|---------|----------|----------|
| FA-P1 | `\bguaranteed?\s+(returns?|profits?|income|growth)\b` | HARD_BLOCK | SEC Marketing Rule; FINRA 2210 |
| FA-P2 | `\b\d+(\.\d+)?%\s+(return|yield|gain)\s+per\s+(year|month)\b` | REVIEW | Specific return claims require performance disclosure |
| FA-P3 | `\b(risk[-\s]free|no[-\s]risk)\s+(investment|return)\b` | HARD_BLOCK | Per-se misleading |
| FA-P4 | `\bbeat\s+the\s+(market|S&P|index)\b` | REVIEW | Past performance claims |
| FA-P5 | `\bcertified\s+financial\s+planner\b` | REVIEW | CFP mark requires active certification |
| FA-P6 | `\b(fiduciary|act\s+in\s+your\s+best\s+interest)\b` | REVIEW | Reg BI / RIA distinction matters |

### Required information

- `kb.advisor.registration_type` (RIA, IAR, BD-registered, dual-registered)
- `kb.advisor.crd_number`
- `kb.advisor.firm_iard_number` (if RIA)
- `kb.advisor.licenses` (Series 6, 7, 63, 65, 66, etc.)
- `kb.advisor.states_registered`

### Required disclosures (SEC Marketing Rule, 17 CFR Â§ 275.206(4)-1)

| ID | Trigger | Text | Placement |
|----|---------|------|-----------|
| FA-D1 | Always | "[Firm Name] is a registered investment adviser. Registration does not imply a certain level of skill or training." | Footer |
| FA-D2 | Performance data | Mandatory performance disclosures — gross vs net, time period, benchmark, material conditions | Adjacent |
| FA-D3 | Testimonial / endorsement | Material connection disclosure; whether cash or non-cash compensation paid; whether the endorser is a client | Adjacent (per 17 CFR Â§ 275.206(4)-1(b)) |
| FA-D4 | Past performance | "Past performance is not indicative of future results." | Adjacent |
| FA-D5 | Hypothetical performance | Specific disclosures per the Marketing Rule — only to a sophisticated audience | Adjacent + audience gate |

### FINRA Rule 2210 (Communications with the Public)

If the firm is BD-registered:
- Retail communications require principal pre-approval
- Filing requirements with FINRA Advertising Regulation Department for certain content
- Specific prohibitions on predictions, projections, exaggerated claims

### Human review triggers

- Any specific security recommendation
- Crypto / digital asset claims
- Options or derivatives content
- "Accredited investor" or private placement content (Reg D)
- 401(k) / IRA rollover content (DOL Fiduciary Rule landscape)

---

## B12 — Tax Relief / Debt Relief

**Pack ID:** `tax-debt-relief-v1.0` Â· **Counsel review status:** PENDING — **FTC ENFORCEMENT PRIORITY**

### Prohibited claims

| ID | Pattern | Severity | Citation |
|----|---------|----------|----------|
| TDR-P1 | `\bsettle(d|ment)?\s+(for\s+)?pennies\s+on\s+the\s+dollar\b` | HARD_BLOCK | FTC enforcement priority; *FTC v. American Tax Relief* |
| TDR-P2 | `\bstop\s+IRS\s+(collections?|garnishments?|levies)\s+(immediately|today|now)\b` | HARD_BLOCK | Misleading; IRS collection holds have specific rules |
| TDR-P3 | `\b(eliminate|erase|wipe\s+out)\s+(tax\s+)?debt\b` | HARD_BLOCK | Misleading per FTC TSR |
| TDR-P4 | `\bguaranteed?\s+(IRS\s+)?(settlement|offer\s+in\s+compromise|reduction)\b` | HARD_BLOCK | OIC acceptance not guaranteeable |
| TDR-P5 | `\bIRS\s+(forgiveness|fresh\s+start)\s+program\b` | REVIEW | Must accurately describe Fresh Start initiative |

### TSR debt-relief overlay (16 CFR Â§ 310.4(a)(5))

For non-tax debt relief (credit card, consumer debt):
- No advance fees before settlement is reached and consumer has made at least one payment under the new arrangement
- Required disclosures about timing, savings calculation, tax consequences, credit impact

### Circular 230 (tax practitioners)

- Cannot give unconditional opinions on tax outcomes
- Specific advertising rules for enrolled agents, CPAs, attorneys practicing before IRS

### Required disclosures

| ID | Text |
|----|------|
| TDR-D1 | "Results vary. Resolution depends on your specific facts, IRS guidelines, and your cooperation. Not all clients qualify for [program]. Past results do not guarantee future outcomes." |
| TDR-D2 | "Tax relief services may have tax consequences. Forgiven debt may be reportable as income." |

### Required information

- `kb.firm.epa_number` or `kb.firm.cpa_state` or `kb.firm.attorney_bar` (one required to represent before IRS)
- For consumer debt relief: state registration where required

### Human review triggers

- Any specific dollar settlement claim
- "IRS audit defense" claims
- Innocent spouse / OIC specific programs
- Payroll tax issues (highly regulated subset)

---

## B13 — Real Estate

**Pack ID:** `real-estate-v1.0`

### Fair Housing Act (42 U.S.C. Â§ 3601 et seq.)

Protected classes: race, color, national origin, religion, sex (including sexual orientation and gender identity per HUD 2021 guidance), familial status, disability. Many states add age, source of income, military status.

### Prohibited claims / patterns

| ID | Pattern | Severity | Citation |
|----|---------|----------|----------|
| RE-P1 | Discriminatory targeting: `\b(adults?\s+only|no\s+kids|no\s+children|christian\s+(neighborhood|community)|exclusive\s+(neighborhood|community)|safe\s+(neighborhood|community)|good\s+schools)\b` | REVIEW | FHA steering; HUD guidance |
| RE-P2 | `\b(perfect|ideal)\s+for\s+(young|single|family|couples|professionals)\b` | REVIEW | FHA steering risk |
| RE-P3 | `\bguaranteed?\s+(sale|sold\s+in\s+\d+\s+days)\b` | SOFT_FLAG | Substantiation required |
| RE-P4 | `\btop\s+(\d+%|producer|realtor|agent)\b` | REVIEW | NAR + state regs |

### Required information

- `kb.agent.license_number`
- `kb.agent.license_state`
- `kb.agent.brokerage_name`
- `kb.agent.brokerage_license`

### Required disclosures

| ID | Trigger | Text | Placement |
|----|---------|------|-----------|
| RE-D1 | Always | Equal Housing Opportunity logo + "[Agent Name], [License #], [Brokerage Name], [Brokerage License #]" | Footer |
| RE-D2 | Property listings | MLS source attribution per state MLS rules | Adjacent |

### State overlays

- **California (DRE):** Specific font-size and placement rules; "DRE# [number]"
- **Florida:** Brokerage name must be more prominent than agent name (Fla. Admin. Code R. 61J2-10.025)
- **New York:** "Licensed Real Estate [Broker/Salesperson]" + brokerage information
- **Texas (TREC):** IABS (Information About Brokerage Services) link required

### Human review triggers

- Any reference to neighborhood demographics or schools
- "Investment property" claims with ROI projections (may trigger securities laws)
- Vacation rental compliance (varies wildly by city)
- iBuyer / Cash offer claims (state-specific licensing)

---

## B14 — Recruiting / Staffing

**Pack ID:** `recruiting-staffing-v1.0`

### Prohibited claims / patterns

| ID | Pattern | Severity | Citation |
|----|---------|----------|----------|
| RS-P1 | `\bguaranteed?\s+placement\b` | REVIEW | Requires substantiation; agency licensing rules |
| RS-P2 | `\b(young|energetic|recent\s+(grad|graduate)|digital\s+native|culture\s+fit)\b` in job listing context | SOFT_FLAG | EEOC age discrimination risk |
| RS-P3 | `\b(he|she|him|her)/[a-z]+\b` when referring to candidate requirements | SOFT_FLAG | Sex/gender discrimination |
| RS-P4 | `\b(US\s+citizens?\s+only)\b` | REVIEW | INA national-origin discrimination unless job legally restricted |

### EEOC anti-discrimination scan

Protected: race, color, religion, sex (including pregnancy, sexual orientation, gender identity), national origin, age (40+), disability, genetic information.

### Salary transparency overlays

Mandatory salary range disclosure in job postings in:
- **California (SB 1162, eff. Jan 2023):** Salary range in all job postings; >15 employees
- **Colorado (Equal Pay for Equal Work Act):** All postings since 2021
- **Washington (SB 5761, eff. Jan 2023):** Salary range + benefits
- **New York State (S9427A, eff. Sep 2023):** Salary range + posting requirements
- **NYC (Local Law 32, eff. Nov 2022):** Salary range in all postings
- **Illinois (HB 3129, eff. Jan 2025):** Salary range and benefits
- **Hawaii (eff. Jan 2024):** Salary range for employers â‰¥50
- **Minnesota (eff. Jan 2025):** Salary range and benefits
- **Massachusetts (eff. July 2025):** Salary range
- **DC (eff. 2024):** Salary range
- **Maryland (eff. Oct 2024):** Salary range

Compliance Agent auto-blocks job postings targeting these states if `kb.role.salary_range` is missing.

### Required information

- `kb.role.salary_range` (when targeting transparency-required states)
- `kb.agency.state_license` (per state, some require employment-agency licensing — e.g., New York, Illinois)

### Human review triggers

- Independent contractor classification claims (DOL/state misclassification rules)
- H-1B / visa sponsorship references
- "Background check required" — FCRA compliance check

---

## B15 — Education / Course Creators

**Pack ID:** `education-courses-v1.0` Â· **Counsel review status:** PENDING — **FTC ENFORCEMENT PRIORITY**

### Prohibited claims

| ID | Pattern | Severity | Citation |
|----|---------|----------|----------|
| EDU-P1 | `\bmake\s+\$?[\d,]+\s+(in|per)\s+(\d+\s+(days?|weeks?|months?))\b` | HARD_BLOCK | FTC Business Opportunity Rule; recent enforcement (FTC v. Automators AI, FBA Machine, etc.) |
| EDU-P2 | `\b(anyone|everyone)\s+can\s+(do|learn|achieve|earn)\b` | HARD_BLOCK | Universal-success claim |
| EDU-P3 | `\b(passive|easy)\s+income\b` | SOFT_FLAG | Add typical-results disclosure |
| EDU-P4 | `\bguaranteed?\s+(success|results?|income|job|career)\b` | HARD_BLOCK | Education outcome guarantees |
| EDU-P5 | `\b(quit\s+your\s+job|fire\s+your\s+boss)\b` | REVIEW | High-risk earnings-claim trigger |
| EDU-P6 | `\b(accredited|certified)\b` | REVIEW | Must verify accreditation source |

### FTC Business Opportunity Rule (16 CFR Part 437)

If the course is structured as a business opportunity (sells the right to start a business + makes earnings claims + requires a payment), specific disclosures are required including a Disclosure Document.

**[ATTY-REVIEW]** — Determining whether a course is a "business opportunity" under the Rule requires legal analysis. Compliance Agent flags candidates for review.

### Income claims (FTC interpretation)

Per FTC, any earnings claim requires:
- Substantiation file (records of actual student outcomes)
- Disclosure of generally expected results
- Disclosure of material limitations (e.g., starting capital required)

### Required disclosures

| ID | Trigger | Text |
|----|---------|------|
| EDU-D1 | Any income claim | "Earnings results are not typical. The students featured invested significant time and effort. Most students who purchase courses do not implement them. Your results will depend on factors including effort, prior experience, market conditions, and other variables outside our control. [If we have data:] Average student earnings over [period] are [number]." |
| EDU-D2 | Testimonials | Standard testimonial disclosure (Endorsement Guides) |
| EDU-D3 | Unaccredited school | "[Brand] is not an accredited educational institution. Credits do not transfer to accredited institutions." (state-mandated in CA, FL, others) |

### State overlays

- **California (BPPE — Bureau for Private Postsecondary Education):** Unaccredited schools must register; specific disclosures
- **Florida (CIE — Commission for Independent Education):** Disclosures and registration
- **New York (BPSS):** Licensing for vocational schools

### Human review triggers

- Crypto/forex/trading course content (CFTC + state securities)
- "Investment" courses (potential SEC implications)
- Real estate investing courses (state licensing in some cases)
- Any FTC consent-decree-respondent style content (high-risk patterns from past enforcement)

---

## B16 — Supplements / Health Products

**Pack ID:** `supplements-v1.0` Â· **HIGH FDA + FTC SCRUTINY**

### Prohibited claims

| ID | Pattern | Severity | Citation |
|----|---------|----------|----------|
| SUP-P1 | `\b(cure|cures|treat|treats|prevent|prevents)\s+(disease|cancer|diabetes|alzheimer|heart\s+disease|covid|flu|infection)\b` | HARD_BLOCK | Disease claims require FDA approval; per-se misbranding under FDCA |
| SUP-P2 | `\bFDA[-\s]approved\b` | HARD_BLOCK | Supplements are NOT FDA-approved (DSHEA) |
| SUP-P3 | `\bclinically\s+proven\b` | REVIEW | Requires RCT-level substantiation under FTC Health Products Compliance Guidance (2022) |
| SUP-P4 | `\bdoctor[-\s]recommended\b` | REVIEW | Requires substantiation (surveys, etc.) |
| SUP-P5 | `\b(detox|detoxify|cleanse)\s+(your\s+)?(body|liver|kidneys?|colon)\b` | REVIEW | Substantiation; FTC enforcement |
| SUP-P6 | `\b(natural|all[-\s]natural)\b` | INFO | Not banned, but flag for substantiation review |

### Required disclosures (DSHEA Â§ 403(r)(6))

| ID | Trigger | Text | Placement |
|----|---------|------|-----------|
| SUP-D1 | Any structure/function claim | "These statements have not been evaluated by the Food and Drug Administration. This product is not intended to diagnose, treat, cure, or prevent any disease." | Adjacent to claim, same page as claim |
| SUP-D2 | Health claims (FTC) | Substantiation summary or "Based on [study description, year]" | Adjacent |
| SUP-D3 | California Prop 65 (if applicable ingredients) | "WARNING: This product can expose you to chemicals including [chemical], which is known to the State of California to cause [cancer/birth defects/reproductive harm]. For more information, go to www.P65Warnings.ca.gov" | Per Prop 65 placement rules |

### FTC Health Products Compliance Guidance (Dec 2022)

Substantiation standard for health claims is "competent and reliable scientific evidence" which the FTC now interprets as generally requiring randomized controlled trials (RCTs) for efficacy claims.

### Required information

- `kb.product.ingredients_list`
- `kb.product.manufacturer_name_and_address`
- `kb.product.facility_fda_registration` (for products with US distribution)
- `kb.product.prop65_assessment` (CA targets)

### Human review triggers

- Cannabinoid (CBD, CBG, etc.) products — FDA + DEA + state laws are extremely complex
- Weight loss supplements (overlaps B2)
- Sexual enhancement supplements (FDA tainted-products list scrutiny)
- Children's supplements
- Pet supplements (different rules)
- Any claim referencing a specific health condition

---

# PART C — Compliance Agent Implementation

## C.1 Architecture

```
                              â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
   Generated Funnel Draft â”€â”€â–¶ â”‚   Compliance Agent        â”‚
                              â”‚                           â”‚
                              â”‚  1. Load rule packs:      â”‚
                              â”‚     - cross-cutting (A)   â”‚
                              â”‚     - vertical (B<n>)     â”‚
                              â”‚     - state overlays      â”‚
                              â”‚                           â”‚
                              â”‚  2. Regex pass            â”‚
                              â”‚  3. Structural validators â”‚
                              â”‚  4. LLM contextual review â”‚
                              â”‚  5. Decision engine       â”‚
                              â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                                            â”‚
                              â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
                              â–¼            â–¼              â–¼
                          PASS         SOFT_FLAG       HARD_BLOCK
                                       Auto-fix         Auto-fix attempt
                                       Disclosure         â”‚
                                       insertion          â”œâ”€ Success â†’ resubmit
                                                          â””â”€ Failure â†’ Human Review Queue
                                                                       (Doc 07b)
```

## C.2 Rule pack loading

Per generation, the orchestrator (Doc 19 Â§3.4) selects the appropriate vertical pack from `KB.vertical_id` and loads:

1. `packs/_cross-cutting.json` (Part A rules)
2. `packs/<vertical>.json` (Part B rules)
3. `packs/_state-overlays/<state-code>.json` for each state in `KB.target_states`
4. Brand-specific overrides from `KB.compliance.brand_overrides` (e.g., legally-cleared substantiation files)

Effective rule set = merge with state overlays winning over vertical winning over cross-cutting where rules conflict (most-specific wins). Disclosures accumulate (union) rather than override.

## C.3 Pass 1 — Regex matchers

Fast, deterministic. Run against the rendered HTML of every page and against every block's source content. For each `prohibited_patterns[*].pattern` match:
- Record location (page + selector + character offset)
- Record severity
- Push to findings array

Latency budget: < 200 ms per page.

## C.4 Pass 2 — Structural validators

For rules that require structural checks (form fields, image metadata, link presence):
- Form field detector â†’ cross-reference with PHI patterns (A10)
- Image EXIF analyzer â†’ before/after photo checks (B1, B3)
- Footer/header validators â†’ required disclosure presence (D-series rules)
- Trigger-term proximity validator â†’ Reg Z (B10)

## C.5 Pass 3 — LLM contextual review

For each `human_review_triggers[*]` and for rules with `severity: REVIEW`, invoke an LLM call with:
- The exact content snippet
- The rule rationale
- The funnel's KB context
- A structured prompt asking: does this violate the rule? Confidence? Suggested fix?

Model: `claude-opus-4-7` (per Doc 19 model assignments — accuracy-critical task).

Output schema:
```json
{
  "rule_id": "PI-P4",
  "matched_text": "specialist in personal injury",
  "violation_likelihood": 0.78,
  "reasoning": "...",
  "suggested_fix": "...",
  "requires_human_review": true
}
```

## C.6 Pass 4 — Decision engine

```python
def decide(findings):
    if any(f.severity == "HARD_BLOCK" for f in findings):
        return Action.HARD_BLOCK
    if any(f.severity == "REVIEW" and f.confidence > 0.5 for f in findings):
        return Action.HUMAN_REVIEW
    if any(f.severity == "SOFT_FLAG" for f in findings):
        return Action.AUTO_FIX
    return Action.PASS
```

## C.7 Auto-fix logic

For HARD_BLOCK on a removable claim, attempt **rewrite without prohibited claim**:
- Inputs: original content, rule ID, rule rationale, prohibited pattern, the matched text
- Constraints: preserve meaning where possible, preserve conversion intent, do not introduce new claims
- Output: rewritten content
- Verification: re-run Pass 1–3 on the rewrite
- Max attempts: 2; on third failure, route to human review queue

For SOFT_FLAG (e.g., missing disclosure), the auto-fix is deterministic insertion of the disclosure template at the required placement.

## C.8 Output to orchestrator

```json
{
  "compliance_check_id": "uuid",
  "funnel_id": "uuid",
  "vertical": "personal-injury",
  "rule_pack_versions": {
    "cross-cutting": "1.0.3",
    "personal-injury": "1.0.0",
    "state-overlays.FL": "1.0.1"
  },
  "decision": "PASS|SOFT_FLAG_FIXED|HUMAN_REVIEW|HARD_BLOCK",
  "findings": [ /* findings array */ ],
  "auto_fixes_applied": [ /* fix records */ ],
  "human_review_required": false,
  "audit_log_uri": "s3://funnel-ai-compliance/audit/<id>.json"
}
```

## C.9 Fact-Check Agent contract

The Fact-Check Agent (Doc 12 Â§4.8) receives:
- All claims that the Compliance Agent flagged as requiring evidence (A3)
- The KB evidence array (Doc 02a Â§7)
- The vertical's substantiation standard (e.g., RCT for B16 supplements)

Fact-Check Agent verifies each evidence pointer resolves to a non-empty, accessible source. If any pointer is broken or insufficient, the claim is escalated back to Compliance Agent for HARD_BLOCK.

## C.10 Audit log

Every compliance check writes an immutable audit log to `s3://funnel-ai-compliance/audit/<funnel-id>/<check-id>.json`. Retention: 7 years (matches FTC document-retention norms).

Contents: full findings, rule pack versions, model versions, content snapshots before/after auto-fix, decision rationale, human reviewer identity (if applicable).

This log is the evidence trail GoFunnelAI relies on if challenged by a regulator or in litigation.

---

# PART D — Quarterly Update Process

## D.1 Monitoring (continuous)

A `compliance-watcher` worker (Doc 19 Â§6) monitors:

| Source | Frequency | Action |
|--------|-----------|--------|
| FTC press releases (RSS + business blog) | Daily | LLM summarization; trigger ticket if new enforcement action or guidance |
| FDA warning letters (FDA.gov RSS) | Daily | Same; especially supplements + GLP-1 + cosmetic |
| State bar opinions (50 states, RSS where available) | Weekly | Same; flagged by state to PI/Family/DUI/Bankruptcy packs |
| State DOI bulletins (50 states) | Weekly | Insurance pack |
| CFPB enforcement actions | Daily | Mortgage + Tax Relief + Debt Relief packs |
| SEC enforcement / FINRA notices | Daily | Financial Advisor pack |
| HUD / DOJ Fair Housing | Weekly | Real Estate pack |
| EEOC guidance | Weekly | Recruiting pack |
| EU AI Act implementing acts | Monthly | Cross-cutting A9 |
| State privacy law updates (CCPA, etc.) | Monthly | Cross-cutting + all packs |

Output: a `compliance-update-candidates.md` document maintained by the watcher; reviewed by counsel on the quarterly cadence.

## D.2 Monthly review

- Engineering reviews watcher output
- Triage into:
  - **Urgent** (regulatory change effective in <30 days): escalate to counsel within 5 business days
  - **Routine**: batch for quarterly review
- Re-validate **existing published funnels** against current rule packs (regression check); any new violations surface in customer's GoFunnelAI dashboard as a soft warning with one-click "regenerate to fix"

## D.3 Quarterly cycle

Cadence: end of each calendar quarter.

1. **Week 1:** Engineering compiles `quarterly-changelog-draft.md` with all proposed rule updates
2. **Week 2:** Outside counsel review (firm of record TBD by GC)
3. **Week 3:** Engineering implements approved changes; bumps semver on affected packs
4. **Week 4:** Regression test suite runs:
   - Golden-set of historical funnels re-evaluated; expected outcomes verified
   - New rule fixtures (positive + negative examples) added to test suite
   - Sign-off from VP Eng + GC required before deploy
5. **Deploy:** Atomic rollout with feature flag; rollback plan in place

## D.4 Versioning

Every rule pack uses semver:
- **MAJOR**: Structural change (new severity codes, schema change) — requires re-test of consuming agents
- **MINOR**: New rules, new disclosures
- **PATCH**: Rule text updates, regex refinements, citation corrections

Every pack carries a `changelog` field listing all changes since the prior major version. The audit log records the exact pack version that evaluated each funnel.

## D.5 Customer-facing change communication

When a published funnel violates a newly-updated rule:
- Yellow banner on customer dashboard: "Compliance update: One element of your funnel may need updating per recent [FTC/state] guidance."
- One-click "Regenerate" applies the new rule's auto-fix
- Critical (HARD_BLOCK-tier) violations on already-published funnels: email notification + 7-day grace period before forced takedown of the offending element (per Doc 05a Â§X — needs cross-reference confirmed with Legal/Eng)

---

# Appendix A — Regex Pattern Library

(Selected reusable patterns; see `compliance/patterns/` in repo for canonical source. All patterns are case-insensitive, Unicode-aware.)

```
SUPERLATIVE_UNQUALIFIED = \b(best|#1|number\s+one|top[-\s]rated|leading|world['']?s?\s+(best|leading|top))\b
GUARANTEE = \bguaranteed?\b
ABSOLUTE_SAFETY = \b(100%|completely|totally|absolutely)\s+(safe|effective|painless|risk[-\s]free)\b
DISEASE_CLAIM = \b(cure|cures|cured|curing|treat|treats|treated|prevent|prevents|prevented)\s+(?:[a-z]+\s+){0,3}(disease|illness|condition|cancer|diabetes|alzheimer|heart\s+disease|covid|flu|infection|hiv|aids|hepatitis|tuberculosis)\b
DOLLAR_AMOUNT = (?:\$|usd\s?)?[\d,]+(?:\.\d{2})?
TIME_PERIOD = \b\d+\s+(seconds?|minutes?|hours?|days?|weeks?|months?|years?)\b
WEIGHT_LOSS_SPECIFIC = \blose\s+\d+\s*(lbs?|pounds?|kg)\s+in\s+\d+\s+(days?|weeks?|months?)\b
INCOME_CLAIM = \bmake\s+\$?[\d,]+(?:\.\d{2})?\s+(in|per|every)\s+(?:\d+\s+)?(days?|weeks?|months?|years?|hours?)\b
TRIGGER_TERM_RATE = \b\d+(?:\.\d+)?\s*%\s+(rate|interest|APR)\b
PHI_FIELD = \b(diagnosis|condition|symptoms?|medication|prescriptions?|treatments?|insurance.+(member|policy|id)|date.+of.+birth|ssn|social.+security)\b
ATTORNEY_RESULT = \b\$?[\d,]+(?:\.\d{2})?\s*(million|m|thousand|k)\s+(settlement|verdict|recovery|award)\b
```

---

# Appendix B — Disclosure Text Templates

Stored as Jinja2 templates in `compliance/disclosures/`.

**B-1 — Generic typical-results (FTC Â§255):**
> Individual results vary. Testimonials reflect the experiences of {{individual|"the customer"}} and are not a guarantee of results. Your results may differ based on {{factors}}.

**B-2 — TCPA consent (default):**
> By providing my phone number, I expressly consent to receive marketing calls and text messages from {{brand}} and its affiliates at the number provided, including via auto-dialer or pre-recorded message. Consent is not a condition of purchase. Msg & data rates may apply. Reply STOP to opt out, HELP for help.

**B-2-FL — TCPA consent (Florida FTSA stricter):**
> By providing my phone number and clicking [submit], I expressly authorize {{brand}} (and not its affiliates) to contact me at the number provided using automated systems for telephone solicitations and text messages, even if the number is on a Do-Not-Call list. Consent is not a condition of purchase. Msg & data rates may apply. Reply STOP to opt out.

**B-3 — Attorney advertising:**
> Attorney advertising. {{firm_name}}, {{firm_address}}. Responsible attorney: {{responsible_attorney}}, {{bar_number}}, licensed in {{states}}. Past results do not guarantee future outcomes. Every case depends on its own facts.

**B-4 — Health-claim DSHEA:**
> These statements have not been evaluated by the Food and Drug Administration. This product is not intended to diagnose, treat, cure, or prevent any disease.

**B-5 — Mortgage NMLS:**
> {{lender_name}}, NMLS #{{nmls_id}}. Equal Housing Lender. All loans subject to credit approval. Rates and terms subject to change without notice.

**B-6 — SEC Marketing Rule:**
> {{firm_name}} is a registered investment adviser. Registration does not imply a certain level of skill or training. Past performance does not guarantee future results.

**B-7 — Bankruptcy BAPCPA:**
> We are a debt relief agency. We help people file for bankruptcy relief under the Bankruptcy Code.

**B-8 — Real Estate EHO:**
> {{agent_name}}, {{license_number}}, {{brokerage_name}}, {{brokerage_license}}. Equal Housing Opportunity.

**B-9 — AI content disclosure (EU + best-practice US):**
> This page includes content generated with the assistance of artificial intelligence. {{brand}} reviewed and approved all content before publication. Made with GoFunnelAI.

**B-10 — Weight-loss FTC:**
> Results are not typical. In a study of {{n}} participants, the average result was {{outcome}}. Individual results depend on factors including adherence, diet, exercise, and individual physiology.

**B-11 — Course earnings:**
> Earnings results are not typical. The students featured invested significant time and effort. Most students who purchase courses do not implement them. Your results will depend on factors including effort, prior experience, market conditions, and other variables outside our control.

**B-12 — Cosmetic surgery risk:**
> Cosmetic surgery involves risks, including infection, scarring, anesthesia complications, and unsatisfactory results. Discuss risks and benefits with a qualified surgeon. Results vary by individual.

---

# Appendix C — Severity Codes (Canonical)

```python
class Severity(str, Enum):
    HARD_BLOCK = "HARD_BLOCK"   # Cannot publish; auto-fix or human review
    SOFT_FLAG = "SOFT_FLAG"     # Publishable with auto-inserted disclosure
    REVIEW = "REVIEW"           # Route to human review queue
    INFO = "INFO"               # Best practice; surfaced as suggestion
```

---

# Appendix D — Open Questions for Counsel

These items are flagged `[ATTY-REVIEW]` throughout and consolidated here:

1. **TCPA one-to-one consent** — Post-IMC v. FCC (11th Cir. Jan 2025), what is the current safe-harbor consent template per state? Should we adopt the stricter FTSA-style consent as default for all US? (Rule A5)

2. **HHS OCR tracking-technology guidance** — Post-AHA v. Becerra (June 2024), what is the current scope of "third-party tracking" prohibition for healthcare advertising? (Rule A10)

3. **EU AI Act Article 50** — What is the precise scope of "deceptively similar" requiring disclosure, and what specific disclosure language is recommended for EU-targeted funnels? (Rule A9)

4. **COPPA reform (2024 NPRM)** — Will the rule change apply to 13–17? Timing? (Rule A7)

5. **Course "business opportunity" classification (16 CFR 437)** — When does a course cross into business opportunity territory requiring the Disclosure Document? (B15)

6. **Compounded GLP-1 state laws** — Current state of LA, MS, TX restrictions and ongoing legislation. (B2)

7. **CMS Medicare marketing rules** — Should B9 split into B9a (Medicare) given the separate regulatory regime under 42 CFR Part 422?

8. **Medical device "FDA cleared" vs "FDA approved"** — Best safe-harbor language for 510(k)-cleared devices in advertising. (B1)

9. **State attorney advertising filing requirements** — Which states require pre-publication filing (NJ, FL for certain ads, others) and should the Compliance Agent prevent publication pending filing? (B5)

10. **"Made with GoFunnelAI" footer** — Is this footer alone sufficient to satisfy emerging state AI disclosure laws (CA AB 2013, CO SB 24-205, Utah AI Policy Act), or do we need to enumerate per-state disclosure variants? (A9)

11. **Fair Housing "steering" via imagery selection** — Can we be liable for image-selection patterns the AI generates? What's the engineering control? (B13)

12. **Prop 65 ingredient mapping** — Maintaining the Prop 65 chemical list and ingredient-to-warning mapping is a substantial undertaking. Build vs license? (B16)

13. **State unaccredited-school disclosure language** — Confirm canonical language for CA BPPE, FL CIE, NY BPSS. (B15)

14. **Loop-back to Doc 05e (Publish Acknowledgment)** — Is the customer's contractual acknowledgment that they are the publisher of record sufficient to shift FTC liability? (Cross-cutting)

15. **Retention period for compliance audit logs** — 7 years assumed; confirm against FTC and state retention norms per industry. (C.10)

---

# Document Control

**Version history:**
- v1.0 (2026-05-25): Initial draft. Engineering authorship. **PENDING COUNSEL REVIEW.**

**Approval matrix (required before production deployment):**
- [ ] VP Engineering — Eng review (regex correctness, agent integration)
- [ ] General Counsel — Legal sufficiency
- [ ] Outside Counsel (per vertical, where required) — Substantive accuracy
- [ ] CEO — Risk acceptance

**Next milestone:** Outside counsel review of Part B verticals 1, 2, 5, 9, 10, 11, 12, 15, 16 (HIGH RISK categories) within 30 days of v1 distribution.

---

*END OF DOCUMENT — Doc 21, v1.0 (pending counsel review)*
