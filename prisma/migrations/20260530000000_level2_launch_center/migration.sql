-- ============================================================================
-- 20260530000000_level2_launch_center
--
-- Level 2 Launch Center for GoFunnelAI (gofunnelai.com).
--
-- A "Campaign" is the unit of launch. Children fan out into platforms, ad
-- variants, creative + video assets, audience profiles, UTM links, tracking
-- events, launch checklists, compliance reviews, export packages, follow-up
-- sequences, retargeting rules, and a per-campaign launch readiness score.
--
-- Tenancy:
--   * Campaign carries the workspace_id (RLS scoped directly).
--   * Every child is RLS-scoped via its campaign_id → campaigns(workspace_id).
--
-- This migration is idempotent: every CREATE TYPE / TABLE / INDEX / POLICY is
-- guarded so re-running it is a no-op.
-- ============================================================================

-- ---------------------------------------------------------------------
-- 1. ENUMS (idempotent)
-- ---------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE "campaign_status" AS ENUM ('draft','ready','launching','live','paused','archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "campaign_platform_kind" AS ENUM ('meta','google','tiktok','linkedin','youtube','email','sms','organic','qr');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "campaign_platform_status" AS ENUM ('draft','ready','launching','live','paused','rejected','archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ad_variant_angle" AS ENUM ('pain','roi','proof','speed','comparison','trust','fear','convenience');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ad_variant_status" AS ENUM ('draft','ready','approved','rejected','archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "creative_asset_type" AS ENUM ('image','video','carousel','display');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "video_asset_type" AS ENUM ('short_form','explainer','retargeting','ugc','founder','saas_demo');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "tracking_event_type" AS ENUM (
    'campaign_link_clicked','funnel_viewed','cta_clicked',
    'calculator_started','calculator_completed',
    'chat_started','lead_captured','appointment_booked',
    'call_started','call_completed',
    'sms_sent','sms_replied',
    'email_sent','email_clicked',
    'crm_updated'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "launch_checklist_status" AS ENUM ('pending','in_progress','blocked','passed','failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "compliance_severity" AS ENUM ('info','warn','block');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "export_package_format" AS ENUM ('pdf','csv','zip');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "export_package_status" AS ENUM ('pending','ready','failed','expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "followup_channel" AS ENUM ('email','sms');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "followup_status" AS ENUM ('draft','active','paused','archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "retargeting_trigger" AS ENUM (
    'page_viewed_no_engage','calculator_abandoned','chat_no_book',
    'video_no_convert','lead_no_schedule','missed_appointment'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "retargeting_status" AS ENUM ('draft','ready','live','paused','archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------
-- 2. campaigns  (root; carries workspace_id for RLS)
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "campaigns" (
  "id"               TEXT PRIMARY KEY DEFAULT ('cmp_' || encode(gen_random_bytes(13), 'hex')),
  "workspace_id"     TEXT NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "funnel_id"        TEXT NOT NULL REFERENCES "funnels"("id") ON DELETE RESTRICT,
  "name"             TEXT NOT NULL,
  "goal"             TEXT,
  "status"           "campaign_status" NOT NULL DEFAULT 'draft',
  "current_version"  INTEGER NOT NULL DEFAULT 1,
  "created_at"       TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at"       TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "archived_at"      TIMESTAMPTZ(6)
);

CREATE INDEX IF NOT EXISTS "campaigns_workspace_status_idx" ON "campaigns" ("workspace_id","status");
CREATE INDEX IF NOT EXISTS "campaigns_workspace_created_idx" ON "campaigns" ("workspace_id","created_at" DESC);
CREATE INDEX IF NOT EXISTS "campaigns_funnel_idx" ON "campaigns" ("funnel_id");

DO $$ BEGIN
  CREATE TRIGGER campaigns_set_updated_at BEFORE UPDATE ON "campaigns"
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------
-- 3. campaign_platforms
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "campaign_platforms" (
  "id"            TEXT PRIMARY KEY DEFAULT ('cpf_' || encode(gen_random_bytes(13), 'hex')),
  "campaign_id"   TEXT NOT NULL REFERENCES "campaigns"("id") ON DELETE CASCADE,
  "platform"      "campaign_platform_kind" NOT NULL,
  "status"        "campaign_platform_status" NOT NULL DEFAULT 'draft',
  "objective"     TEXT,
  "budget_daily"  BIGINT,
  "budget_total"  BIGINT,
  "created_at"    TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at"    TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "campaign_platforms_campaign_platform_unique"
  ON "campaign_platforms" ("campaign_id","platform");
CREATE INDEX IF NOT EXISTS "campaign_platforms_campaign_status_idx"
  ON "campaign_platforms" ("campaign_id","status");

DO $$ BEGIN
  CREATE TRIGGER campaign_platforms_set_updated_at BEFORE UPDATE ON "campaign_platforms"
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------
-- 4. ad_variants
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "ad_variants" (
  "id"            TEXT PRIMARY KEY DEFAULT ('adv_' || encode(gen_random_bytes(13), 'hex')),
  "campaign_id"   TEXT NOT NULL REFERENCES "campaigns"("id") ON DELETE CASCADE,
  "platform"      "campaign_platform_kind" NOT NULL,
  "angle"         "ad_variant_angle" NOT NULL,
  "primary_text"  TEXT NOT NULL,
  "headline"      TEXT NOT NULL,
  "description"   TEXT,
  "cta_text"      TEXT,
  "status"        "ad_variant_status" NOT NULL DEFAULT 'draft',
  "created_at"    TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at"    TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "ad_variants_campaign_status_idx" ON "ad_variants" ("campaign_id","status");
CREATE INDEX IF NOT EXISTS "ad_variants_campaign_platform_idx" ON "ad_variants" ("campaign_id","platform");

DO $$ BEGIN
  CREATE TRIGGER ad_variants_set_updated_at BEFORE UPDATE ON "ad_variants"
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------
-- 5. creative_assets
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "creative_assets" (
  "id"                TEXT PRIMARY KEY DEFAULT ('cas_' || encode(gen_random_bytes(13), 'hex')),
  "campaign_id"       TEXT NOT NULL REFERENCES "campaigns"("id") ON DELETE CASCADE,
  "type"              "creative_asset_type" NOT NULL,
  "format"            TEXT,
  "url"               TEXT NOT NULL,
  "thumbnail_url"     TEXT,
  "prompt"            TEXT,
  "brand_score"       DECIMAL(5,2),
  "quality_score"     DECIMAL(5,2),
  "compliance_flags"  JSONB NOT NULL DEFAULT '[]'::jsonb,
  "license_metadata"  JSONB NOT NULL DEFAULT '{}'::jsonb,
  "created_at"        TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at"        TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "creative_assets_campaign_type_idx" ON "creative_assets" ("campaign_id","type");

DO $$ BEGIN
  CREATE TRIGGER creative_assets_set_updated_at BEFORE UPDATE ON "creative_assets"
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------
-- 6. video_assets
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "video_assets" (
  "id"            TEXT PRIMARY KEY DEFAULT ('vid_' || encode(gen_random_bytes(13), 'hex')),
  "campaign_id"   TEXT NOT NULL REFERENCES "campaigns"("id") ON DELETE CASCADE,
  "type"          "video_asset_type" NOT NULL,
  "script_text"   TEXT,
  "storyboard"    JSONB NOT NULL DEFAULT '{}'::jsonb,
  "voiceover_url" TEXT,
  "captions_url"  TEXT,
  "final_url"     TEXT,
  "duration_sec"  INTEGER,
  "aspect_ratio"  TEXT,
  "created_at"    TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at"    TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "video_assets_campaign_type_idx" ON "video_assets" ("campaign_id","type");

DO $$ BEGIN
  CREATE TRIGGER video_assets_set_updated_at BEFORE UPDATE ON "video_assets"
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------
-- 7. audience_profiles
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "audience_profiles" (
  "id"                TEXT PRIMARY KEY DEFAULT ('aud_' || encode(gen_random_bytes(13), 'hex')),
  "campaign_id"       TEXT NOT NULL REFERENCES "campaigns"("id") ON DELETE CASCADE,
  "platform"          "campaign_platform_kind" NOT NULL,
  "targeting"         JSONB NOT NULL DEFAULT '{}'::jsonb,
  "lookalike_source"  TEXT,
  "exclusions"        JSONB NOT NULL DEFAULT '[]'::jsonb,
  "estimated_reach"   BIGINT,
  "created_at"        TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at"        TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "audience_profiles_campaign_platform_idx"
  ON "audience_profiles" ("campaign_id","platform");

DO $$ BEGIN
  CREATE TRIGGER audience_profiles_set_updated_at BEFORE UPDATE ON "audience_profiles"
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------
-- 8. utm_links
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "utm_links" (
  "id"           TEXT PRIMARY KEY DEFAULT ('utm_' || encode(gen_random_bytes(13), 'hex')),
  "campaign_id"  TEXT NOT NULL REFERENCES "campaigns"("id") ON DELETE CASCADE,
  "platform"     "campaign_platform_kind" NOT NULL,
  "variant"      TEXT,
  "full_url"     TEXT NOT NULL,
  "short_code"   TEXT,
  "click_count"  BIGINT NOT NULL DEFAULT 0,
  "created_at"   TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at"   TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "utm_links_short_code_unique"
  ON "utm_links" ("short_code")
  WHERE "short_code" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "utm_links_campaign_platform_idx" ON "utm_links" ("campaign_id","platform");

DO $$ BEGIN
  CREATE TRIGGER utm_links_set_updated_at BEFORE UPDATE ON "utm_links"
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------
-- 9. tracking_events
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "tracking_events" (
  "id"           TEXT PRIMARY KEY DEFAULT ('tev_' || encode(gen_random_bytes(13), 'hex')),
  "campaign_id"  TEXT NOT NULL REFERENCES "campaigns"("id") ON DELETE CASCADE,
  "event_type"   "tracking_event_type" NOT NULL,
  "occurred_at"  TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "lead_id"      TEXT,
  "properties"   JSONB NOT NULL DEFAULT '{}'::jsonb,
  "created_at"   TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "tracking_events_campaign_time_idx"
  ON "tracking_events" ("campaign_id","occurred_at" DESC);
CREATE INDEX IF NOT EXISTS "tracking_events_campaign_type_time_idx"
  ON "tracking_events" ("campaign_id","event_type","occurred_at" DESC);
CREATE INDEX IF NOT EXISTS "tracking_events_lead_idx"
  ON "tracking_events" ("lead_id")
  WHERE "lead_id" IS NOT NULL;

-- ---------------------------------------------------------------------
-- 10. launch_checklists
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "launch_checklists" (
  "id"              TEXT PRIMARY KEY DEFAULT ('lck_' || encode(gen_random_bytes(13), 'hex')),
  "campaign_id"     TEXT NOT NULL REFERENCES "campaigns"("id") ON DELETE CASCADE,
  "items"           JSONB NOT NULL DEFAULT '[]'::jsonb,
  "completed_count" INTEGER NOT NULL DEFAULT 0,
  "total_count"     INTEGER NOT NULL DEFAULT 0,
  "status"          "launch_checklist_status" NOT NULL DEFAULT 'pending',
  "created_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "launch_checklists_campaign_status_idx"
  ON "launch_checklists" ("campaign_id","status");

DO $$ BEGIN
  CREATE TRIGGER launch_checklists_set_updated_at BEFORE UPDATE ON "launch_checklists"
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------
-- 11. compliance_reviews
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "compliance_reviews" (
  "id"           TEXT PRIMARY KEY DEFAULT ('cmr_' || encode(gen_random_bytes(13), 'hex')),
  "campaign_id"  TEXT NOT NULL REFERENCES "campaigns"("id") ON DELETE CASCADE,
  "asset_id"     TEXT,
  "severity"     "compliance_severity" NOT NULL,
  "category"     TEXT NOT NULL,
  "message"      TEXT NOT NULL,
  "suggestion"   TEXT,
  "created_at"   TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "compliance_reviews_campaign_severity_idx"
  ON "compliance_reviews" ("campaign_id","severity");
CREATE INDEX IF NOT EXISTS "compliance_reviews_asset_idx"
  ON "compliance_reviews" ("asset_id")
  WHERE "asset_id" IS NOT NULL;

-- ---------------------------------------------------------------------
-- 12. export_packages
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "export_packages" (
  "id"             TEXT PRIMARY KEY DEFAULT ('exp_' || encode(gen_random_bytes(13), 'hex')),
  "campaign_id"    TEXT NOT NULL REFERENCES "campaigns"("id") ON DELETE CASCADE,
  "format"         "export_package_format" NOT NULL,
  "url"            TEXT,
  "status"         "export_package_status" NOT NULL DEFAULT 'pending',
  "generated_at"   TIMESTAMPTZ(6),
  "download_count" INTEGER NOT NULL DEFAULT 0,
  "created_at"     TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at"     TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "export_packages_campaign_status_idx"
  ON "export_packages" ("campaign_id","status");

DO $$ BEGIN
  CREATE TRIGGER export_packages_set_updated_at BEFORE UPDATE ON "export_packages"
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------
-- 13. followup_sequences
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "followup_sequences" (
  "id"           TEXT PRIMARY KEY DEFAULT ('fsq_' || encode(gen_random_bytes(13), 'hex')),
  "campaign_id"  TEXT NOT NULL REFERENCES "campaigns"("id") ON DELETE CASCADE,
  "channel"      "followup_channel" NOT NULL,
  "steps"        JSONB NOT NULL DEFAULT '[]'::jsonb,
  "status"       "followup_status" NOT NULL DEFAULT 'draft',
  "created_at"   TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at"   TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "followup_sequences_campaign_status_idx"
  ON "followup_sequences" ("campaign_id","status");
CREATE INDEX IF NOT EXISTS "followup_sequences_campaign_channel_idx"
  ON "followup_sequences" ("campaign_id","channel");

DO $$ BEGIN
  CREATE TRIGGER followup_sequences_set_updated_at BEFORE UPDATE ON "followup_sequences"
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------
-- 14. retargeting_rules
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "retargeting_rules" (
  "id"             TEXT PRIMARY KEY DEFAULT ('rtg_' || encode(gen_random_bytes(13), 'hex')),
  "campaign_id"    TEXT NOT NULL REFERENCES "campaigns"("id") ON DELETE CASCADE,
  "trigger"        "retargeting_trigger" NOT NULL,
  "ad_variant_id"  TEXT REFERENCES "ad_variants"("id") ON DELETE SET NULL,
  "status"         "retargeting_status" NOT NULL DEFAULT 'draft',
  "created_at"     TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at"     TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "retargeting_rules_campaign_status_idx"
  ON "retargeting_rules" ("campaign_id","status");
CREATE INDEX IF NOT EXISTS "retargeting_rules_campaign_trigger_idx"
  ON "retargeting_rules" ("campaign_id","trigger");

DO $$ BEGIN
  CREATE TRIGGER retargeting_rules_set_updated_at BEFORE UPDATE ON "retargeting_rules"
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------
-- 15. launch_scores
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "launch_scores" (
  "id"                  TEXT PRIMARY KEY DEFAULT ('lsc_' || encode(gen_random_bytes(13), 'hex')),
  "campaign_id"         TEXT NOT NULL REFERENCES "campaigns"("id") ON DELETE CASCADE,
  "funnel_readiness"    DECIMAL(5,2) NOT NULL DEFAULT 0,
  "creative_quality"    DECIMAL(5,2) NOT NULL DEFAULT 0,
  "video_readiness"     DECIMAL(5,2) NOT NULL DEFAULT 0,
  "tracking_readiness"  DECIMAL(5,2) NOT NULL DEFAULT 0,
  "offer_strength"      DECIMAL(5,2) NOT NULL DEFAULT 0,
  "audience_fit"        DECIMAL(5,2) NOT NULL DEFAULT 0,
  "compliance_risk"     DECIMAL(5,2) NOT NULL DEFAULT 0,
  "followup_coverage"   DECIMAL(5,2) NOT NULL DEFAULT 0,
  "launch_readiness"    DECIMAL(5,2) NOT NULL DEFAULT 0,
  "computed_at"         TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "launch_scores_campaign_time_idx"
  ON "launch_scores" ("campaign_id","computed_at" DESC);

-- ---------------------------------------------------------------------
-- 16. ROW-LEVEL SECURITY
--
-- campaigns: tenant isolation by workspace_id directly.
-- Every child table: isolation via a campaign_id → campaigns(workspace_id)
-- subquery. Same pattern used elsewhere in this schema for parent-scoped
-- children (no workspace_id column to duplicate, no cross-tenant leakage).
-- ---------------------------------------------------------------------

ALTER TABLE "campaigns" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "campaigns" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "campaigns_tenant_isolation" ON "campaigns";
CREATE POLICY "campaigns_tenant_isolation" ON "campaigns"
  USING ("workspace_id" = current_setting('app.workspace_id', true))
  WITH CHECK ("workspace_id" = current_setting('app.workspace_id', true));

-- Child tables use a campaign_id → campaigns subquery for isolation.
-- The campaigns row itself is filtered by its own RLS policy, so this is a
-- single-hop check that still benefits from the campaign_id indexes above.

ALTER TABLE "campaign_platforms" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "campaign_platforms" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "campaign_platforms_tenant_isolation" ON "campaign_platforms";
CREATE POLICY "campaign_platforms_tenant_isolation" ON "campaign_platforms"
  USING ("campaign_id" IN (
    SELECT "id" FROM "campaigns"
    WHERE "workspace_id" = current_setting('app.workspace_id', true)
  ))
  WITH CHECK ("campaign_id" IN (
    SELECT "id" FROM "campaigns"
    WHERE "workspace_id" = current_setting('app.workspace_id', true)
  ));

ALTER TABLE "ad_variants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ad_variants" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ad_variants_tenant_isolation" ON "ad_variants";
CREATE POLICY "ad_variants_tenant_isolation" ON "ad_variants"
  USING ("campaign_id" IN (
    SELECT "id" FROM "campaigns"
    WHERE "workspace_id" = current_setting('app.workspace_id', true)
  ))
  WITH CHECK ("campaign_id" IN (
    SELECT "id" FROM "campaigns"
    WHERE "workspace_id" = current_setting('app.workspace_id', true)
  ));

ALTER TABLE "creative_assets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "creative_assets" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "creative_assets_tenant_isolation" ON "creative_assets";
CREATE POLICY "creative_assets_tenant_isolation" ON "creative_assets"
  USING ("campaign_id" IN (
    SELECT "id" FROM "campaigns"
    WHERE "workspace_id" = current_setting('app.workspace_id', true)
  ))
  WITH CHECK ("campaign_id" IN (
    SELECT "id" FROM "campaigns"
    WHERE "workspace_id" = current_setting('app.workspace_id', true)
  ));

ALTER TABLE "video_assets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "video_assets" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "video_assets_tenant_isolation" ON "video_assets";
CREATE POLICY "video_assets_tenant_isolation" ON "video_assets"
  USING ("campaign_id" IN (
    SELECT "id" FROM "campaigns"
    WHERE "workspace_id" = current_setting('app.workspace_id', true)
  ))
  WITH CHECK ("campaign_id" IN (
    SELECT "id" FROM "campaigns"
    WHERE "workspace_id" = current_setting('app.workspace_id', true)
  ));

ALTER TABLE "audience_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audience_profiles" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "audience_profiles_tenant_isolation" ON "audience_profiles";
CREATE POLICY "audience_profiles_tenant_isolation" ON "audience_profiles"
  USING ("campaign_id" IN (
    SELECT "id" FROM "campaigns"
    WHERE "workspace_id" = current_setting('app.workspace_id', true)
  ))
  WITH CHECK ("campaign_id" IN (
    SELECT "id" FROM "campaigns"
    WHERE "workspace_id" = current_setting('app.workspace_id', true)
  ));

ALTER TABLE "utm_links" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "utm_links" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "utm_links_tenant_isolation" ON "utm_links";
CREATE POLICY "utm_links_tenant_isolation" ON "utm_links"
  USING ("campaign_id" IN (
    SELECT "id" FROM "campaigns"
    WHERE "workspace_id" = current_setting('app.workspace_id', true)
  ))
  WITH CHECK ("campaign_id" IN (
    SELECT "id" FROM "campaigns"
    WHERE "workspace_id" = current_setting('app.workspace_id', true)
  ));

ALTER TABLE "tracking_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tracking_events" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tracking_events_tenant_isolation" ON "tracking_events";
CREATE POLICY "tracking_events_tenant_isolation" ON "tracking_events"
  USING ("campaign_id" IN (
    SELECT "id" FROM "campaigns"
    WHERE "workspace_id" = current_setting('app.workspace_id', true)
  ))
  WITH CHECK ("campaign_id" IN (
    SELECT "id" FROM "campaigns"
    WHERE "workspace_id" = current_setting('app.workspace_id', true)
  ));

ALTER TABLE "launch_checklists" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "launch_checklists" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "launch_checklists_tenant_isolation" ON "launch_checklists";
CREATE POLICY "launch_checklists_tenant_isolation" ON "launch_checklists"
  USING ("campaign_id" IN (
    SELECT "id" FROM "campaigns"
    WHERE "workspace_id" = current_setting('app.workspace_id', true)
  ))
  WITH CHECK ("campaign_id" IN (
    SELECT "id" FROM "campaigns"
    WHERE "workspace_id" = current_setting('app.workspace_id', true)
  ));

ALTER TABLE "compliance_reviews" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "compliance_reviews" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "compliance_reviews_tenant_isolation" ON "compliance_reviews";
CREATE POLICY "compliance_reviews_tenant_isolation" ON "compliance_reviews"
  USING ("campaign_id" IN (
    SELECT "id" FROM "campaigns"
    WHERE "workspace_id" = current_setting('app.workspace_id', true)
  ))
  WITH CHECK ("campaign_id" IN (
    SELECT "id" FROM "campaigns"
    WHERE "workspace_id" = current_setting('app.workspace_id', true)
  ));

ALTER TABLE "export_packages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "export_packages" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "export_packages_tenant_isolation" ON "export_packages";
CREATE POLICY "export_packages_tenant_isolation" ON "export_packages"
  USING ("campaign_id" IN (
    SELECT "id" FROM "campaigns"
    WHERE "workspace_id" = current_setting('app.workspace_id', true)
  ))
  WITH CHECK ("campaign_id" IN (
    SELECT "id" FROM "campaigns"
    WHERE "workspace_id" = current_setting('app.workspace_id', true)
  ));

ALTER TABLE "followup_sequences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "followup_sequences" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "followup_sequences_tenant_isolation" ON "followup_sequences";
CREATE POLICY "followup_sequences_tenant_isolation" ON "followup_sequences"
  USING ("campaign_id" IN (
    SELECT "id" FROM "campaigns"
    WHERE "workspace_id" = current_setting('app.workspace_id', true)
  ))
  WITH CHECK ("campaign_id" IN (
    SELECT "id" FROM "campaigns"
    WHERE "workspace_id" = current_setting('app.workspace_id', true)
  ));

ALTER TABLE "retargeting_rules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "retargeting_rules" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "retargeting_rules_tenant_isolation" ON "retargeting_rules";
CREATE POLICY "retargeting_rules_tenant_isolation" ON "retargeting_rules"
  USING ("campaign_id" IN (
    SELECT "id" FROM "campaigns"
    WHERE "workspace_id" = current_setting('app.workspace_id', true)
  ))
  WITH CHECK ("campaign_id" IN (
    SELECT "id" FROM "campaigns"
    WHERE "workspace_id" = current_setting('app.workspace_id', true)
  ));

ALTER TABLE "launch_scores" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "launch_scores" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "launch_scores_tenant_isolation" ON "launch_scores";
CREATE POLICY "launch_scores_tenant_isolation" ON "launch_scores"
  USING ("campaign_id" IN (
    SELECT "id" FROM "campaigns"
    WHERE "workspace_id" = current_setting('app.workspace_id', true)
  ))
  WITH CHECK ("campaign_id" IN (
    SELECT "id" FROM "campaigns"
    WHERE "workspace_id" = current_setting('app.workspace_id', true)
  ));
