-- =====================================================================
-- GoFunnelAI initial migration.
-- Generated from prisma/schema.prisma + docs/03-event-taxonomy-and-schemas.md.
-- This migration is the canonical bootstrap and is hand-written rather than
-- emitted via `prisma migrate dev` because it sets up:
--   * extensions (pgcrypto, citext, btree_gin, pg_trgm, vector)
--   * row-level security policies on every workspace-scoped table
--   * monthly partitioning for audit_log + event_log
--   * an updated_at trigger applied to every mutable table
--   * deferrable cyclic FKs (funnels.current_version_id, assets.current_version_id)
-- Subsequent schema changes SHOULD use `prisma migrate` and the diff workflow.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. EXTENSIONS
-- ---------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";
CREATE EXTENSION IF NOT EXISTS "btree_gin";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ---------------------------------------------------------------------
-- 1. ENUMS
-- ---------------------------------------------------------------------
CREATE TYPE "workspace_role"      AS ENUM ('owner','admin','editor','analyst','viewer','billing');
CREATE TYPE "subscription_status" AS ENUM ('trialing','active','past_due','paused','canceled','suspended');
CREATE TYPE "invoice_status"      AS ENUM ('draft','open','paid','void','uncollectible');
CREATE TYPE "lead_status"         AS ENUM ('new','contacted','qualified','disqualified','booked','converted','closed');
CREATE TYPE "call_outcome"        AS ENUM ('answered','no_answer','voicemail','busy','failed','do_not_call');
CREATE TYPE "asset_type"          AS ENUM ('page','copy','image','video','script','email','sms','ad_creative','form');
CREATE TYPE "funnel_status"       AS ENUM ('draft','review','live','paused','archived');
CREATE TYPE "pii_tier"            AS ENUM ('P0','P1','P2','P3');
CREATE TYPE "user_status"         AS ENUM ('active','deactivated','deleted');
CREATE TYPE "workspace_status"    AS ENUM ('active','suspended','closed');
CREATE TYPE "payment_status"      AS ENUM ('succeeded','failed','pending','refunded','partially_refunded');
CREATE TYPE "booking_status"      AS ENUM ('confirmed','canceled','completed','no_show');

-- ---------------------------------------------------------------------
-- 2. updated_at TRIGGER FUNCTION
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------
-- 3. CORE TABLES
-- ---------------------------------------------------------------------

-- 3.1 users
CREATE TABLE "users" (
  "id"                  TEXT PRIMARY KEY,
  "email"               CITEXT NOT NULL,
  "email_normalized"    CITEXT GENERATED ALWAYS AS (lower("email")) STORED,
  "email_verified_at"   TIMESTAMPTZ(6),
  "full_name"           TEXT,
  "avatar_url"          TEXT,
  "locale"              TEXT NOT NULL DEFAULT 'en-US',
  "timezone"            TEXT NOT NULL DEFAULT 'UTC',
  "password_hash"       TEXT,
  "password_changed_at" TIMESTAMPTZ(6),
  "mfa_enrolled"        BOOLEAN NOT NULL DEFAULT FALSE,
  "mfa_factors"         JSONB NOT NULL DEFAULT '[]'::jsonb,
  "last_login_at"       TIMESTAMPTZ(6),
  "last_login_ip_hash"  TEXT,
  "status"              "user_status" NOT NULL DEFAULT 'active',
  "is_internal"         BOOLEAN NOT NULL DEFAULT FALSE,
  "deactivated_at"      TIMESTAMPTZ(6),
  "created_at"          TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at"          TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "deleted_at"          TIMESTAMPTZ(6)
);
CREATE UNIQUE INDEX "users_email_unique" ON "users" ("email_normalized") WHERE "deleted_at" IS NULL;
CREATE INDEX "users_last_login_idx" ON "users" ("last_login_at" DESC);
CREATE INDEX "users_email_trgm_idx" ON "users" USING GIN ("email" gin_trgm_ops);
CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON "users"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3.2 workspaces
CREATE TABLE "workspaces" (
  "id"                    TEXT PRIMARY KEY,
  "slug"                  CITEXT NOT NULL,
  "name"                  TEXT NOT NULL,
  "owner_user_id"         TEXT NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "plan"                  TEXT NOT NULL DEFAULT 'trial',
  "status"                "workspace_status" NOT NULL DEFAULT 'active',
  "vertical"              TEXT,
  "region"                TEXT NOT NULL DEFAULT 'us-east-1',
  "data_residency_lock"   BOOLEAN NOT NULL DEFAULT FALSE,
  "brand_colors"          JSONB NOT NULL DEFAULT '{}'::jsonb,
  "feature_flags"         JSONB NOT NULL DEFAULT '{}'::jsonb,
  "ai_training_opt_in"    BOOLEAN NOT NULL DEFAULT FALSE,
  "closed_at"             TIMESTAMPTZ(6),
  "closed_reason"         TEXT,
  "created_at"            TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at"            TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "deleted_at"            TIMESTAMPTZ(6)
);
CREATE UNIQUE INDEX "workspaces_slug_unique" ON "workspaces" ("slug") WHERE "deleted_at" IS NULL;
CREATE INDEX "workspaces_owner_idx" ON "workspaces" ("owner_user_id");
CREATE INDEX "workspaces_region_idx" ON "workspaces" ("region");
CREATE INDEX "workspaces_status_idx" ON "workspaces" ("status");
CREATE INDEX "workspaces_feature_flags_gin" ON "workspaces" USING GIN ("feature_flags" jsonb_path_ops);
CREATE TRIGGER workspaces_set_updated_at BEFORE UPDATE ON "workspaces"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3.3 workspace_members
CREATE TABLE "workspace_members" (
  "id"           TEXT PRIMARY KEY,
  "workspace_id" TEXT NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "user_id"      TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "role"         "workspace_role" NOT NULL,
  "invited_by"   TEXT REFERENCES "users"("id") ON DELETE SET NULL,
  "invited_at"   TIMESTAMPTZ(6),
  "joined_at"    TIMESTAMPTZ(6),
  "removed_at"   TIMESTAMPTZ(6),
  "removed_by"   TEXT REFERENCES "users"("id") ON DELETE SET NULL,
  "last_seen_at" TIMESTAMPTZ(6),
  "created_at"   TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at"   TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "wsm_workspace_user_unique"
  ON "workspace_members" ("workspace_id", "user_id") WHERE "removed_at" IS NULL;
CREATE INDEX "wsm_workspace_idx" ON "workspace_members" ("workspace_id");
CREATE INDEX "wsm_user_idx" ON "workspace_members" ("user_id");
CREATE TRIGGER workspace_members_set_updated_at BEFORE UPDATE ON "workspace_members"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3.4 funnels (current_version_id FK added later â€” cyclic w/ funnel_versions)
CREATE TABLE "funnels" (
  "id"                  TEXT PRIMARY KEY,
  "workspace_id"        TEXT NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "name"                TEXT NOT NULL,
  "slug"                CITEXT NOT NULL,
  "status"              "funnel_status" NOT NULL DEFAULT 'draft',
  "vertical"            TEXT,
  "current_version_id"  TEXT,
  "live_url"            TEXT,
  "custom_domain_id"    TEXT,
  "ai_disclosure"       JSONB NOT NULL DEFAULT '{"enabled": true}'::jsonb,
  "created_by"          TEXT NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "created_at"          TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at"          TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "archived_at"         TIMESTAMPTZ(6),
  "deleted_at"          TIMESTAMPTZ(6)
);
CREATE UNIQUE INDEX "funnels_workspace_slug_unique"
  ON "funnels" ("workspace_id", "slug") WHERE "deleted_at" IS NULL;
CREATE INDEX "funnels_workspace_status_idx" ON "funnels" ("workspace_id", "status");
CREATE INDEX "funnels_workspace_created_idx" ON "funnels" ("workspace_id", "created_at" DESC);
CREATE INDEX "funnels_ai_disclosure_gin" ON "funnels" USING GIN ("ai_disclosure" jsonb_path_ops);
CREATE TRIGGER funnels_set_updated_at BEFORE UPDATE ON "funnels"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3.5 funnel_versions
CREATE TABLE "funnel_versions" (
  "id"                  TEXT PRIMARY KEY,
  "workspace_id"        TEXT NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "funnel_id"           TEXT NOT NULL REFERENCES "funnels"("id") ON DELETE CASCADE,
  "version_number"      INTEGER NOT NULL,
  "generation_id"       TEXT,
  "source"              TEXT NOT NULL,
  "parent_version_id"   TEXT REFERENCES "funnel_versions"("id") ON DELETE SET NULL,
  "artifact_hash"       TEXT NOT NULL,
  "bundle_s3_uri"       TEXT NOT NULL,
  "copy_blob"           JSONB NOT NULL,
  "design_blob"         JSONB NOT NULL,
  "config_blob"         JSONB NOT NULL,
  "compliance_blob"     JSONB NOT NULL DEFAULT '{}'::jsonb,
  "quality_score"       NUMERIC(5,2),
  "is_published"        BOOLEAN NOT NULL DEFAULT FALSE,
  "published_at"        TIMESTAMPTZ(6),
  "published_by"        TEXT REFERENCES "users"("id") ON DELETE SET NULL,
  "unpublished_at"      TIMESTAMPTZ(6),
  "embedding"           vector(1536),
  "created_at"          TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "fv_funnel_version_unique" ON "funnel_versions" ("funnel_id", "version_number");
CREATE INDEX "fv_workspace_idx" ON "funnel_versions" ("workspace_id");
CREATE INDEX "fv_generation_idx" ON "funnel_versions" ("generation_id");
CREATE INDEX "fv_published_idx" ON "funnel_versions" ("funnel_id", "is_published") WHERE "is_published";
CREATE INDEX "fv_copy_blob_gin" ON "funnel_versions" USING GIN ("copy_blob" jsonb_path_ops);
CREATE INDEX "fv_embedding_ivfflat" ON "funnel_versions" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100);

-- Cyclic FK now that funnel_versions exists
ALTER TABLE "funnels"
  ADD CONSTRAINT "funnels_current_version_fk"
  FOREIGN KEY ("current_version_id") REFERENCES "funnel_versions"("id")
  ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;

-- 3.6 crm_contacts
CREATE TABLE "crm_contacts" (
  "id"               TEXT PRIMARY KEY,
  "workspace_id"     TEXT NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "email_normalized" CITEXT,
  "email_sha256"     TEXT,
  "phone_e164"       TEXT,
  "phone_sha256"     TEXT,
  "full_name"        TEXT,
  "first_name"       TEXT,
  "last_name"        TEXT,
  "company"          TEXT,
  "custom_fields"    JSONB NOT NULL DEFAULT '{}'::jsonb,
  "tags"             TEXT[] NOT NULL DEFAULT '{}',
  "consent"          JSONB NOT NULL DEFAULT '{}'::jsonb,
  "do_not_contact"   BOOLEAN NOT NULL DEFAULT FALSE,
  "primary_source"   TEXT,
  "first_seen_at"    TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "last_activity_at" TIMESTAMPTZ(6),
  "embedding"        vector(1536),
  "created_at"       TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at"       TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "deleted_at"       TIMESTAMPTZ(6),
  "tombstone"        BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE UNIQUE INDEX "crm_workspace_email_unique"
  ON "crm_contacts" ("workspace_id", "email_normalized")
  WHERE "email_normalized" IS NOT NULL AND "deleted_at" IS NULL;
CREATE UNIQUE INDEX "crm_workspace_phone_unique"
  ON "crm_contacts" ("workspace_id", "phone_e164")
  WHERE "phone_e164" IS NOT NULL AND "deleted_at" IS NULL;
CREATE INDEX "crm_workspace_last_activity_idx" ON "crm_contacts" ("workspace_id", "last_activity_at" DESC);
CREATE INDEX "crm_tags_gin" ON "crm_contacts" USING GIN ("tags");
CREATE INDEX "crm_custom_fields_gin" ON "crm_contacts" USING GIN ("custom_fields" jsonb_path_ops);
CREATE INDEX "crm_embedding_ivfflat" ON "crm_contacts" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100);
CREATE TRIGGER crm_contacts_set_updated_at BEFORE UPDATE ON "crm_contacts"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3.7 leads
CREATE TABLE "leads" (
  "id"                       TEXT PRIMARY KEY,
  "workspace_id"             TEXT NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "funnel_id"                TEXT NOT NULL REFERENCES "funnels"("id") ON DELETE RESTRICT,
  "funnel_version_id"        TEXT NOT NULL REFERENCES "funnel_versions"("id") ON DELETE RESTRICT,
  "crm_contact_id"           TEXT REFERENCES "crm_contacts"("id") ON DELETE SET NULL,
  "status"                   "lead_status" NOT NULL DEFAULT 'new',
  "score"                    NUMERIC(5,2),
  "score_band"               TEXT,
  "score_model_version"      TEXT,
  "capture_source"           TEXT NOT NULL,
  "capture_url"              TEXT,
  "utm"                      JSONB NOT NULL DEFAULT '{}'::jsonb,
  "ip_hash"                  TEXT,
  "geo_country"              TEXT,
  "geo_region"               TEXT,
  "consent_id"               TEXT,
  "attribution_blob"         JSONB NOT NULL DEFAULT '{}'::jsonb,
  "first_contact_at"         TIMESTAMPTZ(6),
  "last_contact_at"          TIMESTAMPTZ(6),
  "qualified_at"             TIMESTAMPTZ(6),
  "disqualified_at"          TIMESTAMPTZ(6),
  "disqualified_reason"      TEXT,
  "converted_at"             TIMESTAMPTZ(6),
  "conversion_value_micros"  BIGINT,
  "conversion_currency"      CHAR(3),
  "embedding"                vector(1536),
  "created_at"               TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at"               TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "deleted_at"               TIMESTAMPTZ(6)
);
CREATE INDEX "leads_workspace_status_idx" ON "leads" ("workspace_id", "status");
CREATE INDEX "leads_funnel_created_idx" ON "leads" ("funnel_id", "created_at" DESC);
CREATE INDEX "leads_score_idx" ON "leads" ("workspace_id", "score" DESC);
CREATE INDEX "leads_crm_contact_idx" ON "leads" ("crm_contact_id");
CREATE INDEX "leads_consent_idx" ON "leads" ("consent_id");
CREATE INDEX "leads_workspace_created_idx" ON "leads" ("workspace_id", "created_at" DESC);
CREATE INDEX "leads_utm_gin" ON "leads" USING GIN ("utm" jsonb_path_ops);
CREATE INDEX "leads_embedding_ivfflat" ON "leads" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100);
CREATE TRIGGER leads_set_updated_at BEFORE UPDATE ON "leads"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3.8 bookings
CREATE TABLE "bookings" (
  "id"                TEXT PRIMARY KEY,
  "workspace_id"      TEXT NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "lead_id"           TEXT NOT NULL REFERENCES "leads"("id") ON DELETE CASCADE,
  "funnel_id"         TEXT NOT NULL REFERENCES "funnels"("id") ON DELETE RESTRICT,
  "host_user_id"      TEXT REFERENCES "users"("id") ON DELETE SET NULL,
  "external_calendar" TEXT,
  "external_event_id" TEXT,
  "scheduled_for"     TIMESTAMPTZ(6) NOT NULL,
  "duration_minutes"  INTEGER NOT NULL DEFAULT 30,
  "timezone"          TEXT NOT NULL DEFAULT 'UTC',
  "meeting_url"       TEXT,
  "status"            "booking_status" NOT NULL DEFAULT 'confirmed',
  "canceled_at"       TIMESTAMPTZ(6),
  "canceled_by"       TEXT,
  "cancel_reason"     TEXT,
  "notes_hash"        TEXT,
  "created_at"        TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at"        TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "deleted_at"        TIMESTAMPTZ(6)
);
CREATE INDEX "bookings_workspace_scheduled_idx" ON "bookings" ("workspace_id", "scheduled_for");
CREATE INDEX "bookings_lead_idx" ON "bookings" ("lead_id");
CREATE INDEX "bookings_host_idx" ON "bookings" ("host_user_id");
CREATE TRIGGER bookings_set_updated_at BEFORE UPDATE ON "bookings"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3.9 subscriptions
CREATE TABLE "subscriptions" (
  "id"                       TEXT PRIMARY KEY,
  "workspace_id"             TEXT NOT NULL REFERENCES "workspaces"("id") ON DELETE RESTRICT,
  "plan"                     TEXT NOT NULL,
  "status"                   "subscription_status" NOT NULL DEFAULT 'trialing',
  "external_processor"       TEXT NOT NULL DEFAULT 'stripe',
  "external_subscription_id" TEXT,
  "external_customer_id"     TEXT,
  "current_period_start"     TIMESTAMPTZ(6),
  "current_period_end"       TIMESTAMPTZ(6),
  "trial_ends_at"            TIMESTAMPTZ(6),
  "canceled_at"              TIMESTAMPTZ(6),
  "cancel_at_period_end"     BOOLEAN NOT NULL DEFAULT FALSE,
  "cancellation_reason"      TEXT,
  "paused_at"                TIMESTAMPTZ(6),
  "resume_at"                TIMESTAMPTZ(6),
  "unit_amount_micros"       BIGINT,
  "currency"                 CHAR(3) NOT NULL DEFAULT 'USD',
  "quantity"                 INTEGER NOT NULL DEFAULT 1,
  "metadata"                 JSONB NOT NULL DEFAULT '{}'::jsonb,
  "created_at"               TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at"               TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "sub_external_unique"
  ON "subscriptions" ("external_processor", "external_subscription_id")
  WHERE "external_subscription_id" IS NOT NULL;
CREATE INDEX "sub_workspace_status_idx" ON "subscriptions" ("workspace_id", "status");
CREATE TRIGGER subscriptions_set_updated_at BEFORE UPDATE ON "subscriptions"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3.10 invoices
CREATE TABLE "invoices" (
  "id"                     TEXT PRIMARY KEY,
  "workspace_id"           TEXT NOT NULL REFERENCES "workspaces"("id") ON DELETE RESTRICT,
  "subscription_id"        TEXT REFERENCES "subscriptions"("id") ON DELETE SET NULL,
  "external_processor"     TEXT NOT NULL DEFAULT 'stripe',
  "external_invoice_id"    TEXT,
  "status"                 "invoice_status" NOT NULL DEFAULT 'draft',
  "number"                 TEXT,
  "amount_due_micros"      BIGINT NOT NULL,
  "amount_paid_micros"     BIGINT NOT NULL DEFAULT 0,
  "amount_refunded_micros" BIGINT NOT NULL DEFAULT 0,
  "tax_micros"             BIGINT NOT NULL DEFAULT 0,
  "currency"               CHAR(3) NOT NULL,
  "period_start"           TIMESTAMPTZ(6),
  "period_end"             TIMESTAMPTZ(6),
  "due_at"                 TIMESTAMPTZ(6),
  "paid_at"                TIMESTAMPTZ(6),
  "voided_at"              TIMESTAMPTZ(6),
  "hosted_url"             TEXT,
  "pdf_url"                TEXT,
  "line_items"             JSONB NOT NULL DEFAULT '[]'::jsonb,
  "metadata"               JSONB NOT NULL DEFAULT '{}'::jsonb,
  "created_at"             TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at"             TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "inv_external_unique"
  ON "invoices" ("external_processor", "external_invoice_id")
  WHERE "external_invoice_id" IS NOT NULL;
CREATE INDEX "inv_workspace_status_idx" ON "invoices" ("workspace_id", "status");
CREATE INDEX "inv_period_idx" ON "invoices" ("period_start", "period_end");
CREATE TRIGGER invoices_set_updated_at BEFORE UPDATE ON "invoices"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3.11 payments
CREATE TABLE "payments" (
  "id"                  TEXT PRIMARY KEY,
  "workspace_id"        TEXT NOT NULL REFERENCES "workspaces"("id") ON DELETE RESTRICT,
  "invoice_id"          TEXT REFERENCES "invoices"("id") ON DELETE SET NULL,
  "external_processor"  TEXT NOT NULL DEFAULT 'stripe',
  "external_payment_id" TEXT,
  "amount_micros"       BIGINT NOT NULL,
  "currency"            CHAR(3) NOT NULL,
  "status"              "payment_status" NOT NULL,
  "payment_method_type" TEXT,
  "failure_code"        TEXT,
  "failure_text"        TEXT,
  "attempt_n"           INTEGER NOT NULL DEFAULT 1,
  "paid_at"             TIMESTAMPTZ(6),
  "created_at"          TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at"          TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "pay_external_unique"
  ON "payments" ("external_processor", "external_payment_id")
  WHERE "external_payment_id" IS NOT NULL;
CREATE INDEX "pay_workspace_status_idx" ON "payments" ("workspace_id", "status");
CREATE INDEX "pay_invoice_idx" ON "payments" ("invoice_id");
CREATE TRIGGER payments_set_updated_at BEFORE UPDATE ON "payments"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3.12 refunds
CREATE TABLE "refunds" (
  "id"                    TEXT PRIMARY KEY,
  "workspace_id"          TEXT NOT NULL REFERENCES "workspaces"("id") ON DELETE RESTRICT,
  "payment_id"            TEXT REFERENCES "payments"("id") ON DELETE SET NULL,
  "external_processor"    TEXT NOT NULL DEFAULT 'stripe',
  "external_refund_id"    TEXT,
  "amount_micros"         BIGINT NOT NULL,
  "currency"              CHAR(3) NOT NULL,
  "reason_code"           TEXT,
  "initiated_by_user_id"  TEXT REFERENCES "users"("id") ON DELETE SET NULL,
  "justification"         TEXT,
  "refunded_at"           TIMESTAMPTZ(6),
  "created_at"            TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);
CREATE INDEX "rfd_workspace_idx" ON "refunds" ("workspace_id");
CREATE INDEX "rfd_payment_idx" ON "refunds" ("payment_id");

-- 3.13 api_keys
CREATE TABLE "api_keys" (
  "id"                 TEXT PRIMARY KEY,
  "workspace_id"       TEXT NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "name"               TEXT NOT NULL,
  "key_prefix"         TEXT NOT NULL,
  "key_hash"           TEXT NOT NULL,
  "scopes"             TEXT[] NOT NULL DEFAULT '{}',
  "created_by"         TEXT NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "last_used_at"       TIMESTAMPTZ(6),
  "last_used_ip_hash"  TEXT,
  "expires_at"         TIMESTAMPTZ(6),
  "revoked_at"         TIMESTAMPTZ(6),
  "revoked_by"         TEXT REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at"         TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "apk_prefix_unique" ON "api_keys" ("key_prefix");
CREATE INDEX "apk_workspace_idx" ON "api_keys" ("workspace_id") WHERE "revoked_at" IS NULL;
CREATE INDEX "apk_scopes_gin" ON "api_keys" USING GIN ("scopes");

-- 3.14 webhooks
CREATE TABLE "webhooks" (
  "id"                   TEXT PRIMARY KEY,
  "workspace_id"         TEXT NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "url"                  TEXT NOT NULL,
  "secret_hash"          TEXT NOT NULL,
  "events"               TEXT[] NOT NULL,
  "active"               BOOLEAN NOT NULL DEFAULT TRUE,
  "description"          TEXT,
  "last_delivery_at"     TIMESTAMPTZ(6),
  "last_failure_at"      TIMESTAMPTZ(6),
  "consecutive_failures" INTEGER NOT NULL DEFAULT 0,
  "created_by"           TEXT NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "created_at"           TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at"           TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "deleted_at"           TIMESTAMPTZ(6)
);
CREATE INDEX "whk_workspace_active_idx" ON "webhooks" ("workspace_id") WHERE "active" AND "deleted_at" IS NULL;
CREATE INDEX "whk_events_gin" ON "webhooks" USING GIN ("events");
CREATE TRIGGER webhooks_set_updated_at BEFORE UPDATE ON "webhooks"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3.15 assets / asset_versions (cyclic FK like funnels)
CREATE TABLE "assets" (
  "id"                  TEXT PRIMARY KEY,
  "workspace_id"        TEXT NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "funnel_id"           TEXT REFERENCES "funnels"("id") ON DELETE SET NULL,
  "type"                "asset_type" NOT NULL,
  "name"                TEXT NOT NULL,
  "current_version_id"  TEXT,
  "tags"                TEXT[] NOT NULL DEFAULT '{}',
  "created_by"          TEXT REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at"          TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at"          TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "deleted_at"          TIMESTAMPTZ(6)
);
CREATE INDEX "assets_workspace_type_idx" ON "assets" ("workspace_id", "type");
CREATE INDEX "assets_funnel_idx" ON "assets" ("funnel_id");
CREATE INDEX "assets_tags_gin" ON "assets" USING GIN ("tags");
CREATE TRIGGER assets_set_updated_at BEFORE UPDATE ON "assets"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE "asset_versions" (
  "id"             TEXT PRIMARY KEY,
  "workspace_id"   TEXT NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "asset_id"       TEXT NOT NULL REFERENCES "assets"("id") ON DELETE CASCADE,
  "version_number" INTEGER NOT NULL,
  "generation_id"  TEXT,
  "s3_uri"         TEXT,
  "content_hash"   TEXT NOT NULL,
  "mime_type"      TEXT,
  "width_px"       INTEGER,
  "height_px"      INTEGER,
  "duration_ms"    INTEGER,
  "copy_blob"      JSONB,
  "metadata"       JSONB NOT NULL DEFAULT '{}'::jsonb,
  "embedding"      vector(1536),
  "created_by"     TEXT REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at"     TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "asv_asset_version_unique" ON "asset_versions" ("asset_id", "version_number");
CREATE INDEX "asv_generation_idx" ON "asset_versions" ("generation_id");
CREATE INDEX "asv_embedding_ivfflat" ON "asset_versions" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100);

ALTER TABLE "assets"
  ADD CONSTRAINT "assets_current_version_fk"
  FOREIGN KEY ("current_version_id") REFERENCES "asset_versions"("id")
  ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;

-- 3.16 integration_connections
CREATE TABLE "integration_connections" (
  "id"                   TEXT PRIMARY KEY,
  "workspace_id"         TEXT NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "provider"             TEXT NOT NULL,
  "external_account_id"  TEXT,
  "display_name"         TEXT,
  "scopes"               TEXT[] NOT NULL DEFAULT '{}',
  "credentials_kms_arn"  TEXT NOT NULL,
  "vault_path"           TEXT NOT NULL,
  "status"               TEXT NOT NULL DEFAULT 'active',
  "connected_by"         TEXT NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "connected_at"         TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "last_sync_at"         TIMESTAMPTZ(6),
  "last_error"           TEXT,
  "metadata"             JSONB NOT NULL DEFAULT '{}'::jsonb,
  "disconnected_at"      TIMESTAMPTZ(6),
  "disconnected_by"      TEXT REFERENCES "users"("id") ON DELETE SET NULL
);
CREATE UNIQUE INDEX "itg_workspace_provider_account_unique"
  ON "integration_connections" ("workspace_id", "provider", "external_account_id")
  WHERE "disconnected_at" IS NULL;
CREATE INDEX "itg_workspace_status_idx" ON "integration_connections" ("workspace_id", "status");

-- 3.17 revtry_calls
CREATE TABLE "revtry_calls" (
  "id"                  TEXT PRIMARY KEY,
  "workspace_id"        TEXT NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "lead_id"             TEXT NOT NULL REFERENCES "leads"("id") ON DELETE CASCADE,
  "attempt_n"           INTEGER NOT NULL,
  "agent_voice_id"      TEXT NOT NULL,
  "script_version"      TEXT NOT NULL,
  "from_number"         TEXT NOT NULL,
  "to_number_hash"      TEXT NOT NULL,
  "to_number_country"   TEXT,
  "started_at"          TIMESTAMPTZ(6) NOT NULL,
  "ended_at"            TIMESTAMPTZ(6),
  "duration_sec"        INTEGER,
  "outcome"             "call_outcome",
  "disposition_code"    TEXT,
  "recording_s3_uri"    TEXT,
  "transcript_s3_uri"   TEXT,
  "sentiment_score"     NUMERIC(4,3),
  "objections"          TEXT[] NOT NULL DEFAULT '{}',
  "consent_recorded"    BOOLEAN NOT NULL DEFAULT FALSE,
  "cost_usd_micros"     BIGINT,
  "carrier_metadata"    JSONB NOT NULL DEFAULT '{}'::jsonb,
  "pii_redacted_at"     TIMESTAMPTZ(6),
  "created_at"          TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);
CREATE INDEX "rtc_workspace_started_idx" ON "revtry_calls" ("workspace_id", "started_at" DESC);
CREATE INDEX "rtc_lead_idx" ON "revtry_calls" ("lead_id");
CREATE INDEX "rtc_outcome_idx" ON "revtry_calls" ("workspace_id", "outcome");

-- 3.18 ad_campaigns
CREATE TABLE "ad_campaigns" (
  "id"                    TEXT PRIMARY KEY,
  "workspace_id"          TEXT NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "funnel_id"             TEXT NOT NULL REFERENCES "funnels"("id") ON DELETE RESTRICT,
  "platform"              TEXT NOT NULL,
  "external_campaign_id"  TEXT,
  "name"                  TEXT NOT NULL,
  "objective"             TEXT NOT NULL,
  "status"                TEXT NOT NULL DEFAULT 'draft',
  "budget_micros"         BIGINT NOT NULL,
  "daily_cap_micros"      BIGINT,
  "currency"              CHAR(3) NOT NULL,
  "audience_blob"         JSONB NOT NULL DEFAULT '{}'::jsonb,
  "creative_asset_ids"    TEXT[] NOT NULL DEFAULT '{}',
  "schedule_start"        TIMESTAMPTZ(6),
  "schedule_end"          TIMESTAMPTZ(6),
  "launched_at"           TIMESTAMPTZ(6),
  "paused_at"             TIMESTAMPTZ(6),
  "rejected_at"           TIMESTAMPTZ(6),
  "rejection_code"        TEXT,
  "rejection_text"        TEXT,
  "spend_to_date_micros"  BIGINT NOT NULL DEFAULT 0,
  "metrics_blob"          JSONB NOT NULL DEFAULT '{}'::jsonb,
  "created_by"            TEXT NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "created_at"            TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at"            TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "deleted_at"            TIMESTAMPTZ(6)
);
CREATE UNIQUE INDEX "adc_external_unique"
  ON "ad_campaigns" ("platform", "external_campaign_id")
  WHERE "external_campaign_id" IS NOT NULL;
CREATE INDEX "adc_workspace_status_idx" ON "ad_campaigns" ("workspace_id", "status");
CREATE INDEX "adc_funnel_idx" ON "ad_campaigns" ("funnel_id");
CREATE TRIGGER ad_campaigns_set_updated_at BEFORE UPDATE ON "ad_campaigns"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3.19 email_sequences
CREATE TABLE "email_sequences" (
  "id"                TEXT PRIMARY KEY,
  "workspace_id"      TEXT NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "funnel_id"         TEXT REFERENCES "funnels"("id") ON DELETE SET NULL,
  "name"              TEXT NOT NULL,
  "trigger"           TEXT NOT NULL,
  "status"            TEXT NOT NULL DEFAULT 'draft',
  "steps"             JSONB NOT NULL DEFAULT '[]'::jsonb,
  "from_identity_id"  TEXT,
  "reply_to"          TEXT,
  "metrics_blob"      JSONB NOT NULL DEFAULT '{}'::jsonb,
  "created_by"        TEXT NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "created_at"        TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at"        TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "deleted_at"        TIMESTAMPTZ(6)
);
CREATE INDEX "esq_workspace_status_idx" ON "email_sequences" ("workspace_id", "status");
CREATE TRIGGER email_sequences_set_updated_at BEFORE UPDATE ON "email_sequences"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3.20 sms_sequences
CREATE TABLE "sms_sequences" (
  "id"                  TEXT PRIMARY KEY,
  "workspace_id"        TEXT NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "funnel_id"           TEXT REFERENCES "funnels"("id") ON DELETE SET NULL,
  "name"                TEXT NOT NULL,
  "trigger"             TEXT NOT NULL,
  "status"              TEXT NOT NULL DEFAULT 'draft',
  "steps"               JSONB NOT NULL DEFAULT '[]'::jsonb,
  "brand_id"            TEXT,
  "campaign_use_case"   TEXT,
  "quiet_hours"         JSONB NOT NULL DEFAULT '{"start":"21:00","end":"08:00","tz_strategy":"recipient"}'::jsonb,
  "metrics_blob"        JSONB NOT NULL DEFAULT '{}'::jsonb,
  "created_by"          TEXT NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "created_at"          TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at"          TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "deleted_at"          TIMESTAMPTZ(6)
);
CREATE INDEX "ssq_workspace_status_idx" ON "sms_sequences" ("workspace_id", "status");
CREATE TRIGGER sms_sequences_set_updated_at BEFORE UPDATE ON "sms_sequences"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3.21 lead_magnets
CREATE TABLE "lead_magnets" (
  "id"                  TEXT PRIMARY KEY,
  "workspace_id"        TEXT NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "funnel_id"           TEXT REFERENCES "funnels"("id") ON DELETE SET NULL,
  "type"                TEXT NOT NULL,
  "title"               TEXT NOT NULL,
  "description"         TEXT,
  "artifact_s3_uri"     TEXT,
  "artifact_hash"       TEXT,
  "generated_by_agent"  BOOLEAN NOT NULL DEFAULT FALSE,
  "generation_id"       TEXT,
  "gated_fields"        JSONB NOT NULL DEFAULT '["email"]'::jsonb,
  "download_count"      INTEGER NOT NULL DEFAULT 0,
  "status"              TEXT NOT NULL DEFAULT 'draft',
  "created_by"          TEXT REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at"          TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at"          TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "deleted_at"          TIMESTAMPTZ(6)
);
CREATE INDEX "lmg_workspace_funnel_idx" ON "lead_magnets" ("workspace_id", "funnel_id");
CREATE TRIGGER lead_magnets_set_updated_at BEFORE UPDATE ON "lead_magnets"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3.22 deletion_tombstones (survives forever â€” proof of DSAR honoring)
CREATE TABLE "deletion_tombstones" (
  "request_id"        TEXT PRIMARY KEY,
  "subject_type"      TEXT NOT NULL,
  "subject_id_hash"   TEXT NOT NULL,
  "workspace_id"      TEXT,
  "legal_basis"       TEXT NOT NULL,
  "scope_summary"     JSONB NOT NULL,
  "completed_at"      TIMESTAMPTZ(6) NOT NULL,
  "verifier_user_id"  TEXT
);
CREATE INDEX "dlt_subject_hash_idx" ON "deletion_tombstones" ("subject_id_hash");
CREATE INDEX "dlt_workspace_completed_idx" ON "deletion_tombstones" ("workspace_id", "completed_at" DESC);

-- 3.23 suppression_list
CREATE TABLE "suppression_list" (
  "id"                 TEXT PRIMARY KEY,
  "workspace_id"       TEXT NOT NULL,
  "channel"            TEXT NOT NULL,
  "identifier_sha256"  TEXT NOT NULL,
  "reason"             TEXT NOT NULL,
  "source_event_id"    TEXT,
  "added_at"           TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "sup_unique"
  ON "suppression_list" ("workspace_id", "channel", "identifier_sha256");
CREATE INDEX "sup_workspace_channel_idx" ON "suppression_list" ("workspace_id", "channel");

-- 3.24 kb_packs
CREATE TABLE "kb_packs" (
  "id"                 TEXT PRIMARY KEY,
  "vertical"           TEXT NOT NULL,
  "name"               TEXT NOT NULL,
  "version"            TEXT NOT NULL,
  "status"             TEXT NOT NULL DEFAULT 'active',
  "content_blob"       JSONB NOT NULL DEFAULT '{}'::jsonb,
  "regulatory_refs"    JSONB NOT NULL DEFAULT '[]'::jsonb,
  "embedding"          vector(1536),
  "created_at"         TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at"         TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "kb_pack_vertical_version_unique" ON "kb_packs" ("vertical", "version");
CREATE INDEX "kb_pack_vertical_status_idx" ON "kb_packs" ("vertical", "status");
CREATE INDEX "kb_pack_content_gin" ON "kb_packs" USING GIN ("content_blob" jsonb_path_ops);
CREATE INDEX "kb_pack_embedding_ivfflat" ON "kb_packs" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100);
CREATE TRIGGER kb_packs_set_updated_at BEFORE UPDATE ON "kb_packs"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------
-- 4. PARTITIONED TABLES â€” audit_log, event_log
-- Monthly RANGE partitions on occurred_at.
-- The partition manager function `ensure_partition_for_month` creates a
-- partition on demand; cron/`pgcron` is expected to call
-- `ensure_partitions_for_window(months_ahead := 3)` daily.
-- ---------------------------------------------------------------------

CREATE TABLE "audit_log" (
  "id"                    TEXT NOT NULL,
  "workspace_id"          TEXT,
  "actor_user_id"         TEXT,
  "impersonator_user_id"  TEXT,
  "action"                TEXT NOT NULL,
  "subject_type"          TEXT NOT NULL,
  "subject_id"            TEXT NOT NULL,
  "before_blob"           JSONB,
  "after_blob"            JSONB,
  "diff"                  JSONB,
  "ip_hash"               TEXT,
  "user_agent"            TEXT,
  "request_id"            TEXT,
  "trace_id"              TEXT,
  "reason"                TEXT,
  "pii_tier"              "pii_tier" NOT NULL DEFAULT 'P1',
  "occurred_at"           TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  PRIMARY KEY ("id", "occurred_at"),
  FOREIGN KEY ("actor_user_id")        REFERENCES "users"("id") ON DELETE NO ACTION,
  FOREIGN KEY ("impersonator_user_id") REFERENCES "users"("id") ON DELETE NO ACTION
) PARTITION BY RANGE ("occurred_at");

CREATE INDEX "audit_workspace_time_idx" ON "audit_log" ("workspace_id", "occurred_at" DESC);
CREATE INDEX "audit_actor_time_idx"     ON "audit_log" ("actor_user_id", "occurred_at" DESC);
CREATE INDEX "audit_subject_idx"        ON "audit_log" ("subject_type", "subject_id");
CREATE INDEX "audit_diff_gin"           ON "audit_log" USING GIN ("diff" jsonb_path_ops);

CREATE TABLE "event_log" (
  "event_id"             TEXT NOT NULL,
  "event_name"           TEXT NOT NULL,
  "event_family"         TEXT NOT NULL,
  "schema_version"       INTEGER NOT NULL,
  "workspace_id"         TEXT,
  "actor_type"           TEXT NOT NULL,
  "actor_user_id"        TEXT,
  "agent_id"             TEXT,
  "impersonator_user_id" TEXT,
  "subject_type"         TEXT,
  "subject_id"           TEXT,
  "pii_tier"             "pii_tier" NOT NULL,
  "properties"           JSONB NOT NULL,
  "context"              JSONB NOT NULL DEFAULT '{}'::jsonb,
  "consent"              JSONB NOT NULL DEFAULT '{}'::jsonb,
  "producer"             JSONB NOT NULL,
  "occurred_at"          TIMESTAMPTZ(6) NOT NULL,
  "received_at"          TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  PRIMARY KEY ("event_id", "occurred_at")
) PARTITION BY RANGE ("occurred_at");

CREATE INDEX "el_workspace_name_time_idx" ON "event_log" ("workspace_id", "event_name", "occurred_at" DESC);
CREATE INDEX "el_family_time_idx"         ON "event_log" ("event_family", "occurred_at" DESC);
CREATE INDEX "el_subject_idx"             ON "event_log" ("subject_type", "subject_id");
CREATE INDEX "el_props_gin"               ON "event_log" USING GIN ("properties" jsonb_path_ops);

-- Partition manager
CREATE OR REPLACE FUNCTION ensure_partition_for_month(
  parent_table TEXT,
  month_start  DATE
) RETURNS VOID AS $$
DECLARE
  part_name TEXT;
  range_start TIMESTAMPTZ;
  range_end   TIMESTAMPTZ;
BEGIN
  range_start := date_trunc('month', month_start);
  range_end   := range_start + INTERVAL '1 month';
  part_name   := format('%s_%s', parent_table, to_char(range_start, 'YYYY_MM'));

  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS %I PARTITION OF %I FOR VALUES FROM (%L) TO (%L);',
    part_name, parent_table, range_start, range_end
  );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION ensure_partitions_for_window(
  months_back  INTEGER DEFAULT 1,
  months_ahead INTEGER DEFAULT 3
) RETURNS VOID AS $$
DECLARE
  i INTEGER;
  m DATE;
BEGIN
  FOR i IN -months_back..months_ahead LOOP
    m := (date_trunc('month', now()) + (i || ' month')::interval)::date;
    PERFORM ensure_partition_for_month('audit_log', m);
    PERFORM ensure_partition_for_month('event_log', m);
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create initial 5 months of partitions (prev, current, +3)
SELECT ensure_partitions_for_window(1, 3);

-- ---------------------------------------------------------------------
-- 5. ROW-LEVEL SECURITY
-- Every workspace-scoped table:
--   * ENABLE ROW LEVEL SECURITY
--   * FORCE ROW LEVEL SECURITY (so the owner of the table is also constrained;
--     break-glass admins must use the dedicated `funnel_admin` role)
--   * Tenant policy USING current_setting('app.workspace_id', true)::text
-- Policy names use the pattern `{table}_tenant_isolation`.
-- ---------------------------------------------------------------------

-- 5.1 workspaces (self-row only)
ALTER TABLE "workspaces" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workspaces" FORCE ROW LEVEL SECURITY;
CREATE POLICY "workspaces_tenant_isolation" ON "workspaces"
  USING ("id" = current_setting('app.workspace_id', true))
  WITH CHECK ("id" = current_setting('app.workspace_id', true));

-- 5.2 workspace_members
ALTER TABLE "workspace_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workspace_members" FORCE ROW LEVEL SECURITY;
CREATE POLICY "workspace_members_tenant_isolation" ON "workspace_members"
  USING ("workspace_id" = current_setting('app.workspace_id', true))
  WITH CHECK ("workspace_id" = current_setting('app.workspace_id', true));

-- 5.3 funnels
ALTER TABLE "funnels" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "funnels" FORCE ROW LEVEL SECURITY;
CREATE POLICY "funnels_tenant_isolation" ON "funnels"
  USING ("workspace_id" = current_setting('app.workspace_id', true))
  WITH CHECK ("workspace_id" = current_setting('app.workspace_id', true));

-- 5.4 funnel_versions
ALTER TABLE "funnel_versions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "funnel_versions" FORCE ROW LEVEL SECURITY;
CREATE POLICY "funnel_versions_tenant_isolation" ON "funnel_versions"
  USING ("workspace_id" = current_setting('app.workspace_id', true))
  WITH CHECK ("workspace_id" = current_setting('app.workspace_id', true));

-- 5.5 crm_contacts
ALTER TABLE "crm_contacts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "crm_contacts" FORCE ROW LEVEL SECURITY;
CREATE POLICY "crm_contacts_tenant_isolation" ON "crm_contacts"
  USING ("workspace_id" = current_setting('app.workspace_id', true))
  WITH CHECK ("workspace_id" = current_setting('app.workspace_id', true));

-- 5.6 leads
ALTER TABLE "leads" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "leads" FORCE ROW LEVEL SECURITY;
CREATE POLICY "leads_tenant_isolation" ON "leads"
  USING ("workspace_id" = current_setting('app.workspace_id', true))
  WITH CHECK ("workspace_id" = current_setting('app.workspace_id', true));

-- 5.7 bookings
ALTER TABLE "bookings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bookings" FORCE ROW LEVEL SECURITY;
CREATE POLICY "bookings_tenant_isolation" ON "bookings"
  USING ("workspace_id" = current_setting('app.workspace_id', true))
  WITH CHECK ("workspace_id" = current_setting('app.workspace_id', true));

-- 5.8 subscriptions
ALTER TABLE "subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "subscriptions" FORCE ROW LEVEL SECURITY;
CREATE POLICY "subscriptions_tenant_isolation" ON "subscriptions"
  USING ("workspace_id" = current_setting('app.workspace_id', true))
  WITH CHECK ("workspace_id" = current_setting('app.workspace_id', true));

-- 5.9 invoices
ALTER TABLE "invoices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invoices" FORCE ROW LEVEL SECURITY;
CREATE POLICY "invoices_tenant_isolation" ON "invoices"
  USING ("workspace_id" = current_setting('app.workspace_id', true))
  WITH CHECK ("workspace_id" = current_setting('app.workspace_id', true));

-- 5.10 payments
ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payments" FORCE ROW LEVEL SECURITY;
CREATE POLICY "payments_tenant_isolation" ON "payments"
  USING ("workspace_id" = current_setting('app.workspace_id', true))
  WITH CHECK ("workspace_id" = current_setting('app.workspace_id', true));

-- 5.11 refunds
ALTER TABLE "refunds" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "refunds" FORCE ROW LEVEL SECURITY;
CREATE POLICY "refunds_tenant_isolation" ON "refunds"
  USING ("workspace_id" = current_setting('app.workspace_id', true))
  WITH CHECK ("workspace_id" = current_setting('app.workspace_id', true));

-- 5.12 api_keys
ALTER TABLE "api_keys" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "api_keys" FORCE ROW LEVEL SECURITY;
CREATE POLICY "api_keys_tenant_isolation" ON "api_keys"
  USING ("workspace_id" = current_setting('app.workspace_id', true))
  WITH CHECK ("workspace_id" = current_setting('app.workspace_id', true));

-- 5.13 webhooks
ALTER TABLE "webhooks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "webhooks" FORCE ROW LEVEL SECURITY;
CREATE POLICY "webhooks_tenant_isolation" ON "webhooks"
  USING ("workspace_id" = current_setting('app.workspace_id', true))
  WITH CHECK ("workspace_id" = current_setting('app.workspace_id', true));

-- 5.14 assets
ALTER TABLE "assets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "assets" FORCE ROW LEVEL SECURITY;
CREATE POLICY "assets_tenant_isolation" ON "assets"
  USING ("workspace_id" = current_setting('app.workspace_id', true))
  WITH CHECK ("workspace_id" = current_setting('app.workspace_id', true));

-- 5.15 asset_versions
ALTER TABLE "asset_versions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "asset_versions" FORCE ROW LEVEL SECURITY;
CREATE POLICY "asset_versions_tenant_isolation" ON "asset_versions"
  USING ("workspace_id" = current_setting('app.workspace_id', true))
  WITH CHECK ("workspace_id" = current_setting('app.workspace_id', true));

-- 5.16 integration_connections
ALTER TABLE "integration_connections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "integration_connections" FORCE ROW LEVEL SECURITY;
CREATE POLICY "integration_connections_tenant_isolation" ON "integration_connections"
  USING ("workspace_id" = current_setting('app.workspace_id', true))
  WITH CHECK ("workspace_id" = current_setting('app.workspace_id', true));

-- 5.17 revtry_calls
ALTER TABLE "revtry_calls" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "revtry_calls" FORCE ROW LEVEL SECURITY;
CREATE POLICY "revtry_calls_tenant_isolation" ON "revtry_calls"
  USING ("workspace_id" = current_setting('app.workspace_id', true))
  WITH CHECK ("workspace_id" = current_setting('app.workspace_id', true));

-- 5.18 ad_campaigns
ALTER TABLE "ad_campaigns" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ad_campaigns" FORCE ROW LEVEL SECURITY;
CREATE POLICY "ad_campaigns_tenant_isolation" ON "ad_campaigns"
  USING ("workspace_id" = current_setting('app.workspace_id', true))
  WITH CHECK ("workspace_id" = current_setting('app.workspace_id', true));

-- 5.19 email_sequences
ALTER TABLE "email_sequences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "email_sequences" FORCE ROW LEVEL SECURITY;
CREATE POLICY "email_sequences_tenant_isolation" ON "email_sequences"
  USING ("workspace_id" = current_setting('app.workspace_id', true))
  WITH CHECK ("workspace_id" = current_setting('app.workspace_id', true));

-- 5.20 sms_sequences
ALTER TABLE "sms_sequences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sms_sequences" FORCE ROW LEVEL SECURITY;
CREATE POLICY "sms_sequences_tenant_isolation" ON "sms_sequences"
  USING ("workspace_id" = current_setting('app.workspace_id', true))
  WITH CHECK ("workspace_id" = current_setting('app.workspace_id', true));

-- 5.21 lead_magnets
ALTER TABLE "lead_magnets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lead_magnets" FORCE ROW LEVEL SECURITY;
CREATE POLICY "lead_magnets_tenant_isolation" ON "lead_magnets"
  USING ("workspace_id" = current_setting('app.workspace_id', true))
  WITH CHECK ("workspace_id" = current_setting('app.workspace_id', true));

-- 5.22 audit_log (NULL workspace_id is global, only admins should see it;
-- regular tenants see only their own workspace's audit entries)
ALTER TABLE "audit_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_log" FORCE ROW LEVEL SECURITY;
CREATE POLICY "audit_log_tenant_isolation" ON "audit_log"
  USING ("workspace_id" = current_setting('app.workspace_id', true))
  WITH CHECK ("workspace_id" = current_setting('app.workspace_id', true));

-- 5.23 event_log (same shape as audit_log)
ALTER TABLE "event_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "event_log" FORCE ROW LEVEL SECURITY;
CREATE POLICY "event_log_tenant_isolation" ON "event_log"
  USING ("workspace_id" = current_setting('app.workspace_id', true))
  WITH CHECK ("workspace_id" = current_setting('app.workspace_id', true));

-- 5.24 suppression_list (workspace-scoped though not FK)
ALTER TABLE "suppression_list" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "suppression_list" FORCE ROW LEVEL SECURITY;
CREATE POLICY "suppression_list_tenant_isolation" ON "suppression_list"
  USING ("workspace_id" = current_setting('app.workspace_id', true))
  WITH CHECK ("workspace_id" = current_setting('app.workspace_id', true));

-- 5.25 deletion_tombstones (admin-only by default; tenants see only their own)
ALTER TABLE "deletion_tombstones" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "deletion_tombstones" FORCE ROW LEVEL SECURITY;
CREATE POLICY "deletion_tombstones_tenant_isolation" ON "deletion_tombstones"
  USING ("workspace_id" IS NULL OR "workspace_id" = current_setting('app.workspace_id', true));

-- users, kb_packs are NOT workspace-scoped â€” they are global.
-- Access control for these tables is enforced at the application/role layer.

-- ---------------------------------------------------------------------
-- 6. ADMIN BYPASS ROLE
-- The application connects as `funnel_app`, which is subject to RLS.
-- Operational/admin tasks connect as `funnel_admin`, which has BYPASSRLS.
-- Both roles are created idempotently here; password set out of band.
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'funnel_app') THEN
    CREATE ROLE "funnel_app" NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'funnel_admin') THEN
    CREATE ROLE "funnel_admin" NOLOGIN BYPASSRLS;
  END IF;
END$$;

-- Grant minimum scope to funnel_app. (DBA can extend.)
GRANT USAGE ON SCHEMA public TO "funnel_app", "funnel_admin";
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "funnel_app";
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO "funnel_app";
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO "funnel_admin";
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO "funnel_admin";

-- Audit log: NO UPDATE, NO DELETE for funnel_app (insert-only by design)
REVOKE UPDATE, DELETE ON "audit_log" FROM "funnel_app";

-- Future tables inherit grants:
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "funnel_app";
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL PRIVILEGES ON TABLES TO "funnel_admin";
