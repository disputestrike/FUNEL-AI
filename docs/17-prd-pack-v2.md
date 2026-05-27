# 17 â€” PRD Pack v2 (Day-90 Launch)

**Owner:** VP Engineering
**Status:** Engineering source of truth â€” locked for Day-90 launch (companion to `12-prd-pack-v1.md`)
**Audience:** Engineering, QA, T&S, Trust, Billing, Admin Console, ML/MLOps, Comms/Notifications, Ads, Voice teams
**Cross-references:**
- Event taxonomy & DB schemas: `03-event-taxonomy-and-schemas.md`
- Integration matrix + Provider Abstraction Layer (PAL): `04-integration-matrix-and-pal.md`
- Legal flows: `05a-terms-of-service.md`, `05b-privacy-policy.md`, `05c-acceptable-use-policy.md`, `05d-refund-policy.md`, `05e-publish-acknowledgment-and-indemnification.md`
- Trust & Safety: `07a-trust-and-safety-policy.md`, `07b-human-review-queue.md`, `07c-cost-governor.md`
- Engineering ops: `08-engineering-ops-spec.md`
- v1 PRD pack: `12-prd-pack-v1.md` (PRDs 1â€“5)
- Country launch matrix (TCPA + A2P + ad policy quirks): `15-country-launch-checklists.md`
- Viral loops + referral hooks: `16-viral-loops-spec.md`

> **Role matrix anchor.** Same as v1 Â§15: `workspace_role` enum is `owner | admin | editor | analyst | viewer | billing` (Doc 03 Â§B.0). Admin-console role set is `read_only | support | billing_admin | engineering | super_admin` (v1 PRD 5 Â§7). Every "permissions enforced" table resolves to these two sets and is enforced server-side by `packages/auth`.

> **Event taxonomy anchor.** Every event in a "telemetry events emitted" table MUST exist in Doc 03 Part A. Events tagged **NEW** must land in Doc 03 in the same PR and pass `tooling/eventschema/` lint.

> **Compliance gates anchor.** All auto-block / auto-review / escalate gates resolve to one of: 07a Â§R1â€“R7, 07b Â§2.1â€“2.4, 07c Â§3.

> **Cross-pack interaction anchor.** v2 modules sit downstream of v1's Generation Engine (v1 PRD 2) and Lead Engine (v1 PRD 3), and consume plan state from v1 PRD 4 (Billing) + admin actions from v1 PRD 5. Wherever this pack says "PRD N" without a "v1" or "v2" suffix, the table of contents below resolves the reference.

---

## Table of contents

- [PRD 6 â€” RevTry Integration](#prd-6--revtry-integration)
- [PRD 7 â€” Ad Publishing](#prd-7--ad-publishing)
- [PRD 8 â€” Email + SMS Engine](#prd-8--email--sms-engine)
- [PRD 9 â€” Notification Engine](#prd-9--notification-engine)
- [PRD 10 â€” Recursive Learning Pipeline](#prd-10--recursive-learning-pipeline)
- [Appendix A â€” Cross-PRD interaction map (v1 + v2)](#appendix-a--cross-prd-interaction-map-v1--v2)
- [Appendix B â€” New events introduced by v2 (to land in Doc 03)](#appendix-b--new-events-introduced-by-v2-to-land-in-doc-03)
- [Appendix C â€” Cross-cutting non-negotiables](#appendix-c--cross-cutting-non-negotiables)

---

# PRD 6 â€” RevTry Integration

**Workstream owner:** Voice squad (Tech lead + 2 BE + 1 telephony eng + 1 ML eng for transcript ingestion + 1 SRE partner for SLA monitoring)
**Source-of-truth services:** `revtry-orchestrator`, `revtry-worker` (consumer of v1 PRD 3 events), `voice-meter-svc`, `dnc-svc`, `voice-fallback-svc` (Twilio Programmable Voice adapter), `transcript-ingest-svc`.
**Cross-PRD interactions:** consumes leads from v1 PRD 3 (Lead Engine â€” the 60s speed-to-lead SLA is shared); outcomes write back to v1 PRD 3 (`leads.status`, activity timeline); minute-meter accounting flows to v1 PRD 4 (Billing) for overage invoicing; admin replay / kill-switch lives in v1 PRD 5 (Admin Console); voice scripts come from v1 PRD 2 (Voice Script agent) and bind to a `script_version` per `revtry_calls` row (Doc 03 Â§B.12).

## 1. Module overview

RevTry is the AI voice agent layer that converts captured leads into qualified conversations within 60 seconds â€” and re-engages them on cadence after no-answer / voicemail. Every `lead_captured` event (v1 PRD 3 Â§6, Doc 03 Â§A.5 #1) for a workspace whose plan includes RevTry minutes routes to `revtry-orchestrator`, which composes a dial plan, checks suppression + DNC + quiet-hours + per-jurisdiction TCPA windows (Doc 15 country matrix), then dispatches to `revtry-worker` for outbound dial. Inbound calls to a workspace's RevTry number land in the same worker for inbound-handling personae. Scripts are industry-tuned (sourced from the same KB pack pinned at `business_profile_version`-time in v1 PRD 1) and persona-matched (voice ID + speaking pace + objection-handling style chosen per vertical Ã— geo Ã— language). TCPA opt-out language is read at the start of every outbound call ("Press 9 or say STOP to be removed") and captures are routed to the global suppression list (Doc 03 Â§B.16) so the opt-out is honored across every channel, every workspace, forever.

Outcomes follow a strict state machine: `queued â†’ dialing â†’ connected | no_answer | voicemail | busy | failed | do_not_call â†’ qualified | disqualified | booked | transferred`. Each transition emits the corresponding A.5 event (Doc 03), updates `revtry_calls`, and writes to `leads.activity_timeline`. Recordings + transcripts are gated on consent (recorded jurisdiction-by-jurisdiction per Doc 15 â€” single-party vs two-party consent rules), encrypted at rest in S3 (`s3://funnel-lake-<region>/raw/integrations/revtry/...` per Doc 03 Â§C.4), and surfaced in the CRM timeline with a "PII access logged" overlay (v1 PRD 5 Â§2 story 10). Voice minutes are metered against the plan ledger (`workspace_ledger` per Doc 07c Â§4.1) at the resolution of seconds, rolled up nightly, and exposed in v1 PRD 4's billing UI. Overage at $0.18/minute (configurable per region in `pricing-config`) is invoiced on the next billing cycle.

RevTry's SLA is 99.5% monthly availability for *outbound* dial within 60s P95. When `revtry-svc` health crosses the Â§8 outage threshold, the orchestrator transparently fails over to `voice-fallback-svc` (Twilio Programmable Voice with a TwiML-driven script + Deepgram for ASR + ElevenLabs/Cartesia for TTS via PAL); persona fidelity is reduced but the lead is still contacted. The fallback is one-way (we don't gate the rest of the queue on RevTry recovery once we've cut over). Once RevTry is healthy and a debounce window passes, new dials route back. Fallback dials are tagged on the call record (`carrier_metadata.fallback_provider='twilio'`) so analytics can separate them.

## 2. User stories

1. **GIVEN** a `lead_captured` event for a Growth-tier workspace **WHEN** the lead's country is in our voice launch list (Doc 15) and consent permits **THEN** `revtry-orchestrator` enqueues a dial within 5s, `revtry-worker` initiates the call within the 60s speed-to-lead SLA at P95, and `lead_revtry_call_started` (Doc 03 Â§A.5 #6) is emitted with `attempt_n=1`, `agent_voice_id`, `script_version`, and the workspace's RevTry-allocated `from_number`.
2. **GIVEN** an outbound call connects to a human **WHEN** the RevTry agent reads the TCPA opt-out preamble ("Press 9 to be removed; this call may be recorded") **THEN** `consent_recorded=true` is set on `revtry_calls`, the lead-side disposition is `answered`, and a `consent_captured` (Doc 03 Â§A.9 #2) event is emitted with `purpose='revtry_recording'`, `method='ivr_inbound_preamble'`, `version=<preamble_version_hash>`.
3. **GIVEN** the callee presses 9 OR says any opt-out keyword from the Â§3 list **WHEN** the worker detects it via DTMF or ASR keyword spotting **THEN** the call ends, `lead_sms_opted_out` is reused with `channel='call'` (or the new event `lead_call_opted_out` (**NEW**, add to Doc 03 Â§A.5) â€” *see Â§6 below*), the lead is added to the global `suppression_list` (Doc 03 Â§B.16) with `channel='call'`, and **all** future outbound voice/SMS to that identifier is blocked across **all** workspaces (TCPA boundary).
4. **GIVEN** a no-answer or busy outcome on attempt N **WHEN** the retry policy allows another attempt (default: 3 attempts on day 0 at +10m / +60m / +4h; 1 attempt/day on days 1â€“3 in the lead's local-business-hours window; total cap 6 attempts) **THEN** `revtry-orchestrator` schedules the next dial; the `revtry_calls` row records `outcome='no_answer'` and `lead_revtry_call_completed` is emitted with the disposition.
5. **GIVEN** the dial reaches voicemail **WHEN** voicemail detection (Twilio AMD or RevTry's native AMD) confidently fires **THEN** the worker plays the configured voicemail script (or skips per workspace setting), emits `lead_voicemail_left` (Doc 03 Â§A.5 #8) with `script_version` + `vm_audio_url`, and schedules a follow-up SMS via v2 PRD 8 with idempotency on `(lead_id, attempt_n)`.
6. **GIVEN** a number is on the workspace's local DNC list OR on the synced national DNC list (US â€” DNC.gov daily delta; UK â€” TPS via partner; CA â€” CRTC) **WHEN** the orchestrator pre-checks before dialing **THEN** the call is *not* placed, the lead status moves to `disqualified` with `reason_code='dnc_listed'`, `lead_disqualified` is emitted, and no minutes are metered.
7. **GIVEN** a transcript completes **WHEN** `transcript-ingest-svc` processes the diarized transcript **THEN** PII redaction runs (regex + NER for emails, phones, SSN-like, card-like, address-like patterns), the redacted transcript is stored in `revtry_calls.transcript_s3_uri`, and `lead_revtry_call_completed` is updated with `objections[]` and `sentiment_score`.
8. **GIVEN** a Scale-tier workspace exceeds 2,500 minutes in a billing cycle **WHEN** the next dial would exceed the ledger ceiling **THEN** the orchestrator continues to dial but flags every additional second as `overage=true`; nightly billing roll-up writes an overage invoice line item at $0.18/min (configurable per `pricing-config`) into v1 PRD 4's `invoices`.
9. **GIVEN** an Agency-tier parent workspace pools minutes across N sub-workspaces **WHEN** any sub-workspace dials **THEN** the meter charges the *parent's* pool first, falls through to the sub-workspace's plan ceiling only if the parent has opted out of pooling for that sub (`agency_pool_settings.opted_out=true`), and emits `voice_minutes_metered` (**NEW**, A.7) with `pool_id` set.
10. **GIVEN** `revtry-svc` returns 5xx for â‰¥ 60 s OR latency P95 crosses 10s **WHEN** the health check fires **THEN** `voice-fallback-svc` takes over, every new dial is routed to Twilio, `revtry_fallback_activated` (**NEW**, A.9) is emitted with `reason`, and a SEV-2 page goes to the voice on-call (Doc 08 Â§306).
11. **GIVEN** an inbound call arrives at a workspace's RevTry number **WHEN** the inbound persona is configured **THEN** the worker answers with the inbound greeting, reads the inbound recording-consent preamble (jurisdiction-aware), and offers menu options (book / qualify / human transfer); outcome events mirror the outbound state machine.
12. **GIVEN** a call qualifies the lead per the script's qualification criteria **WHEN** the agent transitions to `qualified` state **THEN** `lead_qualified` (Doc 03 Â§A.5 #9) is emitted with `qualifier='revtry_agent'`, `qualifier_method='ai_voice'`, `criteria_id=<qualification_node_id>`; if the script also books a slot, `lead_booking_created` is emitted via v1 PRD 3's booking flow.
13. **GIVEN** the caller asks to talk to a human **WHEN** the workspace has `human_transfer_enabled=true` and a transfer target (PSTN or SIP URI) is on duty per the on-call schedule **THEN** the worker warm-transfers via Twilio `<Dial>` or SIP REFER, emits `lead_revtry_call_completed` with `outcome='transferred'`, and the activity timeline shows the transfer + the duration up to transfer.
14. **GIVEN** an admin (v1 PRD 5 `super_admin` w/ `pii:read`) replays a single call from the admin console **WHEN** they click "Play recording" **THEN** the recording streams from S3 via a signed URL (60s TTL), `pii_access_recorded` (Doc 03 Â§A.9 NEW per v1) is emitted, and an audit row is written.
15. **GIVEN** the workspace owner toggles "Record calls" to OFF **WHEN** any subsequent call is placed **THEN** `record_call=false` is passed to the worker; the preamble switches to a no-recording variant; `revtry_calls.recording_s3_uri` stays null; existing recordings remain (with a per-workspace retention override path through v1 PRD 5).
16. **GIVEN** a user in a single-party-consent jurisdiction (e.g. most US states) **WHEN** a call connects **THEN** the preamble is short ("This call may be recorded for quality"); **GIVEN** a user in a two-party-consent jurisdiction (e.g. CA, FL, IL, PA, WA â€” Doc 15) **WHEN** the call connects **THEN** the preamble is the explicit consent variant ("â€¦by continuing this call you consentâ€¦"), and if the callee declines, the worker continues without recording.

## 3. Edge cases (â‰¥ 15)

1. Lead captured at 11:58 PM local â€” TCPA quiet-hours start at 9 PM (US) â†’ dial deferred to 8 AM the next morning (jurisdictional rules from Doc 15); `lead_revtry_call_started` not emitted until actual dial.
2. Lead's phone resolves to two countries (e.g. NANP US/CA shared range) â†’ use the funnel's stated geo + `lead.ip_hash` country signal as a tiebreaker; if still ambiguous, apply the *stricter* of the two jurisdictions' rules.
3. The number is a known landline that doesn't accept SMS but the script's voicemail fallback is SMS-only â†’ skip the SMS fallback step, mark the lead with `voicemail_followup_skipped=true`.
4. Number is on a recycled-number list (T-Mobile-style) â†’ require fresh consent before any further outbound; if no fresh consent, dial only once and only with the opt-out preamble.
5. Caller answers in a language different from the configured persona language â†’ if `auto_language_switch=true` and a persona exists for the detected language, hot-swap the persona mid-call; otherwise read the language-mismatch fallback line and offer SMS in the detected language.
6. Caller pretends to be the wrong person ("you have the wrong number") â†’ end politely, emit `lead_disqualified` with `reason_code='wrong_number'`, hash the number to the suppression list with `reason='wrong_number'`.
7. ASR mis-spots a non-opt-out word as an opt-out (e.g. "stoptalking") â†’ opt-out keyword spotting uses a tokenized whole-word matcher with confidence â‰¥ 0.9; below threshold = log + continue + flag for human review.
8. The dial passes pre-flight DNC check at T0 but the number lands on DNC.gov at T0+30s (delta sync window) â†’ if a call connects within the next sync window, treat it as if DNC was honored (we acted in good faith); next attempt is blocked.
9. Workspace plan changes from Growth â†’ Starter mid-cycle â†’ minute ceiling drops; in-flight calls complete, future scheduled dials beyond the new ceiling are paused (not canceled) and the user is notified via v2 PRD 9.
10. Twilio fallback also degraded (rare double outage) â†’ all dials queue with TTL = next business day; v2 PRD 9 sends the workspace a SEV banner; no minutes metered.
11. Call connects but the speaker is an answering service / IVR loop (not a human, not a voicemail) â†’ AMD escalates to `loop_detected`; worker ends the call after 12s with `outcome='failed'` `disposition_code='ivr_loop'`; no recording stored.
12. Caller emits sensitive PII verbally ("my SSN is â€¦") â†’ real-time PII bleeper masks audio in the recording (60ms duck) and redacts in the transcript before storage; emit `pii_leak_blocked` (Doc 03 Â§A.9).
13. Persona-matched voice ID has been removed from the provider (ElevenLabs disabled the voice) â†’ orchestrator selects the next-best persona in the vertical's persona library (v2 PRD 10 weights from the learning pipeline), emits a degraded-quality warning to the workspace via v2 PRD 9.
14. Workspace owner uploads a custom voicemail audio that exceeds 30s OR fails content scan â†’ reject upload with a friendly message; do not silently truncate.
15. Same lead captured twice in 30s from two different funnels in the same workspace â†’ orchestrator dedupes by `(workspace_id, contact_hash)` for 60 minutes; second `lead_captured` joins the first's dial queue rather than creating a parallel dial.
16. Transferred call goes to voicemail on the human's end â†’ treat as `transferred_voicemail`; if the workspace has configured "if transfer voicemail, schedule callback for human", schedule a calendar event on the assignee's calendar via v1 PRD 3's booking-svc; otherwise just record outcome.
17. Caller's audio is silent for > 8s consecutive â†’ worker prompts "Are you still there?"; after a second 8s of silence, ends with `outcome='no_answer'` (treated like dropped).
18. Inbound call arrives during a maintenance window where the worker is restarting â†’ Twilio fallback's `<Dial>` to a pre-recorded "we'll call you right back" line + auto-schedule a callback in 5 minutes.
19. Caller from EU jurisdiction asks to delete the recording mid-call â†’ end politely, queue the DSAR (v1 PRD 5 + Doc 03 Â§C.3), purge S3 recording within 30 days, emit `data_deletion_requested` with `subject_type='lead'`.
20. Pooled Agency minutes nearly exhausted (95% of pool) â†’ orchestrator continues to dial but v2 PRD 9 alerts the Agency owner; admin can lift the soft cap inline.

## 4. API dependencies

**Internal**
- `revtry-orchestrator` (this PRD): queues, schedules, retries.
- `revtry-worker` (this PRD): the actual dial + media handler. Consumes `lead_captured` from Kafka.
- `voice-fallback-svc` (this PRD): Twilio Programmable Voice adapter; TwiML-driven script for fallback.
- `voice-meter-svc` (this PRD): seconds-resolution metering; nightly roll-up to `workspace_ledger` (Doc 07c Â§4.1).
- `dnc-svc` (this PRD): syncs DNC.gov (US daily delta), TPS (UK), CRTC (CA), and per-workspace local lists.
- `transcript-ingest-svc` (this PRD): diarization + PII redaction; writes `revtry_calls.transcript_s3_uri`.
- `kb-svc` (v1 PRD 1/2): pulls the industry script + persona library pinned at `business_profile_version` time.
- `consent-svc`: writes `consent_captured` per recording preamble.
- `suppression-svc`: writes opt-outs to the global list.
- `lead-svc` (v1 PRD 3): writes `leads.status` and activity timeline.
- `booking-svc` (v1 PRD 3): warm-transfer scheduling; callback creation.
- `notification-svc` (v2 PRD 9): degraded-quality + overage notifications.
- `feature-flags`: `release.revtry.v1`, `killswitch.revtry.global`, `killswitch.revtry.<vertical>`, `killswitch.revtry.<region>`, `release.revtry.fallback`.

**External (via PAL â€” Doc 04)**
- RevTry (the AI voice vendor).
- Twilio Programmable Voice + Twilio Lookup (carrier, line-type) â€” fallback path.
- Deepgram ASR (fallback path; RevTry has its own ASR).
- ElevenLabs / Cartesia / OpenAI TTS (fallback path).
- DNC.gov daily download endpoint (US).
- UK TPS partner API (Doc 04 partner list).
- Canada CRTC DNCL API.

## 5. Database tables / objects touched

- `revtry_calls` (Doc 03 Â§B.12) â€” read + write.
- `leads` (Doc 03 Â§B.5) â€” write status, activity timeline.
- `suppression_list` (Doc 03 Â§B.16) â€” write (opt-outs).
- `workspace_ledger` (Doc 07c Â§4.1) â€” write seconds/cost.
- `audit_log` (Doc 03 Â§B.9) â€” every state transition.
- `event_log` â€” emitter hot-tail.
- `consent_records` â€” preamble consent captures.

**New helper schemas (must land in Doc 03 Â§B in the same PR):**

```sql
CREATE TABLE revtry_dial_plan (
  lead_id            TEXT PRIMARY KEY REFERENCES leads(id) ON DELETE CASCADE,
  workspace_id       TEXT NOT NULL,
  attempts_planned   JSONB NOT NULL,         -- [{attempt_n, scheduled_for, persona_id, script_version}]
  attempts_completed INTEGER NOT NULL DEFAULT 0,
  state              TEXT NOT NULL,          -- 'queued','in_progress','exhausted','suppressed','disqualified','completed'
  next_action_at     TIMESTAMPTZ,
  pool_id            TEXT,                   -- agency pool reference
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX rdp_next_action_idx ON revtry_dial_plan (next_action_at) WHERE state IN ('queued','in_progress');

CREATE TABLE voice_minute_ledger (
  id              TEXT PRIMARY KEY,           -- vml_â€¦
  workspace_id    TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  call_id         TEXT NOT NULL REFERENCES revtry_calls(id) ON DELETE CASCADE,
  pool_id         TEXT,
  seconds         INTEGER NOT NULL,
  fallback        BOOLEAN NOT NULL DEFAULT FALSE,
  metered_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  overage         BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX vml_workspace_metered_idx ON voice_minute_ledger (workspace_id, metered_at DESC);

CREATE TABLE dnc_lists (
  id              TEXT PRIMARY KEY,
  jurisdiction    TEXT NOT NULL,            -- 'us_national','uk_tps','ca_dncl','workspace:<id>'
  identifier_sha256 TEXT NOT NULL,
  source          TEXT NOT NULL,
  added_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX dnc_unique ON dnc_lists (jurisdiction, identifier_sha256);

CREATE TABLE revtry_personae (
  id              TEXT PRIMARY KEY,           -- rvp_â€¦
  vertical        TEXT NOT NULL,
  language        TEXT NOT NULL,
  region          TEXT,
  voice_id        TEXT NOT NULL,
  speaking_pace   TEXT,
  objection_style TEXT,
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  ranking_weight  NUMERIC(6,4) NOT NULL DEFAULT 1.0,  -- updated by v2 PRD 10
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

`revtry_dial_plan` is RLS-scoped on `workspace_id`. `voice_minute_ledger` same. `dnc_lists` is global (no RLS) but write-restricted to the `dnc-svc` role. `revtry_personae` is global library (RLS off, write restricted to T&S / MLOps).

## 6. Telemetry events emitted (Doc 03 references)

| Event | Family | When |
|---|---|---|
| `lead_revtry_call_started` (A.5 #6) | A.5 | Worker dials. |
| `lead_revtry_call_completed` (A.5 #7) | A.5 | Worker ends. Includes `outcome`, `disposition_code`, `recording_url?`, `transcript_url?`, `cost_usd_micros`. |
| `lead_voicemail_left` (A.5 #8) | A.5 | Voicemail played. |
| `lead_qualified` / `lead_disqualified` (A.5 #9/#10) | A.5 | Per script's qualification node. |
| `lead_sms_opted_out` (A.5 #5) | A.5 | When an SMS-channel opt-out is captured during a call (cross-channel). |
| `lead_call_opted_out` **NEW** (A.5) | A.5 | When the caller opts out specifically of voice. `channel='call'`, full payload mirrors `lead_sms_opted_out`. Add to Doc 03. |
| `consent_captured` (A.9 #2) | A.9 | Preamble accepted. `purpose='revtry_recording'`. |
| `pii_leak_blocked` (A.9) | A.9 | PII bleeper triggered mid-call. |
| `voice_minutes_metered` **NEW** (A.7 â€” SaaS revenue family) | A.7 | Nightly + real-time on overage threshold cross. Add to Doc 03 Â§A.7. Properties: `workspace_id`, `pool_id?`, `seconds`, `overage_seconds`, `cost_micros`, `currency`. |
| `revtry_fallback_activated` **NEW** (A.9) | A.9 | Health-check trip; carries `reason`, `provider='twilio'`. Add to Doc 03 Â§A.9. |
| `revtry_fallback_deactivated` **NEW** (A.9) | A.9 | Cut back to RevTry after health stable for the debounce window. |
| `dnc_match_blocked` **NEW** (A.5) | A.5 | Dial pre-empted by DNC. `jurisdiction`, `identifier_sha256`. Add to Doc 03. |

All events carry the canonical envelope (Doc 03 Â§A.0). `revtry_calls` is the source-of-truth for joins; events are emit-and-derive.

## 7. Permissions enforced

| Capability | owner | admin | editor | analyst | viewer | billing |
|---|---|---|---|---|---|---|
| View call metadata (no PII, no recording) | âœ… | âœ… | âœ… | âœ… | âœ… | âŒ |
| Play recording / read transcript | âœ… | âœ… | âœ… | âŒ | âŒ | âŒ |
| Trigger manual dial from CRM | âœ… | âœ… | âœ… | âŒ | âŒ | âŒ |
| Cancel scheduled dial | âœ… | âœ… | âœ… | âŒ | âŒ | âŒ |
| Toggle record-calls / consent-preamble variant | âœ… | âœ… | âŒ | âŒ | âŒ | âŒ |
| Configure RevTry persona / script overrides | âœ… | âœ… | âŒ | âŒ | âŒ | âŒ |
| Upload custom voicemail audio | âœ… | âœ… | âŒ | âŒ | âŒ | âŒ |
| View minute usage + overage | âœ… | âœ… | âŒ | âœ… | âŒ | âœ… |
| Configure Agency pool sharing | parent-`owner` only | âŒ | âŒ | âŒ | âŒ | âŒ |
| Add/remove from workspace DNC list | âœ… | âœ… | âœ… | âŒ | âŒ | âŒ |

Admin-console (v1 PRD 5):
- `support`: view metadata + transcripts (PII redacted view) â€” no raw recording.
- `engineering`: replay failed dials, retry from DLQ, view fallback activation log, view per-region health.
- `super_admin` w/ `pii:read`: stream raw recording (signed-URL, `pii_access_recorded` emitted).
- `billing_admin`: view minute ledger + apply credit for SLA breach.

## 8. Error states + recovery paths

| State | User-visible behavior | Recovery |
|---|---|---|
| RevTry vendor outage | `revtry_fallback_activated` fires; Twilio fallback takes over; banner in workspace | Auto re-cut to RevTry after 10-min stable window |
| Both RevTry and Twilio down | New dials queue; v2 PRD 9 SEV banner; existing in-flight finish | Manual ops; SEV-1 page |
| DNC sync stale > 24h | Block new dials in the affected jurisdiction, alert on-call | Force-resync; if sync provider is the issue, manual list pull |
| Transcript pipeline backed up | Recordings stored, transcripts delayed; UI shows "transcript pending"; SLA: 15 min P95 | Auto on backlog drain |
| Persona library empty for a vertical | Use generic-persona fallback (`rvp_generic_<lang>`); flag KB-pack gap to T&S | T&S provisions persona |
| Minute meter write failure | Call still proceeds (do not block on metering); reconcile from `revtry_calls.duration_sec` nightly | Auto recon |
| Opt-out write failure (suppression-list 5xx) | Fail closed â€” block call, retry write, page on-call (legal exposure if we lose an opt-out) | Manual escalation |
| Recording S3 write failure | Call still completes; recording marked `pending_upload`; background job retries 6Ã— over 24h | Auto |
| Workspace ledger exhausted mid-call | Current call completes (we don't hang up mid-sentence); next dial blocked + upgrade banner | User-initiated upgrade or wait for renewal |
| Pooled Agency partner workspace closed mid-call | Call completes; cost attributed to parent; sub-workspace removed from pool on next cycle | Auto |

## 9. Acceptance criteria

- [ ] `lead_captured` â†’ `lead_revtry_call_started` P95 < 60 s on all eligible captures (joint SLA with v1 PRD 3).
- [ ] DNC pre-check P95 < 50 ms; cache hit rate > 95% (jurisdiction lists held in Redis with daily delta).
- [ ] Opt-out keyword detection F1 â‰¥ 0.95 on the 5,000-utterance test corpus (`eval/revtry/optout/`).
- [ ] AMD (answering-machine detection) accuracy â‰¥ 0.92 measured against the held-out call-recording set.
- [ ] TCPA quiet-hours enforced per US state + per international jurisdiction (Doc 15); regression suite has 50+ positive + 50+ negative cases.
- [ ] Two-party-consent jurisdiction preamble triggers in CA, FL, IL, PA, WA (and any others in Doc 15) â€” verified by a Playwright/Twilio recorded-call test.
- [ ] Fallback to Twilio is fully automatic within 60 s of `revtry-svc` health degradation (load-test verified by killing the RevTry adapter).
- [ ] Minute meter accuracy: seconds metered vs `revtry_calls.duration_sec` summed match within 0.1% nightly (drift > 0.1% pages voice-ops).
- [ ] Overage invoicing math verified end-to-end against v1 PRD 4 invoices; cents-precise.
- [ ] All events listed in Â§6 emitted with the correct envelope; **NEW** events landed in Doc 03 Â§A with retention rows.
- [ ] RLS on `revtry_dial_plan`, `voice_minute_ledger`, `revtry_calls`; verified by `packages/db/__rls_tests__/revtry.test.ts`.
- [ ] Recording + transcript PII redaction precision â‰¥ 0.98 against the redaction test corpus.
- [ ] Agency pool accounting: parent + sub-workspace ledger sum matches pool draw down within 1 second; verified by a fuzz test.
- [ ] Coverage â‰¥ 90% on `revtry-orchestrator`, `voice-meter-svc`, `dnc-svc`, `voice-fallback-svc`.
- [ ] Feature flags + kill switches: `killswitch.revtry.global` immediately stops new dials; in-flight finish; verified in staging.

## 10. Launch blockers

1. End-to-end happy-path: `lead_captured` â†’ dial â†’ connect â†’ outcome â†’ `leads.status` update â†’ activity timeline entry, within the 60s SLA P95.
2. Global suppression list integration â€” opt-outs cross-channel and cross-workspace.
3. DNC integration live for US (DNC.gov) at minimum; UK + CA can be staged but must be present for those launch markets per Doc 15.
4. TCPA quiet-hours + two-party-consent jurisdiction handling.
5. Twilio fallback fully wired, tested under simulated RevTry outage.
6. Voice minute metering + overage roll-up to v1 PRD 4 invoices verified to the cent.
7. Recording + transcript storage encrypted at rest, signed-URL access with `pii_access_recorded` emission.
8. Persona library populated for every Day-90 launch vertical Ã— launch language.
9. Kill switches: `killswitch.revtry.global`, `killswitch.revtry.<vertical>`, `killswitch.revtry.<region>` (Doc 08 Â§362 naming).
10. Reconciliation: `revtry_calls` rows vs `lead_revtry_call_completed` Kafka offsets â†” `voice_minute_ledger` â€” clean for 7 days pre-launch (Doc 03 Â§C.5).
11. SEV-2 + SEV-1 runbooks (Doc 08 Â§306) for vendor outage scenarios.

## 11. Post-launch enhancements

- Real-time agent assist for human handoffs ("the AI is whispering objection responses to the human").
- A/B testing for personae per vertical (driven by v2 PRD 10 weights).
- Predictive dial scheduling ("best-time-to-call" model per persona Ã— geo Ã— industry).
- Multi-party calls (3-way for sales-engineer assist).
- Inbound auto-routing rules ("if caller mentions pricing, route to billing-trained persona").
- Live transcription streamed to the CRM page for users watching the call in real time.
- WebRTC widget on the funnel page â€” visitor clicks "Talk now", connects in-browser to the AI agent.
- Conversational-intelligence dashboard (objection frequency, win-correlated phrases).

## 12. Test plan

**Unit**
- Opt-out keyword tokenizer (5,000-utterance corpus).
- DNC pre-check matcher (positive + negative + delta-sync race).
- AMD classifier (held-out audio set).
- Minute-meter math: cents-precise over fuzzed call durations + jurisdictional rate cards.
- Jurisdiction-router (number â†’ country â†’ TCPA rules) for every Doc 15 launch market.

**Integration**
- RevTry happy-path: lead â†’ dial â†’ connect â†’ consent preamble â†’ qualify â†’ emit events.
- Failover drill: kill RevTry adapter mid-call (in-flight calls complete on RevTry, new calls cut to Twilio); cut-back after stable window.
- DNC race: capture happens between DNC delta-sync windows; second attempt blocked.
- Recording + transcript pipeline: end-to-end with PII redaction asserted on a synthetic-PII test recording.
- Agency pool: parent + 3 subs concurrently dial; meter sums to parent pool until exhausted; then per-sub falloff.

**E2E**
- Funnel publish â†’ visitor capture â†’ RevTry dial â†’ answer â†’ opt-out â†’ suppression-list entry â†’ second capture from same number â†’ block â†’ SMS attempt suppressed too.
- Inbound call flow: PSTN call into the workspace RevTry number â†’ menu â†’ qualify â†’ book â†’ calendar event landed via v1 PRD 3.

**Load**
- 500 concurrent dials sustained 10 min; speed-to-lead SLA held; no double-dial; minute meter consistent.

**Chaos**
- Region failover: kill the US-East voice cluster; EU-West backup picks up; opt-outs survive.
- Twilio rate-limit during fallback: graceful queue + ops alert.

---

# PRD 7 â€” Ad Publishing

**Workstream owner:** Ads squad (Tech lead + 2 BE + 2 FE + 1 ML eng for creative variant ranking + 1 compliance eng partner)
**Source-of-truth services:** `ads-svc`, `creative-svc`, `audience-svc`, `pixel-svc`, `ad-policy-svc` (pre-flight compliance), `ad-rejection-resolver-svc`, `attribution-svc`.
**Cross-PRD interactions:** consumes creatives from v1 PRD 2 (Image / Video / Ad Copy agents); publishes to platforms with creative IDs stored in `ad_campaigns.creative_asset_ids` (Doc 03 Â§B.13); budget guardrails read from v1 PRD 4 (plan tier); conversion events feed v2 PRD 10 learning pipeline; rejections route notifications via v2 PRD 9.

## 1. Module overview

Ad Publishing connects FunelAI workspaces to the eight launch ad platforms â€” Meta (Facebook + Instagram), Google (Search + Display + YouTube + Performance Max), TikTok, LinkedIn, X (Twitter), Pinterest, Snap, Reddit â€” via OAuth, and orchestrates campaign creation, creative variant generation (5â€“10 per platform), audience targeting, budget pacing, and conversion tracking. The Generation Engine (v1 PRD 2) produces a *creative bank* (copy + image + video assets per platform aspect ratio); `creative-svc` selects 5â€“10 variants for the chosen platforms based on each platform's spec (Meta Reels 9:16, Google Display 1.91:1 + 1:1, TikTok 9:16, LinkedIn 1:1, X 1.91:1, Pinterest 2:3, Snap 9:16, Reddit 1.91:1). `audience-svc` proposes 1â€“3 audiences using each platform's targeting (interest + lookalike + custom-audience) based on the `business_profile_versions.payload.audience_hints` (v1 PRD 1) plus historical conversion data (v2 PRD 10).

Budget guardrails: new ad accounts (workspace Ã— platform combo with no prior spend) are capped at $50/day for the first 7 days; after 7 days of clean spend (no fraud signals, no rejection rate spike), the cap auto-lifts to the workspace's plan-tier limit (Starter $200/day, Growth $1,000, Scale $5,000, Agency uncapped). Pre-flight compliance runs *before* the platform API call: `ad-policy-svc` checks the creative against Meta Advertising Policies (text overlay %, prohibited categories, before/after restrictions), Google Ads Policies (misrepresentation, dangerous products), TikTok Branded Content + Ad Policies, and platform-specific quirks (X political-ads ban in launch markets per Doc 15, LinkedIn restricted categories). Pre-flight uses a hybrid LLM + rules engine; rules in `packages/ad-policy/rules/<platform>.yaml` are versioned. Failures route to v2 PRD 10's compliance-learning hook (rejection reasons feed back into KB).

Once live, `ads-svc` auto-rotates creative on a `winners-stay / losers-pause` policy (default: pause after 50 impressions with CPC > 2Ã— campaign-avg OR CTR < 50% of campaign-avg, and refresh frontier when 3+ creatives are paused), scales winners by reallocating 20% of budget per day to the top-2 creatives (capped at 70% concentration), and pulls performance metrics every 30 min via each platform's reporting API. Conversion tracking uses GA4 + Meta Pixel + TikTok Pixel + LinkedIn Insight Tag + Pinterest Tag + Snap Pixel + Reddit Pixel (client-side) plus server-side fallback via the Conversion API equivalents (Meta CAPI, Google Enhanced Conversions, TikTok Events API, LinkedIn CAPI) for iOS / cookie-blocked traffic. Pixel install is one-click â€” `pixel-svc` injects the chosen platform tags into every published funnel via the funnel renderer's `<head>` slot (v1 PRD 2 publish hook), with per-platform consent gating (GDPR/EU users see a CMP banner before pixels fire).

When a platform rejects an ad, `ad-rejection-resolver-svc` parses the rejection text, classifies it against a known-cause taxonomy (e.g. `prohibited_text_in_image`, `misleading_claim`, `before_after_health`, `policy_personalization_attributes`), and attempts an *auto-fix* (e.g. regenerate the image without the offending text overlay, soften the claim using the Compliance agent â€” v1 PRD 2). If auto-fix succeeds and re-passes pre-flight, the campaign is automatically re-submitted; if not, the user gets a friendly explanation + a one-click "regenerate with these constraints" CTA.

## 2. User stories

1. **GIVEN** a `funnel_published` event (Doc 03 Â§A.3) for a Growth-tier workspace **WHEN** the user clicks "Run ads on Meta" **THEN** OAuth is checked (re-prompt if expired), `ad_campaign_created` (Doc 03 Â§A.4 #1) is emitted with `platform='meta'`, 7 creative variants are generated for the platform's aspect ratios, and the campaign enters `status='draft'` until pre-flight + user confirm.
2. **GIVEN** a draft campaign **WHEN** the user clicks "Launch" **THEN** `ad-policy-svc` runs pre-flight; on PASS, the campaign is submitted to the platform's API and `ad_campaign_launched` (Doc 03 Â§A.4 #2) is emitted; on FAIL, the user is shown the failing creative + the specific rule and offered "fix it for me" (auto-regen) or "edit manually".
3. **GIVEN** the workspace has no prior spend on TikTok **WHEN** the user tries to set a daily budget of $300 **THEN** the slider clamps to $50/day with a banner "New-account guardrail â€” auto-lifts to your plan limit after 7 days of clean spend".
4. **GIVEN** a campaign has been running for 48h **WHEN** the rotation policy fires **THEN** the worst creative (per Â§1's rule) is paused, `ad_campaign_paused` (Doc 03 Â§A.4 #3) is emitted with `auto_pause_rule_id=rotation.cpc_2x_above_avg`, and budget reallocates to the top performer.
5. **GIVEN** a platform returns a rejection on a creative **WHEN** the webhook arrives **THEN** `ad_rejected` (Doc 03 Â§A.4 #4) is emitted, `ad-rejection-resolver-svc` classifies the reason, attempts an auto-fix once, and either auto-resubmits OR notifies the user via v2 PRD 9 with the parsed reason + the regenerate CTA.
6. **GIVEN** a workspace owner clicks "Install Meta Pixel" **WHEN** they confirm **THEN** `pixel-svc` adds the pixel to every funnel in the workspace via the publish-hook, the pixel ID is stored on the workspace, and a verification ping is sent to confirm the pixel fires on the live funnel within 60 s.
7. **GIVEN** an EU visitor (GeoIP) loads a funnel **WHEN** the pixel slot would fire **THEN** the consent gate intervenes; the pixel does not fire until the visitor accepts the cookie banner (Doc 05b privacy + GDPR); on accept, the pixel + server-side fallback fire together.
8. **GIVEN** a conversion fires on a funnel **WHEN** client-side pixels are blocked (Safari ITP, ad-blockers, iOS 17) **THEN** the server-side fallback (Meta CAPI, etc.) sends the event with the hashed contact identifiers from the lead capture; deduplication keys ensure single attribution.
9. **GIVEN** a campaign has been live â‰¥ 7 days with no rejections + clean spend **WHEN** the nightly guardrail review job runs **THEN** the daily-budget cap auto-lifts to the workspace's plan tier limit; `ads_guardrail_lifted` (**NEW**, A.4) is emitted.
10. **GIVEN** a user is on Free tier **WHEN** they try to publish ads **THEN** the action is refused with the upgrade prompt; OAuth completes but no campaign is created (`feature_locked` event â€” Doc 08 internal).
11. **GIVEN** an X (Twitter) campaign in a launch market where political ads are banned **WHEN** the AI classifies the copy as political-adjacent **THEN** pre-flight blocks with the X policy reference; the user is shown the policy text + a "rewrite as non-political" CTA.
12. **GIVEN** a campaign's lifetime spend approaches the platform's billing-account spend cap **WHEN** the threshold crosses 80% **THEN** v2 PRD 9 notifies the workspace owner + billing role; at 100%, the platform auto-pauses; we mirror the state to `ad_campaigns.status='paused'`.
13. **GIVEN** the user wants to scale a winning creative **WHEN** they click "2Ã— the budget" **THEN** the request is bounded by plan-tier daily cap and platform-side limits; if the request exceeds the cap, it's clamped to the cap with a banner.
14. **GIVEN** a connected platform's OAuth token expires **WHEN** the next API call returns 401 **THEN** silent refresh attempts; on failure, the campaign continues (already-launched ads keep running platform-side), the user is notified to reconnect, and **outbound writes** (pauses, edits) are queued for replay until reconnect.
15. **GIVEN** a workspace is suspended (v1 PRD 4 dunning D14) **WHEN** ads are running **THEN** all platforms are paused via API; `ad_campaign_paused` emitted with `reason='account_suspended'`; on `account_restored`, ads remain paused (user must explicitly resume) for safety.

## 3. Edge cases (â‰¥ 15)

1. Platform API rate-limit during bulk pause â†’ exponential backoff with jitter; user-facing UI shows "we're pausing your adsâ€¦ this may take a minute" with a progress bar.
2. Image agent (v1 PRD 2) produces a creative containing > 20% text overlay (Meta's classic guideline; relaxed but still scored) â†’ pre-flight downgrades the predicted reach in the variant ranker; user is warned but not blocked.
3. Two creatives have nearly identical CTR after 1,000 impressions â†’ tie-break by CPM, then by impression recency; do not auto-pause a tie.
4. A creative paused by auto-rotation is manually un-paused by the user â†’ annotate the manual override; the auto-rotation policy will not re-pause that creative for 24h.
5. Pixel install on a custom-domain funnel where the DNS isn't fully proxied through Cloudflare â†’ fallback to a server-side proxy endpoint at `https://t.<funnel-domain>/...`; user sees a "pixel verified via server-side proxy" badge.
6. Meta CAPI access token expired AND client-side pixel is also blocked â†’ conversion is lost client-side; we still record the conversion server-side from our own `checkout_paid` event (Doc 03 Â§A.6); workspace dashboard shows "attribution incomplete" badge.
7. Conversion fires but the lead's hashed contact doesn't match any pixel event in the platform's lookback window â†’ store the event with `attribution_status='unmatched'`; v2 PRD 10 learns from these to tune the CAPI dedup window.
8. A platform returns a rejection that our classifier doesn't recognize â†’ store the raw reason text, route to a human review queue in the admin console (v1 PRD 5), flag in v2 PRD 10 as a new rejection-type signal.
9. Audience suggestion includes a "sensitive interest" category that's prohibited on Meta (e.g. health-condition-derived) â†’ audience builder filters these out automatically; if the user manually adds one, pre-flight blocks.
10. Pinterest's video aspect ratio requirement changes mid-flight (rare but happens) â†’ the creative selector reads platform spec from a live config (`packages/ads/specs/<platform>.json`); a spec update doesn't break existing campaigns but new ones use the new spec.
11. User connects a Meta Business account they don't own (admin role insufficient) â†’ OAuth callback validates `ads_management` scope on the *target* ad account; if missing, the user is told exactly which scope to request.
12. Server-side conversion firing duplicates a client-side conversion â†’ deduplication key `event_id = sha256(funnel_id + lead_id + 'purchase' + timestamp_ms_rounded_minute)`; both sides send the same `event_id`; platform de-dupes.
13. A creative auto-fix attempt makes the copy *less* compliant (rare LLM regression) â†’ re-run pre-flight; if worse, do not submit; surface to user with both versions side-by-side.
14. The same user runs the same funnel in two workspaces and connects the same Meta ad account â†’ block with a clear "this ad account is already linked elsewhere" message; require disconnect-first.
15. Reddit's daily reporting API returns yesterday's metrics late (after 30-min poll) â†’ rotation policy uses a 72h sliding window; never thrash on stale data.
16. Platform-side billing-method change (user's card on file on Meta expired) â†’ we don't manage the platform's billing, but we surface the rejection-style notification via v2 PRD 9 and show a "fix billing on Meta" deep-link.
17. A campaign created in workspace A is later cloned to workspace B â†’ creative asset IDs are deep-copied (new asset rows), platform-side IDs are *not* (new submission per platform); pre-flight runs again for B.
18. A creative includes a celebrity likeness flagged by the Image agent's safety filter â†’ pre-flight blocks before submission with `policy_id=meta.misrepresentation.celebrity`.
19. User uploads custom creative bypassing the AI variants â†’ pre-flight still runs (we never bypass policy checks).
20. A scaling action would exceed Doc 07c Â§3.1 per-workspace ad-spend ceiling for the day â†’ cap and notify; do not silently exceed.

## 4. API dependencies

**Internal**
- `ads-svc` (this PRD): campaign + budget orchestration.
- `creative-svc` (this PRD): variant management.
- `audience-svc` (this PRD): targeting + lookalike construction.
- `pixel-svc` (this PRD): tag injection + server-side adapters.
- `ad-policy-svc` (this PRD): pre-flight compliance + auto-fix.
- `ad-rejection-resolver-svc` (this PRD): rejection classification + remediation.
- `attribution-svc` (this PRD): conversion dedup + multi-touch.
- `funnel-svc` (v1 PRD 2): publish hook for pixel injection.
- `lead-svc` (v1 PRD 3): hashed contact identifiers for CAPI events.
- `oauth-svc`: connection tokens for all 8 platforms.
- `feature-flags`: `release.ads.<platform>.v1`, `killswitch.ads.<platform>`, `killswitch.ads.global`.

**External (via PAL â€” Doc 04)**
- Meta Marketing API (campaign + ads + insights) + Meta Conversions API.
- Google Ads API + Google Analytics 4 Measurement Protocol + Enhanced Conversions.
- TikTok Marketing API + TikTok Events API.
- LinkedIn Marketing Developer Platform + LinkedIn CAPI.
- X (Twitter) Ads API.
- Pinterest Ads API + Conversions API.
- Snap Marketing API + CAPI.
- Reddit Ads API + Conversions API.
- Cloudflare Workers (server-side pixel proxy on funnel domains).

## 5. Database tables / objects touched

- `ad_campaigns` (Doc 03 Â§B.13) â€” read + write.
- `assets`, `asset_versions` (Doc 03 Â§B.10) â€” creatives.
- `funnels`, `funnel_versions` (Doc 03 Â§B.4) â€” publish hook.
- `integration_connections` (Doc 03 Â§B.11) â€” OAuth.
- `workspace_ledger` â€” ad-spend metering.
- `audit_log`.

**New helper schemas (must land in Doc 03 Â§B):**

```sql
CREATE TABLE ad_creatives (
  id              TEXT PRIMARY KEY,           -- adcr_â€¦
  workspace_id    TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  campaign_id     TEXT REFERENCES ad_campaigns(id) ON DELETE CASCADE,
  platform        TEXT NOT NULL,
  aspect_ratio    TEXT NOT NULL,
  asset_id        TEXT NOT NULL,              -- references assets.id
  external_creative_id TEXT,
  status          TEXT NOT NULL DEFAULT 'draft', -- 'draft','active','paused','rejected','retired'
  rejection_code  TEXT,
  rejection_text  TEXT,
  impressions     BIGINT NOT NULL DEFAULT 0,
  clicks          BIGINT NOT NULL DEFAULT 0,
  spend_micros    BIGINT NOT NULL DEFAULT 0,
  conversions     BIGINT NOT NULL DEFAULT 0,
  paused_by_rule_id TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX adcr_campaign_status_idx ON ad_creatives (campaign_id, status);
CREATE INDEX adcr_workspace_platform_idx ON ad_creatives (workspace_id, platform);
ALTER TABLE ad_creatives ENABLE ROW LEVEL SECURITY;
CREATE POLICY adcr_tenant ON ad_creatives
  USING (workspace_id = current_setting('app.workspace_id', true));

CREATE TABLE ad_pixels (
  id              TEXT PRIMARY KEY,
  workspace_id    TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  platform        TEXT NOT NULL,            -- 'meta','google_ga4','tiktok','linkedin','pinterest','snap','reddit'
  pixel_id        TEXT NOT NULL,
  capi_token_ref  TEXT,                       -- KMS key ref, not the raw token
  verified_at     TIMESTAMPTZ,
  enabled         BOOLEAN NOT NULL DEFAULT TRUE,
  consent_gate    BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE UNIQUE INDEX adpx_unique ON ad_pixels (workspace_id, platform);

CREATE TABLE ad_guardrails (
  workspace_id    TEXT NOT NULL,
  platform        TEXT NOT NULL,
  cap_daily_micros BIGINT NOT NULL,
  expires_at      TIMESTAMPTZ,
  reason          TEXT NOT NULL,
  PRIMARY KEY (workspace_id, platform)
);

CREATE TABLE ad_rejection_reasons (
  code            TEXT PRIMARY KEY,            -- 'prohibited_text_in_image','misleading_claim',...
  platform        TEXT NOT NULL,
  description     TEXT NOT NULL,
  auto_fix_strategy TEXT,                      -- 'regenerate_image_no_text','soften_copy','remove_audience_attr'
  policy_doc_url  TEXT,
  active          BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE conversion_events (
  id              TEXT PRIMARY KEY,
  workspace_id    TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  funnel_id       TEXT REFERENCES funnels(id) ON DELETE SET NULL,
  lead_id         TEXT REFERENCES leads(id) ON DELETE SET NULL,
  event_id_dedup  TEXT NOT NULL,               -- shared with platform dedup
  event_name      TEXT NOT NULL,               -- 'lead','purchase','add_to_cart',...
  value_micros    BIGINT,
  currency        CHAR(3),
  occurred_at     TIMESTAMPTZ NOT NULL,
  sources         TEXT[] NOT NULL DEFAULT '{}', -- 'client','server'
  attribution_status TEXT NOT NULL DEFAULT 'pending', -- 'pending','matched','unmatched'
  raw_blob        JSONB
);
CREATE UNIQUE INDEX cev_dedup_unique ON conversion_events (workspace_id, event_id_dedup);
CREATE INDEX cev_funnel_occurred_idx ON conversion_events (funnel_id, occurred_at DESC);
ALTER TABLE conversion_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY cev_tenant ON conversion_events
  USING (workspace_id = current_setting('app.workspace_id', true));
```

## 6. Telemetry events emitted

| Event | Family | When |
|---|---|---|
| `ad_campaign_created` (A.4 #1) | A.4 | Campaign draft persisted. |
| `ad_campaign_launched` (A.4 #2) | A.4 | Platform accepts submission. |
| `ad_campaign_paused` (A.4 #3) | A.4 | Auto-rotation, manual, or platform-side pause. |
| `ad_rejected` (A.4 #4) | A.4 | Rejection received from platform. |
| `ads_guardrail_lifted` **NEW** (A.4) | A.4 | Daily-cap auto-lift after 7 clean days. Add to Doc 03. |
| `ad_creative_rotated` **NEW** (A.4) | A.4 | A creative auto-paused + a new one auto-introduced. Add to Doc 03. |
| `ad_policy_preflight_blocked` **NEW** (A.4) | A.4 | Pre-flight blocks before submission. Includes `policy_id`. Add to Doc 03. |
| `ad_pixel_installed` **NEW** (A.4) | A.4 | Pixel-svc verified pixel firing on the live funnel. |
| `ad_pixel_verification_failed` **NEW** (A.4) | A.4 | 60 s verification ping did not see the pixel fire. |
| `conversion_recorded` **NEW** (A.6) | A.6 | A conversion attributed (client or server side). Add to Doc 03 Â§A.6. |
| `attribution_mismatch_detected` **NEW** (A.6) | A.6 | Client + server attribution diverge on the same dedup key. |
| `compliance_block_raised` (A.2 already) | A.2 | When ad creative is blocked at pre-flight; `policy_id = ads.<platform>.<rule>`. |

## 7. Permissions enforced

| Capability | owner | admin | editor | analyst | viewer | billing |
|---|---|---|---|---|---|---|
| Connect / disconnect platform OAuth | âœ… | âœ… | âŒ | âŒ | âŒ | âŒ |
| Create / launch campaign | âœ… | âœ… | âœ… | âŒ | âŒ | âŒ |
| Pause / resume campaign | âœ… | âœ… | âœ… | âŒ | âŒ | âŒ |
| Change daily budget (within guardrail) | âœ… | âœ… | âœ… | âŒ | âŒ | âŒ |
| Override guardrail (request lift) | âœ… | âŒ | âŒ | âŒ | âŒ | âŒ |
| Install / remove pixel | âœ… | âœ… | âŒ | âŒ | âŒ | âŒ |
| View ad metrics + reports | âœ… | âœ… | âœ… | âœ… | âœ… | âŒ |
| View ad spend + invoices | âœ… | âœ… | âŒ | âœ… | âŒ | âœ… |
| Approve auto-fix retry | âœ… | âœ… | âœ… | âŒ | âŒ | âŒ |

Admin-console: `support` can view; `engineering` can replay pre-flight + retry rejection-resolver; `super_admin` can force-launch (bypassing guardrails â€” audited, requires `justification_ticket_id`).

## 8. Error states + recovery paths

| State | Behavior | Recovery |
|---|---|---|
| OAuth expired | Outbound writes queued, ads keep running; banner asks to reconnect | User reconnects |
| Platform API rate-limit | Backoff with jitter; UI shows pacing message | Auto |
| Platform API outage | New campaigns queue; existing keep running; v2 PRD 9 banner | Auto on recovery |
| Pre-flight blocks | UI shows reason + auto-fix CTA | User-initiated regen or manual edit |
| Auto-fix exhausted retries | User notified via v2 PRD 9 with manual edit CTA | User-initiated |
| Pixel verification fails after 60 s | Banner + diagnostic ("blocked by CSP", "DNS not proxied", etc.) | User-initiated fix |
| Conversion event dedup collision (same `event_id`, different payloads) | Reject second write, log to `attribution_mismatch_detected` | Manual triage |
| Guardrail lift would exceed Doc 07c ceiling | Refuse lift; offer upgrade | User-initiated |
| Account suspended (v1 PRD 4) | All platforms paused via API + mirrored to our state | On restore, manual resume |
| Platform-side billing failure on customer's ad account | We surface the platform's message; no auto-fix possible | User fixes on platform |

## 9. Acceptance criteria

- [ ] All 8 platforms have a working OAuth + campaign-create + creative-submit + pause-resume + insights-poll loop.
- [ ] Pre-flight compliance: precision â‰¥ 0.90 on a 500-case held-out rejection corpus across the 8 platforms.
- [ ] Auto-fix succeeds on â‰¥ 60% of recognized rejection codes after a single fix attempt.
- [ ] New-account guardrail enforced; auto-lift after 7 days verified by clock-injected integration test.
- [ ] Auto-rotation policy: deterministic on a fixture campaign with controlled metrics; no thrash; verified by simulation.
- [ ] Pixel install: one-click for each of the 7 client-side platforms; verification ping within 60 s; server-side CAPI dual-fire when client blocked.
- [ ] Consent gating: EU IPs see CMP before pixels fire; verified end-to-end with a GeoIP test.
- [ ] Conversion dedup: client + server fire the same `event_id`; `conversion_events.event_id_dedup` unique constraint enforced.
- [ ] All events in Â§6 emitted with correct envelope; **NEW** events landed in Doc 03 Â§A with retention rows.
- [ ] RLS on `ad_creatives`, `ad_pixels`, `conversion_events`; verified by `__rls_tests__/ads.test.ts`.
- [ ] OAuth tokens stored encrypted at rest (KMS-wrapped); raw token never logged.
- [ ] Coverage â‰¥ 85% on `ads-svc`, `ad-policy-svc`, `ad-rejection-resolver-svc`, `pixel-svc`.
- [ ] Kill switches: `killswitch.ads.global` stops new submissions; existing keep platform-side.

## 10. Launch blockers

1. Meta + Google + TikTok end-to-end (other 5 platforms can be staged in Â§11 if needed, but Doc 15 requires at least Meta + Google + TikTok per launch market).
2. OAuth + connection management with scope verification + silent refresh.
3. Pre-flight compliance for the 3 must-launch platforms with auto-fix wired.
4. New-account guardrail + auto-lift.
5. Auto-rotation + budget reallocation engine.
6. Pixel install (client + server-side) for Meta + Google + TikTok + GA4.
7. Conversion dedup verified across client + server paths.
8. Rejection classifier + admin escalation path (v1 PRD 5 admin console).
9. RLS + audit on every write.
10. Kill switches per Doc 08 Â§362.
11. Doc 15 ad-policy quirks (X political-ban market, LinkedIn restricted categories) enforced server-side.

## 11. Post-launch enhancements

- Multi-objective optimization (cost + brand-safety + diversification across platforms via Pareto frontier).
- Cross-platform attribution modeling (data-driven attribution across 8 platforms).
- Predictive ad-fatigue scoring (per creative Ã— audience pair).
- Creative variant tournament UI (let users see the bracket).
- Influencer + UGC ad ingestion (TikTok Spark Ads, Meta Branded Content).
- Audience overlap reporter (Meta audience overlap analysis for waste reduction).
- "Spend-of-record" mode where FunelAI becomes the billing-of-record (regulatory considerations; not Day 90).
- Reddit, X, Pinterest, Snap full feature parity with Meta/Google.

## 12. Test plan

**Unit**
- Pre-flight rule matchers (per platform YAML rule files).
- Auto-rotation policy on synthetic metric streams.
- Conversion-event dedup hashing.
- Audience suggestion exclusion of sensitive categories.

**Integration**
- OAuth flow per platform with mocked OAuth providers + scope verification edge cases.
- Campaign create â†’ creative submit â†’ metrics poll â†’ rotation â†’ pause loop on a fixture sandbox account.
- CAPI dual-fire with simulated client-block (ITP, ad-blocker, iOS).
- Rejection-resolver: feed the 50-case rejection corpus; assert auto-fix outcomes.
- Guardrail lift after 7 clean days using clock injection.

**E2E**
- Funnel publish â†’ install Meta + Google pixels â†’ run Meta + Google campaign for a synthetic conversion â†’ conversion attributed to Meta with dedup against client + server.
- Account suspend (v1 PRD 4 D14) â†’ all platforms pause via our orchestrator â†’ suspend lifts â†’ user must explicitly resume.

**Load**
- 100 simultaneous campaign-launches across 8 platforms; rate-limit handling holds; no double-submission.
- 10k conversions/min sustained 10 min; dedup correctness; lag < 5 s P95.

**Chaos**
- Platform API outage drill per platform; existing campaigns continue, new ones queue, recovery clean.

---

# PRD 8 â€” Email + SMS Engine

**Workstream owner:** Lifecycle squad (Tech lead + 2 BE + 1 FE + 1 deliverability eng + 1 SRE partner)
**Source-of-truth services:** `lifecycle-svc` (sequence orchestrator), `email-send-svc` (SendGrid primary, Resend failover), `sms-send-svc` (Twilio), `suppression-svc`, `deliverability-monitor-svc`, `a2p-registration-svc`, `domain-auth-svc` (SPF/DKIM/DMARC), `unsubscribe-svc`, `send-time-optimizer-svc`, `twilio-lookup-svc` (pre-send verification).
**Cross-PRD interactions:** consumes sequences generated by v1 PRD 2 (Email + SMS agents); triggers on `lead_captured` from v1 PRD 3; respects suppression list from v1 PRD 3 Â§global; sends from verified domains configured during onboarding (v1 PRD 1); notification deliveries cross-reference v2 PRD 9; bounce/complaint signals feed v2 PRD 10 learning.

## 1. Module overview

The Email + SMS Engine ships the post-capture lifecycle: a 7-touch email nurture + 3-touch SMS sequence per industry, time-zone-aware, A2P 10DLC-registered for SMS in the US (and equivalent registration paths per Doc 15 for CA â€” registered keyword/STOP support, UK â€” short-code/long-code policy, AU â€” sender ID), with per-recipient opt-in tracking, one-click unsubscribe (CAN-SPAM list-unsubscribe + Gmail/Yahoo One-Click), and a global suppression list synced from bounces, complaints, opt-outs, and DSARs. Templates are pulled from KB packs (v1 PRD 1) and rendered per-recipient with `business_profile_versions.payload` interpolation; the `lifecycle-svc` orchestrator advances each recipient through the sequence steps based on triggers (`lead_captured`, `lead_qualified`, `lead_booking_canceled`, etc.) and conditions (clicked link, replied, opened, no-action).

Sending is multi-provider via PAL: email primary is SendGrid (high deliverability + Inbox Placement Reports), failover is Resend; SMS is Twilio (with carrier diversity through Twilio's own routing). Send-time optimization uses a per-recipient model (`send-time-optimizer-svc` â€” initially a heuristic based on the recipient's local-business-hours timezone + day-of-week; replaced by a learned model from v2 PRD 10 in Month 3+). Domain authentication is required for custom domains before *any* email is sent from that domain: `domain-auth-svc` verifies SPF, DKIM, DMARC, and BIMI (optional). The default `mail.funelai.com` sender works without setup but enforces a deliverability-protective rate limit per workspace.

SMS-spam prevention is a hard requirement before the first SMS for a given recipient: `twilio-lookup-svc` performs a Lookup v2 query (line-type, carrier, fraud risk) before sending â€” if the number is mobile + carrier-known + fraud-risk-low, send proceeds; if it's a known landline OR VOIP-disposable OR carrier-unknown OR fraud-risk-high, the SMS is skipped and replaced with an email touch. A2P 10DLC registration is required per workspace per use-case (Marketing, OTP, Account Notification); registration status is tracked in `a2p_brand_registrations` (new table) and SMS is blocked until the relevant use-case is registered + approved (typically 3â€“5 days lead time). All SMS payloads include TCPA opt-out language ("Reply STOP to opt out") on the first message of every sequence; STOP/UNSUBSCRIBE/CANCEL/END/QUIT keywords (plus the multilingual variants per Doc 15) trigger a global suppression-list entry.

Delivery logs are visible in the admin console (v1 PRD 5) and surface per-message: queued, sent, delivered, bounced (hard/soft), complained, opened, clicked, replied, unsubscribed. Admins can resend an individual message (`super_admin` + `pii:read` scope; audited via `pii_access_recorded` + a new `admin_message_resent` event). Suppression-list sync: every bounce (hard or 5-soft-in-30d), every complaint, every opt-out keyword, and every DSAR-driven deletion writes to `suppression_list` (Doc 03 Â§B.16) and propagates within 60 s to all in-flight sequences (the lifecycle worker re-checks suppression on every step transition, not just at enroll-time).

## 2. User stories

1. **GIVEN** a `lead_captured` event for a workspace with sequences configured **WHEN** the lifecycle worker enrolls the lead **THEN** the 7-touch email + 3-touch SMS sequence start clocks are scheduled per the recipient's local timezone, suppression is checked, and the first touch is queued.
2. **GIVEN** a lead with `email_sha256` already on the global suppression list (`channel='email'`) **WHEN** enrollment runs **THEN** the lead skips all email touches but proceeds with SMS (if not suppressed) and call (if not suppressed); `sequence_enrollment_skipped` (**NEW**, A.5) is emitted with the channel + reason.
3. **GIVEN** the workspace has not yet authenticated its custom domain **WHEN** the user tries to enable sending from that domain **THEN** the UI shows the DNS records to add (SPF + DKIM + DMARC), a "verify now" button, and blocks sends from that domain until `domain_auth_verified` (**NEW**, A.4) is emitted.
4. **GIVEN** the recipient's local time is outside the workspace's configured send window (default: 8 AM â€“ 9 PM recipient local, weekdays only for marketing) **WHEN** the next touch is due **THEN** the send is deferred to the next allowed slot; if the deferment exceeds the sequence's max-stretch (default: +72h), the touch is skipped and the next one re-schedules from the original baseline.
5. **GIVEN** an SMS touch is the first message to a recipient **WHEN** the worker prepares the send **THEN** `twilio-lookup-svc` is called; if the number is mobile + low-risk, send proceeds; if not, the touch is replaced with an extra email touch and `sms_skipped_for_email` (**NEW**, A.5) is emitted with the lookup verdict.
6. **GIVEN** an SMS reply contains the STOP keyword (case-insensitive, full-word) **WHEN** Twilio's webhook arrives **THEN** `lead_sms_opted_out` (Doc 03 Â§A.5 #5) is emitted, the lead is added to `suppression_list` with `channel='sms'`, an auto-acknowledgment is sent ("You're unsubscribed. Reply START to rejoin."), and all in-flight SMS sequences for this lead pause within 60 s.
7. **GIVEN** an email bounces hard (SMTP 5xx, permanent) **WHEN** the SendGrid webhook arrives **THEN** the `email_sha256` is added to suppression with `reason='bounce'`, the in-flight sequence pauses, and the workspace owner is notified if the workspace's bounce rate exceeds 2% over a rolling 24h window (deliverability protection).
8. **GIVEN** a recipient clicks the one-click list-unsubscribe (RFC 8058) **WHEN** the request arrives **THEN** the suppression entry is written, an `email_unsubscribed` event is emitted (**NEW**, A.5 â€” to be added to Doc 03), no acknowledgment email is sent (the recipient asked to be removed), and the activity timeline records the action.
9. **GIVEN** SendGrid is degraded (`deliverability-monitor-svc` health check fails) **WHEN** the next send is due **THEN** the message routes to Resend with the same template + headers; `email_provider_failover` (**NEW**, A.4) is emitted; PAL holds the new state until SendGrid health recovers + the debounce window passes.
10. **GIVEN** the workspace has registered A2P 10DLC Marketing use-case (approved) **WHEN** an SMS marketing touch is due **THEN** the send proceeds with the registered brand/campaign IDs in the carrier metadata; **GIVEN** the workspace has *not* registered **WHEN** an SMS touch is due **THEN** the send is held with a clear "complete A2P registration" CTA via v2 PRD 9; the lead continues with email touches.
11. **GIVEN** a recipient opens an email + clicks a link **WHEN** the events arrive **THEN** the sequence advances per condition rules (e.g. "if clicked â†’ skip next nurture touch and go directly to qualifier"); the activity timeline records both opens and clicks.
12. **GIVEN** a `super_admin` resends an individual message from the admin console **WHEN** they confirm with `justification_ticket_id` **THEN** the message is queued (with a `Resent` header annotation), `admin_message_resent` (**NEW**, A.8) is emitted, `pii_access_recorded` is emitted, and an audit row is written.
13. **GIVEN** the workspace owner toggles "Pause all sequences" **WHEN** they confirm **THEN** every in-flight sequence enters `paused` status within 30 s, no new touches send, and a banner shows the count of paused enrollments.
14. **GIVEN** the suppression list adds an entry for a lead **WHEN** the entry is < 60 s old **THEN** any in-flight send for that lead is canceled at the worker (right-before-send check, in addition to the at-enrollment check).
15. **GIVEN** an EU recipient with no granular marketing consent **WHEN** the worker tries to send a marketing email **THEN** the send is blocked with `compliance_block_raised` (Doc 03 Â§A.2 family) and `policy_id='email.gdpr.no_consent'`; transactional/operational emails (e.g. booking confirmation) are still allowed under legitimate interest.

## 3. Edge cases (â‰¥ 15)

1. Two workspaces send to the same email from the same custom-domain root (subdomain isolation broken) â†’ block; require unique sending subdomain per workspace.
2. SPF record exceeds 10 DNS lookups â†’ `domain-auth-svc` detects + offers SPF flattening guidance; never silently let an over-lookup SPF go live.
3. DKIM key rotation mid-flight (annual rotation) â†’ both keys (old + new) published in DNS for 7 days; signing uses the new one, verification accepts either; emit `dkim_key_rotated` operational event (Doc 08 Â§362).
4. DMARC reaches `p=quarantine` before SPF + DKIM align â†’ blocking config check before policy escalation; UI shows alignment status.
5. Twilio Lookup returns "carrier_unknown" â€” common in some emerging markets â†’ for Doc 15 launch markets, fall back to a country-specific allow-list of known mobile carriers; otherwise skip SMS.
6. SMS reply with "STOP" sent from a different number than the original recipient (someone else has their phone) â†’ still suppress that number (we have no way to know it's a different human); user can re-opt-in with START.
7. Recipient's timezone is unknown (no IP, no profile data) â†’ default to workspace's timezone; never assume UTC for marketing send.
8. Sequence has a "wait until weekday 9 AM" step but the recipient is in Riyadh (Sunâ€“Thu workweek) â†’ use the locale-aware weekday rules from the `Intl` library; UI explains this to the user.
9. A template references a variable that's not present in the lead's profile (`{{ first_name }}` missing) â†’ fall back to a configured default ("there" for first name); never send `Hi {{ first_name }}`.
10. An SMS template exceeds the 160-char single-segment limit â†’ either split per the workspace's preference (single segment hard-trim with ellipsis, or multi-segment with explicit user opt-in) â€” never silently send 4 segments.
11. The send-time optimizer suggests a time that conflicts with the recipient's stated "do not contact" window â†’ the explicit user-set window wins.
12. Domain DNS provider's nameserver query is slow â†’ DNS check uses 3 different resolvers (Cloudflare 1.1.1.1, Google 8.8.8.8, Quad9 9.9.9.9) and takes the majority outcome.
13. SendGrid + Resend both degraded simultaneously â†’ queue with TTL = 24 h; v2 PRD 9 SEV-2 banner; do not silently drop touches.
14. Carrier-side STOP keyword recognition (Twilio handles this server-side and never delivers the next message) â†’ we still emit `lead_sms_opted_out` from Twilio's webhook; idempotency on `(lead_id, keyword_received_at)`.
15. Recipient opens the email in Apple Mail with Mail Privacy Protection â†’ open event fires immediately on receipt (Apple proxies it); we de-emphasize open-based conditions for Apple-Mail recipients; the sequence still relies on click + reply for advancement.
16. Recipient replies "STOP" to a marketing email (not SMS) â†’ email-svc parses common opt-out words in replies and writes to suppression for that channel; sends an acknowledgment.
17. Workspace deletes a sequence mid-enrollment â†’ in-flight enrollments are paused; admin console shows the count + a "drain or cancel" choice.
18. Same lead enrolled twice from two different funnels in the same workspace â†’ dedup by `(workspace_id, lead_id, sequence_id)`; second enroll joins the first.
19. A list-unsubscribe one-click POST arrives but the recipient never opened the email (some prefetchers click everything) â†’ still suppress; CAN-SPAM mandates honoring unsubscribe regardless of intent inference.
20. Inbound A2P registration approval is rescinded by The Campaign Registry â†’ SMS is blocked immediately; v2 PRD 9 notifies; lead continues with email touches.

## 4. API dependencies

**Internal**
- `lifecycle-svc` (this PRD): sequence orchestrator (driven by Kafka triggers).
- `email-send-svc` (this PRD): send worker w/ template rendering.
- `sms-send-svc` (this PRD): same for SMS.
- `domain-auth-svc` (this PRD): SPF/DKIM/DMARC verification.
- `twilio-lookup-svc` (this PRD): pre-send verification.
- `a2p-registration-svc` (this PRD): brand/campaign registration with The Campaign Registry.
- `unsubscribe-svc` (this PRD): one-click + STOP processing.
- `deliverability-monitor-svc` (this PRD): bounce/complaint rate tracking + provider health.
- `send-time-optimizer-svc` (this PRD): per-recipient timing.
- `suppression-svc` (v1 PRD 3 shared).
- `notification-svc` (v2 PRD 9): workspace alerts on deliverability events.
- `feature-flags`: `release.lifecycle.v1`, `killswitch.email.send`, `killswitch.sms.send`, `killswitch.lifecycle.global`.

**External (via PAL â€” Doc 04)**
- SendGrid (email primary) + Resend (failover).
- Twilio (SMS â€” programmable messaging + Lookup v2 + STOP keyword handling).
- The Campaign Registry (A2P 10DLC US).
- Equivalent SMS regulators per Doc 15 launch markets (CTIA US, UK Mobile Industry Code, etc.).
- DNS resolvers (Cloudflare, Google, Quad9) for SPF/DKIM/DMARC checks.
- IPInfo / MaxMind for recipient geo + timezone (P1 only â€” no raw IP storage).

## 5. Database tables / objects touched

- `email_sequences`, `sms_sequences` (Doc 03 Â§B.14) â€” read.
- `suppression_list` (Doc 03 Â§B.16) â€” write.
- `consent_records` â€” read for marketing-consent gating.
- `leads`, `crm_contacts` (Doc 03 Â§B.5) â€” read.
- `audit_log`.

**New helper schemas (must land in Doc 03 Â§B):**

```sql
CREATE TABLE sequence_enrollments (
  id              TEXT PRIMARY KEY,           -- senr_â€¦
  workspace_id    TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  sequence_id     TEXT NOT NULL,              -- references email_sequences.id or sms_sequences.id
  sequence_type   TEXT NOT NULL CHECK (sequence_type IN ('email','sms')),
  lead_id         TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  current_step    INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'active',  -- 'active','paused','completed','suppressed','canceled'
  next_action_at  TIMESTAMPTZ,
  enrolled_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ
);
CREATE UNIQUE INDEX senr_unique ON sequence_enrollments (workspace_id, sequence_id, lead_id);
CREATE INDEX senr_next_action_idx ON sequence_enrollments (next_action_at) WHERE status = 'active';
ALTER TABLE sequence_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY senr_tenant ON sequence_enrollments
  USING (workspace_id = current_setting('app.workspace_id', true));

CREATE TABLE message_deliveries (
  id              TEXT PRIMARY KEY,
  workspace_id    TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  enrollment_id   TEXT REFERENCES sequence_enrollments(id) ON DELETE SET NULL,
  channel         TEXT NOT NULL CHECK (channel IN ('email','sms')),
  provider        TEXT NOT NULL,                 -- 'sendgrid','resend','twilio'
  external_message_id TEXT,
  template_id     TEXT,
  recipient_sha256 TEXT NOT NULL,
  sent_at         TIMESTAMPTZ,
  delivered_at    TIMESTAMPTZ,
  opened_at       TIMESTAMPTZ,
  clicked_at      TIMESTAMPTZ,
  bounced_at      TIMESTAMPTZ,
  bounce_type     TEXT,
  complained_at   TIMESTAMPTZ,
  unsubscribed_at TIMESTAMPTZ,
  cost_micros     BIGINT,
  status          TEXT NOT NULL DEFAULT 'queued',
  last_error      TEXT
);
CREATE INDEX msgd_workspace_sent_idx ON message_deliveries (workspace_id, sent_at DESC);
CREATE INDEX msgd_recipient_idx ON message_deliveries (recipient_sha256);
ALTER TABLE message_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY msgd_tenant ON message_deliveries
  USING (workspace_id = current_setting('app.workspace_id', true));

CREATE TABLE domain_authentications (
  id              TEXT PRIMARY KEY,
  workspace_id    TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  domain          TEXT NOT NULL,
  spf_status      TEXT NOT NULL DEFAULT 'pending',
  dkim_status     TEXT NOT NULL DEFAULT 'pending',
  dmarc_status    TEXT NOT NULL DEFAULT 'pending',
  bimi_status     TEXT NOT NULL DEFAULT 'not_configured',
  verified_at     TIMESTAMPTZ,
  last_checked_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX dauth_unique ON domain_authentications (workspace_id, domain);

CREATE TABLE a2p_brand_registrations (
  id              TEXT PRIMARY KEY,
  workspace_id    TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  brand_id_external TEXT,
  campaign_id_external TEXT,
  use_case        TEXT NOT NULL,                -- 'marketing','otp','account_notification'
  status          TEXT NOT NULL DEFAULT 'pending', -- 'pending','approved','rejected','revoked'
  submitted_at    TIMESTAMPTZ,
  approved_at     TIMESTAMPTZ,
  rejected_reason TEXT
);
CREATE UNIQUE INDEX a2p_unique ON a2p_brand_registrations (workspace_id, use_case);
```

## 6. Telemetry events emitted

| Event | Family | When |
|---|---|---|
| `lead_sms_sent` (A.5 #3) | A.5 | Send accepted by Twilio. |
| `lead_sms_delivered` (A.5 #4) | A.5 | Carrier-side delivery webhook. |
| `lead_sms_opted_out` (A.5 #5) | A.5 | STOP keyword received. |
| `email_sent` **NEW** (A.5) | A.5 | Send accepted by SendGrid/Resend. Add to Doc 03. |
| `email_delivered` **NEW** (A.5) | A.5 | Delivery webhook. |
| `email_opened` **NEW** (A.5) | A.5 | Open pixel fired. |
| `email_clicked` **NEW** (A.5) | A.5 | Wrapped link clicked. |
| `email_bounced` **NEW** (A.5) | A.5 | Hard or soft bounce. Includes `bounce_type`. |
| `email_complained` **NEW** (A.5) | A.5 | Recipient marked as spam (Yahoo/Gmail FBL). |
| `email_unsubscribed` **NEW** (A.5) | A.5 | One-click or reply-keyword. |
| `sequence_enrolled` **NEW** (A.5) | A.5 | Lead enrolled. |
| `sequence_enrollment_skipped` **NEW** (A.5) | A.5 | Suppression at enroll time. |
| `sequence_advanced` **NEW** (A.5) | A.5 | Step transition. |
| `sequence_paused` **NEW** (A.5) | A.5 | Manual or auto pause. |
| `sms_skipped_for_email` **NEW** (A.5) | A.5 | Twilio Lookup verdict not eligible. |
| `domain_auth_verified` **NEW** (A.4) | A.4 | SPF + DKIM + DMARC all green. |
| `email_provider_failover` **NEW** (A.4) | A.4 | PAL flipped to Resend. |
| `a2p_brand_approved` / `a2p_brand_rejected` **NEW** (A.9) | A.9 | The Campaign Registry decision. |
| `admin_message_resent` **NEW** (A.8) | A.8 | Admin resend action. |
| `compliance_block_raised` (A.2) | A.2 | GDPR / TCPA / CAN-SPAM blocks. |

## 7. Permissions enforced

| Capability | owner | admin | editor | analyst | viewer | billing |
|---|---|---|---|---|---|---|
| Configure / edit a sequence | âœ… | âœ… | âœ… | âŒ | âŒ | âŒ |
| Manually enroll / un-enroll a lead | âœ… | âœ… | âœ… | âŒ | âŒ | âŒ |
| Pause all sequences | âœ… | âœ… | âŒ | âŒ | âŒ | âŒ |
| Connect / verify sending domain | âœ… | âœ… | âŒ | âŒ | âŒ | âŒ |
| Submit / view A2P registration | âœ… | âœ… | âŒ | âŒ | âŒ | âŒ |
| View delivery logs (no body) | âœ… | âœ… | âœ… | âœ… | âœ… | âŒ |
| View delivery body | âœ… | âœ… | âœ… | âŒ | âŒ | âŒ |
| Resend a single message | âœ… | âœ… | âŒ | âŒ | âŒ | âŒ |
| Export delivery logs | âœ… | âœ… | âŒ | âœ… | âŒ | âŒ |

Admin-console: `support` view-only on delivery logs (no body); `engineering` retry sends from DLQ; `super_admin` resend a single message (with `pii:read` + `justification_ticket_id` â€” emits `admin_message_resent` + `pii_access_recorded`).

## 8. Error states + recovery paths

| State | Behavior | Recovery |
|---|---|---|
| SendGrid outage | Failover to Resend; banner | Auto cut-back |
| Both providers degraded | Queue with TTL 24h; SEV-2 banner | Manual |
| Twilio outage | Queue SMS; v2 PRD 9 SEV banner | Auto |
| A2P not registered | Block SMS use-case; UI prompt | User-initiated |
| Domain auth not verified | Block sends from that domain | User-initiated DNS fix |
| Bounce rate > 2% / 24h | Auto-pause new enrollments + workspace alert | Manual review |
| Complaint rate > 0.1% / 24h | Hard pause; deliverability eng on-call | Manual review |
| Suppression-list write failure | Fail closed on send | Manual escalation |
| Carrier blocks our brand short-code | Auto-pause SMS; A2P resubmission flow | Manual |
| Send-time optimizer service down | Fall back to workspace default window | Auto |

## 9. Acceptance criteria

- [ ] Sequence trigger latency P95 < 5 s from `lead_captured` to first enrollment row created.
- [ ] Suppression check correctness: every send checks suppression at enroll-time + right-before-send; verified by a 10k-message fuzz test with concurrent suppression writes.
- [ ] SPF / DKIM / DMARC verification correct on a fixture suite of 30 DNS configurations (correct, broken, ambiguous, lookup-exceeded).
- [ ] One-click list-unsubscribe (RFC 8058) implemented for every email; verified by a Gmail + Yahoo + Outlook delivery test.
- [ ] STOP keyword detection in 15 launch-market languages (Doc 15) with F1 â‰¥ 0.99.
- [ ] Twilio Lookup v2 pre-send verification on every first SMS to a recipient; verified by integration test.
- [ ] A2P 10DLC registration flow live; SMS Marketing use-case blocked until approval.
- [ ] Send-time optimizer respects DST + locale weekday rules (verified for the 10 launch markets).
- [ ] Provider failover (SendGrid â†’ Resend) < 30 s on health-check trip; verified by chaos test.
- [ ] Bounce/complaint rate auto-pause thresholds wired with workspace notification.
- [ ] All events in Â§6 emitted with correct envelope; **NEW** events landed in Doc 03 Â§A.
- [ ] RLS on `sequence_enrollments`, `message_deliveries`, `domain_authentications`, `a2p_brand_registrations`.
- [ ] Coverage â‰¥ 85% on `lifecycle-svc`, `email-send-svc`, `sms-send-svc`, `unsubscribe-svc`, `deliverability-monitor-svc`.

## 10. Launch blockers

1. Sequence enrollment + step advancement + suppression checks at enroll + right-before-send.
2. Email send via SendGrid with Resend failover; PAL health checks.
3. SMS send via Twilio with A2P 10DLC registration enforced.
4. Twilio Lookup v2 pre-send verification.
5. Domain auth (SPF + DKIM + DMARC) verification + blocking.
6. One-click unsubscribe (RFC 8058) + STOP keyword + global suppression-list write.
7. Bounce + complaint webhook handling + auto-pause thresholds.
8. Send-time optimizer + timezone correctness.
9. Admin delivery logs + resend action (audited).
10. Kill switches per Doc 08 Â§362.
11. Doc 15 multilingual STOP keywords for launch markets.

## 11. Post-launch enhancements

- Learned send-time model (v2 PRD 10 driven) replacing the heuristic.
- WhatsApp Business + Apple Business Messages channels.
- RCS messaging (where carrier support exists).
- Branded sender (BIMI) at-scale onboarding.
- Inbound email reply parsing â†’ CRM activity (currently only STOP-keyword reply is parsed).
- Variant testing within sequences (A/B subject lines).
- Multi-language sequence variants triggered by recipient locale.
- Predictive send-volume warmup automation (gradual sending volume ramp on new IPs/domains).

## 12. Test plan

**Unit**
- STOP keyword tokenizer across 15 languages.
- SPF/DKIM/DMARC parser + lookup counter.
- Twilio Lookup verdict â†’ send/skip decision tree.
- Send-time optimizer locale + DST handling.

**Integration**
- Enroll â†’ step 1 â†’ bounce â†’ step 2 (skipped) â†’ step 3 (skipped) â†’ suppression entry visible across workspaces.
- Provider failover: kill SendGrid, send routes to Resend, headers + template parity verified.
- A2P registration submission + approval webhook â†’ SMS use-case unblocked.
- Domain auth verification on a live DNS sandbox (Cloudflare zone).
- One-click unsubscribe end-to-end via Gmail / Yahoo / Outlook test inboxes.

**E2E**
- Lead captured â†’ 7-touch email + 3-touch SMS sequence runs over 14 simulated days (clock-injected); STOP keyword on day 3 pauses SMS and suppresses; email continues; lead converts on day 7 (auto-complete sequence).
- Admin resend a single message â†’ `admin_message_resent` + `pii_access_recorded` + audit row.

**Load**
- 100k enrollments/hour sustained 1 h; suppression check < 5 ms P95; send latency < 30 s P95.

**Chaos**
- DNS resolver outage (kill Cloudflare 1.1.1.1) â†’ majority-of-3 fallback works.
- A2P approval revocation â†’ SMS auto-blocks within 60 s.

---

# PRD 9 â€” Notification Engine

**Workstream owner:** Notifications squad (Tech lead + 2 BE + 2 FE + 1 mobile eng for push tokens)
**Source-of-truth services:** `notification-svc` (router + scheduler), `inapp-svc`, `push-svc` (APNs + FCM), `email-svc` (re-uses v2 PRD 8 `email-send-svc`), `sms-svc` (re-uses v2 PRD 8 `sms-send-svc`), `webhook-out-svc` (re-uses v1 PRD 3 webhook infra), `digest-svc`, `notification-prefs-svc`, `notification-dedup-svc`.
**Cross-PRD interactions:** subscribes to events from every other PRD (Doc 03 Â§A.1â€“A.9); reuses email + SMS sending infra from v2 PRD 8; reuses webhook delivery infra from v1 PRD 3/4 (shared `webhook-svc`); admin replay lives in v1 PRD 5; push tokens come from mobile clients (mobile app is post-launch but token schema lands now).

## 1. Module overview

The Notification Engine is the canonical routing + delivery layer for every user-facing notification across FunelAI. It subscribes to the canonical Kafka event bus (Doc 03 Â§A) and applies per-event-type delivery rules (e.g. `lead_captured` â†’ in-app + email; `payment_failed` â†’ email + SMS for `owner`+`billing`; `human_review_required` â†’ in-app only for `owner`/`admin`/`editor`; `dunning_step_executed` at D14 â†’ email + SMS for `owner`+`billing`). Channels are: **in-app** (real-time WebSocket + persisted to `notifications` table for the bell-icon feed), **email** (transactional sender via v2 PRD 8 SendGrid path, *not* the marketing path â€” separate IP pool, no list-unsubscribe), **mobile push** (APNs for iOS + FCM for Android; tokens stored per device), **SMS** (only for events tagged `priority='high'` and only for users who've opted in to SMS notifications), **Slack** + **Discord webhooks** (Agency+ only; configured per workspace, signed deliveries).

User preferences are a channel Ã— event-type matrix per workspace member, with account-level overrides (an admin can force a notification on for compliance reasons â€” e.g. `data_deletion_completed` is always emailed regardless of user pref). Workspace-level defaults are templated per role (e.g. an `owner` defaults to email + in-app on revenue events; a `viewer` defaults to in-app only). Precedence: per-user pref > workspace-level default > engine default. A "Quiet hours" toggle suppresses SMS + push (not email â€” emails are async by nature); critical events (`account_suspended`, `data_deletion_requested`) always bypass quiet hours per Doc 07a Â§R5 (cannot suppress legally-required notifications).

Digest mode batches low-priority events into a single email/in-app summary at the user's chosen cadence (daily 8 AM local, or hourly). Digest content is rendered per recipient at send-time so it reflects the latest state (e.g. a digest emitted at 8 AM doesn't mention a lead that opted out at 7:55 AM). PII safety is strict: notification subject + preview *never* include raw P2 data (no full email, no full phone). For lead-related notifications, the preview shows the masked variant ("New lead: j***@example.com from Solar Funnel") and the full PII is only visible after the user clicks through and re-authenticates (or session is recent enough). Duplicate detection: identical notifications to the same recipient within a configurable window (default 30 s) are de-duped via `notification-dedup-svc`.

Slack/Discord webhook deliveries (Agency+) are HMAC-signed with a per-workspace secret, retry per the shared `webhook-svc` policy (1 s, 5 s, 30 s, 5 m, 30 m, 2 h, 6 h, 24 h), and land in a DLQ on terminal failure. Mobile push token management: tokens are stored per `(user_id, device_id, platform)`, with last-seen + last-success timestamps; tokens that return APNs/FCM "unregistered" errors are auto-removed; users see their registered devices in settings and can revoke any. Failed deliveries on any channel emit `notification_delivery_failed` (new) and feed into retry per channel-specific policy.

## 2. User stories

1. **GIVEN** a `lead_captured` event for a workspace **WHEN** the notification router applies rules **THEN** each member with the default rule for this event-type gets an in-app notification within 2 s, an email within 30 s (transactional path, batched if digest mode is on), and (for users who opted in) a push within 5 s.
2. **GIVEN** a workspace `owner` has set "Lead notifications: in-app only" in their prefs **WHEN** a `lead_captured` fires **THEN** they receive only the in-app notification; the email is skipped; their workspace default does not override their personal pref.
3. **GIVEN** a `payment_failed` event (Doc 03 Â§A.7 #9) **WHEN** the router runs **THEN** the `owner` and any `billing`-role members receive the notification via in-app + email + (if priority=high which it is) SMS; this is one of the few events where SMS fires by default for any opted-in user.
4. **GIVEN** an Agency-tier workspace has a Slack webhook configured for the channel `#funnel-leads` **WHEN** a `lead_captured` fires **THEN** a signed Slack-formatted message is delivered to the Slack endpoint within 5 s P95; payload is HMAC-signed per the shared `webhook-svc` policy.
5. **GIVEN** a user is in "Quiet hours" (10 PM â€“ 7 AM local) **WHEN** a non-critical notification fires **THEN** SMS + push are suppressed; in-app + email are still delivered (queued visibly in their bell-icon feed); a "this notification was delivered during your quiet hours" suffix is shown when they next open the app.
6. **GIVEN** a `data_deletion_completed` event (always-on, always-email per Doc 07a) **WHEN** it fires **THEN** the subject user receives an email regardless of any pref or quiet-hours setting; the email contains the tombstone reference but no PII.
7. **GIVEN** a user has enabled digest mode (daily 8 AM local) **WHEN** the digest cadence triggers **THEN** all queued low-priority notifications from the past 24 h are rendered into one email + one in-app summary; events fired between the digest's render-start and send finalization are pushed to the *next* digest.
8. **GIVEN** an admin (v1 PRD 5 `engineering`) sees a notification in the DLQ **WHEN** they click "Retry" **THEN** the notification is re-delivered with a new attempt id; outcome appears in the delivery log; an audit row is written.
9. **GIVEN** a Slack webhook URL has been revoked by the customer (Slack returns 410) **WHEN** the next delivery attempt fires **THEN** the webhook is `auto_disabled` after 24 h of consecutive failures; the workspace owner is notified via in-app + email; a "reconnect Slack" CTA is shown.
10. **GIVEN** a mobile push token returns "unregistered" from APNs **WHEN** the response handler runs **THEN** the token is removed from `push_tokens`; the user's device list updates within 5 s; no further push attempts to that token.
11. **GIVEN** two identical `lead_captured` notifications would be sent to the same user within 30 s (rare race: dedup at capture + a duplicate event in Kafka) **WHEN** the dedup service runs **THEN** the second is dropped, `notification_deduped` (**NEW**, A.9) is emitted with the original id.
12. **GIVEN** a user changes their notification prefs in settings **WHEN** they save **THEN** the next event fires under the new prefs within 30 s (cache invalidation); historical notifications are unaffected.
13. **GIVEN** an in-app notification arrives **WHEN** the user is online with an open WebSocket **THEN** it appears in the bell-icon feed in real time (no refresh required); the unread counter updates atomically.
14. **GIVEN** a workspace has 50 members and a `funnel_published` event fires **WHEN** the router runs **THEN** notifications are batched per channel (one bulk send per channel rather than 50 individual sends to the same provider) but per-recipient rendering still applies (PII masking is per-recipient).
15. **GIVEN** the in-app notification feed reaches 500 unread items **WHEN** the user opens the app **THEN** the bell-icon shows "500+", a "mark all as read" affordance appears, and pagination is enforced (50 per page) â€” never load the full window into memory.

## 3. Edge cases (â‰¥ 15)

1. User's notification pref says "email only" but their email address is on the suppression list (bounced) â†’ fall back to in-app and emit `notification_channel_unavailable` (**NEW**); UI surfaces a "fix your email" prompt.
2. Slack webhook URL contains a query string with an old auth token â†’ strip + warn; never log the raw URL.
3. Discord webhook rate-limits us (429 with retry-after) â†’ respect retry-after header in the shared webhook-svc, queue accordingly.
4. Email digest is so large (1000+ entries) that it exceeds the 100 KB SendGrid template limit â†’ render as paginated digest with "see all in app" link; never silently truncate critical entries.
5. User has notifications muted at OS level for the app (iOS / Android setting we can't see) â†’ APNs/FCM still return success; we have no signal; surface this as a "make sure notifications are on" reminder in onboarding.
6. Multiple devices registered for the same user (phone + tablet) â†’ all get the push; idempotency per (`user_id`, `device_id`) so we don't dedup across devices.
7. User logs out on one device but the push token is still registered â†’ token cleanup on logout removes the token immediately; FCM/APNs unregistered errors catch the stragglers.
8. Webhook delivery succeeds (200) but payload was a 5xx HTML page from the customer's load balancer (false-positive) â†’ we trust the HTTP code; if the customer reports missed events, admin can replay from the delivery log.
9. Quiet hours straddle DST transition â†’ calendar arithmetic uses Intl + the user's IANA timezone, never UTC offsets.
10. User is in two workspaces with different quiet-hours preferences â†’ workspace-level setting applies *only* to notifications scoped to that workspace; user-level setting is the master.
11. A high-volume notification storm (e.g. 10k `lead_captured` in an hour during a viral spike) â†’ SMS + push are rate-limited per-user (max 5 push or SMS per user per hour for the same event type) and the excess collapses into a digest item.
12. Account-level override: an admin enables "force notify owner on all `compliance_block_raised`" â†’ the owner cannot turn this off (it's an override); the UI shows the lock icon explaining why.
13. A user's email pref changes during a digest's send-window â†’ digest still goes out (already rendered), next one respects the new pref.
14. WebSocket connection drops â†’ in-app notifications buffer to the user's persisted feed; on reconnect, the unread counter syncs.
15. Mobile app token expires (FCM rotation) â†’ on next app open the client re-registers; we maintain both tokens during a 24-h grace.
16. A non-critical notification's template is missing/invalid â†’ render a generic fallback template ("Something happened in your workspace â€” open the app for details"); never silently drop.
17. PII-masking lint fails (a developer added a new event with raw email in the subject) â†’ the notification linter in CI blocks the merge; emergency override requires an exception ticket.
18. Slack/Discord delivery succeeds at the API but the customer's Slack workspace later deletes the channel â†’ next delivery fails with channel-not-found; auto-disable after 24 h.
19. Two admins try to retry the same DLQ item simultaneously â†’ idempotency on `(delivery_id, attempt_n)`; second click joins the first.
20. Account suspended (v1 PRD 4) â†’ all notifications continue (especially `account_suspended` itself); we never silence a suspended customer's notifications, that's a footgun.

## 4. API dependencies

**Internal**
- `notification-svc` (this PRD): router + scheduler.
- `inapp-svc` (this PRD): WebSocket + persistence.
- `push-svc` (this PRD): APNs + FCM.
- `digest-svc` (this PRD): batching.
- `notification-prefs-svc` (this PRD): pref + override + quiet-hours.
- `notification-dedup-svc` (this PRD): duplicate detection.
- `email-send-svc` (v2 PRD 8): transactional path.
- `sms-send-svc` (v2 PRD 8): high-priority only.
- `webhook-svc` (v1 PRD 3/4 shared): Slack/Discord delivery.
- `event-bus` (Doc 03 Â§A): subscriber.
- `feature-flags`: `release.notifications.v1`, `killswitch.notifications.<channel>`, `killswitch.notifications.global`.

**External (via PAL â€” Doc 04)**
- APNs (Apple Push Notification service).
- FCM (Firebase Cloud Messaging).
- Slack Webhooks (Incoming Webhooks).
- Discord Webhooks.
- SendGrid (transactional; separate IP pool from marketing â€” Doc 04 PAL note).
- Twilio (high-priority SMS only).

## 5. Database tables / objects touched

- `users` (read).
- `workspace_members` (read).
- `webhooks`, `webhook_deliveries` (Doc 03 Â§B.8 + v1 PRD 4 schema) â€” write for Slack/Discord.
- `suppression_list` (read on email/sms).
- `audit_log`.

**New helper schemas (must land in Doc 03 Â§B):**

```sql
CREATE TABLE notifications (
  id              TEXT PRIMARY KEY,           -- ntf_â€¦
  workspace_id    TEXT NOT NULL,              -- nullable for cross-workspace user notifications (data_deletion_completed)
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type      TEXT NOT NULL,              -- e.g. 'lead_captured'
  source_event_id TEXT,                       -- envelope.event_id of the source Kafka event
  priority        TEXT NOT NULL DEFAULT 'normal', -- 'low','normal','high','critical'
  subject         TEXT NOT NULL,
  preview         TEXT NOT NULL,
  payload_ref     JSONB NOT NULL DEFAULT '{}'::jsonb, -- references, never raw PII
  channels        TEXT[] NOT NULL,            -- {'in_app','email','push','sms','slack','discord'}
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ntf_user_created_idx ON notifications (user_id, created_at DESC);
CREATE INDEX ntf_user_unread_idx ON notifications (user_id) WHERE read_at IS NULL;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY ntf_self ON notifications
  USING (user_id = current_setting('app.user_id', true));

CREATE TABLE notification_deliveries (
  id              TEXT PRIMARY KEY,
  notification_id TEXT NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  channel         TEXT NOT NULL,
  provider        TEXT,                       -- 'apns','fcm','sendgrid','twilio','slack','discord','inapp'
  status          TEXT NOT NULL DEFAULT 'queued', -- 'queued','sent','delivered','failed','dlq'
  attempt_n       INTEGER NOT NULL DEFAULT 1,
  delivered_at    TIMESTAMPTZ,
  failed_at       TIMESTAMPTZ,
  last_error      TEXT,
  external_id     TEXT
);
CREATE INDEX ntfd_status_idx ON notification_deliveries (status);

CREATE TABLE notification_prefs (
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id    TEXT,                       -- nullable = user-level master
  event_type      TEXT NOT NULL,
  channels        TEXT[] NOT NULL DEFAULT '{}',
  digest_mode     TEXT NOT NULL DEFAULT 'off', -- 'off','hourly','daily'
  quiet_hours     JSONB NOT NULL DEFAULT '{}', -- {start, end, tz}
  override        BOOLEAN NOT NULL DEFAULT FALSE, -- admin-set force-on
  PRIMARY KEY (user_id, workspace_id, event_type)
);

CREATE TABLE push_tokens (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id       TEXT NOT NULL,
  platform        TEXT NOT NULL CHECK (platform IN ('ios','android','web')),
  token           TEXT NOT NULL,
  last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_success_at TIMESTAMPTZ,
  registered_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX push_token_unique ON push_tokens (user_id, device_id, platform);

CREATE TABLE notification_dedup_keys (
  key             TEXT PRIMARY KEY,           -- hash(user_id + event_type + content_hash + minute_bucket)
  notification_id TEXT NOT NULL,
  expires_at      TIMESTAMPTZ NOT NULL
);
```

## 6. Telemetry events emitted

| Event | Family | When |
|---|---|---|
| `notification_emitted` **NEW** (A.1) | A.1 | Notification record created. Add to Doc 03. |
| `notification_delivered` **NEW** (A.1) | A.1 | Channel delivery confirmed. |
| `notification_delivery_failed` **NEW** (A.1) | A.1 | Channel delivery failed (after retries). |
| `notification_deduped` **NEW** (A.9) | A.9 | Dedup window collapsed a duplicate. |
| `notification_channel_unavailable` **NEW** (A.1) | A.1 | A channel was unavailable (e.g. suppressed). |
| `notification_pref_updated` **NEW** (A.1) | A.1 | User changed prefs. |
| `push_token_registered` / `push_token_revoked` **NEW** (A.1) | A.1 | Mobile token management. |
| `slack_webhook_auto_disabled` **NEW** (A.4) | A.4 | After 24 h of consecutive failures. |
| `digest_sent` **NEW** (A.1) | A.1 | Daily/hourly digest delivered. |

## 7. Permissions enforced

| Capability | owner | admin | editor | analyst | viewer | billing |
|---|---|---|---|---|---|---|
| View own notification feed | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… |
| Edit own prefs | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… |
| Set workspace-level defaults | âœ… | âœ… | âŒ | âŒ | âŒ | âŒ |
| Configure Slack/Discord webhook (Agency+) | âœ… | âœ… | âŒ | âŒ | âŒ | âŒ |
| View workspace notification delivery log | âœ… | âœ… | âŒ | âœ… | âŒ | âŒ |
| Set admin-override (force-on for compliance) | âœ… | âœ… | âŒ | âŒ | âŒ | âŒ |
| Revoke another user's device token | âœ… | âœ… | âŒ | âŒ | âŒ | âŒ |

Admin-console: `support` view-only on delivery log; `engineering` retry from DLQ + view dead-letter; `super_admin` force-resend a single notification (audited).

## 8. Error states + recovery paths

| State | Behavior | Recovery |
|---|---|---|
| APNs/FCM outage | Push queued; in-app + email still go; banner | Auto |
| Slack/Discord URL revoked | Auto-disable after 24 h; notify workspace owner | User-initiated |
| Email suppression on recipient | Fall back to in-app; emit `notification_channel_unavailable` | User fixes email |
| Dedup-svc down | Fall back to "no dedup"; emit operational alert (Doc 08 Â§362) | Auto on recovery |
| WebSocket cluster degraded | Bell-icon polls via REST every 30 s; in-app still delivered (just slower) | Auto |
| Template missing/invalid | Render generic fallback; emit operational alert | Engineering fixes template |
| Digest render fails for one user | That digest is skipped (logged); next digest renders cleanly | Auto |
| Quiet-hours config corrupt for a user | Default to "no quiet hours"; emit operational alert | User-initiated correction |

## 9. Acceptance criteria

- [ ] Event-to-notification latency P95 < 2 s for in-app; < 5 s for push; < 30 s for email.
- [ ] Pref precedence (user > workspace-default > engine-default) verified by a regression suite of 50+ pref combinations.
- [ ] PII safety: no raw P2 in notification subject + preview; verified by a linter on every event-template registration (CI gate).
- [ ] Dedup window correctness: 1k duplicate events to the same user in 30 s â†’ 1 notification + 999 `notification_deduped` events.
- [ ] Quiet hours: SMS + push suppressed; in-app + email delivered; critical events bypass; verified per-user.
- [ ] Digest correctness: rendered at-send-time; events between render-start and send go to next digest; covered by a clock-injected test.
- [ ] APNs/FCM unregistered tokens auto-removed within 5 s of error response.
- [ ] Slack/Discord delivery HMAC-signed; auto-disable after 24 h consecutive failures.
- [ ] All events in Â§6 emitted with correct envelope; **NEW** events landed in Doc 03 Â§A.
- [ ] RLS on `notifications`, `notification_prefs`, `push_tokens` (user_id-scoped, not workspace_id).
- [ ] Coverage â‰¥ 85% on `notification-svc`, `notification-prefs-svc`, `notification-dedup-svc`.

## 10. Launch blockers

1. Event-to-notification routing live for all Doc 03 Â§A.1â€“A.9 events that have a default rule.
2. Channels live: in-app + email + push (mobile token schema landed; mobile app is post-launch, but tokens can be registered from a web push prototype on Day 90 â€” Slack + Discord live for Agency+).
3. Pref UI + precedence + quiet hours.
4. Digest mode (daily + hourly).
5. PII-safety linter in CI.
6. Dedup window + idempotency.
7. Slack/Discord webhook delivery + auto-disable.
8. Admin replay (v1 PRD 5 integration).
9. Kill switches per channel.
10. Push-token lifecycle (register, auto-cleanup on unregistered).

## 11. Post-launch enhancements

- Native mobile app with full push experience.
- WhatsApp + Telegram channels.
- Smart digest grouping by topic + recommended actions.
- Per-event AI-summarized notifications ("3 leads came in while you were out; 2 look high-intent â€” open the app").
- User-defined "notification rules" (Zapier-like: when X event with Y filter â†’ notify in Z channel).
- Multi-language notification templates.
- ML-driven notification fatigue prediction (auto-route low-priority to digest if a user is being flooded).
- Webhook signing-secret rotation UI.

## 12. Test plan

**Unit**
- Pref precedence solver (user Ã— workspace Ã— engine defaults).
- PII-safety linter on a 50-event-template corpus.
- Dedup key hash determinism.
- Quiet-hours calendar arithmetic across DST + IANA timezones.

**Integration**
- Subscriber consuming each Doc 03 Â§A event family; assert correct channel selection per pref + override.
- Digest cadence: 24 h of synthetic events â†’ one digest at the right boundary.
- Slack + Discord delivery (with mocked webhook endpoints) including HMAC verification + retry-backoff-DLQ.
- APNs / FCM mocked providers including unregistered + invalid-token cleanups.

**E2E**
- Workspace with 5 members at different roles + different prefs; fire a synthetic event mix (`lead_captured`, `payment_failed`, `human_review_required`); assert exact set of notifications per user per channel.
- DLQ retry from admin console; audit row present.

**Load**
- 50k events/sec sustained 5 min; event-to-in-app latency < 2 s P95; no message loss.

**Chaos**
- WebSocket cluster restart â†’ REST poll fallback works.
- Slack webhook returns 410 for 24 h â†’ auto-disable triggers; workspace owner notified via in-app + email.

---

# PRD 10 â€” Recursive Learning Pipeline

**Workstream owner:** MLOps + Data squad (Tech lead + 2 data eng + 2 ML eng + 1 privacy eng + 1 T&S partner for bias review)
**Source-of-truth services:** `flywheel-etl` (Iceberg writer + lake compactor), `anonymizer-svc`, `aggregator-svc`, `kb-update-svc`, `model-registry-svc` (canonical home in Doc 08 mlops; PRD-10 consumes), `ranking-retraining-svc`, `bias-audit-svc`, `flywheel-optout-svc`, `compliance-feedback-svc`.
**Cross-PRD interactions:** consumes events from *every* PRD (Doc 03 Â§A.1â€“A.9 + agent_io traces from v1 PRD 2); writes KB-pack updates that v1 PRD 1 + v1 PRD 2 read at runtime; promotes ranking models that v2 PRDs 6/7/8 read (RevTry persona ranker, ad rotation policy, send-time optimizer); rejection signals from v2 PRD 7 feed compliance-feedback; admin gates promotion via v1 PRD 5.

## 1. Module overview

The Recursive Learning Pipeline is the closed loop that makes FunelAI self-improving. Every funnel publish, every lead capture, every voice call, every ad rejection, every email delivery feeds anonymized signal into the lake. Nightly, `flywheel-etl` writes Kafka tail + agent_io trace blobs into Iceberg per Doc 03 Â§C.4 bucket layout. `aggregator-svc` runs SQL aggregations per **industry Ã— geo Ã— language Ã— variant** (where "variant" is the generated funnel/page/copy/persona artifact) producing conversion lift metrics with confidence intervals (Wilson score for small samples; bootstrap for large). High-confidence winning patterns are extracted as few-shot examples and pushed into the relevant KB pack as a new version (Doc 03 Â§A.9 #9 `kb_pack_updated`); this is the *weekly* cadence. Monthly, the small ranking models (lead scorer, RevTry persona ranker, ad rotation rule policy, send-time optimizer) are retrained on the curated lake datasets in `training/datasets/` (Doc 03 Â§C.4) and the model registry is updated (`model_version_promoted` â€” Doc 03 Â§A.9 #8) only after bias-audit and human-review approval (see Â§12 below). Quarterly, human reviewers (T&S + senior content) audit the top 100 patterns by lift across verticals and either confirm them, retire them, or flag them for additional safety analysis.

Anonymization is non-negotiable. **No row in the curated lake or training datasets ever contains direct PII.** Anonymization rules: drop `email`, `phone_e164`, `full_name`, `ip` raw; keep `*_sha256` where joins are required (note: hashed identifiers are still considered P1, never P2, per Doc 03 Â§C.2). Quasi-identifiers (rare-vertical Ã— small-geo Ã— small-employer-cluster) are k-anonymized to k=10 per the bucketing scheme in `packages/anonymize/k_anon.py`; if a bucket falls below k=10, the row is dropped from cross-network aggregations (it can still inform the source workspace's own analytics, but never patterns shared cross-network). Workspace-level opt-out via `flywheel-optout-svc`: a workspace owner can disable their data contributing to cross-network learning (default: opt-in; opt-out toggleable in workspace settings). Opting out removes the workspace's signal from *future* aggregations; signal already baked into a deployed KB pack stays (the KB pack is anonymous + cross-customer; we can't un-bake one workspace's signal without retraining).

Self-improving compliance is the most interesting loop. Every `ad_rejected` (v2 PRD 7) + `compliance_block_raised` (v1 PRD 2) + `human_review_completed` outcome feeds `compliance-feedback-svc`. The service clusters rejection reasons against the active rule set in `packages/ad-policy/rules/*.yaml` and surfaces a "rule candidate" to T&S when a cluster grows past a threshold (â‰¥ 20 instances of a previously-unseen rejection pattern). T&S reviews and either adds the rule to pre-flight (preventing future rejections) or flags it as a false-positive cluster (improving the Compliance agent's training data).

A/B test integration: every published funnel can be entered into an A/B experiment (control = baseline variant, treatment = generated variant) via `experiment-svc` (Day-90 thin layer on top of GrowthBook or LaunchDarkly â€” Doc 04). Results from A/B tests are first-class signals into the aggregator; KB updates that come from A/B winners carry an `evidence_type='ab_test'` annotation and outrank observational pattern-mining signals in the few-shot ranker.

Promotion gating is strict: any ranking-model promotion requires (a) eval-set passage on the held-out set (â‰¥ baseline performance + â‰¥ 1% relative improvement, or no regression > 0.5% on any segment); (b) bias-audit completion (`bias_audit_completed` â€” Doc 03 Â§A.9 #10) with no `verdict='fail'` dimension; (c) human approval via the admin console (v1 PRD 5 `super_admin` + a second `super_admin` co-sign for any model touching personae or ad-policy); (d) rollback plan recorded in `mlops-svc` (Doc 03 Â§A.9 #8 `rollback_plan_ref`). Promoted models go behind a feature flag with gradual rollout (10% â†’ 50% â†’ 100% over 7 days).

## 2. User stories

1. **GIVEN** a `generation_completed` event with `funnel_published` follow-up **WHEN** the flywheel-etl nightly job runs **THEN** the agent_io trace blob is written to `s3://funnel-lake-<region>/raw/agent_io/generations/<gen_id>/` per Doc 03 Â§C.4, and a curated row lands in `fact_funnels` + `fact_generation_cost` Iceberg tables within 24 h.
2. **GIVEN** the weekly aggregator runs **WHEN** a pattern (vertical Ã— geo Ã— language Ã— variant) shows â‰¥ 5% conversion lift at â‰¥ 95% confidence (Wilson score) and k-anonymity â‰¥ 10 **THEN** the pattern is queued as a KB-pack update candidate, `kb_pack_update_candidate` (**NEW**, A.9) is emitted, and a human reviewer is paged in the T&S admin queue.
3. **GIVEN** a T&S reviewer approves a KB-pack update candidate **WHEN** they confirm **THEN** `kb-update-svc` writes a new KB-pack version, `kb_pack_updated` (Doc 03 Â§A.9 #9) is emitted, and Generation Engine (v1 PRD 2) reads the new version on subsequent runs (existing in-flight generations keep their pinned version).
4. **GIVEN** a workspace owner toggles "Do not contribute my data to cross-network learning" **WHEN** they save **THEN** `flywheel_optout_set` (**NEW**, A.9) is emitted, the workspace's row appears in `flywheel_optouts`, future aggregator runs exclude this workspace, and a confirmation banner explains what stays in deployed KB packs (cannot be removed retroactively).
5. **GIVEN** the monthly ranking-model retraining job triggers **WHEN** the lead-scorer model finishes training **THEN** the eval-set comparison runs against the prior production version; if criteria pass, `model_version_promoted` candidate is created (not yet promoted) and the bias-audit pipeline is triggered.
6. **GIVEN** the bias-audit completes for a candidate model **WHEN** all dimensions report `verdict='pass'` (or `verdict='no_effect'`) **THEN** `bias_audit_completed` (Doc 03 Â§A.9 #10) is emitted with the report URL; the admin console (v1 PRD 5) shows the candidate as "ready for human approval".
7. **GIVEN** a `super_admin` approves the candidate model **WHEN** a second `super_admin` co-signs (for persona + ad-policy models â€” required) **THEN** `model_version_promoted` (Doc 03 Â§A.9 #8) is emitted with `rollback_plan_ref`, the model goes behind a feature flag with `release.model.<name>.rollout`, and `mlops-svc` orchestrates the 10% â†’ 50% â†’ 100% rollout.
8. **GIVEN** the production model's performance regresses (â‰¥ 2% drop on any production metric) during the rollout **WHEN** the regression detector fires **THEN** the rollout pauses, the rollback plan is enacted automatically, `model_version_rolled_back` (**NEW**, A.9) is emitted, and on-call data eng is paged.
9. **GIVEN** an A/B test concludes with the treatment winning at â‰¥ 95% confidence **WHEN** the aggregator reads the test result **THEN** the winning pattern is queued as a KB-pack candidate with `evidence_type='ab_test'`; A/B-evidence patterns are prioritized over observational ones (higher ranking weight).
10. **GIVEN** an ad rejection cluster reaches the 20-instance threshold for a previously-unseen pattern **WHEN** `compliance-feedback-svc` runs **THEN** a rule-candidate is created for T&S review, `compliance_rule_candidate_raised` (**NEW**, A.9) is emitted, and the surfaced cluster contains the redacted creative snapshots + the platform rejection texts.
11. **GIVEN** an opted-out workspace's owner wants to *re-enroll* in cross-network learning **WHEN** they toggle back **THEN** `flywheel_optout_cleared` (**NEW**, A.9) is emitted, the next aggregator run includes them again, but their *historical* opted-out window is not retroactively re-included.
12. **GIVEN** a DSAR deletion completes for a user/lead (Doc 03 Â§C.3) **WHEN** the lake-scrub portion of the cascade runs **THEN** the row-level delete is applied to all Iceberg tables that contain the subject_id_hash; compaction completes within 7 days; the curated KB packs are unaffected (already anonymous), and an audit row is written.
13. **GIVEN** a quarterly human review of the top-100 patterns runs **WHEN** a pattern is retired (no longer recommended) **THEN** the KB pack is updated to remove the few-shot example, `kb_pack_updated` is emitted with `change_summary='retired_pattern:<id>'`, and Generation Engine picks up the new KB pack version.
14. **GIVEN** a model promotion is in progress at the 50% rollout stage **WHEN** the on-call eng triggers an emergency rollback via the admin console (v1 PRD 5 `engineering`) **THEN** the rollout pauses, `model_version_rolled_back` is emitted, the prior version goes back to 100%, and the candidate version stays available for re-promotion after fix.
15. **GIVEN** the daily anonymization-rules linter runs **WHEN** a developer added a new event field that matches the PII pattern (`email`, `phone`, `address`, etc.) without an explicit allow-list entry **THEN** the linter fails the CI build; an exception requires a privacy-eng review.

## 3. Edge cases (â‰¥ 15)

1. A lake-scrub for a DSAR happens *during* an aggregator run â†’ aggregator pauses for the affected partition + restarts after the scrub; intermediate results are versioned.
2. The aggregator finds a "winning" pattern that's actually an artifact of a single mega-customer (e.g. one workspace contributing 90% of the rows in a bucket) â†’ the dominance check (Herfindahl-style concentration index) flags + drops the pattern.
3. Two patterns conflict (one says "use red CTA in solar vertical", another says "use green CTA in solar vertical-California") â†’ the more specific one wins by k-anonymity-weighted lift; we never emit conflicting few-shots to Generation Engine.
4. A KB-pack update is approved but the underlying lake table is mid-compaction â†’ kb-update-svc reads from the latest committed snapshot, never from in-flight files.
5. The bias-audit finds a `verdict='fail'` dimension on a small intersection (e.g. "non-English speakers in vertical X are under-served by the new lead scorer") â†’ promotion is blocked; the audit report goes to T&S; the candidate model is retired *unless* the failure mode can be mitigated by reweighting the training set (and another audit must pass).
6. An opt-out is set, then the next aggregator includes the workspace anyway due to a race (opt-out cache wasn't invalidated) â†’ cache invalidation is synchronous on toggle (TTL=0); a regression test asserts opt-out is honored within the same aggregator run.
7. An ad-rejection cluster contains creatives from a single workspace only (mass-fail of one customer's creatives) â†’ not a rule candidate; surfaced to that customer's account manager instead via v2 PRD 9.
8. A new event field is added to Doc 03 Â§A but the anonymizer rules aren't updated â†’ CI lint fails; merge blocked; privacy-eng review required.
9. A model retrains successfully but the eval-set's distribution has drifted (the held-out set is no longer representative) â†’ drift detector flags + holds the promotion; data eng refreshes the eval set.
10. Quarterly review finds a pattern that's been live for 3 months but the lift has decayed to baseline â†’ retire the pattern; emit `kb_pack_updated` with change_summary.
11. The KB pack update would change the few-shot prompt for an in-flight regulated-vertical generation â†’ no, generations pin their KB pack version (v1 PRD 1); the new KB pack version only applies to subsequent generations.
12. A workspace closes (v1 PRD 4 `account_closed`) â†’ after the 30-day grace, their lake data is scrubbed per Doc 03 Â§C.3; opt-out status remains "opt-out forever" in the audit history.
13. Two A/B tests are running on the same funnel simultaneously (rare but possible if the customer doesn't notice the warning) â†’ experiment-svc surfaces the conflict + offers to halt one; results from both are excluded from aggregation until resolved.
14. The compliance-rule candidate that T&S approves conflicts with an existing rule (e.g. broader scope) â†’ T&S resolves manually; rule version + diff are stored.
15. The aggregator finds a pattern that improves conversion but worsens lead quality (lift on top-funnel + drop on qualified-rate) â†’ the multi-objective scorer weights downstream qualified-rate higher; the pattern is *not* promoted.
16. Model promotion succeeds at 100% but a new model regression appears 14 days later (concept drift) â†’ the daily drift monitor fires; auto-rollback can be triggered or the model retrains on the latest window.
17. A workspace asks for an *individual* explanation of why the KB pack changed â†’ response: the KB pack is cross-customer + anonymous; we can show the aggregate evidence (`pattern_id` + `lift` + `confidence`) but not individual contributing rows.
18. The bias-audit-svc itself is biased (e.g. it under-tests a dimension) â†’ the auditor is human + tool; quarterly external review of the audit tool itself per Doc 07a Â§13.
19. A KB-pack rollback is requested 48 h after a publish (the new pack is causing worse conversions) â†’ kb-svc supports version rollback to the prior committed version; emit `kb_pack_rolled_back` (**NEW**, A.9).
20. Cross-region lake (US-East, EU-West) data residency: aggregations that span regions strip the region tag + drop per-region quasi-identifiers; per-region KB packs exist for region-restricted patterns.

## 4. API dependencies

**Internal**
- `flywheel-etl` (this PRD): Kafka tail + agent_io blob writer + Iceberg landing.
- `anonymizer-svc` (this PRD): PII drop + k-anonymity bucketing.
- `aggregator-svc` (this PRD): SQL aggregations + lift/confidence.
- `kb-update-svc` (this PRD): KB-pack version writes.
- `ranking-retraining-svc` (this PRD): monthly retrain orchestrator.
- `bias-audit-svc` (this PRD): pre-promotion audit runner.
- `flywheel-optout-svc` (this PRD): opt-out toggle + cache.
- `compliance-feedback-svc` (this PRD): rejection clustering.
- `model-registry-svc` (Doc 08 mlops): model artifact + version + promotion gate.
- `experiment-svc` (Doc 04 PAL â€” GrowthBook or LaunchDarkly): A/B test result reader.
- `kb-svc` (v1 PRD 1/2): KB pack reader/writer.
- `event-bus`: subscriber to all families.
- `feature-flags`: `release.model.<name>.rollout`, `killswitch.flywheel.global`, `killswitch.flywheel.kb_updates`.

**External (via PAL â€” Doc 04)**
- AWS S3 + Glue + Athena (Iceberg compute).
- GrowthBook / LaunchDarkly (A/B test backend).
- Anthropic / OpenAI evaluation APIs (for LLM-as-judge eval steps, where applicable).
- BigQuery (analytics queries for reviewer dashboards).

## 5. Database tables / objects touched

- `audit_log` (write â€” every KB update + every promotion).
- Iceberg tables in `s3://funnel-lake-<region>/curated/...` (Doc 03 Â§C.4).
- `agent_invocations` (read for trace data).
- `event_log` (read tail) â€” produces nothing into Postgres directly; everything flows lake-side.

**New helper schemas (must land in Doc 03 Â§B):**

```sql
CREATE TABLE flywheel_optouts (
  workspace_id    TEXT PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  opted_out_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  opted_back_in_at TIMESTAMPTZ,
  reason          TEXT
);

CREATE TABLE kb_pack_update_candidates (
  id              TEXT PRIMARY KEY,
  pack_id         TEXT NOT NULL,
  vertical        TEXT NOT NULL,
  geo             TEXT,
  language        TEXT,
  variant_id      TEXT NOT NULL,
  evidence_type   TEXT NOT NULL,             -- 'ab_test','observational','user_feedback'
  lift            NUMERIC(6,4) NOT NULL,
  confidence      NUMERIC(6,4) NOT NULL,
  k_anonymity     INTEGER NOT NULL,
  proposed_diff   JSONB NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending', -- 'pending','approved','rejected','retired'
  reviewer_id     TEXT REFERENCES users(id),
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE model_promotion_candidates (
  id              TEXT PRIMARY KEY,
  model_id        TEXT NOT NULL,
  from_version    TEXT NOT NULL,
  to_version      TEXT NOT NULL,
  eval_report_id  TEXT,
  bias_audit_id   TEXT,
  status          TEXT NOT NULL DEFAULT 'pending', -- 'pending','approved','rejected','rolled_back'
  approver_user_id TEXT REFERENCES users(id),
  cosigner_user_id TEXT REFERENCES users(id),
  rollback_plan_ref TEXT,
  rollout_state   JSONB NOT NULL DEFAULT '{}', -- {pct: 10, started_at: ...}
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE compliance_rule_candidates (
  id              TEXT PRIMARY KEY,
  platform        TEXT NOT NULL,            -- 'meta','google','tiktok',...
  cluster_signature TEXT NOT NULL,           -- hash of pattern
  instance_count  INTEGER NOT NULL,
  evidence_refs   TEXT[] NOT NULL,           -- references to ad_rejected event ids
  proposed_rule   JSONB NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending',
  reviewer_id     TEXT REFERENCES users(id),
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE quarterly_pattern_reviews (
  id              TEXT PRIMARY KEY,
  quarter         TEXT NOT NULL,              -- '2026-Q3'
  pattern_id      TEXT NOT NULL,
  decision        TEXT NOT NULL,              -- 'confirmed','retired','flagged_for_safety'
  reviewer_id     TEXT NOT NULL REFERENCES users(id),
  notes_hash      TEXT,
  reviewed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## 6. Telemetry events emitted

| Event | Family | When |
|---|---|---|
| `kb_pack_updated` (A.9 #9) | A.9 | KB pack version published. |
| `kb_pack_update_candidate` **NEW** (A.9) | A.9 | Candidate queued for review. |
| `kb_pack_rolled_back` **NEW** (A.9) | A.9 | KB version rollback. |
| `model_version_promoted` (A.9 #8) | A.9 | Model promoted (after gate). |
| `model_version_rolled_back` **NEW** (A.9) | A.9 | Rollback triggered. |
| `bias_audit_completed` (A.9 #10) | A.9 | Audit finished. |
| `flywheel_optout_set` **NEW** (A.9) | A.9 | Workspace opted out of cross-network learning. |
| `flywheel_optout_cleared` **NEW** (A.9) | A.9 | Workspace re-enrolled. |
| `compliance_rule_candidate_raised` **NEW** (A.9) | A.9 | Rejection cluster threshold reached. |
| `ab_test_concluded` **NEW** (A.6) | A.6 | A/B test reaches statistical significance. |
| `pattern_retired` **NEW** (A.9) | A.9 | Quarterly review retired a pattern. |
| `recon_drift_detected` (A.9 existing) | A.9 | Lake vs Postgres drift > 0.1% (Doc 03 Â§C.5). |

## 7. Permissions enforced

| Capability | owner | admin | editor | analyst | viewer | billing |
|---|---|---|---|---|---|---|
| Toggle flywheel opt-out for own workspace | âœ… | âœ… | âŒ | âŒ | âŒ | âŒ |
| View own workspace's aggregated insights | âœ… | âœ… | âœ… | âœ… | âŒ | âŒ |
| Cross-network insights (anonymous) | âœ… | âœ… | âœ… | âœ… | âœ… | âŒ |
| Configure A/B tests on own funnels | âœ… | âœ… | âœ… | âŒ | âŒ | âŒ |

Admin-console (v1 PRD 5):
- `read_only`: view dashboards (aggregate, anonymous).
- `support`: view candidate queue (no PII).
- `engineering`: trigger retrains, view drift logs, force rollback.
- `super_admin`: approve KB-pack updates + model promotions; with co-sign for personae + ad-policy models.

T&S has dedicated permission `flywheel:review` (separate from admin roles) for the rule + pattern reviewer queues (Doc 07b Â§1).

## 8. Error states + recovery paths

| State | Behavior | Recovery |
|---|---|---|
| Iceberg compaction failure | Aggregator paused for affected partition | Auto-retry; on-call data eng |
| Anonymization rule miss (PII detected in curated row) | Pipeline halts; alert on-call; row quarantined | Manual fix + reprocess |
| K-anonymity floor breached for a published KB pack | Roll back the pack to prior version (`kb_pack_rolled_back`) | Manual review |
| Bias audit timeout | Promotion candidate stays `pending`; do not auto-promote | Re-run audit |
| Model rollout regression (â‰¥ 2% drop) | Auto-rollback; emit `model_version_rolled_back` | Engineering investigation |
| Compliance-feedback false positives flood | Reviewer queue overwhelmed; T&S triages | Manual + tune clustering thresholds |
| Lake vs Postgres recon drift > 0.1% | Freeze affected promotion path; emit `recon_drift_detected` (Doc 03 Â§A.9) | Manual recon |
| A/B test contamination (overlapping experiments on same funnel) | Exclude both from aggregator until resolved | Customer-initiated unblock |
| Opt-out cache stale | Synchronous invalidation; assertion test in CI ensures TTL=0 | Auto |
| External eval API (LLM judge) outage | Switch to secondary eval path or delay promotion | PAL |

## 9. Acceptance criteria

- [ ] Nightly ETL job completes within 4 h for the launch-day volume (well under the 24-h SLA budget).
- [ ] Anonymization rules: 100% drop of P2 fields in curated tables; verified by a daily scanner (`tooling/privacy/lake_scan.py`).
- [ ] K-anonymity â‰¥ 10 enforced for cross-network aggregations; below k=10 rows are dropped; verified by a fuzz test.
- [ ] DSAR row-level delete propagates across Iceberg tables; verified by a synthetic-DSAR drill within 7 days (Doc 03 Â§C.3).
- [ ] KB-pack update workflow: candidate â†’ human review â†’ publish â†’ Generation Engine picks up new version; verified end-to-end.
- [ ] Model promotion gate: eval passes + bias audit passes + human approval (+ co-sign for personae/ad-policy) â†’ `model_version_promoted` emitted; verified.
- [ ] Rollout: gradual 10% â†’ 50% â†’ 100% per 7 days; emergency rollback restores prior version within 5 min.
- [ ] Regression detector: 2% drop on production metric triggers auto-rollback; verified by chaos test.
- [ ] Bias-audit dimensions cover at least: language, geo, vertical-segment, age-band (proxied), and any other dimensions surfaced by Doc 07a Â§13.
- [ ] Compliance-feedback cluster threshold (20 instances) is configurable per platform; verified.
- [ ] Opt-out toggle: future aggregations exclude the workspace within the same run; verified.
- [ ] All events in Â§6 emitted with correct envelope; **NEW** events landed in Doc 03 Â§A.
- [ ] Reconciliation: lake vs Kafka offsets vs Postgres aggregate within 0.1% drift (Doc 03 Â§C.5).
- [ ] Coverage â‰¥ 85% on `flywheel-etl`, `anonymizer-svc`, `aggregator-svc`, `kb-update-svc`, `flywheel-optout-svc`.

## 10. Launch blockers

1. ETL writes from Kafka tail + agent_io into Iceberg per Doc 03 Â§C.4 (`raw/` + `curated/` + `feature_store/`).
2. Anonymization rules + privacy linter in CI.
3. K-anonymity enforcement on cross-network aggregations.
4. KB-pack update workflow (candidate â†’ human review â†’ publish â†’ consume).
5. Workspace opt-out toggle + cache invalidation + audit trail.
6. Model promotion gate (eval + bias + human + co-sign) + gradual rollout + rollback.
7. Compliance-feedback rejection clustering + T&S reviewer queue.
8. DSAR row-level delete on Iceberg verified by a synthetic-DSAR drill.
9. Recon drift detection between lake + Postgres + Kafka (Doc 03 Â§C.5).
10. Bias-audit pipeline live with at least 4 dimensions (Doc 07a Â§13).
11. Quarterly human-review queue scaffolded (top-100 patterns + audit log).
12. Kill switches: `killswitch.flywheel.global`, `killswitch.flywheel.kb_updates`.

## 11. Post-launch enhancements

- Real-time learning loop (rather than nightly) for high-volume signals (CTR, send-time).
- Federated learning (per-workspace fine-tuning that doesn't leave the workspace's region/boundary).
- LLM-as-judge for pattern quality (currently human-only).
- Counterfactual evaluation (what would have happened if we hadn't promoted X?).
- Per-customer customized model fine-tuning (Enterprise tier; explicit consent + price tag).
- Public transparency report ("here's what changed in our KB packs last quarter, here's why").
- Open dataset contributions (anonymized industry-pattern dataset published as a research contribution â€” gated by privacy review).
- Cost-aware retraining schedule (only retrain when expected lift > retraining cost).

## 12. Test plan

**Unit**
- Anonymizer: drop rules + k-anonymity bucketing on a 10k-row fixture.
- Aggregator: lift + Wilson + bootstrap confidence on synthetic fixtures with known ground truth.
- Dominance check (Herfindahl) on contributor-concentration fixtures.
- Compliance-feedback clustering on the 500-case rejection corpus.

**Integration**
- ETL nightly run on a 1-day-of-traffic synthetic dataset â†’ curated tables land + recon clean.
- KB-pack update candidate â†’ admin approve â†’ KB pack version published â†’ next generation reads the new pack.
- Model retraining â†’ bias-audit pass â†’ promotion candidate â†’ super_admin + cosign â†’ rollout 10% â†’ regression detector trips â†’ auto-rollback.
- Workspace opt-out toggle â†’ next aggregator run excludes; opt back in â†’ next run includes (no retroactive).
- DSAR row-level delete on a synthetic subject â†’ lake scrub verified across all curated tables within 7 days.

**E2E**
- A customer publishes funnel â†’ leads convert â†’ A/B test concludes â†’ aggregator surfaces pattern â†’ KB pack update â†’ next generation uses the new pack â†’ measured lift on follow-up funnels.

**Bias-audit (continuous)**
- Pre-promotion bias-audit dry run on a fixture model with known-biased data â†’ must report `verdict='fail'`; do not promote.
- Quarterly bias-audit of all in-production models (Doc 07a Â§13).

**Load**
- 100M-event-day-equivalent ETL run completes within 4 h on production-equivalent hardware; recon drift < 0.05%.

**Chaos**
- Iceberg compaction failure mid-aggregation â†’ aggregator pauses + retries cleanly.
- Lake-region failover (US-East â†’ EU-West) â†’ cross-region partitioning preserved; per-region KB packs unaffected.
- Synthetic DSAR drill: row-level delete propagation verified within the 7-day SLA.

---

## Appendix A â€” Cross-PRD interaction map (v1 + v2)

```
                       v1 PRD 1 (Onboarding)
                                 â”‚
                                 â–¼
              v1 PRD 2 (Generation Engine) â”€â”€â”€â”€â–º v1 PRD 3 (CRM + Lead Engine)
                       â”‚     â”‚     â”‚                  â”‚
                       â”‚     â”‚     â”‚                  â–¼
                       â”‚     â”‚     â””â”€â”€â”€â”€â”€â”€â–º   v2 PRD 6 (RevTry)  â”€â”€â–º outcomes back to PRD 3
                       â”‚     â”‚                       â”‚
                       â”‚     â”‚                       â–¼
                       â”‚     â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â–º v2 PRD 8 (Email + SMS Engine) â—„â”€â”€ triggers from PRD 3 / 6
                       â”‚                              â”‚
                       â–¼                              â–¼
                v2 PRD 7 (Ad Publishing) â”€â”€â”€â”€ pixels + conv. attribution
                       â”‚                              â”‚
                       â”‚                              â”‚
                       â–¼                              â–¼
                v1 PRD 4 (Billing) â—„â”€â”€ plan-state drives 07c ceilings + v2 PRD 6 minute meter + PRD 7 ad-spend caps
                       â”‚
                       â–¼
                v1 PRD 5 (Admin Console) â—„â”€â”€ reads everything; writes audited; admin replay for PRDs 6/7/8/9
                       â”‚
                       â–¼
                v2 PRD 9 (Notification Engine) â—„â”€â”€ subscribes to every event family; surfaces incidents from PRDs 6/7/8 + dunning + admin
                       â”‚
                       â–¼
                v2 PRD 10 (Recursive Learning) â—„â”€â”€ ingests events + agent_io; writes KB packs + model versions consumed by PRDs 1/2/6/7/8
```

Every arrow is a Kafka topic plus a synchronous read for cache-warming. Synchronous calls (e.g. v2 PRD 6 calling `kb-svc` for a script) follow PAL retry policy (Doc 04).

## Appendix B â€” New events introduced by v2 (to land in Doc 03)

All listed events must be added to Doc 03 Part A in the same PR that ships their PRD. Each must have: emitter, required props, optional props, consumers, retention, PII tier.

**A.1 Identity**
- `notification_emitted`, `notification_delivered`, `notification_delivery_failed`, `notification_channel_unavailable`, `notification_pref_updated`, `push_token_registered`, `push_token_revoked`, `digest_sent`.

**A.4 Distribution**
- `ads_guardrail_lifted`, `ad_creative_rotated`, `ad_policy_preflight_blocked`, `ad_pixel_installed`, `ad_pixel_verification_failed`, `email_provider_failover`, `domain_auth_verified`, `slack_webhook_auto_disabled`.

**A.5 Lead**
- `lead_call_opted_out`, `dnc_match_blocked`, `email_sent`, `email_delivered`, `email_opened`, `email_clicked`, `email_bounced`, `email_complained`, `email_unsubscribed`, `sequence_enrolled`, `sequence_enrollment_skipped`, `sequence_advanced`, `sequence_paused`, `sms_skipped_for_email`.

**A.6 Revenue â€” Customer Funnels**
- `conversion_recorded`, `attribution_mismatch_detected`, `ab_test_concluded`.

**A.7 Revenue â€” SaaS**
- `voice_minutes_metered`.

**A.8 Support**
- `admin_message_resent`.

**A.9 Governance**
- `revtry_fallback_activated`, `revtry_fallback_deactivated`, `a2p_brand_approved`, `a2p_brand_rejected`, `notification_deduped`, `kb_pack_update_candidate`, `kb_pack_rolled_back`, `model_version_rolled_back`, `flywheel_optout_set`, `flywheel_optout_cleared`, `compliance_rule_candidate_raised`, `pattern_retired`.

Each must pass `tooling/eventschema/` lint (Doc 03 Â§A.0 envelope conformance) before its PRD's launch blocker Â§10 can be marked done.

## Appendix C â€” Cross-cutting non-negotiables

Inherited from v1 Appendix C (Doc 12). Apply to every v2 PRD.

1. **Tenant isolation:** RLS on every workspace-scoped table; `notification_prefs` + `push_tokens` are user-scoped (RLS on `user_id`).
2. **PII discipline:** Doc 03 Â§C.2 tiering. RevTry recordings + transcripts treated as P2; lake-curated tables hold only P0/P1.
3. **Idempotency:** every mutating endpoint accepts `Idempotency-Key`; webhook handlers in v2 PRD 6/7/8/9 dedup on processor `event_id`.
4. **Auditing:** every admin write + every consent capture + every opt-out emits an event AND writes an `audit_log` row in the same transaction.
5. **Feature flags + kill switches:** every v2 service ships with `release.<area>.v1` + `killswitch.<area>` per Doc 08 Â§362.
6. **Observability:** every service has a Doc 08 Â§443 dashboard; SLOs + error budgets per service.
7. **Money discipline:** `Money` bigint (Doc 08 Â§65) for all amounts including voice-minute overage + ad spend.
8. **Test discipline:** unit + integration + E2E + load + chaos per each PRD; flake policy per Doc 08 Â§120.
9. **Legal docs wired:** TCPA, A2P 10DLC, CAN-SPAM, GDPR consent gating, two-party-consent jurisdiction handling, ad-platform policies â€” all enforced server-side, all cited to Doc 05 / Doc 07 / Doc 15.
10. **No silent T&S failures:** every Doc 07a/b/c gate emits a typed event + alert. Suppression-list write failure must fail closed.

---

**End of PRD Pack v2.**

Open issues / follow-ups to land before Day 90:
- Confirm the full **NEW** event list in Appendix B is added to Doc 03 with envelope + retention + PII tier in the same PR window. Block PRD 6/7/8/9/10 launch on this.
- Confirm Doc 15 launch-market coverage for: TCPA two-party-consent jurisdictions (RevTry), A2P 10DLC equivalent (Email + SMS), platform political-ads bans (Ad Publishing), multilingual STOP keywords (Email + SMS).
- Confirm the seven (or fewer, per Day-90 scope) ad platforms in PRD 7 Â§10 launch blockers. Meta + Google + TikTok is the minimum.
- Confirm the bias-audit dimensions for PRD 10 Â§9 with T&S + legal (Doc 07a Â§13).
- Confirm the mobile-app launch timing: PRD 9 push-token schema lands now; mobile native client is post-Day-90 unless brought forward.
- Confirm flywheel opt-out copy with Comms (Doc 09 founder content + Doc 11 help center) â€” needs a clear plain-language explanation of "what stays in the deployed KB pack vs what your opt-out removes from future learning".
- Confirm RevTry vendor SLA + escalation path (PRD 6 Â§10 #11).
