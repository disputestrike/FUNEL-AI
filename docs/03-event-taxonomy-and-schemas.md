# 03 — Event Taxonomy and Database Schemas

> **Status:** Canonical. Engineers and data engineers may begin migrations and event-producer work directly from this document.
> **Owners:** Platform (events bus), Data Eng (warehouse + lake), App Eng (Postgres), Trust & Safety (PII, retention).
> **Companion docs:** `01-product-overview.md`, `02-system-architecture.md`, `04-agent-pipeline.md`, `05-compliance-and-privacy.md`.

---

## Table of contents

- [0. Conventions](#0-conventions)
- [PART A — Canonical event taxonomy](#part-a--canonical-event-taxonomy)
  - [A.0 Envelope](#a0-envelope)
  - [A.1 Identity](#a1-identity)
  - [A.2 Generation](#a2-generation)
  - [A.3 Publish](#a3-publish)
  - [A.4 Distribution](#a4-distribution)
  - [A.5 Lead](#a5-lead)
  - [A.6 Revenue — Customer Funnels](#a6-revenue--customer-funnels)
  - [A.7 Revenue — Our SaaS](#a7-revenue--our-saas)
  - [A.8 Support](#a8-support)
  - [A.9 Governance](#a9-governance)
- [PART B — Database schemas (Postgres + Prisma-friendly)](#part-b--database-schemas-postgres--prisma-friendly)
- [PART C — Data lifecycle, PII, retention, lake](#part-c--data-lifecycle-pii-retention-lake)

---

## 0. Conventions

**Naming**

- Event names: `snake_case`, present-or-past tense, namespaced by family (e.g. `lead_sms_sent`, `funnel_published`).
- Table names: `PascalCase` singular (Prisma convention). Prisma `@@map` to `snake_case` plural in Postgres (e.g. `User` â†’ `users`).
- Column names: `snake_case`.
- IDs: ULID strings, 26 chars, prefix per entity (e.g. `usr_01HX…`, `wsp_01HX…`, `fnl_01HX…`, `lds_01HX…`). Stored as `TEXT` with `CHECK (length = 30)` — prefix is 4 chars including the underscore. Sortable, URL-safe, no hot index keys.
- Timestamps: `TIMESTAMPTZ`, UTC, microsecond precision. Always include `created_at` and `updated_at` on writable tables.
- Soft delete: `deleted_at TIMESTAMPTZ NULL`. App and Prisma middleware filter on `deleted_at IS NULL` by default. Hard delete only on GDPR/CCPA cascade.
- Money: `BIGINT` minor units (cents) + `CHAR(3)` ISO-4217 currency. Never floats.
- Tenancy: every workspace-scoped row carries `workspace_id` for RLS and partition pruning.
- JSON: `JSONB`, never `JSON`. Always include a `_schema_version` key when the blob is consumer-facing.

**Event envelope versioning**

- `schema_version` is mandatory and starts at `1`. Breaking changes bump major; additive changes do not. Producers may emit `n` and `n+1` simultaneously during a migration window of 30 days.

**Event bus**

- Primary transport: Kafka (topic-per-family). Mirror to S3/Iceberg (`raw.events.<family>`) within 60s. Postgres `EventLog` is a hot tail for the last 90 days (operational queries, support tools).
- All events idempotent via `event_id` (ULID, producer-generated). Consumers must dedupe.

**PII tiering** (used throughout):

- **P0** — non-PII (event types, counts, timestamps, model IDs).
- **P1** — pseudonymous (workspace_id, user_id, lead_id without contact info).
- **P2** — direct PII (name, email, phone, IP, device ID).
- **P3** — sensitive PII (financial PAN, government ID, health, race/sexual orientation). GoFunnelAI stores P3 only via tokenized references to Stripe/Plaid; we do not warehouse P3.

---

## PART A — Canonical event taxonomy

### A.0 Envelope

Every event, regardless of family, ships in this envelope. Family-specific properties live under `properties`.

```json
{
  "event_id": "evt_01HXABCDEFGHJKMNPQRSTVWXYZ",
  "event_name": "lead_sms_sent",
  "event_family": "lead",
  "schema_version": 1,
  "occurred_at": "2026-05-25T17:42:01.123456Z",
  "received_at":  "2026-05-25T17:42:01.501221Z",
  "producer": {
    "service": "revtry-worker",
    "version": "2026.05.21-a3f1",
    "host": "revtry-worker-7f8c9d-2k4xp",
    "region": "us-east-1"
  },
  "tenancy": {
    "workspace_id": "wsp_01HX…",
    "environment": "production"
  },
  "actor": {
    "type": "user | agent | system | admin | anonymous",
    "user_id": "usr_01HX…",        
    "agent_id": "agt_outreach_v12",
    "impersonator_user_id": null
  },
  "subject": {
    "type": "lead | funnel | workspace | subscription | …",
    "id": "lds_01HX…"
  },
  "context": {
    "ip": "203.0.113.42",
    "ip_hash": "sha256:…",
    "user_agent": "…",
    "session_id": "ses_01HX…",
    "request_id": "req_01HX…",
    "trace_id": "00-…-…-01",
    "locale": "en-US",
    "country": "US"
  },
  "consent": {
    "marketing": true,
    "analytics": true,
    "ai_training": false,
    "consent_id": "cns_01HX…"
  },
  "properties": { /* family-specific, see below */ },
  "pii_class": "P0 | P1 | P2 | P3"
}
```

**Required on every event:** `event_id`, `event_name`, `event_family`, `schema_version`, `occurred_at`, `producer.service`, `tenancy.workspace_id` (except pre-signup events, where it is `null` and `actor.type = "anonymous"`), `actor.type`, `pii_class`.

---

### A.1 Identity

Captures human and tenant lifecycle. Drives auth, billing entitlements, audit trail, security alerts.

| # | Event | Emitter | Required props | Optional props | Consumers | Retention | PII |
|---|-------|---------|----------------|----------------|-----------|-----------|-----|
| 1 | `user_signed_up` | `auth-svc` | `user_id`, `email`, `signup_method` | `referrer`, `utm`, `invite_id`, `marketing_consent` | Growth, CRM, lifecycle email, billing | 7y | P2 |
| 2 | `user_verified_email` | `auth-svc` | `user_id`, `email` | `verification_token_age_sec` | Growth, security | 7y | P2 |
| 3 | `user_logged_in` | `auth-svc` | `user_id`, `method`, `mfa_used` | `device_id`, `geo_country`, `geo_city` | Security, product analytics | 13mo | P2 |
| 4 | `user_logged_out` | `auth-svc` | `user_id`, `session_id`, `reason` | — | Security | 13mo | P1 |
| 5 | `user_password_reset_requested` | `auth-svc` | `user_id_or_email_hash`, `request_ip_hash` | `delivery_channel` | Security, support | 7y | P2 |
| 6 | `user_password_changed` | `auth-svc` | `user_id`, `change_method` | — | Security, audit | 7y | P1 |
| 7 | `user_mfa_enrolled` | `auth-svc` | `user_id`, `factor_type` | `device_fingerprint_hash` | Security, audit | 7y | P1 |
| 8 | `user_mfa_used` | `auth-svc` | `user_id`, `factor_type`, `outcome` | `challenge_id` | Security | 13mo | P1 |
| 9 | `user_new_device_login` | `auth-svc` | `user_id`, `device_id`, `geo_country` | `risk_score`, `ip_hash`, `ua_family` | Security, lifecycle email | 13mo | P2 |
| 10 | `user_deactivated` | `auth-svc` / admin | `user_id`, `reason`, `actor_user_id` | — | Billing, audit | 7y | P1 |
| 11 | `user_deleted` | `auth-svc` | `user_id`, `request_id`, `cascade_summary` | `gdpr_request_id` | Compliance, audit | **kept forever** (tombstone only) | P0 |
| 12 | `workspace_created` | `workspace-svc` | `workspace_id`, `owner_user_id`, `plan`, `region` | `template_id`, `vertical` | Billing, growth, provisioning | 7y | P1 |
| 13 | `workspace_member_invited` | `workspace-svc` | `workspace_id`, `inviter_user_id`, `invitee_email`, `role` | `invite_id`, `expires_at` | Lifecycle email, audit | 7y | P2 |
| 14 | `workspace_member_joined` | `workspace-svc` | `workspace_id`, `user_id`, `role`, `invite_id` | — | Growth, audit | 7y | P1 |
| 15 | `workspace_member_removed` | `workspace-svc` | `workspace_id`, `user_id`, `actor_user_id`, `reason` | — | Audit | 7y | P1 |
| 16 | `workspace_role_changed` | `workspace-svc` | `workspace_id`, `user_id`, `from_role`, `to_role`, `actor_user_id` | — | Audit, security | 7y | P1 |
| 17 | `workspace_ownership_transferred` | `workspace-svc` | `workspace_id`, `from_user_id`, `to_user_id`, `actor_user_id` | `legal_doc_ref` | Audit, billing | 7y | P1 |
| 18 | `workspace_closed` | `workspace-svc` | `workspace_id`, `actor_user_id`, `reason`, `data_disposition` | `final_invoice_id` | Billing, compliance | 7y | P1 |

**Example payload (`user_signed_up`):**

```json
{
  "event_name": "user_signed_up",
  "event_family": "identity",
  "properties": {
    "user_id": "usr_01HX…",
    "email": "kara@acme.example",
    "signup_method": "google_oauth",
    "referrer": "https://www.producthunt.com/posts/funnel-ai",
    "utm": { "source": "ph", "medium": "social", "campaign": "launch" },
    "invite_id": null,
    "marketing_consent": true
  },
  "pii_class": "P2"
}
```

---

### A.2 Generation

Emitted by the agent pipeline (see `04-agent-pipeline.md`). Drives the learning flywheel, quality dashboards, model promotion gates, and regulated-vertical audit trails.

| # | Event | Emitter | Required props | Optional props | Consumers | Retention | PII |
|---|-------|---------|----------------|----------------|-----------|-----------|-----|
| 1 | `generation_started` | `orchestrator` | `generation_id`, `funnel_id?`, `vertical`, `prompt_hash`, `model_lineup` | `kb_pack_ids`, `parent_generation_id`, `requested_by_user_id` | Flywheel, analytics, support | 5y | P1 |
| 2 | `generation_completed` | `orchestrator` | `generation_id`, `duration_ms`, `token_usage`, `cost_usd_micros`, `output_asset_ids[]`, `final_quality_score` | `agent_breakdown[]`, `cache_hit_ratio` | Flywheel, billing, analytics | 5y | P1 |
| 3 | `generation_regenerated` | `orchestrator` | `generation_id`, `previous_generation_id`, `regenerate_reason`, `delta_summary` | `user_id`, `nudges[]` | Flywheel, support | 5y | P1 |
| 4 | `agent_invoked` | each agent | `generation_id`, `agent_id`, `agent_version`, `input_hash`, `output_hash`, `duration_ms`, `token_usage`, `cost_usd_micros`, `outcome` | `tools_called[]`, `retries`, `model_id`, `temperature` | Flywheel, cost, evals | 5y | P0/P1 |
| 5 | `quality_score_computed` | `quality-svc` | `generation_id`, `score`, `rubric_version`, `dimensions{}` | `rater`, `reference_set_id` | Flywheel, dashboards | 5y | P0 |
| 6 | `quality_failed` | `quality-svc` | `generation_id`, `reason_code`, `reason_detail`, `severity` | `auto_remediation_taken` | Flywheel, alerting, support | 5y | P0 |
| 7 | `fact_check_flag_raised` | `fact-check-agent` | `generation_id`, `claim_text_hash`, `claim_type`, `confidence`, `evidence_refs[]` | `human_review_required` | Compliance, content moderation | 5y | P0 |
| 8 | `compliance_block_raised` | `compliance-agent` | `generation_id`, `policy_id`, `vertical`, `severity`, `blocked_assets[]` | `redaction_applied` | Compliance, legal | 7y | P0 |
| 9 | `human_review_required` | `review-svc` | `generation_id`, `reason`, `queue`, `sla_due_at` | `assigned_to_user_id`, `priority` | Ops, support | 7y | P1 |
| 10 | `human_review_completed` | `review-svc` | `generation_id`, `reviewer_user_id`, `decision`, `decided_at` | `notes_hash`, `policy_overrides[]` | Compliance, flywheel | 7y | P1 |

**Example (`agent_invoked`):**

```json
{
  "event_name": "agent_invoked",
  "event_family": "generation",
  "properties": {
    "generation_id": "gen_01HX…",
    "agent_id": "copy_agent",
    "agent_version": "2026.05.18-c",
    "model_id": "claude-opus-4-7",
    "input_hash": "sha256:8a…",
    "output_hash": "sha256:1b…",
    "duration_ms": 4127,
    "token_usage": { "input": 3120, "output": 1840, "cache_read": 12500 },
    "cost_usd_micros": 47830,
    "outcome": "ok",
    "tools_called": ["kb_lookup", "web_search"],
    "retries": 0
  },
  "pii_class": "P0"
}
```

---

### A.3 Publish

Lifecycle of a funnel artifact going live, coming down, or being re-used.

| # | Event | Emitter | Required props | Optional props | Consumers | Retention | PII |
|---|-------|---------|----------------|----------------|-----------|-----------|-----|
| 1 | `funnel_published` | `publish-svc` | `funnel_id`, `funnel_version_id`, `actor_user_id`, `url`, `regions[]` | `custom_domain_id`, `ai_disclosure_visible` | Analytics, CRM, compliance | 7y | P1 |
| 2 | `funnel_unpublished` | `publish-svc` | `funnel_id`, `funnel_version_id`, `actor_user_id`, `reason` | `restore_token` | Audit | 7y | P1 |
| 3 | `funnel_archived` | `publish-svc` | `funnel_id`, `actor_user_id` | `archive_reason` | Billing, audit | 7y | P1 |
| 4 | `funnel_cloned` | `publish-svc` | `source_funnel_id`, `target_funnel_id`, `actor_user_id` | `clone_scope`, `cross_workspace` | Analytics | 7y | P1 |
| 5 | `funnel_imported` | `import-svc` | `funnel_id`, `actor_user_id`, `import_source`, `source_artifact_hash` | `mapping_warnings[]` | Analytics, support | 7y | P1 |
| 6 | `custom_domain_connected` | `domain-svc` | `funnel_id`, `domain`, `verification_method` | `dns_records_set[]` | Ops, support | 7y | P1 |
| 7 | `ssl_provisioned` | `domain-svc` | `domain`, `cert_id`, `issuer`, `expires_at` | `renewal_strategy` | Ops | 3y | P0 |
| 8 | `publish_acknowledged` | `publish-svc` | `funnel_id`, `funnel_version_id`, `vertical`, `acknowledger_user_id`, `attestation_text_hash`, `signed_at` | `e_signature_provider`, `signature_id` | **Compliance (regulated verticals)** | **10y** | P2 |

`publish_acknowledged` is the regulated-vertical attestation event. Required for finance/health/legal verticals before a funnel can transition `draft â†’ live`. Linked to a frozen `FunnelVersion` snapshot.

---

### A.4 Distribution

Outbound activation. Drives spend reconciliation, channel attribution, ad-platform compliance.

| # | Event | Emitter | Required props | Optional props | Consumers | Retention | PII |
|---|-------|---------|----------------|----------------|-----------|-----------|-----|
| 1 | `ad_campaign_created` | `ads-svc` | `campaign_id`, `funnel_id`, `platform`, `objective`, `budget_micros`, `currency` | `audience_def_hash`, `creative_asset_ids[]` | Analytics, billing | 7y | P1 |
| 2 | `ad_campaign_launched` | `ads-svc` | `campaign_id`, `platform`, `external_campaign_id`, `launched_at` | `daily_cap_micros` | Analytics | 7y | P1 |
| 3 | `ad_campaign_paused` | `ads-svc` | `campaign_id`, `reason`, `actor` | `auto_pause_rule_id` | Ops, analytics | 7y | P1 |
| 4 | `ad_rejected` | `ads-svc` | `campaign_id`, `platform`, `rejection_code`, `rejection_text` | `policy_doc_ref`, `auto_appeal_filed` | Compliance, support | 7y | P1 |
| 5 | `social_post_scheduled` | `social-svc` | `post_id`, `funnel_id`, `platform`, `scheduled_for` | `content_hash` | Analytics | 3y | P1 |
| 6 | `social_post_published` | `social-svc` | `post_id`, `platform`, `external_post_id`, `published_at` | `permalink` | Analytics | 3y | P1 |
| 7 | `qr_generated` | `link-svc` | `qr_id`, `funnel_id`, `target_url`, `style_preset` | `physical_use_case` | Analytics | 3y | P0 |
| 8 | `short_link_created` | `link-svc` | `short_link_id`, `slug`, `target_url`, `funnel_id` | `expires_at`, `password_protected` | Analytics | 3y | P0 |

---

### A.5 Lead

The most volumetric family. Each lead’s full journey from capture â†’ revtry call â†’ booking. Powers SLAs, opt-out compliance, conversion analytics, RevTry agent training.

| # | Event | Emitter | Required props | Optional props | Consumers | Retention | PII |
|---|-------|---------|----------------|----------------|-----------|-----------|-----|
| 1 | `lead_captured` | `capture-svc` | `lead_id`, `funnel_id`, `funnel_version_id`, `capture_source`, `consent_id`, `contact_fields_hashed{}` | `landing_page_id`, `utm`, `referrer`, `ip_hash`, `geo_country` | CRM, scoring, RevTry, analytics | 5y | P2 |
| 2 | `lead_scored` | `scoring-agent` | `lead_id`, `score`, `model_version`, `features_hash` | `band` (`hot/warm/cold`), `explanations[]` | RevTry, analytics, flywheel | 5y | P1 |
| 3 | `lead_sms_sent` | `sms-svc` | `lead_id`, `message_id`, `sequence_id`, `template_id`, `from_number`, `country` | `personalization_token_count` | Compliance, analytics | 5y | P2 |
| 4 | `lead_sms_delivered` | `sms-svc` (carrier webhook) | `lead_id`, `message_id`, `delivery_status`, `carrier_code` | `latency_ms` | Analytics, ops | 5y | P1 |
| 5 | `lead_sms_opted_out` | `sms-svc` | `lead_id`, `keyword`, `received_at`, `from_number` | `legal_basis` | **Compliance (TCPA/CAN-SPAM)**, suppression list | **10y** | P2 |
| 6 | `lead_revtry_call_started` | `revtry-worker` | `lead_id`, `call_id`, `agent_voice_id`, `from_number`, `to_number_hash`, `attempt_n` | `script_version`, `tts_provider` | RevTry, compliance | 3y (transcripts) / 7y (metadata) | P2 |
| 7 | `lead_revtry_call_completed` | `revtry-worker` | `lead_id`, `call_id`, `duration_sec`, `outcome`, `disposition_code`, `recording_url?`, `transcript_url?` | `sentiment_score`, `objections[]`, `consent_recorded` | RevTry flywheel, analytics, support | 3y (recordings) / 7y (metadata) | P2 |
| 8 | `lead_voicemail_left` | `revtry-worker` | `lead_id`, `call_id`, `vm_audio_url`, `script_version` | `length_sec` | Analytics | 3y | P2 |
| 9 | `lead_qualified` | `scoring-agent` / human | `lead_id`, `qualifier`, `qualifier_method`, `criteria_id` | `notes_hash` | CRM, RevTry | 5y | P1 |
| 10 | `lead_disqualified` | `scoring-agent` / human | `lead_id`, `reason_code`, `disqualifier` | `notes_hash` | CRM, flywheel | 5y | P1 |
| 11 | `lead_booking_created` | `booking-svc` | `lead_id`, `booking_id`, `calendar_event_id`, `scheduled_for`, `host_user_id` | `meeting_url`, `notes_hash` | CRM, analytics, lifecycle | 5y | P2 |
| 12 | `lead_booking_canceled` | `booking-svc` | `booking_id`, `canceled_by`, `cancel_reason` | `reschedule_token` | CRM, analytics | 5y | P1 |

**TCPA/A2P 10DLC compliance properties** — every SMS event must carry:

```json
"compliance": {
  "consent_id": "cns_…",
  "consent_method": "web_form_double_optin",
  "consent_timestamp": "2026-05-25T12:00:00Z",
  "consent_ip_hash": "sha256:…",
  "campaign_use_case": "lead_alerts",
  "brand_id": "brand_…"
}
```

**Example (`lead_captured`):**

```json
{
  "event_name": "lead_captured",
  "event_family": "lead",
  "properties": {
    "lead_id": "lds_01HX…",
    "funnel_id": "fnl_01HX…",
    "funnel_version_id": "fvr_01HX…",
    "capture_source": "landing_page_form",
    "consent_id": "cns_01HX…",
    "contact_fields_hashed": {
      "email_sha256": "…",
      "phone_e164_sha256": "…"
    },
    "utm": { "source": "facebook", "medium": "cpc", "campaign": "spring2026" }
  },
  "pii_class": "P2"
}
```

---

### A.6 Revenue — Customer Funnels

Money flowing **through** a customer’s funnel to the customer. We are facilitator, not merchant of record by default.

| # | Event | Emitter | Required props | Optional props | Consumers | Retention | PII |
|---|-------|---------|----------------|----------------|-----------|-----------|-----|
| 1 | `checkout_started` | `checkout-svc` | `checkout_id`, `funnel_id`, `lead_id?`, `amount_micros`, `currency`, `processor` | `coupon_code`, `tax_estimate_micros` | Analytics, attribution | 5y | P1 |
| 2 | `checkout_paid` | `checkout-svc` (processor webhook) | `checkout_id`, `external_payment_id`, `amount_micros`, `currency`, `paid_at` | `processor_fee_micros`, `payment_method_type` | Analytics, billing recon | 7y | P1 |
| 3 | `checkout_failed` | `checkout-svc` | `checkout_id`, `failure_code`, `failure_text`, `processor` | `attempt_n` | Analytics, support | 5y | P1 |
| 4 | `refund_issued` | `checkout-svc` | `refund_id`, `external_payment_id`, `amount_micros`, `currency`, `reason_code` | `actor_user_id`, `notes_hash` | Analytics, support | 7y | P1 |
| 5 | `dispute_opened` | processor webhook | `dispute_id`, `external_payment_id`, `amount_micros`, `currency`, `reason_code`, `due_by` | `evidence_required[]` | Risk, support | 7y | P1 |
| 6 | `dispute_resolved` | processor webhook | `dispute_id`, `outcome`, `resolved_at` | `final_amount_micros`, `evidence_id` | Risk, analytics | 7y | P1 |

---

### A.7 Revenue — Our SaaS

Money flowing **to GoFunnelAI**. Drives MRR, churn analytics, dunning, account suspension.

| # | Event | Emitter | Required props | Optional props | Consumers | Retention | PII |
|---|-------|---------|----------------|----------------|-----------|-----------|-----|
| 1 | `trial_started` | `billing-svc` | `subscription_id`, `workspace_id`, `plan`, `trial_ends_at` | `acquisition_source` | Lifecycle, growth | 7y | P1 |
| 2 | `trial_ended` | `billing-svc` | `subscription_id`, `outcome` (`converted`/`expired`/`canceled`) | `plan_at_conversion` | Growth, billing | 7y | P1 |
| 3 | `plan_upgraded` | `billing-svc` | `subscription_id`, `from_plan`, `to_plan`, `actor_user_id`, `effective_at` | `proration_amount_micros` | Billing, growth | 7y | P1 |
| 4 | `plan_downgraded` | `billing-svc` | `subscription_id`, `from_plan`, `to_plan`, `actor_user_id`, `effective_at` | `reason_code` | Billing, churn | 7y | P1 |
| 5 | `plan_paused` | `billing-svc` | `subscription_id`, `actor_user_id`, `resume_at?` | `reason_code` | Billing | 7y | P1 |
| 6 | `plan_resumed` | `billing-svc` | `subscription_id`, `actor_user_id` | — | Billing | 7y | P1 |
| 7 | `subscription_canceled` | `billing-svc` | `subscription_id`, `actor_user_id`, `effective_at`, `reason_code` | `feedback_hash` | Churn, growth | 7y | P1 |
| 8 | `payment_succeeded` | `billing-svc` (Stripe webhook) | `invoice_id`, `payment_id`, `amount_micros`, `currency`, `paid_at` | `payment_method_type` | Billing, GL | 7y | P1 |
| 9 | `payment_failed` | `billing-svc` | `invoice_id`, `payment_id?`, `failure_code`, `attempt_n` | `next_retry_at` | Dunning, support | 7y | P1 |
| 10 | `dunning_step_executed` | `dunning-svc` | `subscription_id`, `step`, `action`, `channel` | `template_id` | Dunning, support | 7y | P1 |
| 11 | `account_suspended` | `billing-svc` / admin | `workspace_id`, `reason_code`, `actor` | `expected_restore_at` | Support, ops | 7y | P1 |
| 12 | `account_restored` | `billing-svc` / admin | `workspace_id`, `actor_user_id` | `notes_hash` | Support | 7y | P1 |
| 13 | `account_closed` | `billing-svc` | `workspace_id`, `actor_user_id`, `final_invoice_id`, `data_disposition` | `notes_hash` | Compliance, billing | 7y | P1 |

---

### A.8 Support

Generated by support tooling and admin actions. Anything an internal employee does that touches customer data emits one of these.

| # | Event | Emitter | Required props | Optional props | Consumers | Retention | PII |
|---|-------|---------|----------------|----------------|-----------|-----------|-----|
| 1 | `ticket_opened` | `support-svc` | `ticket_id`, `workspace_id?`, `requester_user_id?`, `channel`, `subject_hash` | `priority`, `tags[]` | Support, analytics | 5y | P1 |
| 2 | `ticket_assigned` | `support-svc` | `ticket_id`, `assignee_user_id`, `actor_user_id` | `from_assignee_user_id` | Support | 5y | P1 |
| 3 | `ticket_resolved` | `support-svc` | `ticket_id`, `resolver_user_id`, `resolution_code`, `resolved_at` | `csat_score`, `time_to_resolve_sec` | Support, analytics | 5y | P1 |
| 4 | `impersonation_started` | `admin-svc` | `admin_user_id`, `target_user_id`, `workspace_id`, `justification_ticket_id`, `expires_at` | `scope[]` | **Audit (mandatory)**, security | **10y** | P1 |
| 5 | `impersonation_ended` | `admin-svc` | `session_id`, `admin_user_id`, `target_user_id`, `actions_summary[]` | `ended_reason` | Audit, security | 10y | P1 |
| 6 | `internal_note_added` | `support-svc` | `ticket_id`, `author_user_id`, `note_id`, `note_hash`, `visibility` | `mentions[]` | Support | 5y | P1 |
| 7 | `admin_credit_applied` | `admin-svc` | `workspace_id`, `credit_id`, `amount_micros`, `currency`, `actor_user_id`, `justification_ticket_id` | `expires_at` | Billing, audit | 7y | P1 |
| 8 | `admin_refund_issued` | `admin-svc` | `workspace_id`, `refund_id`, `amount_micros`, `currency`, `actor_user_id`, `justification_ticket_id` | `external_refund_id` | Billing, audit | 7y | P1 |

`impersonation_started` and `_ended` are bookends. Every admin action between them is annotated with `actor.impersonator_user_id` on its native event.

---

### A.9 Governance

Trust, safety, model ops, and regulatory hooks.

| # | Event | Emitter | Required props | Optional props | Consumers | Retention | PII |
|---|-------|---------|----------------|----------------|-----------|-----------|-----|
| 1 | `ai_disclosure_rendered` | `web-runtime` | `funnel_id`, `funnel_version_id`, `disclosure_text_hash`, `surface`, `viewer_session_id` | `locale`, `geo_country` | Compliance | 7y | P0 |
| 2 | `consent_captured` | `consent-svc` | `consent_id`, `subject_type` (`user`/`lead`/`workspace`), `subject_id_hash`, `purpose`, `method`, `version`, `ip_hash` | `proof_artifact_url`, `geo_country` | Compliance, marketing | **10y** | P2 |
| 3 | `consent_withdrawn` | `consent-svc` | `consent_id`, `subject_type`, `subject_id_hash`, `withdrawn_at`, `method` | `reason_code` | Compliance, suppression | 10y | P2 |
| 4 | `data_export_requested` | `privacy-svc` | `request_id`, `subject_type`, `subject_id`, `legal_basis` (`gdpr_dsar`/`ccpa`/`user_self_serve`), `requested_by` | `due_by`, `regulatory_jurisdiction` | Compliance, ops | 10y | P2 |
| 5 | `data_export_delivered` | `privacy-svc` | `request_id`, `delivered_at`, `artifact_url`, `artifact_sha256`, `delivery_channel` | `expires_at` | Compliance | 10y | P2 |
| 6 | `data_deletion_requested` | `privacy-svc` | `request_id`, `subject_type`, `subject_id`, `legal_basis`, `requested_by` | `due_by` | Compliance | 10y | P2 |
| 7 | `data_deletion_completed` | `privacy-svc` | `request_id`, `completed_at`, `scope_summary{}`, `tombstone_ids[]` | `verifier_user_id` | Compliance, audit | **kept forever (tombstone)** | P0 |
| 8 | `model_version_promoted` | `mlops-svc` | `model_id`, `from_version`, `to_version`, `promoter_user_id`, `eval_report_id` | `rollback_plan_ref` | MLOps, audit | 7y | P0 |
| 9 | `kb_pack_updated` | `kb-svc` | `kb_pack_id`, `version`, `vertical`, `actor_user_id`, `change_summary` | `regulatory_source_refs[]` | Compliance, MLOps | 7y | P0 |
| 10 | `bias_audit_completed` | `mlops-svc` | `audit_id`, `model_id`, `version`, `dimensions_tested[]`, `verdict`, `report_url`, `auditor` | `mitigation_actions[]` | Compliance, board reporting | 10y | P0 |

---

## PART B — Database schemas (Postgres + Prisma-friendly)

> **Conventions.** Postgres 15+. All workspace-scoped tables include `workspace_id TEXT NOT NULL` plus an RLS policy `USING (workspace_id = current_setting('app.workspace_id'))`. Soft delete via `deleted_at`. Foreign keys use `ON DELETE` policies appropriate for cascade safety (RESTRICT default; SET NULL or CASCADE called out where used). Every table has `created_at` and (where mutable) `updated_at`, both `TIMESTAMPTZ NOT NULL DEFAULT now()`. The Prisma `@@map` and column `@map` directives are implicit — column and table names below are the Postgres physical names.

### B.0 Common DDL prelude

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- Set on every connection by the app; RLS policies key on this.
-- SET app.workspace_id = 'wsp_…';

CREATE TYPE workspace_role     AS ENUM ('owner','admin','editor','analyst','viewer','billing');
CREATE TYPE subscription_status AS ENUM ('trialing','active','past_due','paused','canceled','suspended');
CREATE TYPE invoice_status     AS ENUM ('draft','open','paid','void','uncollectible');
CREATE TYPE lead_status        AS ENUM ('new','contacted','qualified','disqualified','booked','converted','closed');
CREATE TYPE call_outcome       AS ENUM ('answered','no_answer','voicemail','busy','failed','do_not_call');
CREATE TYPE asset_type         AS ENUM ('page','copy','image','video','script','email','sms','ad_creative','form');
CREATE TYPE funnel_status      AS ENUM ('draft','review','live','paused','archived');
CREATE TYPE pii_tier           AS ENUM ('P0','P1','P2','P3');
```

---

### B.1 `users`

```sql
CREATE TABLE users (
  id                   TEXT PRIMARY KEY,                              -- usr_…
  email                CITEXT NOT NULL,
  email_normalized     CITEXT GENERATED ALWAYS AS (lower(email)) STORED,
  email_verified_at    TIMESTAMPTZ,
  full_name            TEXT,
  avatar_url           TEXT,
  locale               TEXT NOT NULL DEFAULT 'en-US',
  timezone             TEXT NOT NULL DEFAULT 'UTC',
  password_hash        TEXT,                                          -- argon2id
  password_changed_at  TIMESTAMPTZ,
  mfa_enrolled         BOOLEAN NOT NULL DEFAULT FALSE,
  mfa_factors          JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_login_at        TIMESTAMPTZ,
  last_login_ip_hash   TEXT,
  is_internal          BOOLEAN NOT NULL DEFAULT FALSE,                -- GoFunnelAI employees
  deactivated_at       TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at           TIMESTAMPTZ
);
CREATE UNIQUE INDEX users_email_unique ON users (email_normalized) WHERE deleted_at IS NULL;
CREATE INDEX users_last_login_idx ON users (last_login_at DESC);
```

### B.2 `workspaces`

```sql
CREATE TABLE workspaces (
  id                  TEXT PRIMARY KEY,                              -- wsp_…
  slug                CITEXT NOT NULL,
  name                TEXT NOT NULL,
  owner_user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  plan                TEXT NOT NULL DEFAULT 'trial',
  vertical            TEXT,                                          -- e.g. 'real_estate','coaching','finance'
  region              TEXT NOT NULL DEFAULT 'us-east-1',             -- data residency
  data_residency_lock BOOLEAN NOT NULL DEFAULT FALSE,
  brand_colors        JSONB NOT NULL DEFAULT '{}'::jsonb,
  feature_flags       JSONB NOT NULL DEFAULT '{}'::jsonb,
  ai_training_opt_in  BOOLEAN NOT NULL DEFAULT FALSE,
  closed_at           TIMESTAMPTZ,
  closed_reason       TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at          TIMESTAMPTZ
);
CREATE UNIQUE INDEX workspaces_slug_unique ON workspaces (slug) WHERE deleted_at IS NULL;
CREATE INDEX workspaces_owner_idx ON workspaces (owner_user_id);
CREATE INDEX workspaces_region_idx ON workspaces (region);
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
CREATE POLICY workspace_self ON workspaces
  USING (id = current_setting('app.workspace_id', true));
```

### B.3 `workspace_members`

```sql
CREATE TABLE workspace_members (
  id              TEXT PRIMARY KEY,                                  -- wsm_…
  workspace_id    TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role            workspace_role NOT NULL,
  invited_by      TEXT REFERENCES users(id),
  invited_at      TIMESTAMPTZ,
  joined_at       TIMESTAMPTZ,
  removed_at      TIMESTAMPTZ,
  removed_by      TEXT REFERENCES users(id),
  last_seen_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX wsm_workspace_user_unique
  ON workspace_members (workspace_id, user_id) WHERE removed_at IS NULL;
CREATE INDEX wsm_workspace_idx ON workspace_members (workspace_id);
CREATE INDEX wsm_user_idx ON workspace_members (user_id);
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY wsm_tenant ON workspace_members
  USING (workspace_id = current_setting('app.workspace_id', true));
```

### B.4 `funnels` and `funnel_versions`

```sql
CREATE TABLE funnels (
  id                  TEXT PRIMARY KEY,                              -- fnl_…
  workspace_id        TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  slug                CITEXT NOT NULL,
  status              funnel_status NOT NULL DEFAULT 'draft',
  vertical            TEXT,
  current_version_id  TEXT,                                          -- fk added later (cyclic)
  live_url            TEXT,
  custom_domain_id    TEXT,
  ai_disclosure       JSONB NOT NULL DEFAULT '{"enabled":true}'::jsonb,
  created_by          TEXT NOT NULL REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at         TIMESTAMPTZ,
  deleted_at          TIMESTAMPTZ
);
CREATE UNIQUE INDEX funnels_workspace_slug_unique
  ON funnels (workspace_id, slug) WHERE deleted_at IS NULL;
CREATE INDEX funnels_workspace_status_idx ON funnels (workspace_id, status);
ALTER TABLE funnels ENABLE ROW LEVEL SECURITY;
CREATE POLICY funnels_tenant ON funnels
  USING (workspace_id = current_setting('app.workspace_id', true));

CREATE TABLE funnel_versions (
  id                  TEXT PRIMARY KEY,                              -- fvr_…
  workspace_id        TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  funnel_id           TEXT NOT NULL REFERENCES funnels(id) ON DELETE CASCADE,
  version_number      INTEGER NOT NULL,
  generation_id       TEXT,                                          -- gen_…
  source              TEXT NOT NULL,                                 -- 'agent','import','clone','manual'
  parent_version_id   TEXT REFERENCES funnel_versions(id),
  artifact_hash       TEXT NOT NULL,                                 -- sha256 of full bundle
  bundle_s3_uri       TEXT NOT NULL,                                 -- frozen snapshot
  copy_blob           JSONB NOT NULL,                                -- canonical copy tree
  design_blob         JSONB NOT NULL,                                -- canonical design tree
  config_blob         JSONB NOT NULL,                                -- pages, routing, integrations
  compliance_blob     JSONB NOT NULL DEFAULT '{}'::jsonb,            -- disclosures, attestations
  quality_score       NUMERIC(5,2),
  is_published        BOOLEAN NOT NULL DEFAULT FALSE,
  published_at        TIMESTAMPTZ,
  published_by        TEXT REFERENCES users(id),
  unpublished_at      TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX fv_funnel_version_unique ON funnel_versions (funnel_id, version_number);
CREATE INDEX fv_workspace_idx ON funnel_versions (workspace_id);
CREATE INDEX fv_generation_idx ON funnel_versions (generation_id);
CREATE INDEX fv_published_idx ON funnel_versions (funnel_id, is_published) WHERE is_published;
ALTER TABLE funnel_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY fv_tenant ON funnel_versions
  USING (workspace_id = current_setting('app.workspace_id', true));

ALTER TABLE funnels
  ADD CONSTRAINT funnels_current_version_fk
  FOREIGN KEY (current_version_id) REFERENCES funnel_versions(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;
```

### B.5 `crm_contacts` and `leads`

```sql
CREATE TABLE crm_contacts (
  id                   TEXT PRIMARY KEY,                             -- crm_…
  workspace_id         TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email_normalized     CITEXT,
  email_sha256         TEXT,                                         -- for unsuppressed dedupe in lake
  phone_e164           TEXT,
  phone_sha256         TEXT,
  full_name            TEXT,
  first_name           TEXT,
  last_name            TEXT,
  company              TEXT,
  custom_fields        JSONB NOT NULL DEFAULT '{}'::jsonb,
  tags                 TEXT[] NOT NULL DEFAULT '{}',
  consent              JSONB NOT NULL DEFAULT '{}'::jsonb,           -- {marketing, sms, calls}
  do_not_contact       BOOLEAN NOT NULL DEFAULT FALSE,
  primary_source       TEXT,
  first_seen_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_activity_at     TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at           TIMESTAMPTZ,
  tombstone            BOOLEAN NOT NULL DEFAULT FALSE                -- set true on GDPR delete; PII wiped
);
CREATE UNIQUE INDEX crm_workspace_email_unique
  ON crm_contacts (workspace_id, email_normalized) WHERE email_normalized IS NOT NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX crm_workspace_phone_unique
  ON crm_contacts (workspace_id, phone_e164) WHERE phone_e164 IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX crm_workspace_last_activity_idx ON crm_contacts (workspace_id, last_activity_at DESC);
CREATE INDEX crm_tags_gin ON crm_contacts USING GIN (tags);
ALTER TABLE crm_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY crm_tenant ON crm_contacts
  USING (workspace_id = current_setting('app.workspace_id', true));

CREATE TABLE leads (
  id                    TEXT PRIMARY KEY,                            -- lds_…
  workspace_id          TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  funnel_id             TEXT NOT NULL REFERENCES funnels(id) ON DELETE RESTRICT,
  funnel_version_id     TEXT NOT NULL REFERENCES funnel_versions(id) ON DELETE RESTRICT,
  crm_contact_id        TEXT REFERENCES crm_contacts(id) ON DELETE SET NULL,
  status                lead_status NOT NULL DEFAULT 'new',
  score                 NUMERIC(5,2),
  score_band            TEXT,                                        -- 'hot','warm','cold'
  score_model_version   TEXT,
  capture_source        TEXT NOT NULL,
  capture_url           TEXT,
  utm                   JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_hash               TEXT,
  geo_country           TEXT,
  geo_region            TEXT,
  consent_id            TEXT,
  attribution_blob      JSONB NOT NULL DEFAULT '{}'::jsonb,
  first_contact_at      TIMESTAMPTZ,
  last_contact_at       TIMESTAMPTZ,
  qualified_at          TIMESTAMPTZ,
  disqualified_at       TIMESTAMPTZ,
  disqualified_reason   TEXT,
  converted_at          TIMESTAMPTZ,
  conversion_value_micros BIGINT,
  conversion_currency   CHAR(3),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at            TIMESTAMPTZ
);
CREATE INDEX leads_workspace_status_idx ON leads (workspace_id, status);
CREATE INDEX leads_funnel_created_idx ON leads (funnel_id, created_at DESC);
CREATE INDEX leads_score_idx ON leads (workspace_id, score DESC);
CREATE INDEX leads_crm_contact_idx ON leads (crm_contact_id);
CREATE INDEX leads_consent_idx ON leads (consent_id);
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY leads_tenant ON leads
  USING (workspace_id = current_setting('app.workspace_id', true));
```

### B.6 `bookings`

```sql
CREATE TABLE bookings (
  id                  TEXT PRIMARY KEY,                              -- bkg_…
  workspace_id        TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  lead_id             TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  funnel_id           TEXT NOT NULL REFERENCES funnels(id) ON DELETE RESTRICT,
  host_user_id        TEXT REFERENCES users(id) ON DELETE SET NULL,
  external_calendar   TEXT,                                          -- 'google','outlook','funnel_native'
  external_event_id   TEXT,
  scheduled_for       TIMESTAMPTZ NOT NULL,
  duration_minutes    INTEGER NOT NULL DEFAULT 30,
  timezone            TEXT NOT NULL DEFAULT 'UTC',
  meeting_url         TEXT,
  status              TEXT NOT NULL DEFAULT 'confirmed',             -- confirmed|canceled|completed|no_show
  canceled_at         TIMESTAMPTZ,
  canceled_by         TEXT,                                          -- user_id or 'lead' or 'system'
  cancel_reason       TEXT,
  notes_hash          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at          TIMESTAMPTZ
);
CREATE INDEX bookings_workspace_scheduled_idx ON bookings (workspace_id, scheduled_for);
CREATE INDEX bookings_lead_idx ON bookings (lead_id);
CREATE INDEX bookings_host_idx ON bookings (host_user_id);
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY bookings_tenant ON bookings
  USING (workspace_id = current_setting('app.workspace_id', true));
```

### B.7 `subscriptions`, `invoices`, `payments`, `refunds`

```sql
CREATE TABLE subscriptions (
  id                    TEXT PRIMARY KEY,                            -- sub_…
  workspace_id          TEXT NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
  plan                  TEXT NOT NULL,
  status                subscription_status NOT NULL DEFAULT 'trialing',
  external_processor    TEXT NOT NULL DEFAULT 'stripe',
  external_subscription_id TEXT,
  external_customer_id  TEXT,
  current_period_start  TIMESTAMPTZ,
  current_period_end    TIMESTAMPTZ,
  trial_ends_at         TIMESTAMPTZ,
  canceled_at           TIMESTAMPTZ,
  cancel_at_period_end  BOOLEAN NOT NULL DEFAULT FALSE,
  cancellation_reason   TEXT,
  paused_at             TIMESTAMPTZ,
  resume_at             TIMESTAMPTZ,
  unit_amount_micros    BIGINT,
  currency              CHAR(3) NOT NULL DEFAULT 'USD',
  quantity              INTEGER NOT NULL DEFAULT 1,
  metadata              JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX sub_external_unique
  ON subscriptions (external_processor, external_subscription_id) WHERE external_subscription_id IS NOT NULL;
CREATE INDEX sub_workspace_status_idx ON subscriptions (workspace_id, status);
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY sub_tenant ON subscriptions
  USING (workspace_id = current_setting('app.workspace_id', true));

CREATE TABLE invoices (
  id                    TEXT PRIMARY KEY,                            -- inv_…
  workspace_id          TEXT NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
  subscription_id       TEXT REFERENCES subscriptions(id) ON DELETE SET NULL,
  external_processor    TEXT NOT NULL DEFAULT 'stripe',
  external_invoice_id   TEXT,
  status                invoice_status NOT NULL DEFAULT 'draft',
  number                TEXT,
  amount_due_micros     BIGINT NOT NULL,
  amount_paid_micros    BIGINT NOT NULL DEFAULT 0,
  amount_refunded_micros BIGINT NOT NULL DEFAULT 0,
  tax_micros            BIGINT NOT NULL DEFAULT 0,
  currency              CHAR(3) NOT NULL,
  period_start          TIMESTAMPTZ,
  period_end            TIMESTAMPTZ,
  due_at                TIMESTAMPTZ,
  paid_at               TIMESTAMPTZ,
  voided_at             TIMESTAMPTZ,
  hosted_url            TEXT,
  pdf_url               TEXT,
  line_items            JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata              JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX inv_external_unique
  ON invoices (external_processor, external_invoice_id) WHERE external_invoice_id IS NOT NULL;
CREATE INDEX inv_workspace_status_idx ON invoices (workspace_id, status);
CREATE INDEX inv_period_idx ON invoices (period_start, period_end);
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY inv_tenant ON invoices
  USING (workspace_id = current_setting('app.workspace_id', true));

CREATE TABLE payments (
  id                    TEXT PRIMARY KEY,                            -- pay_…
  workspace_id          TEXT NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
  invoice_id            TEXT REFERENCES invoices(id) ON DELETE SET NULL,
  external_processor    TEXT NOT NULL DEFAULT 'stripe',
  external_payment_id   TEXT,
  amount_micros         BIGINT NOT NULL,
  currency              CHAR(3) NOT NULL,
  status                TEXT NOT NULL,                               -- 'succeeded','failed','pending','refunded','partially_refunded'
  payment_method_type   TEXT,
  failure_code          TEXT,
  failure_text          TEXT,
  attempt_n             INTEGER NOT NULL DEFAULT 1,
  paid_at               TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX pay_external_unique
  ON payments (external_processor, external_payment_id) WHERE external_payment_id IS NOT NULL;
CREATE INDEX pay_workspace_status_idx ON payments (workspace_id, status);
CREATE INDEX pay_invoice_idx ON payments (invoice_id);
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY pay_tenant ON payments
  USING (workspace_id = current_setting('app.workspace_id', true));

CREATE TABLE refunds (
  id                    TEXT PRIMARY KEY,                            -- rfd_…
  workspace_id          TEXT NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
  payment_id            TEXT REFERENCES payments(id) ON DELETE SET NULL,
  external_processor    TEXT NOT NULL DEFAULT 'stripe',
  external_refund_id    TEXT,
  amount_micros         BIGINT NOT NULL,
  currency              CHAR(3) NOT NULL,
  reason_code           TEXT,
  initiated_by_user_id  TEXT REFERENCES users(id),
  justification         TEXT,
  refunded_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX rfd_workspace_idx ON refunds (workspace_id);
CREATE INDEX rfd_payment_idx ON refunds (payment_id);
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;
CREATE POLICY rfd_tenant ON refunds
  USING (workspace_id = current_setting('app.workspace_id', true));
```

### B.8 `api_keys` and `webhooks`

```sql
CREATE TABLE api_keys (
  id                  TEXT PRIMARY KEY,                              -- apk_…
  workspace_id        TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  key_prefix          TEXT NOT NULL,                                 -- public prefix shown in UI, e.g. 'fnl_live_8a…'
  key_hash            TEXT NOT NULL,                                 -- sha256 of the full secret
  scopes              TEXT[] NOT NULL DEFAULT '{}',
  created_by          TEXT NOT NULL REFERENCES users(id),
  last_used_at        TIMESTAMPTZ,
  last_used_ip_hash   TEXT,
  expires_at          TIMESTAMPTZ,
  revoked_at          TIMESTAMPTZ,
  revoked_by          TEXT REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX apk_prefix_unique ON api_keys (key_prefix);
CREATE INDEX apk_workspace_idx ON api_keys (workspace_id) WHERE revoked_at IS NULL;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY apk_tenant ON api_keys
  USING (workspace_id = current_setting('app.workspace_id', true));

CREATE TABLE webhooks (
  id                  TEXT PRIMARY KEY,                              -- whk_…
  workspace_id        TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  url                 TEXT NOT NULL,
  secret_hash         TEXT NOT NULL,
  events              TEXT[] NOT NULL,                               -- subscribed event names
  active              BOOLEAN NOT NULL DEFAULT TRUE,
  description         TEXT,
  last_delivery_at    TIMESTAMPTZ,
  last_failure_at     TIMESTAMPTZ,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  created_by          TEXT NOT NULL REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at          TIMESTAMPTZ
);
CREATE INDEX whk_workspace_active_idx ON webhooks (workspace_id) WHERE active AND deleted_at IS NULL;
CREATE INDEX whk_events_gin ON webhooks USING GIN (events);
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY whk_tenant ON webhooks
  USING (workspace_id = current_setting('app.workspace_id', true));
```

### B.9 `audit_log` and `event_log`

```sql
-- audit_log: human-meaningful, who-did-what-to-what, append-only.
-- Powers compliance, support investigations. NEVER backfilled, NEVER UPDATEd.
CREATE TABLE audit_log (
  id                  TEXT PRIMARY KEY,                              -- aud_…
  workspace_id        TEXT,                                          -- NULL for global admin actions
  actor_user_id       TEXT REFERENCES users(id),
  impersonator_user_id TEXT REFERENCES users(id),
  action              TEXT NOT NULL,                                 -- e.g. 'workspace.member.role_changed'
  subject_type        TEXT NOT NULL,
  subject_id          TEXT NOT NULL,
  before_blob         JSONB,
  after_blob          JSONB,
  ip_hash             TEXT,
  user_agent          TEXT,
  request_id          TEXT,
  trace_id            TEXT,
  reason              TEXT,
  pii_tier            pii_tier NOT NULL DEFAULT 'P1',
  occurred_at         TIMESTAMPTZ NOT NULL DEFAULT now()
) PARTITION BY RANGE (occurred_at);
CREATE INDEX audit_workspace_time_idx ON audit_log (workspace_id, occurred_at DESC);
CREATE INDEX audit_actor_time_idx ON audit_log (actor_user_id, occurred_at DESC);
CREATE INDEX audit_subject_idx ON audit_log (subject_type, subject_id);
-- partitions: audit_log_2026_q1, audit_log_2026_q2, ...
-- INSERT-only: revoke UPDATE/DELETE for app role.

-- event_log: hot tail of the canonical event bus for ~90 days. Operational
-- queries, support, near-real-time joins. Source of truth lives in Kafka + Iceberg.
CREATE TABLE event_log (
  event_id            TEXT PRIMARY KEY,                              -- evt_…
  event_name          TEXT NOT NULL,
  event_family        TEXT NOT NULL,
  schema_version      INTEGER NOT NULL,
  workspace_id        TEXT,
  actor_type          TEXT NOT NULL,
  actor_user_id       TEXT,
  agent_id            TEXT,
  impersonator_user_id TEXT,
  subject_type        TEXT,
  subject_id          TEXT,
  pii_tier            pii_tier NOT NULL,
  properties          JSONB NOT NULL,
  context             JSONB NOT NULL DEFAULT '{}'::jsonb,
  consent             JSONB NOT NULL DEFAULT '{}'::jsonb,
  producer            JSONB NOT NULL,
  occurred_at         TIMESTAMPTZ NOT NULL,
  received_at         TIMESTAMPTZ NOT NULL DEFAULT now()
) PARTITION BY RANGE (occurred_at);
CREATE INDEX el_workspace_name_time_idx ON event_log (workspace_id, event_name, occurred_at DESC);
CREATE INDEX el_family_time_idx ON event_log (event_family, occurred_at DESC);
CREATE INDEX el_subject_idx ON event_log (subject_type, subject_id);
CREATE INDEX el_props_gin ON event_log USING GIN (properties jsonb_path_ops);
ALTER TABLE event_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY el_tenant ON event_log
  USING (workspace_id IS NULL OR workspace_id = current_setting('app.workspace_id', true));
-- Daily/weekly partitions; old partitions detached and dropped after 90d (lake retains).
```

### B.10 `assets` and `asset_versions`

```sql
CREATE TABLE assets (
  id                  TEXT PRIMARY KEY,                              -- ast_…
  workspace_id        TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  funnel_id           TEXT REFERENCES funnels(id) ON DELETE SET NULL,
  type                asset_type NOT NULL,
  name                TEXT NOT NULL,
  current_version_id  TEXT,
  tags                TEXT[] NOT NULL DEFAULT '{}',
  created_by          TEXT REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at          TIMESTAMPTZ
);
CREATE INDEX assets_workspace_type_idx ON assets (workspace_id, type);
CREATE INDEX assets_funnel_idx ON assets (funnel_id);
CREATE INDEX assets_tags_gin ON assets USING GIN (tags);
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY assets_tenant ON assets
  USING (workspace_id = current_setting('app.workspace_id', true));

CREATE TABLE asset_versions (
  id                  TEXT PRIMARY KEY,                              -- asv_…
  workspace_id        TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  asset_id            TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  version_number      INTEGER NOT NULL,
  generation_id       TEXT,
  s3_uri              TEXT,
  content_hash        TEXT NOT NULL,
  mime_type           TEXT,
  width_px            INTEGER,
  height_px           INTEGER,
  duration_ms         INTEGER,
  copy_blob           JSONB,
  metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by          TEXT REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX asv_asset_version_unique ON asset_versions (asset_id, version_number);
CREATE INDEX asv_generation_idx ON asset_versions (generation_id);
ALTER TABLE asset_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY asv_tenant ON asset_versions
  USING (workspace_id = current_setting('app.workspace_id', true));

ALTER TABLE assets
  ADD CONSTRAINT assets_current_version_fk
  FOREIGN KEY (current_version_id) REFERENCES asset_versions(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;
```

### B.11 `integration_connections`

```sql
CREATE TABLE integration_connections (
  id                  TEXT PRIMARY KEY,                              -- itg_…
  workspace_id        TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider            TEXT NOT NULL,                                 -- 'stripe','google_calendar','meta_ads','hubspot','twilio',...
  external_account_id TEXT,
  display_name        TEXT,
  scopes              TEXT[] NOT NULL DEFAULT '{}',
  credentials_kms_arn TEXT NOT NULL,                                 -- KMS key reference; tokens live in Vault, NOT this row
  vault_path          TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'active',                -- 'active','expired','revoked','error'
  connected_by        TEXT NOT NULL REFERENCES users(id),
  connected_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_sync_at        TIMESTAMPTZ,
  last_error          TEXT,
  metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
  disconnected_at     TIMESTAMPTZ,
  disconnected_by     TEXT REFERENCES users(id)
);
CREATE UNIQUE INDEX itg_workspace_provider_account_unique
  ON integration_connections (workspace_id, provider, external_account_id)
  WHERE disconnected_at IS NULL;
CREATE INDEX itg_workspace_status_idx ON integration_connections (workspace_id, status);
ALTER TABLE integration_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY itg_tenant ON integration_connections
  USING (workspace_id = current_setting('app.workspace_id', true));
```

### B.12 `revtry_calls`

```sql
CREATE TABLE revtry_calls (
  id                   TEXT PRIMARY KEY,                             -- cll_…
  workspace_id         TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  lead_id              TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  attempt_n            INTEGER NOT NULL,
  agent_voice_id       TEXT NOT NULL,
  script_version       TEXT NOT NULL,
  from_number          TEXT NOT NULL,
  to_number_hash       TEXT NOT NULL,
  to_number_country    TEXT,
  started_at           TIMESTAMPTZ NOT NULL,
  ended_at             TIMESTAMPTZ,
  duration_sec         INTEGER,
  outcome              call_outcome,
  disposition_code     TEXT,
  recording_s3_uri     TEXT,                                         -- redacted recording
  transcript_s3_uri    TEXT,                                         -- redacted transcript
  sentiment_score      NUMERIC(4,3),
  objections           TEXT[] NOT NULL DEFAULT '{}',
  consent_recorded     BOOLEAN NOT NULL DEFAULT FALSE,
  cost_usd_micros      BIGINT,
  carrier_metadata     JSONB NOT NULL DEFAULT '{}'::jsonb,
  pii_redacted_at      TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX rtc_workspace_started_idx ON revtry_calls (workspace_id, started_at DESC);
CREATE INDEX rtc_lead_idx ON revtry_calls (lead_id);
CREATE INDEX rtc_outcome_idx ON revtry_calls (workspace_id, outcome);
ALTER TABLE revtry_calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY rtc_tenant ON revtry_calls
  USING (workspace_id = current_setting('app.workspace_id', true));
```

### B.13 `ad_campaigns`

```sql
CREATE TABLE ad_campaigns (
  id                  TEXT PRIMARY KEY,                              -- adc_…
  workspace_id        TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  funnel_id           TEXT NOT NULL REFERENCES funnels(id) ON DELETE RESTRICT,
  platform            TEXT NOT NULL,                                 -- 'meta','google','tiktok','linkedin','reddit'
  external_campaign_id TEXT,
  name                TEXT NOT NULL,
  objective           TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'draft',                 -- 'draft','launched','paused','rejected','ended'
  budget_micros       BIGINT NOT NULL,
  daily_cap_micros    BIGINT,
  currency            CHAR(3) NOT NULL,
  audience_blob       JSONB NOT NULL DEFAULT '{}'::jsonb,
  creative_asset_ids  TEXT[] NOT NULL DEFAULT '{}',
  schedule_start      TIMESTAMPTZ,
  schedule_end        TIMESTAMPTZ,
  launched_at         TIMESTAMPTZ,
  paused_at           TIMESTAMPTZ,
  rejected_at         TIMESTAMPTZ,
  rejection_code      TEXT,
  rejection_text      TEXT,
  spend_to_date_micros BIGINT NOT NULL DEFAULT 0,
  metrics_blob        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by          TEXT NOT NULL REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at          TIMESTAMPTZ
);
CREATE UNIQUE INDEX adc_external_unique
  ON ad_campaigns (platform, external_campaign_id) WHERE external_campaign_id IS NOT NULL;
CREATE INDEX adc_workspace_status_idx ON ad_campaigns (workspace_id, status);
CREATE INDEX adc_funnel_idx ON ad_campaigns (funnel_id);
ALTER TABLE ad_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY adc_tenant ON ad_campaigns
  USING (workspace_id = current_setting('app.workspace_id', true));
```

### B.14 `email_sequences` and `sms_sequences`

```sql
CREATE TABLE email_sequences (
  id                  TEXT PRIMARY KEY,                              -- esq_…
  workspace_id        TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  funnel_id           TEXT REFERENCES funnels(id) ON DELETE SET NULL,
  name                TEXT NOT NULL,
  trigger             TEXT NOT NULL,                                 -- 'lead_captured','booking_canceled', cron expr, etc.
  status              TEXT NOT NULL DEFAULT 'draft',                 -- 'draft','active','paused','archived'
  steps               JSONB NOT NULL DEFAULT '[]'::jsonb,            -- [{delay, template_id, conditions}]
  from_identity_id    TEXT,                                          -- verified sender
  reply_to            TEXT,
  metrics_blob        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by          TEXT NOT NULL REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at          TIMESTAMPTZ
);
CREATE INDEX esq_workspace_status_idx ON email_sequences (workspace_id, status);
ALTER TABLE email_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY esq_tenant ON email_sequences
  USING (workspace_id = current_setting('app.workspace_id', true));

CREATE TABLE sms_sequences (
  id                  TEXT PRIMARY KEY,                              -- ssq_…
  workspace_id        TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  funnel_id           TEXT REFERENCES funnels(id) ON DELETE SET NULL,
  name                TEXT NOT NULL,
  trigger             TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'draft',
  steps               JSONB NOT NULL DEFAULT '[]'::jsonb,
  brand_id            TEXT,                                          -- A2P 10DLC brand registration
  campaign_use_case   TEXT,
  quiet_hours         JSONB NOT NULL DEFAULT '{"start":"21:00","end":"08:00","tz_strategy":"recipient"}'::jsonb,
  metrics_blob        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by          TEXT NOT NULL REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at          TIMESTAMPTZ
);
CREATE INDEX ssq_workspace_status_idx ON sms_sequences (workspace_id, status);
ALTER TABLE sms_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY ssq_tenant ON sms_sequences
  USING (workspace_id = current_setting('app.workspace_id', true));
```

### B.15 `lead_magnets`

```sql
CREATE TABLE lead_magnets (
  id                  TEXT PRIMARY KEY,                              -- lmg_…
  workspace_id        TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  funnel_id           TEXT REFERENCES funnels(id) ON DELETE SET NULL,
  type                TEXT NOT NULL,                                 -- 'pdf','quiz','calculator','webinar','checklist','template'
  title               TEXT NOT NULL,
  description         TEXT,
  artifact_s3_uri     TEXT,
  artifact_hash       TEXT,
  generated_by_agent  BOOLEAN NOT NULL DEFAULT FALSE,
  generation_id       TEXT,
  gated_fields        JSONB NOT NULL DEFAULT '["email"]'::jsonb,
  download_count      INTEGER NOT NULL DEFAULT 0,
  status              TEXT NOT NULL DEFAULT 'draft',
  created_by          TEXT REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at          TIMESTAMPTZ
);
CREATE INDEX lmg_workspace_funnel_idx ON lead_magnets (workspace_id, funnel_id);
ALTER TABLE lead_magnets ENABLE ROW LEVEL SECURITY;
CREATE POLICY lmg_tenant ON lead_magnets
  USING (workspace_id = current_setting('app.workspace_id', true));
```

### B.16 Tombstone / suppression supporting tables

```sql
-- Deletion tombstones survive forever. Prove we honored a DSAR without retaining PII.
CREATE TABLE deletion_tombstones (
  request_id          TEXT PRIMARY KEY,                              -- dlq_…
  subject_type        TEXT NOT NULL,
  subject_id_hash     TEXT NOT NULL,                                 -- sha256(subject_id) — original id is gone
  workspace_id        TEXT,
  legal_basis         TEXT NOT NULL,
  scope_summary       JSONB NOT NULL,
  completed_at        TIMESTAMPTZ NOT NULL,
  verifier_user_id    TEXT
);

-- Global suppression list (opt-outs) — survives lead/contact deletion.
CREATE TABLE suppression_list (
  id                  TEXT PRIMARY KEY,                              -- sup_…
  workspace_id        TEXT NOT NULL,                                 -- not a FK on purpose; survives workspace closure
  channel             TEXT NOT NULL,                                 -- 'sms','email','call'
  identifier_sha256   TEXT NOT NULL,
  reason              TEXT NOT NULL,                                 -- 'user_opt_out','tcpa_complaint','bounce','admin'
  source_event_id     TEXT,
  added_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX sup_unique ON suppression_list (workspace_id, channel, identifier_sha256);
```

---

## PART C — Data lifecycle, PII, retention, lake

### C.1 Retention by event family (canonical)

| Family | Hot (`event_log` in Postgres) | Warm (Iceberg, full fidelity) | Cold (Iceberg, aggregates/hashed) | Hard delete |
|---|---|---|---|---|
| Identity | 90 days | 13 months | 7 years (login telemetry: 13 months only) | After 7y |
| Generation | 90 days | 13 months | 5 years | After 5y |
| Publish | 90 days | 13 months | 7y; `publish_acknowledged` 10y | After legal retention |
| Distribution | 90 days | 13 months | 7y (ads); 3y (organic social) | After retention |
| Lead | 90 days | 13 months | 5y; `lead_sms_opted_out` 10y | After retention or on DSAR |
| Revenue — Customer funnels | 90 days | 13 months | 7y (tax/finance regulations) | After 7y |
| Revenue — Our SaaS | 90 days | 13 months | 7y | After 7y |
| Support | 90 days | 13 months | 5y; `impersonation_*` 10y | After retention |
| Governance | 90 days | 13 months | 10y; tombstones forever | Tombstone only |

Default retention is **5 years** for anything in the lake unless overridden in the table above. Workspace owners can request **shorter** retention for non-regulatory event families via contract (Enterprise tier).

### C.2 PII classification rules

| Tier | Definition | Examples in our events | Handling |
|---|---|---|---|
| **P0** | No identifying signal | event counts, model versions, durations, hashes | No restrictions. Safe to share in dashboards, propensity models, board reports. |
| **P1** | Pseudonymous identifiers tied to a workspace/user/lead but no contact info | `user_id`, `workspace_id`, `lead_id`, `funnel_id`, `score`, internal employee IDs | Internal use only. Logged in audit log. Joined with PII only inside trust boundary. |
| **P2** | Direct PII | `email`, `phone_e164`, `full_name`, `ip` (raw), `geo_city`, `device_id`, recordings, transcripts | Stored encrypted at rest (column-level KMS for `users.email`, `crm_contacts.phone_e164`; envelope-encrypted blobs in S3). Access requires `pii:read` scope and is itself audited via `audit_log`. Hashed (`*_sha256`) variants must accompany every P2 field used for joins or analytics. |
| **P3** | Sensitive PII (financial PAN, gov ID, health, demographic-sensitive) | We do **not** warehouse these. Stripe holds card data; Plaid holds bank data; we store only their opaque tokens. | Never stored in Postgres beyond an external processor token. Never written to Kafka/Iceberg in raw form. Any future field claiming P3 requires a DPO + legal review. |

**Hashing standard.** All `*_sha256` fields use `HMAC-SHA256(secret_per_workspace, lowercase_trim_value)`. The HMAC key is per-workspace and rotated annually; rotations re-hash via a background job and keep both hashes available during a 30-day window.

**Producer-side PII redaction.** Every event SDK includes a PII linter. If a property is sent to a P0 event and the property name matches the PII pattern (`email`, `phone`, `ssn`, `dob`, `name`, raw `ip`), the SDK auto-hashes before transmit and emits a `pii_leak_blocked` governance event.

### C.3 GDPR/CCPA deletion cascade

When `data_deletion_requested` is received and approved (DPO sign-off for any DSAR involving > 1000 records), `privacy-svc` executes the following deterministic cascade. SLA: **30 days from receipt** for GDPR, **45 days** for CCPA.

1. **Verify subject identity** and scope (`user`, `lead`, `crm_contact`, `workspace`).
2. **Freeze writes** for affected rows: flip `deleted_at = now()` on subject row(s); pause sequence enrollments; remove from active audiences.
3. **Postgres scrub.** For the subject and all owned rows:
   - `users`: null `email`, `full_name`, `avatar_url`, `password_hash`; keep `id`, `created_at`. Mark `deleted_at`.
   - `crm_contacts`: null `email_normalized`, `phone_e164`, names, custom fields, `consent`; keep `id`, `workspace_id`, `email_sha256`, `phone_sha256`, `created_at`, set `tombstone = TRUE`. The hashes survive so suppression and dedupe continue to work.
   - `leads`: null `capture_url` (if it contains query-string PII), `ip_hash` (rotated to `null`), `attribution_blob` (recursive PII strip). Keep aggregate fields.
   - `bookings`: null `meeting_url`, `notes_hash`. Keep timestamps.
   - `revtry_calls`: delete `recording_s3_uri` and `transcript_s3_uri` objects from S3 (`s3:DeleteObject`, then `s3:DeleteObjectVersion` for versioned bucket); null both columns; null `carrier_metadata.caller_id_name`.
   - `audit_log`: **not modified**. Audit log retains `subject_id` (pseudonymous) and `actor_user_id`. Direct PII is never written into audit log payloads (enforced by linter).
   - `event_log` (hot tail): scrub matching events' P2 properties to `null` and stamp `properties._redacted = true`.
4. **Lake scrub.** Iceberg has row-level delete enabled. The privacy worker emits a row-level delete spec keyed by `subject_id_hash` to:
   - `s3://funnel-lake/raw/events/<family>/...`
   - `s3://funnel-lake/curated/<table>/...`
   - `s3://funnel-lake/feature-store/<table>/...`
   Compaction runs nightly; deletes are physically applied within 7 days.
5. **External processors.** Fire deletion API calls in parallel to Stripe, Twilio, SendGrid, Meta, Google, HubSpot for the subject's identifiers. Track per-provider acknowledgment in `data_deletion_completed.scope_summary`.
6. **Suppression preserved.** `suppression_list` rows are **never** deleted on subject deletion. We must continue to honor an opt-out forever — that requires keeping the hashed identifier.
7. **Tombstone.** Insert into `deletion_tombstones` and emit `data_deletion_completed` with a `tombstone_ids[]` referencing every system scrubbed. The tombstone is the proof artifact returned in regulator audits.

**Workspace closure (`workspace_closed`)** triggers the same cascade for every user and contact whose **only** workspace was the closed one, after a 30-day grace period.

**Backups.** Postgres PITR snapshots are encrypted and retained 35 days. Restoring a backup that pre-dates a DSAR re-injects deleted PII; the privacy worker maintains a `deletion_replay_log` and re-applies all pending deletions immediately after any restore.

### C.4 Learning flywheel — S3 / Iceberg lake structure

The lake is the canonical training-data store. Postgres is operational; Kafka is the bus; Iceberg is the warehouse.

**Bucket layout (region-partitioned for residency):**

```
s3://funnel-lake-us-east-1/
  raw/
    events/
      identity/        year=2026/month=05/day=25/hour=17/*.parquet
      generation/      year=…/…/…/…/
      publish/         …
      distribution/    …
      lead/            …
      revenue_funnel/  …
      revenue_saas/    …
      support/         …
      governance/      …
    integrations/
      stripe/          (raw webhook payloads, encrypted)
      twilio/
      meta_ads/
      ...
    agent_io/
      generations/     gen_id=gen_01HX…/agent=copy_agent/{input.json,output.json,trace.jsonl}
  curated/
    fact_users/        Iceberg table, scd-2
    fact_workspaces/
    fact_funnels/
    fact_leads/
    fact_bookings/
    fact_subscriptions/
    fact_revenue_funnel/
    fact_revenue_saas/
    fact_revtry_calls/
    dim_plan/          dim_*
    dim_funnel_version/
    dim_kb_pack/
    dim_model_version/
  feature_store/
    online/            (mirrored to Redis/DynamoDB for serving)
    offline/           Iceberg tables, point-in-time-correct
      lead_features_v3/
      funnel_features_v2/
      ...
  training/
    datasets/
      copy_agent/      train/val/test splits, manifest.json, license.json
      scoring_agent/
      revtry_dialogue/
    eval_sets/
      golden_leads/    versioned, frozen
      regression_funnels/
    models/
      copy_agent/
        v2026.05.18-c/
          weights.safetensors
          tokenizer.json
          card.md
          eval_report.json
          lineage.json    (links back to dataset manifests + generation IDs)
  exports/
    dsar/<request_id>/  (zip + manifest; auto-expires per request)
  audit/
    backups/
      audit_log/        weekly snapshots, WORM (Object Lock)
```

**Iceberg specifics.**

- Catalog: AWS Glue (or Nessie for branching in dev). Spark, Trino, and DuckDB readers all supported.
- Table format: Iceberg v2 (row-level deletes + upserts). Required for DSAR row-deletion compliance.
- Partitioning: `event_family` tables partition by `(occurred_at_day, workspace_region)`; fact tables by `(occurred_at_month)`.
- Compaction: nightly `rewrite_data_files` with target file size 256 MiB; `expire_snapshots` keeps last 30 days.
- Schema evolution: additive only without coordination; breaking changes require a new table with a migration window.
- Encryption: SSE-KMS with a per-region CMK; per-workspace data-key envelopes for P2 columns inside Parquet (parquet-modular-encryption).
- Access: row-level filters in Lake Formation. Production analysts get P1; only DPO + a 2-of-3 break-glass quorum gets P2; nobody gets P3 (it isn't there).

**Flywheel data contract.**

1. `agent_invoked` and `generation_completed` write a `trace.jsonl` to `raw/agent_io/generations/…` synchronously before acking. Each line is one tool call or model turn with token usage, latency, and hashes.
2. `quality_score_computed`, `quality_failed`, and human review decisions land in `raw/events/generation/…` and are joined nightly into `curated/fact_generation_quality/`.
3. A dataset-build job materializes per-agent training corpora into `training/datasets/<agent>/`, **only including rows whose workspace has `workspaces.ai_training_opt_in = TRUE`** and whose `consent.ai_training` flag was `true` at event time. Manifests include the SQL provenance query so any row can be traced back to its source events.
4. `model_version_promoted` and `bias_audit_completed` are gating events: the model registry refuses to promote without both, plus a green eval report in `training/models/<agent>/<version>/eval_report.json`.
5. DSAR deletes propagate to the lake via row-level deletes keyed on `subject_id_hash` (see C.3). Training datasets older than the deletion are NOT retroactively rebuilt — but any **future** model training must filter against the current tombstone table, joined by hash. The model registry enforces this via the `lineage.json` audit.

### C.5 Cross-system reconciliation

A daily job (`recon-svc`) reconciles three sources of truth and emits `recon_drift_detected` (governance) if drift exceeds 0.1%:

| Domain | Sources |
|---|---|
| Lead counts | Postgres `leads` â†” Iceberg `fact_leads` â†” Kafka `lead.lead_captured` partition offsets |
| Customer revenue | Postgres `payments` â†” Stripe API â†” Iceberg `fact_revenue_funnel` |
| SaaS revenue | Postgres `invoices` â†” Stripe API â†” accounting GL export |
| Generation cost | Postgres aggregate â†” Iceberg `fact_generation_cost` â†” model-provider invoices |
| Consent | Postgres `crm_contacts.consent` â†” Iceberg `fact_consent_history` â†” suppression list |

Drift greater than threshold pages the on-call data engineer and freezes the affected billing/promotion pipeline until cleared.

---

## Appendix — Event quick-reference index

| Family | Events |
|---|---|
| Identity | `user_signed_up`, `user_verified_email`, `user_logged_in`, `user_logged_out`, `user_password_reset_requested`, `user_password_changed`, `user_mfa_enrolled`, `user_mfa_used`, `user_new_device_login`, `user_deactivated`, `user_deleted`, `workspace_created`, `workspace_member_invited`, `workspace_member_joined`, `workspace_member_removed`, `workspace_role_changed`, `workspace_ownership_transferred`, `workspace_closed` |
| Generation | `generation_started`, `generation_completed`, `generation_regenerated`, `agent_invoked`, `quality_score_computed`, `quality_failed`, `fact_check_flag_raised`, `compliance_block_raised`, `human_review_required`, `human_review_completed` |
| Publish | `funnel_published`, `funnel_unpublished`, `funnel_archived`, `funnel_cloned`, `funnel_imported`, `custom_domain_connected`, `ssl_provisioned`, `publish_acknowledged` |
| Distribution | `ad_campaign_created`, `ad_campaign_launched`, `ad_campaign_paused`, `ad_rejected`, `social_post_scheduled`, `social_post_published`, `qr_generated`, `short_link_created` |
| Lead | `lead_captured`, `lead_scored`, `lead_sms_sent`, `lead_sms_delivered`, `lead_sms_opted_out`, `lead_revtry_call_started`, `lead_revtry_call_completed`, `lead_voicemail_left`, `lead_qualified`, `lead_disqualified`, `lead_booking_created`, `lead_booking_canceled` |
| Revenue — customer | `checkout_started`, `checkout_paid`, `checkout_failed`, `refund_issued`, `dispute_opened`, `dispute_resolved` |
| Revenue — SaaS | `trial_started`, `trial_ended`, `plan_upgraded`, `plan_downgraded`, `plan_paused`, `plan_resumed`, `subscription_canceled`, `payment_succeeded`, `payment_failed`, `dunning_step_executed`, `account_suspended`, `account_restored`, `account_closed` |
| Support | `ticket_opened`, `ticket_assigned`, `ticket_resolved`, `impersonation_started`, `impersonation_ended`, `internal_note_added`, `admin_credit_applied`, `admin_refund_issued` |
| Governance | `ai_disclosure_rendered`, `consent_captured`, `consent_withdrawn`, `data_export_requested`, `data_export_delivered`, `data_deletion_requested`, `data_deletion_completed`, `model_version_promoted`, `kb_pack_updated`, `bias_audit_completed`, `pii_leak_blocked`, `recon_drift_detected` |

— End of document —
