/**
 * Tiny SQL helper layered over Hyperdrive (which exposes a Postgres
 * connection string at `env.DB.connectionString`). We use
 * @neondatabase/serverless because it's the smallest Workers-compatible PG
 * client; Hyperdrive accepts its connection just like Neon.
 *
 * The renderer is read-mostly. The only write is `INSERT INTO leads` on form
 * submit. Everything else is `SELECT` with aggressive KV caching in front.
 */

import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import type { Env } from "../env.js";

export type Sql = NeonQueryFunction<false, false>;

/**
 * Build a per-request SQL client. Hyperdrive pools the underlying connections;
 * `neon()` returns a thin HTTP-fetch wrapper that's safe to construct hot.
 */
export function sqlFor(env: Env): Sql {
  // Hyperdrive surfaces a libpq URL — neon() handles it identically.
  const url = env.DB?.connectionString ?? env.DATABASE_URL;
  if (!url) throw new Error("No database connection string available");
  return neon(url);
}

// ----- Resolved-route shape ----------------------------------------------

export interface ResolvedRouteRow {
  workspace_id: string;
  workspace_slug: string;
  workspace_status: string;
  workspace_plan: string;
  ai_disclosure: { enabled: boolean } | null;
  funnel_id: string;
  funnel_slug: string;
  funnel_status: string;
  funnel_current_version_id: string;
  funnel_ai_disclosure: { enabled: boolean } | null;
  funnel_version_id: string;
  copy_blob: unknown;
  design_blob: unknown;
  config_blob: unknown;
  compliance_blob: unknown;
  brand_colors: unknown;
}

/** Look up a route by workspace slug + funnel slug. */
export async function findFunnelBySlug(
  sql: Sql,
  workspaceSlug: string,
  funnelSlug: string
): Promise<ResolvedRouteRow | null> {
  const rows = (await sql(
    `SELECT
        w.id              AS workspace_id,
        w.slug            AS workspace_slug,
        w.status::text    AS workspace_status,
        w.plan            AS workspace_plan,
        w.brand_colors    AS brand_colors,
        f.id              AS funnel_id,
        f.slug            AS funnel_slug,
        f.status::text    AS funnel_status,
        f.current_version_id AS funnel_current_version_id,
        f.ai_disclosure   AS funnel_ai_disclosure,
        fv.id             AS funnel_version_id,
        fv.copy_blob      AS copy_blob,
        fv.design_blob    AS design_blob,
        fv.config_blob    AS config_blob,
        fv.compliance_blob AS compliance_blob
     FROM workspaces w
     JOIN funnels f         ON f.workspace_id = w.id
     JOIN funnel_versions fv ON fv.id = f.current_version_id
     WHERE w.slug = $1
       AND f.slug = $2
       AND w.deleted_at IS NULL
       AND f.deleted_at IS NULL
       AND fv.is_published = TRUE
     LIMIT 1`,
    [workspaceSlug, funnelSlug]
  )) as ResolvedRouteRow[];
  return rows[0] ?? null;
}

/**
 * Look up the (single) published funnel for a workspace by its slug. This is
 * what `slug.gofunnelai.com/` (no funnel path) resolves to — the workspace's
 * default published funnel.
 */
export async function findDefaultFunnelForWorkspace(
  sql: Sql,
  workspaceSlug: string
): Promise<ResolvedRouteRow | null> {
  const rows = (await sql(
    `SELECT
        w.id              AS workspace_id,
        w.slug            AS workspace_slug,
        w.status::text    AS workspace_status,
        w.plan            AS workspace_plan,
        w.brand_colors    AS brand_colors,
        f.id              AS funnel_id,
        f.slug            AS funnel_slug,
        f.status::text    AS funnel_status,
        f.current_version_id AS funnel_current_version_id,
        f.ai_disclosure   AS funnel_ai_disclosure,
        fv.id             AS funnel_version_id,
        fv.copy_blob      AS copy_blob,
        fv.design_blob    AS design_blob,
        fv.config_blob    AS config_blob,
        fv.compliance_blob AS compliance_blob
     FROM workspaces w
     JOIN funnels f         ON f.workspace_id = w.id
     JOIN funnel_versions fv ON fv.id = f.current_version_id
     WHERE w.slug = $1
       AND w.deleted_at IS NULL
       AND f.deleted_at IS NULL
       AND fv.is_published = TRUE
       AND f.status::text = 'published'
     ORDER BY fv.published_at DESC NULLS LAST
     LIMIT 1`,
    [workspaceSlug]
  )) as ResolvedRouteRow[];
  return rows[0] ?? null;
}

/** Custom domains live on funnels keyed by `custom_domain_id` â†’ custom_domains table. */
export async function findFunnelByCustomDomain(
  sql: Sql,
  hostname: string
): Promise<ResolvedRouteRow | null> {
  const rows = (await sql(
    `SELECT
        w.id              AS workspace_id,
        w.slug            AS workspace_slug,
        w.status::text    AS workspace_status,
        w.plan            AS workspace_plan,
        w.brand_colors    AS brand_colors,
        f.id              AS funnel_id,
        f.slug            AS funnel_slug,
        f.status::text    AS funnel_status,
        f.current_version_id AS funnel_current_version_id,
        f.ai_disclosure   AS funnel_ai_disclosure,
        fv.id             AS funnel_version_id,
        fv.copy_blob      AS copy_blob,
        fv.design_blob    AS design_blob,
        fv.config_blob    AS config_blob,
        fv.compliance_blob AS compliance_blob
     FROM custom_domains cd
     JOIN funnels f         ON f.custom_domain_id = cd.id
     JOIN workspaces w      ON w.id = f.workspace_id
     JOIN funnel_versions fv ON fv.id = f.current_version_id
     WHERE LOWER(cd.hostname) = LOWER($1)
       AND cd.verified_at IS NOT NULL
       AND cd.deleted_at IS NULL
       AND w.deleted_at IS NULL
       AND f.deleted_at IS NULL
       AND fv.is_published = TRUE
     LIMIT 1`,
    [hostname]
  )) as ResolvedRouteRow[];
  return rows[0] ?? null;
}

/**
 * Insert a Lead. Called from the form-handler. Returns the new lead_id.
 * We deliberately use a single round-trip — the form-handler runs this in the
 * critical request path and we cannot exceed the 100ms SLO.
 */
export async function insertLead(
  sql: Sql,
  row: {
    id: string;
    workspace_id: string;
    funnel_id: string;
    funnel_version_id: string;
    capture_source: string;
    capture_url: string;
    utm: Record<string, string>;
    ip_hash: string | null;
    geo_country: string | null;
    geo_region: string | null;
    consent_id: string | null;
    attribution_blob: Record<string, unknown>;
  }
): Promise<void> {
  await sql(
    `INSERT INTO leads (
       id, workspace_id, funnel_id, funnel_version_id, status,
       capture_source, capture_url, utm, ip_hash, geo_country, geo_region,
       consent_id, attribution_blob, created_at, updated_at
     ) VALUES (
       $1, $2, $3, $4, 'new',
       $5, $6, $7::jsonb, $8, $9, $10,
       $11, $12::jsonb, NOW(), NOW()
     )`,
    [
      row.id,
      row.workspace_id,
      row.funnel_id,
      row.funnel_version_id,
      row.capture_source,
      row.capture_url,
      JSON.stringify(row.utm),
      row.ip_hash,
      row.geo_country,
      row.geo_region,
      row.consent_id,
      JSON.stringify(row.attribution_blob),
    ]
  );
}

/**
 * The renderer hot path includes a workspace-status check. Workspaces that are
 * `suspended`, `past_due`, or `closed` MUST get a placeholder page instead of
 * the live funnel. This is part of our trust-and-safety contract — see doc 07a.
 */
export function isWorkspaceBlocked(status: string): boolean {
  return (
    status === "suspended" ||
    status === "past_due" ||
    status === "closed" ||
    status === "blocked"
  );
}

/**
 * Free-tier plans cannot remove the AI disclosure. The brand-tokens config
 * field can request hiding it, but for these plans the renderer ignores that
 * request. See doc 18 Â§A.5 and doc 05e (publish acknowledgment).
 */
export function isFreeTier(plan: string): boolean {
  return plan === "trial" || plan === "free" || plan === "starter";
}
