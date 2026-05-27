# 12 â€” PRD Pack v1 (Day-90 Launch)

**Owner:** VP Engineering
**Status:** Engineering source of truth â€” locked for Day-90 launch
**Audience:** Engineering, QA, T&S, Trust, Billing, Admin Console teams
**Cross-references:**
- Event taxonomy & DB schemas: `03-event-taxonomy-and-schemas.md`
- Integration matrix + Provider Abstraction Layer (PAL): `04-integration-matrix-and-pal.md`
- Legal flows: `05a-terms-of-service.md`, `05b-privacy-policy.md`, `05c-acceptable-use-policy.md`, `05d-refund-policy.md`, `05e-publish-acknowledgment-and-indemnification.md`
- Trust & Safety policy: `07a-trust-and-safety-policy.md`
- Human Review Queue: `07b-human-review-queue.md`
- Cost Governor: `07c-cost-governor.md`
- Engineering ops: `08-engineering-ops-spec.md`

> **Role matrix anchor.** Where this pack says "role matrix" it refers to the canonical `workspace_role` enum defined in Doc 03 Â§B.0 â€” `owner | admin | editor | analyst | viewer | billing` â€” and the admin-console role set defined in PRD 5 Â§7 (`read_only | support | billing_admin | engineering | super_admin`). Both are enforced server-side by `packages/auth` (see Doc 08 Â§47 of the engineering ops spec). Every "permissions enforced" section below resolves capabilities against one of these two sets.

> **Event taxonomy anchor.** Every event name in any "telemetry events emitted" section MUST exist in Doc 03 Part A. If a PRD requires a new event, it must be added to Doc 03 in the same PR and pass the linter in `tooling/eventschema/`.

> **Compliance gates anchor.** Anywhere a generation can be auto-blocked, auto-routed-to-review, or escalated, the gate is one of: 07a Â§R1â€“R7 (policy rules), 07b Â§2.1â€“2.4 (queue triggers), 07c Â§3 (budget ceilings). Cite the specific rule, not just the doc.

> **Legal flow anchor.** Any user-visible click that creates contractual obligation (ToS accept, AUP accept, publish acknowledgment, refund request, DSAR submission) must be wired to the corresponding doc in `05*`.

---

## Table of contents

- [PRD 1 â€” Onboarding Module](#prd-1--onboarding-module)
- [PRD 2 â€” Generation Engine](#prd-2--generation-engine)
- [PRD 3 â€” Native CRM + Lead Engine](#prd-3--native-crm--lead-engine)
- [PRD 4 â€” Billing Module](#prd-4--billing-module)
- [PRD 5 â€” Admin Console (admin.funelai.com)](#prd-5--admin-console-adminfunnelai)

---

# PRD 1 â€” Onboarding Module

**Workstream owner:** Onboarding squad (FE lead + BE lead + 1 ML eng for industry classifier)
**Source-of-truth services:** `onboarding-svc`, `brand-autofill-svc`, `industry-classifier-svc`
**Cross-PRD interactions:** feeds PRD 2 (Generation Engine), PRD 3 (CRM seed defaults), PRD 4 (trial start), PRD 5 (Admin can inspect/edit Business Profile).

## 1. Module overview

The Onboarding Module captures a customer's business identity in â‰¤ 60 seconds via four interchangeable input channels â€” short form, URL, document upload, or voice â€” and produces a single canonical `business_profile` document. That document is the sole input contract for the Generation Engine (PRD 2). Onboarding fans-out async enrichment to Clearbit, WhoisXML, LinkedIn (via partner API), and Crunchbase to pre-fill brand identity (logo, colors, palette, copy voice cues, founding year, employee count, social handles). A free-form industry string is mapped to one of 30 canonical verticals by `industry-classifier-svc` (text-embedding nearest-neighbor over a curated taxonomy). The output is versioned (`business_profile_versions`) and immutable per generation reference, so downstream generations are deterministic with respect to the profile they used.

## 2. User stories (Given / When / Then)

1. **GIVEN** an anonymous visitor on `funelai.com/start` **WHEN** they choose "Form" and submit business name, industry free-text, target audience, and offer **THEN** a `business_profile` is persisted with `source=form`, the user is moved into Generation, and `user_signed_up` + `workspace_created` are emitted within the same database transaction.
2. **GIVEN** a signed-in user **WHEN** they paste their website URL and click Continue **THEN** the URL is scraped within 8s (timeout 12s), brand colors / logo / hero copy / industry hints extracted, fields pre-populated, and the user is given an editable review screen before confirming.
3. **GIVEN** a user uploads up to 3 documents (PDF, DOCX, PPTX) â‰¤ 20 MB total **WHEN** they click Continue **THEN** documents are extracted, summarized, and used to populate the `business_profile` draft; un-supported file types are rejected with a friendly inline error.
4. **GIVEN** a user chooses "Voice" **WHEN** they speak for 20â€“90 seconds answering 4 prompts ("what's your business?", "who buys?", "what do you sell?", "what makes you different?") **THEN** the audio is transcribed (Deepgram), structured into the profile JSON, and shown for confirmation; the user can re-record any single answer without losing the others.
5. **GIVEN** any of the four channels completes **WHEN** brand-autofill returns within 6 seconds **THEN** logo, colors, and verified social handles are merged into the draft with `provenance=autofill:<provider>`; if autofill exceeds 6s the user proceeds and autofill backfills the profile when it completes (UI shows a non-blocking "we're enriching your brandâ€¦" badge).
6. **GIVEN** the industry classifier produces a top-1 label with confidence â‰¥ 0.78 **WHEN** the user reviews the draft **THEN** that industry is pre-selected, with a "not quite right?" affordance that opens the full 30-vertical picker.
7. **GIVEN** the classifier top-1 confidence is < 0.78 **WHEN** the review screen renders **THEN** the user is shown the top 3 candidates as chips and must explicitly pick one before continuing.
8. **GIVEN** a user is in a regulated vertical (per Doc 07b Â§2.1) **WHEN** they confirm the profile **THEN** a regulated-vertical banner is shown, the `legal_acknowledgment_required=true` flag is set on the profile, and the user is presented with the publish-acknowledgment language (Doc 05e) *before* Generation can run.
9. **GIVEN** a returning user with an existing workspace **WHEN** they re-enter onboarding **THEN** the prior `business_profile` is loaded as the editable starting point (not a blank form), and saving creates a *new* version, not a mutation.
10. **GIVEN** the user abandons mid-flow **WHEN** they return within 30 days **THEN** the draft is restored from `business_profile_drafts` keyed on `user_id`; after 30 days the draft is purged and a fresh flow begins.
11. **GIVEN** a user enters a URL that returns 4xx/5xx/timeout **WHEN** the scraper fails **THEN** the UI degrades gracefully to the form path with whatever was extracted, surfacing a non-blocking "we couldn't fully read that site â€” please fill the missing fields" message.
12. **GIVEN** any input contains content prohibited by Doc 07a (e.g. AUP Â§R3 categories) **WHEN** the user submits **THEN** onboarding refuses to create the profile, emits `compliance_block_raised` with `policy_id=onboarding.aup.<rule>`, and shows the AUP-aligned refusal message from `06b-crisis-comms-library.md`.

## 3. Edge cases (at least 15)

1. URL with no `https://` prefix â€” auto-prefix and retry once.
2. URL behind Cloudflare bot-protection or login wall â€” fall back to OG-tag + meta extraction; if both fail, degrade to form.
3. URL whose root redirects to a different TLD â€” follow up to 3 redirects, cap on cross-origin chain length.
4. Website is a single-page React app with no SSR â€” execute a 4s headless render (Playwright in a sandboxed Worker), then re-extract.
5. Document upload contains macros / embedded executables â€” strip and continue with text; emit `pii_leak_blocked` if PII is detected in document contents pre-strip.
6. Voice transcription returns < 5 seconds of speech â€” show "we didn't catch that, try again" rather than producing a low-confidence profile.
7. Voice transcription contains profanity or AUP-violating speech â€” surface AUP rejection per story 12; do not silently scrub.
8. Brand-autofill returns conflicting logos from two providers â€” prefer Clearbit, fall back to OG `og:image`, never silently merge two different logos.
9. Clearbit returns 404 (unknown domain) â€” silently continue; record `provenance=autofill:not_found`.
10. Industry free-text is in a non-English language â€” pass through translation layer; if confidence on translated text < 0.6, force user to pick from 30-vertical list manually.
11. Industry free-text matches a vertical we *explicitly do not support* (per Doc 07a Â§R3, e.g. predatory loans, multi-level marketing recruiting) â€” block at onboarding with the Â§R3 refusal message; do not create the workspace.
12. User submits the same URL twice from different sessions â€” second invocation hits a 60s scrape cache, no double-spend on scraper costs.
13. Logo extraction returns a PNG with transparency vs a JPG without â€” normalize to PNG with transparent background where possible (canvas processing), persist both `logo_url` and `logo_url_square`.
14. Brand color extraction returns more than 8 dominant colors â€” cluster to a 4-color palette (primary, secondary, accent, neutral) and discard the rest.
15. User is in a country we do not yet launch in (per `06-country-launch-checklists.md` not-yet-launched list) â€” show the "join waitlist" path, do NOT create a billable workspace.
16. User is under the age gate (Doc 05a Â§3) â€” auth flow already enforces; onboarding double-checks the `dob`/age signal and refuses with a friendly message.
17. Document upload is encrypted/password-protected â€” reject with a specific message ("we can't read encrypted docs â€” paste the text or upload an unlocked copy").
18. Concurrent updates on the same draft from two browser tabs â€” last-write-wins per field, with optimistic UI and a non-blocking "we merged your latest changes" toast.
19. Brand autofill latency exceeds 30s â€” autofill job is marked `timed_out`, profile is finalized without enrichment, and a backfill job is scheduled for up to 24h.
20. Voice channel chosen on a device that denies mic permission â€” show fallback to form channel inline, without losing entered fields.

## 4. API dependencies

**Internal**
- `auth-svc`: session, `user_id`, email verification status.
- `workspace-svc`: `workspace_create()`, role assignment (`owner`).
- `industry-classifier-svc` (this PRD): `classify(free_text, locale) -> [{vertical, confidence}]`.
- `brand-autofill-svc` (this PRD): orchestrator over external enrichment providers, returns a normalized `BrandAutofillResult`.
- `consent-svc`: `consent_captured` write for marketing consent + ToS/Privacy acceptance.
- `event-bus`: emits canonical events to Kafka per Doc 03.
- `cg-svc` (Cost Governor): `precharge_check(workspace_id, channel)` â€” onboarding is free, but voice transcription and scraping must be metered.
- `kb-svc`: returns the KB pack ID (per Doc 02a) for the resolved vertical, attached to the profile for downstream Generation.

**External**
- Clearbit Enrichment API (logo, employee count, founded year).
- WhoisXML (domain age, registrant country â€” feeds Doc 07b Â§2.3 "new domain" trigger).
- LinkedIn (via approved partner: Coresignal or Proxycurl) â€” company description, employee count, headquarters.
- Crunchbase Enterprise API â€” funding stage, sector tags.
- Deepgram (voice transcription).
- Playwright headless render farm (for JS-rendered sites).
- Cloudflare Workers + R2 (file upload).

All external calls go through the PAL (Doc 04) so circuit-breakers, retries, and provider swaps are uniform.

## 5. Database tables / objects touched

- `users` (created by `auth-svc`, read here).
- `workspaces` (created here; see Doc 03 Â§B.2).
- `workspace_members` (creator added as `owner`).
- `business_profiles` (new â€” defined below).
- `business_profile_versions` (new â€” append-only).
- `business_profile_drafts` (new â€” TTL 30 days).
- `consent_records` (Doc 03 Â§B governance schemas).
- `audit_log` (Doc 03 Â§B.9).

**New schema (DDL sketch â€” must land in Doc 03 Â§B before merge):**

```sql
CREATE TABLE business_profiles (
  id                  TEXT PRIMARY KEY,                  -- bpf_â€¦
  workspace_id        TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  current_version_id  TEXT,                              -- bpv_â€¦
  industry_vertical   TEXT NOT NULL,                     -- one of 30 canonical
  industry_confidence NUMERIC(4,3),
  source              TEXT NOT NULL,                     -- 'form'|'url'|'docs'|'voice'
  legal_ack_required  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE business_profile_versions (
  id                  TEXT PRIMARY KEY,                  -- bpv_â€¦
  business_profile_id TEXT NOT NULL REFERENCES business_profiles(id) ON DELETE CASCADE,
  payload             JSONB NOT NULL,                    -- canonical profile doc
  autofill_provenance JSONB NOT NULL DEFAULT '{}',
  kb_pack_id          TEXT,                              -- snapshot of KB pack version (Doc 02a)
  created_by          TEXT REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE business_profile_drafts (
  user_id      TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  payload      JSONB NOT NULL,
  channel      TEXT NOT NULL,
  expires_at   TIMESTAMPTZ NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

All three tables get RLS keyed on `workspace_id` (drafts excepted â€” keyed on `user_id`).

## 6. Telemetry events emitted (Doc 03 references)

| Event | When | Notes |
|---|---|---|
| `user_signed_up` (A.1) | First time onboarding creates a user | `signup_method = 'onboarding_<channel>'` |
| `workspace_created` (A.1) | Workspace materialized | `template_id` if a template was used, `vertical` set to resolved industry |
| `consent_captured` (A.9) | ToS + Privacy + marketing consent | `purpose âˆˆ {tos, privacy, marketing_email}`, `version = doc 05a/05b version hash` |
| `kb_pack_attached` (A.9) | KB pack version pinned to profile | Add to Doc 03 if not present. Producer: `onboarding-svc`. |
| `business_profile_created` (new â€” A.1 extension) | New profile materialized | `vertical`, `confidence`, `source`, `autofill_providers_used[]` |
| `business_profile_updated` (new) | New version created | `previous_version_id`, `delta_summary` |
| `compliance_block_raised` (A.2) | Input violates AUP Â§R3 or matches Â§R1 banned set | `policy_id = onboarding.aup.<rule>` |
| `pii_leak_blocked` (A.9) | Document/voice contains P2/P3 data we refuse to ingest | `surface = onboarding` |

> **Note for engineering:** any "new" event above must be added to Doc 03 Part A in the same PR; do not ship onboarding without the schema landed.

## 7. Permissions enforced

Onboarding runs *before* a workspace exists for the form/URL/voice flow, so the only role that exists at the time of profile-create is `owner` (auto-assigned). After workspace exists:

| Capability | Roles |
|---|---|
| View business profile (current version) | `owner`, `admin`, `editor`, `analyst`, `viewer`, `billing` |
| Create new profile version | `owner`, `admin`, `editor` |
| Re-run autofill | `owner`, `admin`, `editor` |
| Delete draft | `owner` only |
| Override industry classifier label | `owner`, `admin`, `editor` |

Admin-console roles (PRD 5) can also read profiles; only `super_admin` can edit on behalf of a workspace and only inside an impersonation session (PRD 5 Â§8).

## 8. Error states + recovery paths

| State | User-visible behavior | Recovery |
|---|---|---|
| URL scrape timeout | Inline notice, continue to manual form prefilled with whatever was extracted | Background job retries autofill for 24h |
| Document parse error | "We couldn't read that file" with file-format guidance | User re-uploads or proceeds without |
| Voice ASR failure (e.g. carrier or Deepgram outage) | Fall back to text answers for the 4 prompts | Async retry on `voice_capture` blob |
| Classifier service down | UI shows full 30-vertical picker upfront; no autoclassify | Profile saved with `industry_confidence = null`; backfill job runs once classifier recovers |
| Brand-autofill provider down (any one) | Skip that provider; record `provenance.<provider> = "skipped:outage"`; continue | Re-enrichment job runs in 24h |
| All autofill providers fail | Profile saved with manual fields only | Re-enrichment job retries with exponential backoff over 7 days |
| AUP block | Refusal message; user can edit and resubmit | If user appeals, ticket opened with `policy_id` (see Doc 07b appeal flow) |
| KB pack missing for vertical | Block profile finalization, page T&S on-call | T&S provisions a KB pack stub (Doc 02a template) within 24h |
| Concurrent draft conflicts | Optimistic per-field merge; banner explaining what was merged | None needed; idempotent |
| Storage write failure on draft | Inline retry; client buffers in localStorage for 1h | If retries exhaust, surface a "save failed" toast with a "copy answers" button |

## 9. Acceptance criteria (engineering checklist)

- [ ] All four channels (form, URL, docs, voice) reach `business_profile.finalized=true` in the happy-path E2E test in â‰¤ 60 seconds at P50 and â‰¤ 90 seconds at P95.
- [ ] Industry classifier mean precision â‰¥ 0.90 against the held-out test set of 1,000 free-text-to-vertical pairs.
- [ ] Profiles are immutable post-finalize except via new version creation; an attempt to UPDATE in SQL is rejected by a CHECK constraint.
- [ ] `business_profile_versions.payload` validates against the JSON Schema in `packages/onboarding/profile.schema.json`.
- [ ] All AUP Â§R3 prohibited verticals are blocked at onboarding; the regression test suite has at least 30 positive and 30 negative cases.
- [ ] All events listed in Â§6 are emitted with the correct envelope (Doc 03 Â§A.0) and pass `tooling/eventschema/` lint.
- [ ] RLS policies on all three new tables verified by `packages/db/__rls_tests__/onboarding.test.ts`.
- [ ] Brand-autofill cost stays under $0.04 per profile at P95 (Cost Governor budget â€” Doc 07c Â§3.1 Free-tier ceiling).
- [ ] Drafts older than 30 days are purged nightly; verified by integration test.
- [ ] All copy passes the i18n linter (no hard-coded English in components; strings in `locales/en-US.json`).
- [ ] Telemetry dashboard `observability/dashboards/onboarding.json` shows funnel: profile-started â†’ channel-chosen â†’ profile-finalized â†’ first-generation-started, with per-channel completion rate.
- [ ] Accessibility: WCAG 2.1 AA on all four channels; keyboard-only flow verified.

## 10. Launch blockers (MUST work to launch)

1. All four channels reach finalize in happy path.
2. AUP Â§R3 block list enforced â€” no prohibited verticals can create a workspace.
3. Industry classifier deployed with the 30-vertical taxonomy; fallback manual picker works.
4. Brand autofill works for at least 2 of the 4 providers at any time (must survive a single-provider outage).
5. Regulated-vertical legal acknowledgment (Doc 05e) wired and acceptance recorded in `consent_records`.
6. `business_profile_versions` immutability + version pinning verified â€” a generation MUST be able to reference the exact profile version it used.
7. P95 â‰¤ 90s end-to-end on each channel under load test (Doc 08 perf budgets).
8. Telemetry events flowing to the warehouse and visible on the onboarding dashboard.
9. Feature flag `release.onboarding.v1` exists and can disable the new flow per Doc 08 Â§362.

## 11. Post-launch enhancements

- "Smart import" from Google Business Profile / Instagram bio / TikTok bio.
- Multi-language voice prompts (start: ES, DE, PT-BR; estimated by Month 3).
- AI-generated welcome video from the finalized profile.
- Profile-quality score (predicts downstream Generation quality) shown as a coaching score with "how to improve" tips.
- Bring-your-own-brand-guidelines PDF parser (auto-extract logo usage rules + color palette + voice tone).
- Profile diff visualizer between versions (for `admin` users investigating regressions).

## 12. Test plan

**Unit**
- `industry-classifier-svc.classify()` over the 1,000-case test set; precision/recall reported in CI.
- `brand-autofill-svc.merge()` deterministic merge order; conflict resolution rules.
- AUP Â§R3 block-list matcher; 100% coverage on rule IDs.
- Profile JSON schema validation.

**Integration**
- Form â†’ profile â†’ workspace creation, single transaction (rollback on any failure).
- URL channel against a fixture suite of 50 real-world site archetypes in `packages/onboarding/__fixtures__/urls/`.
- Document channel: PDF + DOCX + PPTX + edge formats (encrypted, macro, image-only); against `__fixtures__/docs/`.
- Voice channel against `__fixtures__/voice/` (clean, accented, noisy, profanity, AUP-violating, multilingual).
- Autofill provider outage simulations (each provider individually + all-providers-down).

**E2E**
- Playwright test in `e2e/onboarding/*.spec.ts` covering each of the 12 user stories above. Runs on every PR.
- Cross-PRD: onboarding â†’ Generation Engine (PRD 2) â†’ first funnel published â€” must complete in â‰¤ 4 minutes wall clock (Doc 08 Â§A.1.5 perf budget).

**Load**
- 500 concurrent profile-creates sustained for 10 minutes â€” error rate < 0.1%, P95 < 90s.

---

# PRD 2 â€” Generation Engine

**Workstream owner:** Generation squad (Tech lead + 2 BE eng + 2 ML eng + 1 FE eng for streamed UI)
**Source-of-truth services:** `orchestrator`, `quality-svc`, `fact-check-agent`, `compliance-agent`, `brand-guardian-agent`, plus the 12 production agents.
**Cross-PRD interactions:** consumes PRD 1 (Business Profile); produces assets consumed by PRD 3 (CRM hooks, audience targeting), PRD 4 (Cost-governor accounting maps to plan ledger), PRD 5 (Admin can replay, regenerate, inspect).

## 1. Module overview

The Generation Engine is the production multi-agent system that converts a finalized `business_profile_version` into a complete campaign: funnel JSON (multi-step page), ad creatives (Meta + Google formats), email sequence, SMS sequence, voice script (RevTry), lead magnet (gated PDF/quiz), and upsell sequence â€” emitted as one atomic `generation` object. Sixteen agents (Planner, Hook, Page, Lead Magnet, Image, Video, Ad Copy, Audience, Email, SMS, Voice Script, Upsell, Fact-Check, Compliance, QA, Brand Guardian) run under the orchestrator. UI is server-sent-event-streamed so the user sees agents complete in real time. A quality bar of 80 (per Doc 07b Â§2.3) gates publish; below 60 = auto-reject, 60â€“79 = auto-regen with cheaper path (Doc 07c Â§5), 80â€“85 = human review (Doc 07b), â‰¥ 86 = auto-approve. Cost Governor (Doc 07c) enforces tier Ã— industry Ã— complexity budgets at every charge; an exhausted budget downgrades or skips per the recommendation table. Every agent invocation is audit-logged with input/output hashes, agent version, token usage, and cost. Human Review Queue (Doc 07b) triggers route the generation to `review-svc` automatically. Regenerations are first-class operations with a `previous_generation_id` and a `regenerate_reason`.

## 2. User stories

1. **GIVEN** a finalized `business_profile_version` **WHEN** the user clicks "Generate my funnel" **THEN** `generation_started` is emitted, the orchestrator picks the agent lineup, and a streamed UI begins showing per-agent status within 800 ms.
2. **GIVEN** a generation is running **WHEN** the user navigates away **THEN** the generation continues server-side; on return, the UI re-attaches to the same stream via `generation_id`.
3. **GIVEN** a generation completes with quality score â‰¥ 86 **WHEN** there are no compliance or fact-check flags **THEN** the generation transitions to `approved`, all assets are persisted in `assets` + `asset_versions` (Doc 03 Â§B.10), and `generation_completed` is emitted.
4. **GIVEN** quality score falls between 60 and 79 **WHEN** the rubric reports a remediable dimension (e.g. weak hook) **THEN** the orchestrator auto-regenerates once with the failing dimensions targeted and a cheaper model lineup (Doc 07c Â§5 degradation policy).
5. **GIVEN** quality score is between 80 and 85 OR a Doc 07b Â§2 trigger fires **WHEN** the generation completes **THEN** it enters `review_required`, `human_review_required` is emitted with the routing reason, and the user sees the positive-framed banner from Doc 07b Â§8.1.
6. **GIVEN** the customer is in a regulated vertical (Doc 07b Â§2.1) AND it is their first publish in that workspace **WHEN** the generation completes **THEN** it MUST route to review regardless of quality score.
7. **GIVEN** Fact-Check agent raises a flag with confidence â‰¥ 0.7 **WHEN** the claim is in a regulated vertical **THEN** the generation is paused at `review_required` with `reason=fact_check_flag`; the human reviewer dashboard shows the claim text + evidence refs (Doc 07b Â§6.2).
8. **GIVEN** Compliance agent raises a `severity=high` block **WHEN** the generation completes **THEN** the generation is auto-rejected, `compliance_block_raised` is emitted, and the user sees the AUP-aligned explanation from `06b-crisis-comms-library.md`.
9. **GIVEN** the Cost Governor returns `status=exhausted` mid-generation **WHEN** an optional agent (e.g. Video) is next **THEN** the orchestrator skips it per the Â§5 recommendation; the user is told "we kept it lean to stay in budget" and the generation completes successfully.
10. **GIVEN** the user clicks "Regenerate" on a completed funnel **WHEN** they provide an optional nudge (e.g. "more aggressive copy") **THEN** `generation_regenerated` is emitted with `previous_generation_id` and `regenerate_reason`; the multiplier 0.80 (Doc 07c Â§3.2) applies on the second regen and 0.60 on the third.
11. **GIVEN** Brand Guardian detects a deviation from the workspace's color palette / voice / tagline **WHEN** the generation completes **THEN** it produces a diff list and either auto-corrects (low-severity) or routes to review (high-severity).
12. **GIVEN** a generation is in `review_required` **WHEN** a tier-1 reviewer approves with edits (Doc 07b Â§6.3) **THEN** the system re-runs `auto_check_2`; if it passes, the generation publishes; if not, the orchestrator loops once more (max 2 cycles per Doc 07b Â§3).
13. **GIVEN** any agent crashes mid-generation **WHEN** the orchestrator detects the failure **THEN** it retries that agent up to 2 times with exponential backoff, then either falls forward (cheaper agent) or marks the generation `failed` with a clear error event.
14. **GIVEN** the generation completes **WHEN** the user clicks Publish **THEN** the publish flow first verifies the publish acknowledgment (Doc 05e) is accepted, then `funnel_published` is emitted.
15. **GIVEN** the user is on Free tier **WHEN** they attempt to generate a 4th funnel in a billing cycle **THEN** the orchestrator refuses with the upgrade prompt; cost governor never starts charging.

## 3. Edge cases

1. The pinned `business_profile_version` was deleted by DSAR before generation completed â†’ generation aborts with a clean `failed` state; user is told to redo onboarding (this should be vanishingly rare given immutability).
2. Two concurrent generations from the same workspace â†’ both proceed but share the per-account ledger; if ledger exhausts, second one queues.
3. Agent returns malformed JSON â†’ orchestrator's JSON-repair layer attempts a fix once; if still bad, agent is retried; if still bad, fall-forward to a simpler agent variant.
4. LLM provider rate-limit during peak â†’ PAL (Doc 04) routes to secondary provider; if all providers rate-limited, generation queues and shows a "your campaign is queued â€” ~2 minutes" message.
5. Image generation produces a face that resembles a real public person (similarity > threshold) â†’ Image agent retries with a "different face" constraint; max 2 retries; then skips images.
6. Video generation exceeds tier video-second cap (Doc 07c Â§3.1) â†’ orchestrator caps generated length and tells the user.
7. Voice TTS character cap exceeded â†’ voice script is truncated to the cap with a graceful ending; UI tells the user.
8. Brand Guardian disagrees with Image agent on a color â†’ Brand Guardian wins; image is regenerated up to 2 times then dropped.
9. Fact-Check finds an unverifiable claim that the user *wrote* in their offer description â†’ flag as `fact_check_flag_raised`, route to review; never silently remove user-authored content.
10. Compliance agent's `severity=medium` flag (Doc 07b Â§2.3) â†’ route to review; do not auto-reject.
11. KB pack referenced is > 30 days stale (Doc 07b Â§2.3 trigger) â†’ still generate, but force review.
12. User loses internet mid-stream â†’ server-side generation continues; user re-attaches via persisted `generation_id`; UI shows progress from `agent_invoked` events.
13. Streamed UI receives an out-of-order event â†’ client reorders by `event_ts`; if a gap > 5s, re-fetches the timeline via REST.
14. Generation contains a phone number the user provided that's on the global suppression list â†’ fail closed with a specific "your phone is suppressed â€” please update" message; do not proceed.
15. Generation produces text that mentions a competitor by name in a defamatory way â†’ Compliance + Brand Guardian both flag â†’ auto-rewrite once, then route to review if still flagged.
16. A multi-asset generation succeeds for some assets and fails for others â†’ orchestrator chooses to publish partial only if the page + lead capture exist; otherwise marks the whole generation `failed`.
17. User aborts mid-generation â†’ orchestrator stops scheduling new agents; in-flight agents finish (we still pay for them); cost-governor ledger updated; generation marked `aborted`.
18. Cost Governor budget exhausted before *any* output materialized â†’ generation marked `failed_budget_exhausted`; no charge to the user; ops alert if this happens > 1% of generations in a day.
19. Two regenerations in flight simultaneously for the same funnel (e.g. user double-clicks) â†’ idempotency key on the regenerate button; second click joins the first.
20. Agent runs longer than the per-agent soft deadline (P95 from baseline) â†’ orchestrator preemptively cancels and falls forward.

## 4. API dependencies

**Internal**
- `orchestrator` (this PRD): coordinates the 16 agents.
- `quality-svc`: computes rubric per the published version (Doc 03 references `rubric_version`).
- `fact-check-agent`, `compliance-agent`, `brand-guardian-agent`: gating agents.
- `cg-svc` (Doc 07c): per-charge calls.
- `review-svc` (Doc 07b): `enqueue(generation_id, triggers[], priority)`.
- `kb-svc`: pulls KB pack pinned at profile-version time.
- `asset-svc`: persists `assets` + `asset_versions`.
- `publish-svc`: PRD 2 hands off to here on `approved` â†’ user clicks publish.
- `event-bus`.
- `feature-flags`: agent rollout gates (`release.agents.*`, Doc 08 Â§362).

**External (via PAL â€” Doc 04)**
- LLM: Anthropic Claude, OpenAI, Google Gemini.
- Image: Flux, Ideogram, DALLÂ·E.
- Video: Runway, Veo, Sora.
- Voice TTS: ElevenLabs, Cartesia, OpenAI TTS.
- Search / web fetch: Brave, Tavily, Serper (for Fact-Check agent).
- Plagiarism check (Originality.ai or Copyleaks).

All external calls go through PAL: per-provider quota, circuit breaker, signed timestamps, content-safety pre-check.

## 5. Database tables / objects touched

- `generations` (referenced throughout Doc 03; canonical schema in `04-agent-pipeline.md`).
- `generation_state_history` (per Doc 07b Â§3).
- `agent_invocations` (per `agent_invoked` event â€” schema in Doc 03 Â§A.2).
- `assets`, `asset_versions` (Doc 03 Â§B.10).
- `lead_magnets` (Doc 03 Â§B.15).
- `email_sequences`, `sms_sequences` (Doc 03 Â§B.14).
- `funnels`, `funnel_versions` (Doc 03 Â§B.4).
- `workspace_ledger` (Doc 07c Â§4.1).
- `review_audit` (Doc 07b Â§7).
- `audit_log` (Doc 03 Â§B.9).
- `business_profile_versions` (read â€” PRD 1).

## 6. Telemetry events emitted

| Event | Family | When |
|---|---|---|
| `generation_started` | A.2 | Orchestrator begins. `model_lineup` captures the picked agents + models. |
| `agent_invoked` | A.2 | Every agent call. Required for the learning flywheel â€” never skip. |
| `quality_score_computed` | A.2 | After QA agent finishes. |
| `quality_failed` | A.2 | Score < 60 or rubric-blocking dimension. |
| `fact_check_flag_raised` | A.2 | Fact-Check agent finds claim with confidence â‰¥ threshold. |
| `compliance_block_raised` | A.2 | Compliance agent blocks. |
| `human_review_required` | A.2 | Routed to review queue. |
| `human_review_completed` | A.2 | Reviewer acts (Doc 07b Â§6.3). |
| `generation_completed` | A.2 | Terminal state, includes `cost_usd_micros`, `final_quality_score`. |
| `generation_regenerated` | A.2 | New regen scheduled with `previous_generation_id`. |
| `kb_pack_updated` | A.9 | If a KB pack hot-swap happened mid-generation (rare; should ideally be pinned). |

All events carry the `actor` envelope (`user|agent|system|admin|anonymous`) per Doc 03 Â§A.0.

## 7. Permissions enforced

| Capability | Roles |
|---|---|
| Start a generation | `owner`, `admin`, `editor` |
| View a generation's stream + outputs | all six workspace roles |
| Regenerate | `owner`, `admin`, `editor` |
| Approve / publish (Doc 05e ack) | `owner`, `admin` (editor can request publish but not finalize the legal ack) |
| Abort an in-flight generation | `owner`, `admin`, `editor` (originator can also cancel theirs) |
| Force re-run with overrides (admin-only) | `engineering` or `super_admin` admin-console roles, inside impersonation session |

Plan-gated checks (PRD 4) also apply: Free tier capped at 3 funnels total; Starter at 5/mo; Growth+ unlimited (cost governor still enforces per-generation ceilings).

## 8. Error states + recovery paths

| State | Behavior | Recovery |
|---|---|---|
| `failed_agent_max_retries` | Generation marked failed | User can retry; cost-governor refunds tier credit if the cost was wasted on retries (auto-credit, Doc 07c Â§11) |
| `failed_budget_exhausted` | Cannot complete within budget | Offer upgrade; no charge |
| `paused_review_required` | Waiting on human reviewer | UI shows ETA from `review-svc` (Doc 07b Â§5) |
| `aborted_by_user` | User stopped it | Costs already incurred are charged; partial outputs discarded |
| `failed_provider_outage` | All PAL providers down for a class (e.g. image) | Generation either falls forward (skip images) or marks failed with retry guidance |
| `failed_kb_pack_missing` | KB pack unavailable | Page T&S on-call; user told "we're spinning up your industry pack â€” back in a few hours" |
| `failed_compliance_block` | Auto-reject | User sees explanation + appeal path (Doc 07b Â§9) |
| `published_partial` | Some assets shipped, others didn't | UI flags missing assets with a "we couldn't generate this â€” regenerate?" CTA |

## 9. Acceptance criteria

- [ ] Generation P50 â‰¤ 90s, P95 â‰¤ 240s for full multi-asset on Growth tier.
- [ ] Streamed UI shows first agent-status event â‰¤ 800 ms after click.
- [ ] Every `agent_invoked` event includes `input_hash`, `output_hash`, `cost_usd_micros`, `duration_ms`, `model_id`.
- [ ] Cost meter never exceeds `tier_hard_max` (Doc 07c Â§3.2) â€” verified by a budget-fuzzing test that tries to spend over budget and fails closed.
- [ ] Quality gate behaves exactly per Doc 07b Â§2.3 thresholds (60 / 80 / 86); regression suite covers each band.
- [ ] All Doc 07b Â§2 triggers route to review (regulated vertical, content trigger, edge trigger) â€” 30 positive cases per family.
- [ ] Doc 07a Â§R1â€“R7 policy rules each have a Compliance agent regression test (positive + negative).
- [ ] Fact-Check agent precision â‰¥ 0.85 against the held-out regulated-claim corpus.
- [ ] Brand Guardian color/voice diff exact-match on the test palette set.
- [ ] Generations are deterministic with a fixed seed in test mode (model temperature 0, fixed token paths).
- [ ] Audit log entry created for every state transition; `audit_log` rows are append-only (verified via DB role).
- [ ] Reviewer ETA shown in UI matches `review-svc.metrics()` within 5 min staleness.
- [ ] Coverage allow-list (Doc 08 Appendix) for `orchestrator/**` â‰¥ 90%.
- [ ] All flywheel writes to S3/Iceberg succeed before `generation_completed` acks (Doc 03 Â§C.4 step 1).

## 10. Launch blockers

1. All 16 agents in production with versioned model IDs registered in `mlops-svc`.
2. Quality bar 80 gating + auto-regen below + human-review band â€” fully wired to `review-svc`.
3. Cost Governor enforcement â€” soft-degrade + hard-stop tested against tier ceilings.
4. Compliance agent + Fact-Check agent: Doc 07a Â§R1â€“R7 rule coverage at â‰¥ 95% precision on the launch corpus.
5. KB packs for all 30 verticals exist (Doc 02a) and are pinned at profile-version time.
6. Streamed UI works on poor networks (tested on simulated 3G).
7. Publish acknowledgment (Doc 05e) gate enforced before `funnel_published`.
8. Audit log for every state transition + every agent invocation.
9. Kill-switches: `killswitch.generation.global`, `killswitch.generation.<vertical>`, `killswitch.agents.<agent>` (Doc 08 Â§362 naming).
10. Flywheel writes (Doc 03 Â§C.4) â€” `trace.jsonl` written before ack; reconciliation drift check (Doc 03 Â§C.5) clean for 7 days pre-launch.

## 11. Post-launch enhancements

- Personalized agent lineup ("auto-select best lineup for this vertical based on historical performance").
- Multi-language generation (ES, DE, PT-BR â€” by Month 4).
- Long-form video agent (currently capped at 60 sec).
- Inline reviewer-suggestion preview to the *user* before they regenerate.
- Self-serve "agent debugger" for advanced users on Scale/Agency tier.
- A/B test agent (generates 2â€“3 variants and runs head-to-head once published).
- Smarter cache: profile-similar generations share intermediate outputs.

## 12. Test plan

**Unit**
- Each agent's prompt + output schema test in `eval/agents/<agent>/`.
- JSON-repair layer (malformed â†’ repaired).
- Cost-meter math (rate Ã— units â†’ cents) â€” fuzzed.
- Quality rubric scorer determinism.

**Integration**
- Full orchestrator run against a 100-vertical fixture set, asserting state-machine paths.
- PAL provider fallback: kill provider A, expect provider B picks up; assert latency budget held.
- Cost Governor + orchestrator: exhausted budget â†’ degrade or skip per Â§5 recommendation; never overrun.
- Review-svc enqueue: all Doc 07b Â§2 triggers route correctly.

**E2E**
- Onboarding â†’ Generate â†’ Review â†’ Publish wall-clock under 4 minutes for non-regulated vertical; under 6 minutes for regulated (counting reviewer time stubbed to median).
- User cancels mid-generation â†’ audit + ledger correct.
- Concurrent regenerations idempotent.

**Eval (continuous)**
- Daily eval run against the agent regression corpus (Doc 08 Â§A.1 â€” `eval/agents/corpus/`); any regression > 2% on any rubric dimension blocks promotion.
- Bias audit eval (`bias_audit_completed`) quarterly; required before any model version promotion.

**Load**
- 100 concurrent generations sustained 10 min; cost ledger consistent (Doc 03 Â§C.5 recon clean).

---

# PRD 3 â€” Native CRM + Lead Engine

**Workstream owner:** CRM squad (Tech lead + 3 BE + 2 FE + 1 voice infra eng for RevTry integration)
**Source-of-truth services:** `crm-svc`, `lead-svc`, `scoring-agent`, `booking-svc`, `revtry-worker` (consumed).
**Cross-PRD interactions:** receives leads from PRD 2 (capture forms in funnels); calendar bookings flow to PRD 5 (admin view); export hooks tie to PRD 4 (plan-gated exports).

## 1. Module overview

The Native CRM + Lead Engine is the customer-facing system of record for every contact and lead generated by funnels. It provides contacts, opportunities, pipelines (Kanban), lead scoring, activity timeline, tags, custom fields, lists/segments, full-text search, and multi-user role-based access. It exports via CSV, JSON, and outbound webhook (HMAC-signed). The Lead Engine enforces speed-to-lead â€” every captured lead is dispatched to the RevTry voice worker within 60 seconds (P95) of `lead_captured` for outbound dial, with consent checks and country-specific TCPA/quiet-hours gating. It integrates bidirectionally with Google Calendar, Microsoft Graph, and Cal.com â€” bookings sync both ways with conflict resolution and idempotency keys.

## 2. User stories

1. **GIVEN** a published funnel **WHEN** a visitor submits the capture form **THEN** `lead_captured` is emitted, a `leads` row is created, a `crm_contacts` row is upserted (Doc 03 Â§B.5), and the activity timeline gets a `captured` entry within 2 seconds.
2. **GIVEN** a lead is captured **WHEN** consent permits and quiet-hours allow **THEN** `revtry-worker` initiates an outbound call within 60s P95; `lead_revtry_call_started` is emitted (Doc 03 Â§A.5 #6).
3. **GIVEN** a lead is captured outside the lead's local quiet-hours window **WHEN** the call would violate TCPA quiet-hours **THEN** the call is deferred to the next allowed window; lead status stays `new` with a scheduled `next_action_at` and a calendar-visible reminder.
4. **GIVEN** the user has Google Calendar connected **WHEN** a lead books via the funnel's booking widget **THEN** `lead_booking_created` is emitted, a calendar event is created on the user's primary calendar, and the lead's status moves to `booked`.
5. **GIVEN** a booked lead cancels via the calendar (not the CRM) **WHEN** the Google webhook fires **THEN** the CRM marks the booking canceled, `lead_booking_canceled` is emitted, and the lead drops back to `qualified`.
6. **GIVEN** a CRM editor adds a tag **WHEN** the tag is new **THEN** the workspace's tag library is updated, the activity timeline records the change, and lists filtered by that tag refresh in real time.
7. **GIVEN** a user with role `analyst` **WHEN** they attempt to delete a contact **THEN** the action is refused with a 403 and an audit entry is logged with `action=permission_denied`.
8. **GIVEN** a user with role `owner` **WHEN** they export 10,000 contacts to CSV **THEN** the export streams as chunks, finishes in â‰¤ 30 seconds, and is emailed/downloadable; `data_export_requested` + `data_export_delivered` (Doc 03 Â§A.9) are emitted.
9. **GIVEN** the workspace has a webhook subscribed to `lead_captured` **WHEN** a lead is captured **THEN** the webhook is delivered within 5 seconds P95, signed with HMAC-SHA256, with idempotency keys; failure follows the retry-backoff-DLQ pattern in PRD 4 Â§webhook handling (shared infra).
10. **GIVEN** scoring-agent assigns a lead a score **WHEN** the score crosses the `hot` threshold **THEN** `lead_scored` is emitted with `band=hot` and the lead jumps to the top of the Kanban "Hot Today" column.
11. **GIVEN** a lead replies with an SMS opt-out keyword (STOP, UNSUBSCRIBE, etc., per Doc 07a) **WHEN** the SMS webhook arrives **THEN** `lead_sms_opted_out` is emitted, the lead is added to the global suppression list (Doc 03 Â§B.16), and *all* future SMS/voice to that contact is blocked across all workspaces (TCPA boundary).
12. **GIVEN** a user has Cal.com connected and another team member has Google Calendar connected **WHEN** a lead books with the team-roundrobin **THEN** the booking lands on the correct member's calendar and is visible from the CRM's unified booking view.
13. **GIVEN** a user searches "john smith san diego" **WHEN** the search executes **THEN** the full-text + fuzzy match returns matching contacts ranked by recency + match quality, in â‰¤ 250 ms P95.
14. **GIVEN** a user creates a custom field of type `dropdown` **WHEN** they save **THEN** the field is added to the schema, existing contacts get `null`, and the field appears in lists, filters, and exports.
15. **GIVEN** a contact has been deleted via DSAR (Doc 03 Â§C.3 cascade) **WHEN** a downstream service queries by hash **THEN** the suppression list still returns "suppressed=true"; PII is gone but the cryptographic suppression evidence persists.

## 3. Edge cases

1. Same lead captured twice in 60s from same IP+email â†’ dedupe within the workspace; second event still recorded but linked to first lead.
2. Lead captures with a malformed email (e.g. "john@foo") â†’ field stored as raw, normalized field empty, lead status `new` but excluded from email sequences.
3. Phone number not in E.164 format â†’ normalize using Google libphonenumber; if invalid for declared country, lead still saved but no voice/SMS attempt.
4. Calendar provider OAuth token expired â†’ silent refresh; if refresh fails, surface a banner asking the user to reconnect; queued bookings wait up to 24h then fall back to "send me a manual email" mode.
5. Two CRM users simultaneously edit the same contact â†’ optimistic locking on `updated_at`; second write conflicts with a clear "this was changed by X â€” review changes" UI.
6. Lead's geolocation suggests a country we do not support voice in â†’ skip the RevTry call, schedule an SMS instead (if SMS allowed), or send email only.
7. Lead is in a TCPA-restricted state (per `06-country-launch-checklists.md` or US state rules) â†’ enforce stricter quiet-hours and disallow texting outside opt-in flow.
8. Lead is captured from an embedded form on a 3rd-party site (not on a funelai.com domain) â†’ still ingested if API key valid; consent must be explicit; reject if consent string missing.
9. Booking widget shows a slot, two leads book the same slot simultaneously â†’ server-side hold-and-confirm; second booker sees a "just taken â€” pick another" inline.
10. Calendar timezone mismatch (user in PT, lead in IST) â†’ store UTC, display per-user timezone, send confirmations in the lead's stated timezone.
11. Webhook URL returns 410 Gone â†’ mark webhook as `auto_disabled` after 24h of consecutive failures; notify the workspace owner.
12. Export size > 250k rows â†’ server streams as paginated NDJSON instead of CSV; user gets a "large export ready" email with download link.
13. List filter combines 12 criteria â†’ query planner uses partial indexes; if the query is estimated > 2s, we ask user to add a constraint.
14. Custom field name collides with a reserved name (`email`, `phone`, `tags`, `score`, `consent`, `tombstone`) â†’ reject with helpful inline error.
15. Lead is captured but the scoring-agent service is down â†’ lead stored with `score=null`, queued for backfill; never block lead capture on scoring.
16. RevTry call connects but TTS provider is degraded â†’ fall back to a recorded human voicemail template; never auto-rotate to a synthetic voice the user didn't approve.
17. Bidirectional sync conflict: same booking updated in both Google Calendar and CRM within 1 second â†’ last-writer-wins by external timestamp; CRM logs both versions in activity timeline.
18. A user changes role from `editor` to `viewer` mid-session â†’ existing tabs preserve their session but every API call re-checks role; on first 403, UI prompts a refresh.
19. A lead's phone number gets recycled to a different person (T-Mobile-style number reuse) â†’ workspace receives one "suspicious recycled number" alert when our verification heuristic fires; manual confirmation gate.
20. CSV export started, workspace deletes the requesting user mid-export â†’ export continues to completion (user_id captured at start); download link sent to the workspace `owner` instead.

## 4. API dependencies

**Internal**
- `lead-svc`: lead lifecycle.
- `crm-svc`: contacts, custom fields, lists, tags.
- `scoring-agent`: lead scoring.
- `revtry-worker`: voice dial.
- `booking-svc`: calendar sync.
- `webhook-svc` (shared with PRD 4): outbound webhook delivery.
- `consent-svc`: capture + revoke.
- `suppression-svc`: global suppression list (Doc 03 Â§B.16).
- `event-bus`.

**External**
- Google Calendar API + Google Workspace.
- Microsoft Graph (Outlook).
- Cal.com API.
- Twilio (SMS + voice).
- Deepgram (RevTry ASR).
- ElevenLabs / Cartesia (RevTry TTS).
- SendGrid (email confirmations).

## 5. Database tables / objects touched

- `crm_contacts` (Doc 03 Â§B.5).
- `leads` (Doc 03 Â§B.5).
- `bookings` (Doc 03 Â§B.6).
- `revtry_calls` (Doc 03 Â§B.12).
- `suppression_list` (Doc 03 Â§B.16).
- `webhooks`, `webhook_deliveries` (Doc 03 Â§B.8 + PRD 4 schema).
- `audit_log`.
- `consent_records`.

**New helper schemas** (must land in Doc 03 Â§B before merge):

```sql
CREATE TABLE custom_field_definitions (
  id            TEXT PRIMARY KEY,
  workspace_id  TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  entity_type   TEXT NOT NULL CHECK (entity_type IN ('contact','lead','opportunity')),
  field_name    TEXT NOT NULL,
  field_type    TEXT NOT NULL CHECK (field_type IN ('text','number','date','dropdown','multi_select','boolean')),
  options       JSONB NOT NULL DEFAULT '[]',
  required      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX cfd_workspace_entity_name ON custom_field_definitions (workspace_id, entity_type, field_name);

CREATE TABLE saved_lists (
  id            TEXT PRIMARY KEY,
  workspace_id  TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  entity_type   TEXT NOT NULL,
  filter        JSONB NOT NULL,
  created_by    TEXT REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## 6. Telemetry events emitted

| Event | Family |
|---|---|
| `lead_captured` | A.5 |
| `lead_scored` | A.5 |
| `lead_sms_sent`, `lead_sms_delivered`, `lead_sms_opted_out` | A.5 |
| `lead_revtry_call_started`, `lead_revtry_call_completed`, `lead_voicemail_left` | A.5 |
| `lead_qualified`, `lead_disqualified` | A.5 |
| `lead_booking_created`, `lead_booking_canceled` | A.5 |
| `consent_captured`, `consent_withdrawn` | A.9 |
| `data_export_requested`, `data_export_delivered` | A.9 |

## 7. Permissions enforced

Per workspace role enum:

| Capability | owner | admin | editor | analyst | viewer | billing |
|---|---|---|---|---|---|---|
| View contacts | âœ… | âœ… | âœ… | âœ… | âœ… | âŒ |
| Create contact | âœ… | âœ… | âœ… | âŒ | âŒ | âŒ |
| Edit contact | âœ… | âœ… | âœ… | âŒ | âŒ | âŒ |
| Delete contact | âœ… | âœ… | âŒ | âŒ | âŒ | âŒ |
| Export contacts (CSV/JSON) | âœ… | âœ… | âœ… | âœ… | âŒ | âŒ |
| Configure custom fields | âœ… | âœ… | âŒ | âŒ | âŒ | âŒ |
| Manage outbound webhooks | âœ… | âœ… | âŒ | âŒ | âŒ | âŒ |
| Connect / disconnect calendar | âœ… | âœ… | âœ… (own only) | âŒ | âŒ | âŒ |
| Manage tags + lists | âœ… | âœ… | âœ… | âŒ | âŒ | âŒ |
| View activity timeline | âœ… | âœ… | âœ… | âœ… | âœ… | âŒ |
| Trigger manual RevTry call | âœ… | âœ… | âœ… | âŒ | âŒ | âŒ |

Admin-console (PRD 5) `support` and above can view; `super_admin` can edit only inside impersonation session.

## 8. Error states + recovery paths

| State | Behavior | Recovery |
|---|---|---|
| Lead capture during DB failover | Capture endpoint queues to durable buffer (Cloudflare Workers KV / Queue); replays on recovery | Auto |
| Calendar OAuth expired | Booking succeeds in CRM, calendar event queued; banner asks user to reconnect | User-initiated reconnect; 24h grace |
| Webhook 5xx for 24h | Auto-disable webhook; email owner | Owner re-enables after fix |
| Voice provider degraded | Fall back to secondary TTS / ASR per PAL | Auto |
| Scoring service down | Lead saved with null score; backfill on recovery | Auto |
| Export download link expired (24h) | "Regenerate link" button | User-initiated |
| Suppression-list write failure | Hard-fail the opt-out event; alert on-call (legal exposure if we lose an opt-out) | Manual escalation |

## 9. Acceptance criteria

- [ ] Lead capture latency P95 < 250 ms; P50 < 80 ms.
- [ ] Speed-to-lead: `lead_captured` â†’ `lead_revtry_call_started` P95 < 60s on all eligible captures.
- [ ] TCPA quiet-hours enforcement per US state + per international jurisdiction (matrix in `06-country-launch-checklists.md`).
- [ ] Global suppression list checked on every outbound SMS, voice, email â€” verified by an integration test that attempts contact and expects refusal.
- [ ] Calendar bidirectional sync: changes in CRM appear in Google/MS within 30 seconds; vice versa via webhooks.
- [ ] Booking double-book prevention: 1000-rps concurrency test produces zero double-bookings.
- [ ] Search latency P95 < 250 ms across a 1M-row contact corpus.
- [ ] Export 10k rows < 30s; 250k rows streams to NDJSON < 5 min.
- [ ] All Doc 03 Â§A.5 events emitted with correct envelope.
- [ ] RLS on every CRM table verified.
- [ ] Webhook delivery: HMAC-SHA256, idempotency key, retry with exponential backoff, DLQ after N attempts (shared infra spec with PRD 4 Â§webhook).
- [ ] Coverage â‰¥ 85% on `crm-svc` + `lead-svc`.

## 10. Launch blockers

1. Lead capture â†’ CRM upsert â†’ RevTry dial within 60s P95.
2. Global suppression list enforcement across all outbound channels.
3. TCPA quiet-hours + opt-out keyword handling.
4. Calendar bidirectional sync with Google Calendar (Cal.com + MS Graph can be Day-90 best-effort; Doc 06 lists tier-1 launch markets where Google dominates).
5. CSV + JSON export.
6. Outbound webhooks with HMAC + retry + DLQ.
7. All A.5 events emitted to Kafka with reconciliation against Postgres (Doc 03 Â§C.5).
8. RLS verified on every CRM table.

## 11. Post-launch enhancements

- Email sync (full IMAP/Gmail two-way) â€” out of scope for Day-90.
- Native call recording playback in the CRM timeline (currently only RevTry recordings).
- Built-in email campaign builder (for one-off broadcasts; not just nurture sequences).
- Mobile native app for sales reps.
- Sales pipeline forecasting + revenue analytics dashboard.
- Bulk-edit operations across thousands of contacts (CSV import / upsert).
- Round-robin / territory-based lead routing rules UI.

## 12. Test plan

**Unit**
- Phone normalization (libphonenumber wrapper).
- Custom field schema validators.
- Lead-scoring features-hash determinism.

**Integration**
- Lead capture â†’ enrichment â†’ scoring â†’ RevTry dial pipeline.
- Calendar bidirectional with each provider (Google, MS, Cal.com) under provider contract tests (Doc 08 Â§1 integration suite).
- Webhook delivery: 200, 4xx (no retry), 5xx (retry with backoff), timeout (retry), 410 (auto-disable).
- Suppression list: contact â†’ blocked across all channels and all workspaces.

**E2E**
- Funnel publish â†’ visitor capture â†’ CRM appearance â†’ RevTry call â†’ booking â†’ calendar event â†’ activity timeline complete.

**Load**
- 2k captures/sec sustained 5 min; speed-to-lead SLA held.
- 500 concurrent calendar syncs with no double-book.

---

# PRD 4 â€” Billing Module

**Workstream owner:** Billing squad (Tech lead + 2 BE + 1 FE + 1 finance/accounting eng partner)
**Source-of-truth services:** `billing-svc`, `webhook-svc` (shared with PRD 3), `dunning-svc`, `recon-svc`.
**Cross-PRD interactions:** consumes plan state from PRD 5 (admin can credit, refund, suspend); plan changes propagate to PRD 2 (cost ceilings â€” Doc 07c Â§3) and PRD 3 (export gating, seat limits).

## 1. Module overview

The Billing Module owns the entire subscription lifecycle for FunelAI. PayPal Subscriptions API is the primary processor; Stripe Billing is the secondary (planned month 3+, but both adapters are present from Day 1 behind the PAL â€” Doc 04). Plans: Free (forever-free with limits), 7-Day Pro Boost (one-time $7 / 7-day Growth-tier access), Starter, Growth, Scale, Agency. A trial state machine governs `trialing â†’ active â†’ past_due â†’ paused â†’ canceled â†’ suspended` transitions. Upgrade/downgrade with proration is supported; Pause/Resume is available on Growth and above with a hard cap of 90 days total per 12-month window. Cancel includes a structured exit survey. Dunning is a deterministic state machine running from D0 to D90 (per Doc 02-spec hooks in Â§6 below). All webhooks (PayPal + Stripe) are HMAC-verified, idempotent, retried with exponential backoff, and land in a DLQ on terminal failure. A reconciliation job runs hourly to verify Postgres state vs processor state. Card-expiring reminders fire 14, 7, and 1 day pre-expiry. A "Free until you make $1K" Starter opt-in tracks customer revenue via the funnel's checkout integration and converts to paid once $1K threshold is crossed.

## 2. User stories

1. **GIVEN** a new user signs up **WHEN** they pick "Free" **THEN** `subscriptions` row created with status `trialing`, `plan='free'`, no payment method required; `trial_started` is emitted with `acquisition_source`.
2. **GIVEN** a Free user **WHEN** they click "Try Pro for $7" **THEN** PayPal Smart Button opens, payment captures, plan upgrades to `growth_boost_7d`, `trial_ends_at` = +7d, `plan_upgraded` emitted.
3. **GIVEN** a user is on 7-Day Pro Boost **WHEN** the 7 days end without explicit upgrade **THEN** plan reverts to Free; `trial_ended` emitted with `outcome=expired`.
4. **GIVEN** a Starter user **WHEN** they upgrade to Growth mid-cycle **THEN** proration credit is computed, an invoice line item is added with negative + positive amounts, `plan_upgraded` emitted with `proration_amount_micros`.
5. **GIVEN** a Growth user **WHEN** they downgrade to Starter **THEN** downgrade is scheduled at `current_period_end` (no immediate change); `plan_downgraded` emitted at that boundary.
6. **GIVEN** a Growth+ user **WHEN** they click Pause (â‰¤ 90 days remaining) **THEN** subscription enters `paused` status with `resume_at` set; `plan_paused` emitted; access drops to read-only until `resume_at` or manual resume.
7. **GIVEN** a paused user **WHEN** they click Resume **THEN** `plan_resumed` emitted, status returns to `active`, next billing date adjusted forward by the pause duration.
8. **GIVEN** a user clicks Cancel **WHEN** they pick a reason from the exit survey **THEN** `subscription_canceled` emitted with `reason_code` + `feedback_hash`; service continues to `current_period_end`, then status flips to `canceled`.
9. **GIVEN** a payment fails on renewal **WHEN** the dunning state machine enters **THEN** at D0 we retry, at D1/D3/D7 we retry + send escalating emails, at D14 we pause access (status `past_due`), at D30 we suspend (`account_suspended`), at D90 we close (`account_closed`). Each transition emits the corresponding event.
10. **GIVEN** a PayPal webhook arrives **WHEN** the HMAC verifies and the `event_id` has not been processed **THEN** the side effect is applied exactly once; a repeat delivery is a no-op.
11. **GIVEN** a PayPal webhook arrives with a bad signature **WHEN** verification fails **THEN** the request is logged, dropped with 400, and a security alert fires if > 5/min from any source.
12. **GIVEN** a card on file is expiring in 14 days **WHEN** the daily expiry-reminder job runs **THEN** the user is emailed; same at 7 days and 1 day.
13. **GIVEN** a Starter user opts into "Free until you make $1K" **WHEN** their funnel checkout cumulatively crosses $1,000 in tracked revenue **THEN** Starter subscription transitions to billed status; `plan_upgraded` (effectively `free_until_thresholdâ†’starter`) emitted.
14. **GIVEN** an admin issues a refund via PRD 5 **WHEN** the refund completes at the processor **THEN** `admin_refund_issued` and `refund_processed` emitted; an `audit_log` entry is written with the `justification_ticket_id`.
15. **GIVEN** the hourly reconciliation job runs **WHEN** processor state diverges from Postgres state **THEN** a `recon_drift_detected` event fires (Doc 03 Â§A.9 governance), affected workspaces enter a "billing-frozen" state until manual triage, and on-call is paged (Doc 08 Â§306).

## 3. Edge cases

1. PayPal returns success but our DB write fails â€” payment is real, plan is not yet upgraded â†’ reconciliation job reconciles within the hour; user not blocked from access (we trust the processor).
2. Same webhook delivered 5 times in 60 seconds â€” idempotency table absorbs; only the first processes.
3. Webhook arrives out-of-order (e.g. `payment_succeeded` arrives before `invoice_finalized`) â†’ re-order at the handler via dependency-aware queueing; never apply state regressions.
4. Stripe Billing soft-launches mid-cycle for a customer (we migrate them) â€” both processors hold a record; we mark Stripe as primary, PayPal as `migrated_out`, and re-attach the same subscription state.
5. User on Pause Resume tries to start a generation â†’ blocked at the cost-governor pre-charge check (Doc 07c).
6. User cancels then re-subscribes within 7 days â†’ treat as resume, not new â€” preserves trial-eligibility flag (no second trial).
7. Refund issued for an invoice that funded a generation that has already been delivered â†’ refund is allowed, but generation outputs remain visible (we don't claw back content).
8. Plan downgrade scheduled, then user upgrades again before period end â†’ cancel the scheduled downgrade, log both transitions.
9. Currency mismatch between processor and our `currency` column (PayPal returns EUR for a USD subscription) â†’ reject with audit log; manual triage; never silently FX.
10. User in a country we don't accept payments in â†’ block at checkout with `country_unsupported`.
11. Chargeback received â†’ mark invoice `disputed`; freeze the workspace (`account_suspended` with reason `chargeback`); pull from the dunning state machine.
12. Pause exceeds 90 days total across multiple pause/resume cycles â†’ block resume; force upgrade or cancel.
13. Card expires mid-cycle â†’ grace through current cycle; renewal failure pushes into dunning.
14. PayPal subscription gets canceled outside our app (user from PayPal dashboard) â†’ webhook fires, we honor it; mark `cancel_at_period_end=true`; if they paid for the current cycle, service continues until period end.
15. "Free until $1K" â€” funnel checkout integration reports a $200 chargeback after the user crossed $1K â†’ revenue is decremented; if it falls below threshold, user is *not* downgraded back (one-way ratchet to protect trust).
16. Test-mode payment lands in production by mistake â†’ recon job catches; alert on-call; do not extend access.
17. Two simultaneous upgrade clicks â†’ idempotency key on the upgrade endpoint; second click joins the first.
18. Refund larger than original payment â†’ reject with 400; auditor on-call alert (Doc 08 Â§306 â€” financial discrepancy).
19. Webhook DLQ accumulates > 100 messages â†’ on-call paged; dunning state machine paused for affected workspaces.
20. User attempts to cancel during an active human review (Doc 07b) â†’ cancel is allowed, but `review_required` items continue through review (cost meter is paused per Doc 07b Â§3 â€” no additional cost).
21. Region change (US â†’ EU) on subscription â€” must rebill in new currency, may require data residency migration; require ops approval.
22. PayPal API rate-limits us â†’ bursty queue with circuit breaker; user-facing actions show "try again in a moment".

## 4. API dependencies

**Internal**
- `billing-svc`: subscriptions, invoices, payments, refunds.
- `webhook-svc`: webhook ingress + signature verify + idempotency + DLQ.
- `dunning-svc`: D0 â†’ D90 state machine.
- `recon-svc`: hourly reconciliation.
- `notification-svc`: dunning emails, card-expiry emails.
- `feature-flags`: `release.billing.stripe`, `killswitch.billing.paypal`.
- `event-bus`.

**External**
- PayPal Subscriptions API + Webhooks (HMAC-SHA256).
- Stripe Billing API + Webhooks (Stripe-Signature header).
- Plaid (only if we add ACH later; out of scope for Day 90).
- Currency rates feed (for display only â€” settlement is processor-native).
- Funnel checkout integration (built atop PRD 2 publish â€” read-only here, source of "Free until $1K" revenue signal).

## 5. Database tables / objects touched

- `subscriptions`, `invoices`, `payments`, `refunds` (Doc 03 Â§B.7).
- `webhooks` + new `webhook_deliveries` table.
- `dunning_state` (new â€” see DDL below).
- `card_expiry_schedule` (new).
- `revenue_ledger_free_until_1k` (new).
- `idempotency_keys` (new).
- `audit_log`.

**New DDL (must land in Doc 03 Â§B):**

```sql
CREATE TABLE webhook_deliveries (
  id                  TEXT PRIMARY KEY,
  workspace_id        TEXT,                          -- nullable for inbound processor webhooks (no workspace yet)
  direction           TEXT NOT NULL CHECK (direction IN ('inbound','outbound')),
  source              TEXT NOT NULL,                 -- 'paypal','stripe','customer:<webhook_id>'
  event_id_external   TEXT,                          -- processor event id (idempotency)
  payload_hash        TEXT NOT NULL,
  signature_valid     BOOLEAN NOT NULL,
  attempt_n           INTEGER NOT NULL DEFAULT 1,
  status              TEXT NOT NULL,                 -- 'received','retrying','succeeded','failed','dlq'
  last_error          TEXT,
  received_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at        TIMESTAMPTZ
);
CREATE UNIQUE INDEX wd_source_event_unique
  ON webhook_deliveries (source, event_id_external)
  WHERE event_id_external IS NOT NULL;

CREATE TABLE dunning_state (
  subscription_id     TEXT PRIMARY KEY REFERENCES subscriptions(id) ON DELETE CASCADE,
  step                TEXT NOT NULL,                 -- 'd0','d1','d3','d7','d14','d30','d60','d90','recovered','closed'
  entered_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  next_action_at      TIMESTAMPTZ,
  attempts            INTEGER NOT NULL DEFAULT 0,
  paused              BOOLEAN NOT NULL DEFAULT FALSE,
  paused_reason       TEXT
);

CREATE TABLE idempotency_keys (
  key             TEXT PRIMARY KEY,
  scope           TEXT NOT NULL,                     -- 'billing.upgrade','billing.refund', etc.
  workspace_id    TEXT,
  response_hash   TEXT,
  expires_at      TIMESTAMPTZ NOT NULL
);

CREATE TABLE revenue_ledger_free_until_1k (
  workspace_id    TEXT PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  cumulative_micros BIGINT NOT NULL DEFAULT 0,
  threshold_crossed_at TIMESTAMPTZ,
  source_funnels  TEXT[] NOT NULL DEFAULT '{}'
);
```

## 6. Telemetry events emitted

| Event | Family |
|---|---|
| `trial_started`, `trial_ended` | A.7 |
| `plan_upgraded`, `plan_downgraded`, `plan_paused`, `plan_resumed` | A.7 |
| `subscription_canceled` | A.7 |
| `payment_succeeded`, `payment_failed` | A.7 |
| `refund_processed` (Doc 03 Â§A.7 #10 â€” verify exists; if not, add) | A.7 |
| `account_suspended`, `account_restored`, `account_closed` | A.7 |
| `admin_credit_applied`, `admin_refund_issued` | A.8 (admin-issued) |
| `recon_drift_detected` | A.9 |

Dunning step transitions emit `dunning_step_entered` (new event â€” add to Doc 03 Â§A.7) with `step`, `previous_step`, `subscription_id`, `paused`.

## 7. Permissions enforced

| Capability | owner | admin | editor | analyst | viewer | billing |
|---|---|---|---|---|---|---|
| View invoices + receipts | âœ… | âœ… | âŒ | âŒ | âŒ | âœ… |
| Change plan (upgrade/downgrade) | âœ… | âŒ | âŒ | âŒ | âŒ | âœ… |
| Update payment method | âœ… | âŒ | âŒ | âŒ | âŒ | âœ… |
| Cancel subscription | âœ… | âŒ | âŒ | âŒ | âŒ | âœ… |
| Pause / resume | âœ… | âŒ | âŒ | âŒ | âŒ | âœ… |
| Request refund (UI ticket) | âœ… | âŒ | âŒ | âŒ | âŒ | âœ… |
| View dunning state | âœ… | âœ… | âŒ | âŒ | âŒ | âœ… |

Admin-console:
- `billing_admin` and `super_admin`: full billing controls including credits + refunds.
- `support`: view only.
- `engineering`: view + replay webhooks + retry DLQ items.
- `read_only`: view only.

Refunds + credits always require a `justification_ticket_id` (linked to a Linear or Zendesk ticket) and audit-logged.

## 8. Error states + recovery paths

| State | Behavior | Recovery |
|---|---|---|
| PayPal API outage | Upgrades/downgrades queue with idempotency; UI shows "we'll process this shortly" | Auto-replay on recovery; SLA banner |
| Webhook signature invalid | 400, security alert | Manual triage |
| Webhook arrives for unknown workspace | Log + DLQ; recon picks it up | Manual triage |
| Dunning step misses | `dunning-svc` self-heals via the `next_action_at` index; misses also alert on-call | Auto + manual |
| Reconciliation drift | Affected workspaces enter "billing-frozen"; user sees a "we're verifying your billing â€” your service is unaffected" banner | Manual ops |
| Refund partial failure (PayPal accepts, we fail to record) | Recon catches within hour; UI shows refund as `pending` until reconciled | Auto |
| Free-until-$1K signal source missing | Stop crediting revenue, alert on-call; do not retroactively downgrade | Manual |
| Idempotency key collision (different payload, same key) | 409 with a clear error; never silently merge | Manual |
| DLQ overflow | On-call paged; dunning paused for affected workspaces | Manual |

## 9. Acceptance criteria

- [ ] All seven state-machine transitions covered by integration tests with both processors.
- [ ] Webhook handler: HMAC verify, idempotency, retry-with-backoff (1s, 5s, 30s, 5m, 30m, 2h, 6h, 24h), DLQ on terminal failure.
- [ ] Idempotency key on every mutating endpoint; second identical call returns the cached response within 24h.
- [ ] Reconciliation job: hourly, < 5 min wall clock for our scale; drift alerts on any non-zero divergence.
- [ ] Proration math: cents-precise, no rounding drift (use `Money` bigint per Doc 08 Â§65).
- [ ] Pause cap of 90 days/12-month enforced server-side.
- [ ] Dunning state machine covers D0/D1/D3/D7/D14/D30/D60/D90 transitions and re-entry on payment success.
- [ ] Refund issuance requires `justification_ticket_id`; audit row written.
- [ ] Free-until-$1K threshold accuracy: revenue ledger matches funnel-checkout summed values to the cent.
- [ ] All events listed in Â§6 emitted with correct envelope.
- [ ] Card-expiry reminders fire at 14/7/1 days exactly once each.
- [ ] Stripe Billing adapter behind feature flag `release.billing.stripe`; passes the same test suite as PayPal in CI.
- [ ] No PII written to webhook delivery payload_hash; PAN never stored (Doc 03 Â§C.2 P3).

## 10. Launch blockers

1. PayPal Subscriptions API end-to-end: trial â†’ paid â†’ upgrade â†’ downgrade â†’ cancel â†’ resume.
2. Webhook handler with HMAC + idempotency + retry + DLQ.
3. Reconciliation job + on-call paging on drift.
4. Dunning state machine fully wired through email notifications (D0-D90).
5. Refund + credit endpoints (admin-only) with audit logging.
6. Card-expiry reminders.
7. "Free until you make $1K" opt-in + revenue ledger integration with funnel checkout.
8. Plan-state propagation to PRD 2 (Cost Governor reads from plan) verified by integration test.
9. PRD 5 admin console can: apply credit, issue refund, retry webhook, view DLQ.
10. `recon_drift_detected` alert + freeze flow tested in staging chaos drill (Doc 08 Â§306).

## 11. Post-launch enhancements

- Stripe Billing live (month 3+).
- ACH via Plaid for Agency tier.
- Multi-currency display + auto-FX on dashboards (settlement remains processor-native).
- Tax compliance (US sales tax via TaxJar, VAT for EU launch).
- Yearly pricing + annual discount automation.
- Self-serve dunning-status page for end-customers ("why is my account paused?").
- Coupon / promo code engine.
- Affiliate / partner revenue share ledger.

## 12. Test plan

**Unit**
- Proration math (cents-precise, every combo of tier-to-tier mid-cycle).
- Pause-cap calendar arithmetic (DST edges, leap days).
- HMAC verification for both PayPal and Stripe payloads (positive + tampered).

**Integration**
- Full lifecycle on each processor: trial â†’ upgrade â†’ downgrade â†’ pause â†’ resume â†’ cancel â†’ restore.
- Dunning state machine driven by simulated time (clock-injection); assert every D-step transition and email.
- Webhook contract tests using `packages/webhooks/__fixtures__/{paypal,stripe}/` (Doc 08 Â§74 integration matrix).
- Refund flow including failure mid-process (PayPal succeeded, our DB failed).
- Free-until-$1K: revenue events from funnel checkout â†’ ledger â†’ cross-threshold conversion.

**E2E**
- New user signup â†’ Free â†’ Pro Boost â†’ expire â†’ Starter â†’ upgrade Growth â†’ pause â†’ resume â†’ cancel â€” wall clock < 4 min on staging with mocked processors.

**Chaos / DR**
- Processor outage drill (Doc 08 Â§306): pause dunning, queue webhooks, verify recovery in < 1h.
- Drift drill: introduce a Postgres-only state mutation; recon must catch + freeze + alert within the hour.

**Load**
- 200 webhook deliveries/sec sustained 10 min; 100% processed exactly once.

---

# PRD 5 â€” Admin Console (admin.funelai.com)

**Workstream owner:** Internal Tools squad (Tech lead + 2 BE + 2 FE + 1 security eng)
**Source-of-truth services:** `admin-svc`, `impersonation-svc`, `audit-query-svc`.
**Cross-PRD interactions:** read access to PRD 1â€“4 data; write access via narrowly-scoped, audited admin actions; impersonation requires mandatory reason + user-visible banner.

## 1. Module overview

`admin.funelai.com` is the staff-only console for FunelAI employees. It is the operational pane-of-glass for customer support, billing operations, engineering on-call, and trust & safety. All access requires SSO via Google Workspace + WebAuthn (MFA mandatory, no password fallback). The console exposes five admin roles â€” `read_only`, `support`, `billing_admin`, `engineering`, `super_admin` â€” each scoped to a specific capability set (Â§7). Read capabilities span every customer surface: plan, trial state, all funnels, all leads, integrations, failed payments, email delivery log, webhook delivery log, audit log, error log, usage vs limits. Write capabilities are explicit and individually permissioned: resend verification, trigger password reset, apply credit, issue refund, suspend/unsuspend, restore deleted funnel, force regenerate, retry webhook, retry job, add internal note, impersonate. Every write action requires a `justification_ticket_id`, emits an admin event (Doc 03 Â§A.8), and writes an `audit_log` row. Impersonation requires a mandatory free-text reason, displays a permanent banner to the impersonated user ("A FunelAI support team member is currently viewing your account"), and emits `impersonation_started` / `impersonation_ended` with 10-year retention.

## 2. User stories

1. **GIVEN** an internal employee navigates to admin.funelai.com **WHEN** they SSO and pass WebAuthn **THEN** they land on the dashboard; the session record includes `admin_session_id` and is bound to the device.
2. **GIVEN** a `support` admin **WHEN** they search "alice@example.com" **THEN** results show matching `users`, `workspaces`, `crm_contacts`, and `leads` (only `users` and `workspaces` for support; PII on contacts/leads requires `super_admin`).
3. **GIVEN** a `billing_admin` **WHEN** they apply a $25 credit to a workspace **THEN** they MUST provide a `justification_ticket_id`; `admin_credit_applied` is emitted, audit row written, customer notified.
4. **GIVEN** an `engineering` admin sees a webhook in DLQ **WHEN** they click "Retry" **THEN** the webhook is re-delivered with a new attempt id; outcome appears in the delivery log.
5. **GIVEN** a `super_admin` decides to impersonate a workspace owner **WHEN** they click Impersonate **THEN** a modal demands a reason (min 20 chars) + a `justification_ticket_id`; on confirm, the impersonator's session-cookie carries an `impersonator_user_id` claim, the impersonated user sees a banner "A FunelAI support team member is viewing your account", and `impersonation_started` is emitted with `expires_at` (max 60 min, refreshable with a new reason).
6. **GIVEN** an impersonation session is active **WHEN** the impersonator clicks any mutating action **THEN** the action's event carries `actor.impersonator_user_id` (Doc 03 Â§A.0 + Â§A.8 footnote).
7. **GIVEN** a `support` admin **WHEN** they click "Resend verification" on a user **THEN** the verification email is queued; `user_verification_resent` (new event â€” add to Doc 03 Â§A.1 if missing) is emitted.
8. **GIVEN** a `support` admin **WHEN** they click "Trigger password reset" **THEN** a one-time reset email is sent; `user_password_reset_requested` is emitted with `actor.type=admin`.
9. **GIVEN** any admin role with view access **WHEN** they view a workspace **THEN** they see plan, trial state, all funnels (count + status), lead counts, integration list, failed payments, email delivery stats, webhook delivery stats, audit log, error log, usage vs limits â€” but NO raw PII fields without the `super_admin` PII scope.
10. **GIVEN** a `super_admin` views a customer's leads **WHEN** they click into a single lead **THEN** PII fields decrypt and render with a "PII access logged" overlay; the access itself emits `pii_access_recorded` (add to Doc 03 Â§A.9 if missing).
11. **GIVEN** a `billing_admin` issues a refund **WHEN** they specify amount + reason + ticket id **THEN** PRD 4's refund path executes; `admin_refund_issued` emitted; customer email sent with refund confirmation.
12. **GIVEN** a `super_admin` restores a deleted funnel **WHEN** they confirm **THEN** funnel rows are un-soft-deleted, assets re-linked, audit + admin event emitted, owner notified.
13. **GIVEN** a `support` admin attempts to view another `support` admin's audit log **WHEN** they don't have audit-query scope **THEN** they see only their own actions; cross-admin audit requires `super_admin`.
14. **GIVEN** a `super_admin` adds an internal note on a workspace **WHEN** they save **THEN** `internal_note_added` is emitted, note stored with author + timestamp + workspace pointer; customer never sees the note.
15. **GIVEN** an impersonation session **WHEN** the impersonator closes the tab or 60 min elapse **THEN** `impersonation_ended` emitted with `actions_summary[]` containing the events emitted during the session.

## 3. Edge cases

1. SSO returns valid identity but employee has been off-boarded â†’ access denied; security alert.
2. WebAuthn challenge fails 3 times â†’ 15-minute lockout; security alert.
3. Admin attempts an action outside their role â†’ 403; emit `admin_permission_denied` (add to Doc 03 Â§A.8 if missing); record in audit.
4. Two admins issue simultaneous refunds on the same payment â†’ optimistic locking on `payments.amount_refunded_micros`; second 409s with a clear message.
5. Impersonation session is force-terminated by an `engineering` admin (kill switch) â†’ impersonator's tab redirects to admin home with a banner; `impersonation_ended` with `ended_reason=force_terminated`.
6. Customer is in EU data residency â†’ admin's view is region-scoped; cross-region access requires explicit `super_admin` + a second `super_admin` approval (Doc 03 Â§C.2 P2 access discipline).
7. Customer has been DSAR-deleted â†’ admin search returns "user has been deleted" with tombstone metadata (Doc 03 Â§C.3 step 7); no PII recoverable.
8. Admin attempts to restore a funnel whose linked workspace is closed â†’ fail with a clear message; `super_admin` can re-open the workspace first via a separate flow.
9. Internal note contains PII pasted from a customer email â†’ linter flags; admin must confirm before saving; PII never indexed in search.
10. Webhook retry attempted on a webhook whose target URL has been deactivated by the customer â†’ fail with "target deactivated"; do not deliver.
11. Force-regenerate triggered on a generation already in human review â†’ block until review concludes; admin sees state explanation.
12. Apply-credit amount exceeds an internal cap (e.g. > $500 for `billing_admin`, > $5,000 requires `super_admin`) â†’ 403 with a clear ladder; emit `admin_permission_denied`.
13. Admin role change happens mid-session (an off-boarded role) â†’ next API call re-checks; on 403, the UI prompts re-auth.
14. PII-search query returns > 50 results â†’ cap to 50; admin must add a workspace constraint.
15. Audit log query against a multi-year range â†’ pages, server-side cursor; never load the whole window into memory.
16. Admin attempts to impersonate themselves (e.g. for testing) â†’ blocked.
17. Customer has filed an active fraud / abuse case in T&S â†’ impersonation requires a second-`super_admin` co-sign (configurable per Doc 07a Â§13).
18. The impersonated user is currently logged in on two devices â†’ both see the banner; the impersonator's session is bound to one device but visible everywhere.
19. Admin attempts to delete an audit log row (any method) â†’ DB role lacks DELETE on audit_log (Doc 03 Â§B.9); request errors at the DB; security alert fires.
20. Admin uses an internal browser extension that injects scripts â†’ CSP blocks; admin notified to remove the extension.

## 4. API dependencies

**Internal**
- `admin-svc`: all admin actions.
- `auth-svc`: SSO + WebAuthn.
- `impersonation-svc`: session minting + revocation.
- `audit-query-svc`: indexed, paginated audit-log search.
- `notification-svc`: customer-facing emails (verification resend, refund confirmation).
- `billing-svc` (PRD 4): credit, refund, retry webhook.
- `webhook-svc` (PRD 3/4): retry, DLQ.
- `job-svc`: retry failed background jobs.
- All read paths: `crm-svc`, `lead-svc`, `generation-svc`, `funnel-svc`, `subscription-svc`.

**External**
- Google Workspace (SSO, OIDC).
- WebAuthn (FIDO2 platform authenticator + roaming key).
- 1Password (for the admin secrets index, Doc 08 Â§583).

## 5. Database tables / objects touched

- `users` (read for all; write only for admin actions like `is_internal=true` toggling â€” `super_admin`).
- `workspaces` (read; restore/close â€” `super_admin`).
- `subscriptions`, `invoices`, `payments`, `refunds` (read all; write `billing_admin`+).
- `funnels`, `funnel_versions`, `generations`, `assets` (read all; restore + force-regen `super_admin`).
- `webhooks`, `webhook_deliveries` (read all; retry `engineering`+).
- `audit_log` (read all; write only via append).
- `internal_notes` (new â€” see DDL).
- `admin_sessions` (new).
- `impersonation_sessions` (new).
- `admin_permission_grants` (new â€” role assignments).

**New DDL (lands in Doc 03 Â§B in same PR):**

```sql
CREATE TYPE admin_role AS ENUM ('read_only','support','billing_admin','engineering','super_admin');

CREATE TABLE admin_permission_grants (
  user_id      TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  role         admin_role NOT NULL,
  granted_by   TEXT NOT NULL REFERENCES users(id),
  granted_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at   TIMESTAMPTZ,
  revoked_by   TEXT REFERENCES users(id),
  scopes       TEXT[] NOT NULL DEFAULT '{}'  -- e.g. {'pii:read','impersonate:high_risk'}
);

CREATE TABLE admin_sessions (
  id              TEXT PRIMARY KEY,
  admin_user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id_hash  TEXT NOT NULL,
  ip_hash         TEXT NOT NULL,
  webauthn_used   BOOLEAN NOT NULL,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ NOT NULL,
  ended_at        TIMESTAMPTZ,
  end_reason      TEXT
);

CREATE TABLE impersonation_sessions (
  id                       TEXT PRIMARY KEY,
  admin_session_id         TEXT NOT NULL REFERENCES admin_sessions(id),
  admin_user_id            TEXT NOT NULL REFERENCES users(id),
  target_user_id           TEXT NOT NULL REFERENCES users(id),
  workspace_id             TEXT NOT NULL REFERENCES workspaces(id),
  justification            TEXT NOT NULL,
  justification_ticket_id  TEXT NOT NULL,
  cosigner_user_id         TEXT REFERENCES users(id),       -- required for high-risk
  scopes                   TEXT[] NOT NULL DEFAULT '{}',
  started_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at               TIMESTAMPTZ NOT NULL,
  ended_at                 TIMESTAMPTZ,
  ended_reason             TEXT,
  actions_summary          JSONB
);
CREATE INDEX impers_target_idx ON impersonation_sessions (target_user_id);
CREATE INDEX impers_admin_idx ON impersonation_sessions (admin_user_id);

CREATE TABLE internal_notes (
  id             TEXT PRIMARY KEY,
  workspace_id   TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  subject_type   TEXT NOT NULL,                              -- 'workspace','user','lead','funnel','subscription'
  subject_id     TEXT NOT NULL,
  author_user_id TEXT NOT NULL REFERENCES users(id),
  body           TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX in_subject_idx ON internal_notes (subject_type, subject_id);
```

## 6. Telemetry events emitted

| Event | Family | Notes |
|---|---|---|
| `impersonation_started` | A.8 #4 | Mandatory audit, 10y retention. |
| `impersonation_ended` | A.8 #5 | `actions_summary[]`, `ended_reason`. |
| `admin_credit_applied` | A.8 #7 | Requires `justification_ticket_id`. |
| `admin_refund_issued` | A.8 #8 | Same. |
| `internal_note_added` | A.8 | (Confirmed in Doc 03 Â§A.8 family index.) |
| `ticket_opened`, `ticket_assigned`, `ticket_resolved` | A.8 | If we integrate ticketing inside admin. |
| `user_password_reset_requested` | A.1 | `actor.type=admin`. |
| `user_verification_resent` | A.1 (add if not present) | `actor.type=admin`. |
| `admin_permission_denied` (new) | A.8 | Add to Doc 03 Â§A.8. Fires on any 403 inside admin console. |
| `pii_access_recorded` (new) | A.9 | Add to Doc 03 Â§A.9. Fires on any P2 read inside admin. |
| `account_suspended`, `account_restored`, `account_closed` | A.7 | When admin-initiated. |
| `funnel_unpublished` | A.3 | Admin take-down (with `actor.type=admin`). |

Every write action also writes an `audit_log` row (Doc 03 Â§B.9) with `actor_user_id`, `subject_type`, `subject_id`, `action`, `payload_hash`, `justification_ticket_id`.

## 7. Permissions enforced (admin-role Ã— capability matrix)

| Capability | read_only | support | billing_admin | engineering | super_admin |
|---|---|---|---|---|---|
| View dashboards (aggregate, no PII) | âœ… | âœ… | âœ… | âœ… | âœ… |
| Search users by email | âŒ | âœ… | âœ… | âœ… | âœ… |
| Search workspaces by id/slug/payment_id/funnel_url | âŒ | âœ… | âœ… | âœ… | âœ… |
| View workspace usage vs limits | âœ… | âœ… | âœ… | âœ… | âœ… |
| View failed payments | âŒ | âœ… | âœ… | âœ… | âœ… |
| View email + webhook delivery logs | âŒ | âœ… | âœ… | âœ… | âœ… |
| View audit log (own actions) | âœ… | âœ… | âœ… | âœ… | âœ… |
| View audit log (all admin actions) | âŒ | âŒ | âŒ | âŒ | âœ… |
| View error log | âŒ | âœ… | âŒ | âœ… | âœ… |
| Read raw PII on leads/contacts | âŒ | âŒ | âŒ | âŒ | âœ… (with `pii:read` scope) |
| Resend verification | âŒ | âœ… | âœ… | âŒ | âœ… |
| Trigger password reset | âŒ | âœ… | âŒ | âŒ | âœ… |
| Apply credit | âŒ | âŒ | âœ… (â‰¤$500) | âŒ | âœ… (no cap) |
| Issue refund | âŒ | âŒ | âœ… (â‰¤$500) | âŒ | âœ… (no cap) |
| Suspend / unsuspend workspace | âŒ | âŒ | âœ… | âŒ | âœ… |
| Restore deleted funnel | âŒ | âŒ | âŒ | âœ… | âœ… |
| Force regenerate | âŒ | âŒ | âŒ | âœ… | âœ… |
| Retry webhook | âŒ | âœ… | âœ… | âœ… | âœ… |
| Retry background job | âŒ | âœ… | âŒ | âœ… | âœ… |
| Add internal note | âŒ | âœ… | âœ… | âœ… | âœ… |
| Impersonate (with reason + banner) | âŒ | âŒ | âŒ | âŒ | âœ… |
| Grant admin role | âŒ | âŒ | âŒ | âŒ | âœ… + second `super_admin` co-sign |
| Force-terminate impersonation session | âŒ | âŒ | âŒ | âœ… | âœ… |

High-risk impersonation (vertical = regulated, or workspace under active T&S investigation) requires a second `super_admin` co-sign.

## 8. Error states + recovery paths

| State | Behavior | Recovery |
|---|---|---|
| SSO outage | Break-glass: a YubiKey-only path for 2 named SRE leads, gated on a vault-stored secret (Doc 08 Â§583) | Restored when SSO returns |
| WebAuthn unavailable on device | Fall back to a registered roaming security key; no password fallback | Use a different device |
| `justification_ticket_id` invalid | 400 with clear message; action not applied | Provide valid id |
| Impersonation session expired mid-action | Action 401s; impersonator must re-mint a session | Self-recover |
| Audit-log write failure | Admin action rejected (fail closed) | Manual escalation; on-call paged |
| Customer DSAR mid-impersonation | Impersonation session auto-terminated; admin sees explanation | Auto |
| Role grant attempted by single super_admin without co-sign | 400 with "co-sign required"; co-sign request notification sent to other super_admins | Co-sign |
| PII access from a non-EU admin against an EU workspace | Refused; require region-routed admin | Manual |
| Admin's own account compromised (anomalous IP + new device) | Step-up auth; session terminated | Manual |

## 9. Acceptance criteria

- [ ] SSO + WebAuthn enforced on every admin route (no password fallback).
- [ ] Role matrix in Â§7 enforced server-side; UI hides capabilities the role lacks, but server still re-checks.
- [ ] Every write emits one of the Â§6 events AND an `audit_log` row, both within the same DB transaction.
- [ ] `justification_ticket_id` required on every refund/credit/suspend/impersonate; format-validated against ticketing integration.
- [ ] Impersonation banner renders on every customer-facing page during the session (no exclusions); banner content tested with a Playwright check.
- [ ] Impersonation max session length 60 min; auto-extension requires a new justification.
- [ ] `audit_log` is INSERT-only at the DB role (Doc 03 Â§B.9); attempt to UPDATE/DELETE fails.
- [ ] PII access UI overlay shown on every P2 field; `pii_access_recorded` event emitted per overlay opened.
- [ ] Force-terminate impersonation works within 5 seconds globally (cache invalidation propagates).
- [ ] Search latency P95 < 300 ms across users + workspaces + payments + funnels.
- [ ] Coverage â‰¥ 90% on `admin-svc`, `impersonation-svc`, `audit-query-svc`.
- [ ] Quarterly pen-test (Doc 08 Â§170) includes admin-console privilege escalation tests; zero unmitigated findings at launch.
- [ ] CSP, frame-ancestors `none`, HSTS, COOP, COEP all set on every admin route.
- [ ] No admin route is indexed by search engines (robots.txt + meta tags + DNS-only access via Cloudflare Access â€” Doc 08 Â§270).

## 10. Launch blockers

1. SSO + WebAuthn working for all 5 roles.
2. All write capabilities in Â§7 functional with audit + event emission.
3. Impersonation: banner, mandatory reason, ticket id, expiry, force-terminate.
4. Audit log query UI with cursor pagination.
5. PII overlay + `pii_access_recorded` event.
6. Co-sign flow for high-risk impersonation + role grant.
7. Cloudflare Access in front of admin.funelai.com.
8. DLQ retry + webhook retry actions for `engineering`.
9. Credit + refund actions for `billing_admin` with caps + escalation to `super_admin` above caps.
10. Pen-test sign-off (Doc 08 Â§170) â€” must pass before Day 90.
11. Break-glass procedure documented + dry-run by SRE leads.

## 11. Post-launch enhancements

- Per-vertical specialist admin views (medical reviewer, legal reviewer).
- Bulk admin actions (e.g. apply credit to a list of workspaces affected by an incident).
- Smart search with relevance ranking + saved searches.
- Admin notebooks (long-running runbook execution with checkpointed state).
- Customer-facing transparency: a "view all admin actions on my account" page (consumer-rights forward-leaning).
- ML-assisted anomaly detection in admin actions (catches insider risk early).
- Voice-note attachments on internal notes.
- Time-travel debugging: view a workspace as of timestamp T (read-only, audited).

## 12. Test plan

**Unit**
- Role-matrix capability check function (every cell tested).
- Justification-ticket-id format validator.
- Impersonation session minting + claim assembly.

**Integration**
- SSO + WebAuthn enrollment + login flow.
- Impersonation: start â†’ action â†’ end; events + audit + banner verified.
- Refund / credit caps + escalation to `super_admin`.
- DLQ retry + webhook retry surface-area.
- Audit log append-only property (attempt UPDATE/DELETE under admin DB role â†’ must fail).

**E2E**
- Full incident-response drill (Doc 08 Â§306): support admin investigates a customer complaint, applies credit, hands off to billing_admin, who issues refund, hands off to super_admin, who impersonates to verify fix â€” every step logged.
- High-risk impersonation requires co-sign and is force-terminated by engineering admin mid-session.

**Security**
- Quarterly pen-test (Doc 08 Â§170): all admin endpoints; specifically privilege escalation, IDOR (cross-workspace data), broken auth, server-side request forgery via webhook retry forms, log-injection in `internal_notes`.
- Bug bounty scope includes admin (separate scope tier with higher payouts).
- CSP / headers verified by `tooling/security/headers.test.ts`.

**Chaos**
- SSO outage: break-glass path works.
- WebAuthn provider outage: roaming key fallback works.
- Region failover: EU admin can still access EU workspaces; cross-region access blocked until manually approved.

---

## Appendix A â€” Cross-PRD interaction map

```
            PRD 1 (Onboarding)
                    â”‚
                    â–¼
            PRD 2 (Generation Engine) â”€â”€â–º PRD 3 (CRM + Lead Engine)
                    â”‚                            â”‚
                    â”œâ”€â”€â–º Cost Governor (07c)     â”œâ”€â”€â–º Suppression list (Doc 03 Â§B.16)
                    â”œâ”€â”€â–º Human Review (07b)      â”œâ”€â”€â–º Calendar providers
                    â”œâ”€â”€â–º Compliance (07a)        â”œâ”€â”€â–º RevTry voice
                    â”‚                            â”‚
                    â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â–º PRD 4 (Billing) â—„â”€â”€â”€â”€ Plan state drives 07c ceilings
                                          â”‚
                                          â–¼
                                  PRD 5 (Admin Console)
                                  reads everything; writes audited
```

## Appendix B â€” Event-name index used in this pack

(All events listed must exist in Doc 03 Part A. Events marked **NEW** must be added in the same PR that ships their PRD.)

- A.1 Identity: `user_signed_up`, `workspace_created`, `user_verification_resent` (**NEW**), `user_password_reset_requested`.
- A.2 Generation: `generation_started`, `generation_completed`, `generation_regenerated`, `agent_invoked`, `quality_score_computed`, `quality_failed`, `fact_check_flag_raised`, `compliance_block_raised`, `human_review_required`, `human_review_completed`.
- A.3 Publish: `funnel_published`, `funnel_unpublished`, `funnel_archived`.
- A.5 Lead: `lead_captured`, `lead_scored`, `lead_sms_sent`, `lead_sms_delivered`, `lead_sms_opted_out`, `lead_revtry_call_started`, `lead_revtry_call_completed`, `lead_voicemail_left`, `lead_qualified`, `lead_disqualified`, `lead_booking_created`, `lead_booking_canceled`.
- A.7 Revenue (SaaS): `trial_started`, `trial_ended`, `plan_upgraded`, `plan_downgraded`, `plan_paused`, `plan_resumed`, `subscription_canceled`, `payment_succeeded`, `payment_failed`, `refund_processed`, `account_suspended`, `account_restored`, `account_closed`, `dunning_step_entered` (**NEW**).
- A.8 Support: `impersonation_started`, `impersonation_ended`, `internal_note_added`, `admin_credit_applied`, `admin_refund_issued`, `admin_permission_denied` (**NEW**).
- A.9 Governance: `consent_captured`, `consent_withdrawn`, `data_export_requested`, `data_export_delivered`, `data_deletion_completed`, `pii_leak_blocked`, `pii_access_recorded` (**NEW**), `recon_drift_detected`, `kb_pack_updated`, `kb_pack_attached` (**NEW**).

## Appendix C â€” Cross-cutting non-negotiables (apply to every PRD)

1. **Tenant isolation:** every table has RLS keyed on `workspace_id` (or `user_id` for pre-workspace data). Verified by `packages/db/__rls_tests__/`.
2. **PII discipline:** Doc 03 Â§C.2 tiering. No P2 in logs/spans. No P3 ever warehoused.
3. **Idempotency:** every mutating endpoint accepts an `Idempotency-Key` header and de-duplicates within 24h.
4. **Auditing:** every write that affects another user emits an event AND writes an `audit_log` row in the same transaction.
5. **Feature flags + kill switches:** every new module ships with `release.<area>.v1` and `killswitch.<area>` flags (Doc 08 Â§362).
6. **Observability:** every service has a Doc 08 Â§443 dashboard; SLO + error budget defined.
7. **Money discipline:** `Money` type (bigint + currency tag, Doc 08 Â§65). No `number` for money.
8. **Test discipline:** unit, integration, E2E, and load tests required at the thresholds in each PRD; flake policy per Doc 08 Â§120 (auto-quarantine).
9. **Legal docs wired:** every contractual click maps to `05aâ€“e`. Versions are pinned at `consent_captured` event.
10. **No silent T&S failures:** anything that touches Doc 07aâ€“c must fail loudly (event + alert), never silently.

---

**End of PRD Pack v1.**

Open issues / follow-ups to land before Day 90:
- Confirm whether `user_verification_resent`, `kb_pack_attached`, `pii_access_recorded`, `admin_permission_denied`, and `dunning_step_entered` already exist in Doc 03; if not, file separate PRs to add them with full envelope + retention rows.
- Confirm Stripe Billing on/off date (currently month 3+); if compressed to launch, PRD 4 Â§10 expands.
- Confirm exact dunning email cadence + copy with Customer Success (Doc 06a â€” activation framework owns the copy; PRD 4 owns the state machine).
- Confirm 30-vertical canonical taxonomy snapshot (Onboarding PRD 1 references) is checked in at `packages/onboarding/verticals.json`.
- Pen-test schedule with vendor (PRD 5 launch blocker Â§10).
