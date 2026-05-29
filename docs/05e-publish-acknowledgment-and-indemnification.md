# GoFunnelAI — Publish Acknowledgment & Indemnification (Regulated Verticals)

**Document ID:** 05e-publish-acknowledgment-and-indemnification
**Status:** v1 — pending counsel review
**Effective Date:** [TO BE SET ON LAUNCH]
**Last Updated:** [TO BE SET ON LAUNCH]
**Entity:** GoFunnelAI, Inc., a Delaware C-corporation

> **Plain-language note:** This document specifies the **publish-time acknowledgment** required when you publish content in a **Regulated Vertical**, together with the binding **indemnification clause** that applies to all Published Content. It is part of and incorporated by reference into the **Terms of Service** (`05a-terms-of-service.md`, Section 5).
>
> Related documents:
> - **Terms of Service** (`05a-terms-of-service.md`)
> - **Privacy Policy** (`05b-privacy-policy.md`)
> - **Acceptable Use Policy** (`05c-acceptable-use-policy.md`)
> - **Refund Policy** (`05d-refund-policy.md`)

---

## 1. Purpose

AI-generated marketing in Regulated Verticals (healthcare, legal, finance, insurance, weight-loss / GLP-1, cosmetic surgery, debt/bankruptcy, employment, credit, and similar) can expose you and your end-users to significant legal risk if not reviewed and compliance-checked. This document defines:

(a) the **Regulated Verticals** subject to the additional checkpoint;
(b) the **UX flow** that delivers the publish-time acknowledgment;
(c) the **exact acknowledgment text** the user must check before first publish (and on re-prompt);
(d) the **audit-trail requirements**;
(e) the **indemnification clause** binding the user.

---

## 2. Regulated Verticals — Scope

The publish-time acknowledgment is triggered when your Account, your funnel, or your Published Content relates to any of the following ("**Regulated Verticals**"):

| # | Vertical | Examples and notes |
|---|---|---|
| 1 | **Healthcare and wellness** | Medical practices, telehealth, clinics, supplements, medical devices, mental-health services, diagnostic claims |
| 2 | **Legal services** | Attorney advertising, legal-aid, paralegal, document-preparation services |
| 3 | **Financial services** | Investment advice, brokerage, financial planning, crypto, forex, robo-advisory |
| 4 | **Insurance** | Life, health, auto, home, commercial; agents and brokers |
| 5 | **GLP-1 / weight-loss pharmaceuticals** | Semaglutide, tirzepatide (Ozempic, Wegovy, Mounjaro, Zepbound), compounded GLP-1, weight-loss programs making efficacy claims |
| 6 | **Cosmetic surgery and aesthetic medicine** | Plastic surgery, dermatology, med-spa, injectables, lasers, before/after imagery |
| 7 | **Debt relief, bankruptcy, credit repair** | FDCPA-regulated services, credit counseling, settlement, BK petition prep |
| 8 | **Employment and recruiting** | Job ads, AI-assisted screening, recruiting agencies, hiring funnels |
| 9 | **Credit and lending** | Personal loans, mortgages, BNPL, auto finance, payday/short-term lending |
| 10 | **Securities, ICOs, token sales** | Any solicitation of investment |
| 11 | **Gambling, sports betting, daily fantasy** | Where lawful and licensed |
| 12 | **Cannabis, CBD, kratom, psychedelics** | Where lawful and licensed |
| 13 | **Tax preparation and advice** | IRS Circ. 230, state CPA/EA rules |
| 14 | **Immigration services** | EOIR/ABA rules, BIA accreditation |
| 15 | **Real estate** | Fair Housing Act, MLS, broker licensing |
| 16 | **Education** | For-profit education, Title IV, state authorization |

The Service may add Regulated Verticals at any time; updates are reflected in this document and the in-product flow.

---

## 3. Detection and Trigger Logic

3.1 The publish-time acknowledgment is triggered when **any** of the following is true at the moment of publish, send, or first activation:

(a) the user selects a Regulated Vertical during onboarding, in workspace settings, or when picking a template;
(b) the Generated Content or User Content matches a Regulated-Vertical classifier (keyword, embedding, or model-based) above a threshold;
(c) the user connects a Third-Party Integration commonly associated with a Regulated Vertical (e.g., pharmacy, health-record, lending, broker-dealer integrations);
(d) a human reviewer at GoFunnelAI flags the workspace.

3.2 The acknowledgment is required:

- before the **first publish event** in that vertical for the workspace;
- on **material content changes** (regulated claims modified, vertical reclassified);
- on **substantive policy updates** to this document (version bump that changes obligations);
- at least **every 12 months**, on rolling re-acknowledgment.

---

## 4. UX Flow

```
[User clicks "Publish" / "Send" / "Activate Voice Agent"]
              â”‚
              â–¼
   â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
   â”‚  Regulated Vertical detected: [VERTICAL NAME]   â”‚
   â”‚                                                 â”‚
   â”‚  GoFunnelAI uses generative AI. AI output is a   â”‚
   â”‚  DRAFT. You are solely responsible for          â”‚
   â”‚  reviewing it for accuracy, legality, and       â”‚
   â”‚  compliance before publishing.                  â”‚
   â”‚                                                 â”‚
   â”‚  Because your content is in a regulated         â”‚
   â”‚  vertical, you must acknowledge the following   â”‚
   â”‚  before continuing.                             â”‚
   â”‚                                                 â”‚
   â”‚  [ View full acknowledgment â–¼ ]                 â”‚
   â”‚                                                 â”‚
   â”‚  â˜ I have read and agree to the                 â”‚
   â”‚    Publish Acknowledgment (v[X.Y]).             â”‚
   â”‚                                                 â”‚
   â”‚  Recommended next steps:                        â”‚
   â”‚   • Have a qualified professional review        â”‚
   â”‚   • Verify all claims with primary sources      â”‚
   â”‚   • Confirm licensing in every jurisdiction     â”‚
   â”‚   • Confirm consent for all recipients          â”‚
   â”‚                                                 â”‚
   â”‚  [ Cancel ]                  [ Confirm & Publish ]
   â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

4.1 The "Confirm & Publish" button is **disabled** until the user actively checks the box. The checkbox is **never pre-checked**.

4.2 The full acknowledgment text (Section 5) is shown in an expandable panel, fully readable in-app (not a link-out only). The user must scroll to the end before the checkbox enables.

4.3 The dialog records the time of impression and the time of acknowledgment.

4.4 If the user cancels, the publish is blocked and a draft state is preserved.

4.5 For RevTry voice agent activation, the same flow applies before the first outbound or inbound call is enabled.

---

## 5. Required Acknowledgment Text — v1.0

The exact text the user must agree to is reproduced below. The Service stores the **version identifier** alongside each acknowledgment so we can prove what the user agreed to at the time.

> **GoFunnelAI Publish Acknowledgment — Regulated Vertical — v1.0**
>
> By checking this box and clicking "Confirm & Publish," I acknowledge and agree as follows:
>
> 1. **AI output is a draft.** The content I am about to publish, send, or activate was generated or assisted by GoFunnelAI's AI features. AI output can be inaccurate, biased, outdated, infringing, or non-compliant. It is a draft, not a final, vetted, or legally cleared product.
>
> 2. **I have reviewed the content.** I have personally reviewed every page, message, script, claim, image, audio file, and call flow that will be published, sent, or used. I am not relying on GoFunnelAI to ensure its accuracy, legality, or suitability.
>
> 3. **I am responsible for compliance.** I am solely responsible for ensuring the content complies with all laws, regulations, professional codes, advertising rules, platform policies, and licensing requirements applicable to me, my business, my audience, and every jurisdiction in which the content will be accessible. This includes (without limitation): FTC Act and FTC endorsement / health-claim guidance; FDA, EMA, MHRA, and equivalent drug/device rules; HIPAA and state medical-privacy laws; state attorney-advertising rules; SEC, FINRA, CFPB, state UDAP, Reg Z, TILA, ECOA, FDCPA, FCRA; state insurance licensing; ADA/WCAG accessibility; CAN-SPAM, TCPA, CASL, GDPR/ePrivacy, LGPD, POPIA, DPDP, and equivalent consent and anti-spam laws; PIPEDA; child-protection laws; tax and securities laws; advertising codes administered by Meta, Google, TikTok, LinkedIn, X, YouTube, Reddit, Apple, and other platforms; and any sector-specific rules applicable to my Regulated Vertical.
>
> 4. **Professional review.** Where my Regulated Vertical requires advice from a licensed professional (e.g., physician, attorney, financial advisor, insurance compliance officer), I confirm I have either obtained that review or have determined in good faith that the content does not require it for my use case.
>
> 5. **Licensing and authorization.** I confirm I hold (or my client/principal holds) every license, registration, certification, accreditation, or authorization required to operate in the Regulated Vertical and to make the claims being published in every applicable jurisdiction.
>
> 6. **Substantiation.** I have a reasonable basis and contemporaneous documentation for every objective claim, statistic, testimonial, before/after image, outcome, and earnings or savings figure in the content.
>
> 7. **Consent.** I confirm I have all consents legally required to (a) contact each recipient of the content, (b) record calls where applicable, (c) use any individual's name, voice, image, likeness, or biometric identifier, and (d) process any personal data involved.
>
> 8. **No professional advice from GoFunnelAI.** GoFunnelAI does not provide medical, legal, financial, tax, regulatory, or other professional advice, and I am not relying on GoFunnelAI for any such advice.
>
> 9. **Indemnification.** I agree to **defend, indemnify, and hold harmless** GoFunnelAI, Inc., its affiliates, officers, directors, employees, agents, contractors, and licensors from and against any and all claims, demands, actions, investigations, losses, damages, liabilities, fines, penalties, settlements, judgments, costs, and expenses (including reasonable attorneys' fees and expert fees) arising out of or relating to: (a) my Published Content; (b) my use of the Service in violation of the Terms of Service, the Acceptable Use Policy, or any law; (c) any breach of the representations I make in this acknowledgment; and (d) any third-party claim by a recipient of, or person referenced in, my Published Content. This obligation survives termination of my Account.
>
> 10. **GoFunnelAI's disclaimer.** GoFunnelAI disclaims liability for my Published Content to the maximum extent permitted by law. The Service is provided "as is" and "as available."
>
> 11. **Audit trail.** I understand and agree that this acknowledgment is logged with a timestamp, my IP address, my Account identifier, the version of this text I agreed to, and the publish event it relates to. I agree this electronic record is admissible as evidence of my agreement and that GoFunnelAI may rely on it.
>
> 12. **Binding nature.** I have authority to bind myself, my company, and any client on whose behalf I am publishing. I have read the underlying Terms of Service (`05a-terms-of-service.md`), Acceptable Use Policy (`05c-acceptable-use-policy.md`), and Privacy Policy (`05b-privacy-policy.md`), and I agree to be bound by them.
>
> â˜ I have read and agree to the Publish Acknowledgment (v1.0).

The string `GoFunnelAI Publish Acknowledgment — Regulated Vertical — v1.0` and the **SHA-256 hash** of the canonical text are stored in our policy registry. Any change to the text increments the version and triggers re-acknowledgment.

---

## 6. Audit Trail Requirements

Each acknowledgment event MUST be persisted to an append-only audit log with at least the following fields:

| Field | Description |
|---|---|
| `event_id` | Unique, monotonic ID |
| `account_id` | GoFunnelAI workspace ID |
| `user_id` | Acting user ID |
| `user_email` | Email at time of event |
| `ip_address` | Source IP (IPv4/IPv6) |
| `user_agent` | Browser / device user agent |
| `geo_inference` | Approximate country/region from IP (optional, where lawful) |
| `regulated_vertical` | Vertical(s) detected, with confidence |
| `trigger_reason` | Which detector(s) fired (Section 3.1) |
| `policy_version` | e.g., `publish-ack-v1.0` |
| `policy_hash_sha256` | Hash of the canonical text shown to the user |
| `policy_locale` | Language locale presented (e.g., `en-US`) |
| `displayed_at` | Timestamp the dialog was shown |
| `scrolled_to_end_at` | Timestamp the user reached the end |
| `checkbox_checked_at` | Timestamp the box was checked |
| `confirmed_at` | Timestamp "Confirm & Publish" was clicked |
| `publish_event_id` | Linked publish action |
| `content_fingerprint` | Hash of the content as published |
| `signature` | HMAC signature over the record |

6.1 **Retention.** Acknowledgment audit records are retained for **7 years**, consistent with `05b` Section 7.

6.2 **Tamper-evidence.** Records are written to an append-only store with periodic hash-chaining or equivalent integrity controls; backups are encrypted.

6.3 **Access.** Users may export their own acknowledgment history from `Settings â†’ Compliance â†’ Acknowledgments`. GoFunnelAI may produce records in legal proceedings or in response to lawful requests.

6.4 **Localization.** The acknowledgment text is presented in the user's selected interface language (EN/ES/PT/FR/DE at launch; additional locales over time). The English version of v1.0 is the canonical legal text; localized versions are translations for usability, and the English version controls in case of conflict.

---

## 7. Indemnification (Restated and Binding)

> **The user shall defend, indemnify, and hold harmless GoFunnelAI, Inc., its affiliates, and their respective officers, directors, employees, agents, contractors, and licensors (the "Indemnitees") from and against any and all third-party claims, demands, actions, suits, proceedings, investigations, losses, damages, liabilities, fines, penalties, settlements, judgments, costs, and expenses (including reasonable attorneys' fees, expert fees, and disbursements) (collectively, "Losses") arising out of or relating to: (a) the user's Published Content, including any allegation that such content is false, misleading, deceptive, infringing, defamatory, in violation of any privacy, publicity, intellectual property, consumer-protection, advertising, telemarketing, anti-spam, healthcare, financial, securities, gambling, employment, fair-housing, accessibility, data-protection, or other law; (b) the user's breach of the Terms of Service (05a), Acceptable Use Policy (05c), Privacy Policy (05b), or any representation made in any Publish Acknowledgment; (c) the user's failure to obtain any required consent, license, registration, or authorization; (d) any claim by a recipient of, or any individual identified or depicted in, the user's Published Content; (e) the user's use of any Third-Party Integration; and (f) any tax, withholding, or contribution obligation of the user.**
>
> **GoFunnelAI will (i) promptly notify the user of any claim subject to indemnification (a delay does not relieve the user except to the extent prejudiced), (ii) tender control of the defense and settlement to the user (provided the user uses counsel reasonably acceptable to GoFunnelAI and does not settle in a way that admits GoFunnelAI's liability, imposes obligations on GoFunnelAI, or fails to fully release GoFunnelAI, without GoFunnelAI's prior written consent), and (iii) cooperate at the user's expense. GoFunnelAI may participate in the defense with its own counsel at its own expense.**
>
> **This indemnification is in addition to, and does not limit, any other remedies available to GoFunnelAI. It survives termination of the user's Account.**

7.1 **No limitation on user obligations.** The limitation of liability in **ToS Section 10.2** does **not** apply to the user's indemnification obligations under this Section 7 or to amounts the user owes for usage, taxes, or restitution.

7.2 **GoFunnelAI disclaimer.** GoFunnelAI disclaims liability for the user's Published Content to the maximum extent permitted by law and makes no representation that Generated Content is accurate, lawful, non-infringing, or fit for any purpose.

7.3 **Consumer carve-out.** Where mandatory consumer law in the user's jurisdiction limits or modifies indemnification by a consumer, those limits apply and the remainder of this Section 7 continues in force to the maximum extent permitted.

---

## 8. Relationship to Other Documents

| Document | Connection |
|---|---|
| `05a-terms-of-service.md` | Section 5 establishes the general AI-output and indemnification framework. This document is the operational implementation. |
| `05b-privacy-policy.md` | Defines retention and handling of the audit-trail records produced here (Section 7, audit logs — 7 years). |
| `05c-acceptable-use-policy.md` | Defines independent baseline of prohibited content; this acknowledgment supplements but does not replace it. |
| `05d-refund-policy.md` | Suspension/termination for breach of this acknowledgment does not entitle a refund (Section 1, table; Section 5.2 of `05d`). |

---

## 9. Versioning and Updates

9.1 The acknowledgment text is **versioned** (`v1.0`, `v1.1`, ...). Material changes increment the major version and re-prompt all affected users.

9.2 The canonical text for each version is preserved indefinitely so that historical audit records remain interpretable.

9.3 A public version history of this document is maintained at `https://gofunnelai.com/legal/history`.

---

## 10. Contact

- **Legal / acknowledgment questions:** `legal@gofunnelai.com`
- **Compliance and audit-record requests:** `compliance@gofunnelai.com`
- **Privacy:** `privacy@gofunnelai.com`

---

*— End of Publish Acknowledgment & Indemnification, v1, pending counsel review —*
