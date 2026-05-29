-- ============================================================================
-- 20260529000000_deployment_surfaces
--
-- Adds the three tables that back the GoFunnelAI deployment surfaces:
--   * published_funnels   ← what the renderer serves at *.gofunnelai.com and
--                            on customer-CNAMEd hosts.
--   * short_links         ← gofnl.co/[6chars] redirect table.
--   * custom_domains      ← Cloudflare-for-SaaS-fronted customer domains.
--
-- All three are workspace-scoped and protected with the same RLS pattern as
-- the rest of the schema: USING (workspace_id = current_setting('app.workspace_id'))
-- so a tenant-scoped Postgres role can never read or write across tenants.
-- ============================================================================

-- ---------------------------------------------------------------------
-- 1. ENUMS
-- ---------------------------------------------------------------------

CREATE TYPE "published_funnel_status" AS ENUM ('active', 'paused', 'archived');

CREATE TYPE "custom_domain_status" AS ENUM (
  'pending',
  'verifying',
  'verified',
  'active',
  'failed',
  'removed'
);

CREATE TYPE "ssl_status" AS ENUM (
  'pending_validation',
  'active',
  'failed',
  'unknown'
);

-- ---------------------------------------------------------------------
-- 2. published_funnels
-- Immutable per-publish snapshot. Renderer reads from this table on the
-- hot path (no JOIN against funnel_versions required).
-- ---------------------------------------------------------------------

CREATE TABLE "published_funnels" (
  "id"                 TEXT PRIMARY KEY DEFAULT ('pub_' || encode(gen_random_bytes(12), 'hex')),
  "workspace_id"       TEXT NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "funnel_id"          TEXT NOT NULL REFERENCES "funnels"("id") ON DELETE CASCADE,
  "funnel_version_id"  TEXT NOT NULL REFERENCES "funnel_versions"("id") ON DELETE RESTRICT,
  "slug"               CITEXT NOT NULL,
  "subdomain_url"      TEXT NOT NULL,
  "custom_domain"      TEXT,
  "status"             "published_funnel_status" NOT NULL DEFAULT 'active',
  "snapshot"           JSONB NOT NULL,
  "version"            INTEGER NOT NULL DEFAULT 1,
  "published_at"       TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "published_by"       TEXT REFERENCES "users"("id") ON DELETE SET NULL,
  "paused_at"          TIMESTAMPTZ(6),
  "archived_at"        TIMESTAMPTZ(6),
  "created_at"         TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at"         TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CHECK ("slug" ~ '^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$' OR length("slug") = 3 AND "slug" ~ '^[a-z0-9]{3}$')
);

CREATE UNIQUE INDEX "published_funnels_slug_unique"
  ON "published_funnels" ("slug")
  WHERE "status" <> 'archived';
CREATE UNIQUE INDEX "published_funnels_funnel_version_unique"
  ON "published_funnels" ("funnel_id", "version");
CREATE INDEX "published_funnels_workspace_idx" ON "published_funnels" ("workspace_id");
CREATE INDEX "published_funnels_funnel_status_idx" ON "published_funnels" ("funnel_id", "status");
CREATE INDEX "published_funnels_custom_domain_idx" ON "published_funnels" ("custom_domain")
  WHERE "custom_domain" IS NOT NULL;
CREATE INDEX "published_funnels_snapshot_gin" ON "published_funnels" USING GIN ("snapshot" jsonb_path_ops);

CREATE TRIGGER published_funnels_set_updated_at BEFORE UPDATE ON "published_funnels"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------
-- 3. short_links
-- gofnl.co/[code] → target_url. Code is 6 chars base32 by default; vanity
-- slugs are up to 32 chars and Growth+ tier only.
-- ---------------------------------------------------------------------

CREATE TABLE "short_links" (
  "id"               TEXT PRIMARY KEY DEFAULT ('sl_' || encode(gen_random_bytes(8), 'hex')),
  "code"             CITEXT NOT NULL,
  "target_url"       TEXT NOT NULL,
  "funnel_id"        TEXT REFERENCES "funnels"("id") ON DELETE SET NULL,
  "published_id"     TEXT REFERENCES "published_funnels"("id") ON DELETE SET NULL,
  "workspace_id"     TEXT NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "vanity"           BOOLEAN NOT NULL DEFAULT FALSE,
  "click_count"      BIGINT NOT NULL DEFAULT 0,
  "last_clicked_at"  TIMESTAMPTZ(6),
  "created_by"       TEXT REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at"       TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "deleted_at"       TIMESTAMPTZ(6),
  CHECK (length("code") BETWEEN 4 AND 64),
  CHECK ("code" ~ '^[A-Za-z0-9_-]+$')
);

CREATE UNIQUE INDEX "short_links_code_unique"
  ON "short_links" ("code")
  WHERE "deleted_at" IS NULL;
CREATE INDEX "short_links_workspace_idx" ON "short_links" ("workspace_id");
CREATE INDEX "short_links_funnel_idx" ON "short_links" ("funnel_id");

-- ---------------------------------------------------------------------
-- 4. custom_domains
-- Customer-CNAMEd hosts onboarded through Cloudflare for SaaS.
-- ---------------------------------------------------------------------

CREATE TABLE "custom_domains" (
  "id"                      TEXT PRIMARY KEY DEFAULT ('cd_' || encode(gen_random_bytes(12), 'hex')),
  "workspace_id"            TEXT NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "hostname"                CITEXT NOT NULL,
  "status"                  "custom_domain_status" NOT NULL DEFAULT 'pending',
  "verification_token"      TEXT NOT NULL,
  "cloudflare_hostname_id"  TEXT,
  "ssl_status"              "ssl_status" NOT NULL DEFAULT 'pending_validation',
  "default_funnel_id"       TEXT REFERENCES "funnels"("id") ON DELETE SET NULL,
  "last_checked_at"         TIMESTAMPTZ(6),
  "verified_at"             TIMESTAMPTZ(6),
  "activated_at"            TIMESTAMPTZ(6),
  "failure_reason"          TEXT,
  "created_at"              TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at"              TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "deleted_at"              TIMESTAMPTZ(6),
  CHECK ("hostname" ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$')
);

CREATE UNIQUE INDEX "custom_domains_hostname_unique"
  ON "custom_domains" ("hostname")
  WHERE "deleted_at" IS NULL AND "status" <> 'removed';
CREATE INDEX "custom_domains_workspace_idx" ON "custom_domains" ("workspace_id");
CREATE INDEX "custom_domains_status_idx" ON "custom_domains" ("status");

CREATE TRIGGER custom_domains_set_updated_at BEFORE UPDATE ON "custom_domains"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------
-- 5. ROW-LEVEL SECURITY
-- Same pattern as the rest of the schema: tenant isolation by
-- workspace_id = current_setting('app.workspace_id').
-- ---------------------------------------------------------------------

ALTER TABLE "published_funnels" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "published_funnels" FORCE ROW LEVEL SECURITY;
CREATE POLICY "published_funnels_tenant_isolation" ON "published_funnels"
  USING ("workspace_id" = current_setting('app.workspace_id', true))
  WITH CHECK ("workspace_id" = current_setting('app.workspace_id', true));

ALTER TABLE "short_links" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "short_links" FORCE ROW LEVEL SECURITY;
CREATE POLICY "short_links_tenant_isolation" ON "short_links"
  USING ("workspace_id" = current_setting('app.workspace_id', true))
  WITH CHECK ("workspace_id" = current_setting('app.workspace_id', true));

ALTER TABLE "custom_domains" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "custom_domains" FORCE ROW LEVEL SECURITY;
CREATE POLICY "custom_domains_tenant_isolation" ON "custom_domains"
  USING ("workspace_id" = current_setting('app.workspace_id', true))
  WITH CHECK ("workspace_id" = current_setting('app.workspace_id', true));

-- ---------------------------------------------------------------------
-- 6. CROSS-TENANT READ POLICIES FOR EDGE WORKERS
-- The renderer at *.gofunnelai.com and the gofnl.co worker run with the
-- `funnel_edge` role which has no app.workspace_id session var. They must
-- read these tables across tenants for routing; the rows are PUBLIC by
-- definition (they back public URLs) so this is safe.
-- The role is created in the init migration; we grant SELECT here.
-- ---------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'funnel_edge') THEN
    -- published_funnels and short_links power public hosts; an edge worker
    -- only needs SELECT.
    EXECUTE 'GRANT SELECT ON "published_funnels" TO funnel_edge';
    EXECUTE 'GRANT SELECT, UPDATE ("click_count","last_clicked_at") ON "short_links" TO funnel_edge';
    EXECUTE 'GRANT SELECT ON "custom_domains" TO funnel_edge';
    -- Bypass RLS for this role on these three tables only.
    EXECUTE 'ALTER POLICY "published_funnels_tenant_isolation" ON "published_funnels" TO funnel_edge USING (TRUE) WITH CHECK (TRUE)';
    EXECUTE 'ALTER POLICY "short_links_tenant_isolation" ON "short_links" TO funnel_edge USING (TRUE) WITH CHECK (TRUE)';
    EXECUTE 'ALTER POLICY "custom_domains_tenant_isolation" ON "custom_domains" TO funnel_edge USING (TRUE) WITH CHECK (TRUE)';
  END IF;
END $$;
