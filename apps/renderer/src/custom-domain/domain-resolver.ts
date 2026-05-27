/**
 * Domain resolution â€” given an incoming `hostname` (e.g. `tx-solar.gofunnelai.com`
 * or `quote.acmesolar.com`), find the matching workspace + funnel.
 *
 * Resolution order:
 *   1. KV cache lookup (positive + negative).
 *   2. Apex marketing redirect (gofunnelai.com itself).
 *   3. Subdomain pattern: <workspace-slug>.gofunnelai.com â†’ workspace default funnel.
 *      With a path: <workspace-slug>.gofunnelai.com/<funnel-slug> â†’ specific funnel.
 *   4. Custom domain (any other hostname) â†’ custom_domains lookup.
 *
 * Caches are written with a short fresh TTL (60s) and a longer SWR window.
 * On funnel publish, apps/api purges the cache by tag â€” see edge-cache.ts.
 */

import type { Env } from "../env.js";
import {
  findFunnelByCustomDomain,
  findDefaultFunnelForWorkspace,
  findFunnelBySlug,
  sqlFor,
  type ResolvedRouteRow,
} from "../lib/db.js";

const POSITIVE_TTL_SECONDS = 60;
const POSITIVE_SWR_SECONDS = 3600;
const NEGATIVE_TTL_SECONDS = 30;

interface CacheEntry {
  row: ResolvedRouteRow | null;
  ts: number;
}

function cacheKey(hostname: string, funnelSlug: string | null): string {
  return `route:${hostname.toLowerCase()}:${funnelSlug ?? "_default"}`;
}

/** Strip the apex from a hostname to find the workspace slug. */
export function workspaceSlugFromSubdomain(hostname: string, apexDomain: string): string | null {
  hostname = hostname.toLowerCase();
  if (!hostname.endsWith("." + apexDomain)) return null;
  const sub = hostname.slice(0, -("." + apexDomain).length);
  // Reject multi-label subdomains (foo.bar.gofunnelai.com) and reserved labels.
  if (!sub || sub.includes(".")) return null;
  if (RESERVED_SUBDOMAINS.has(sub)) return null;
  if (!/^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/.test(sub)) return null;
  return sub;
}

const RESERVED_SUBDOMAINS = new Set([
  "www", "app", "api", "admin", "auth", "edge", "assets", "static", "cdn",
  "mail", "smtp", "imap", "pop", "ftp", "ssh", "vpn",
  "status", "docs", "help", "support", "blog", "community", "partners",
  "grader", "grader-agents", "marketplace", "feed", "rss",
  "staging", "preview", "qa", "dev", "test",
]);

export interface RouteResolution {
  kind: "ok" | "not_found" | "marketing_redirect" | "blocked_workspace";
  row: ResolvedRouteRow | null;
  is_custom_domain: boolean;
  custom_domain?: string;
}

/**
 * The full resolve pipeline. Pure helpers above; this orchestrates them and
 * the KV cache.
 */
export async function resolveRoute(
  env: Env,
  hostname: string,
  pathFunnelSlug: string | null
): Promise<RouteResolution> {
  hostname = hostname.toLowerCase();
  const apex = env.APEX_DOMAIN.toLowerCase();

  // 1. Apex hostname â€” marketing redirect, never resolved here.
  if (hostname === apex || hostname === "www." + apex) {
    return { kind: "marketing_redirect", row: null, is_custom_domain: false };
  }

  // 2. KV cache lookup.
  const key = cacheKey(hostname, pathFunnelSlug);
  const cached = await env.DOMAIN_CACHE.get(key, "json").catch(() => null);
  if (cached) {
    const c = cached as CacheEntry;
    const ageSec = (Date.now() - c.ts) / 1000;
    if (ageSec < POSITIVE_SWR_SECONDS) {
      if (c.row === null) {
        return { kind: "not_found", row: null, is_custom_domain: !isSubdomainOf(hostname, apex) };
      }
      return finalize(c.row, !isSubdomainOf(hostname, apex), hostname);
    }
  }

  // 3. Subdomain branch.
  const sql = sqlFor(env);
  const wsSlug = workspaceSlugFromSubdomain(hostname, apex);
  let row: ResolvedRouteRow | null = null;
  if (wsSlug) {
    if (pathFunnelSlug) {
      row = await findFunnelBySlug(sql, wsSlug, pathFunnelSlug);
    } else {
      row = await findDefaultFunnelForWorkspace(sql, wsSlug);
    }
  } else {
    // 4. Custom domain branch.
    row = await findFunnelByCustomDomain(sql, hostname);
  }

  // Cache the result (positive or negative).
  const entry: CacheEntry = { row, ts: Date.now() };
  await env.DOMAIN_CACHE.put(key, JSON.stringify(entry), {
    expirationTtl: row ? POSITIVE_SWR_SECONDS : NEGATIVE_TTL_SECONDS,
  });

  if (!row) return { kind: "not_found", row: null, is_custom_domain: !isSubdomainOf(hostname, apex) };
  return finalize(row, !isSubdomainOf(hostname, apex), hostname);
}

function finalize(
  row: ResolvedRouteRow,
  isCustomDomain: boolean,
  hostname: string
): RouteResolution {
  if (row.workspace_status !== "active") {
    return {
      kind: "blocked_workspace",
      row,
      is_custom_domain: isCustomDomain,
      custom_domain: isCustomDomain ? hostname : undefined,
    };
  }
  return {
    kind: "ok",
    row,
    is_custom_domain: isCustomDomain,
    custom_domain: isCustomDomain ? hostname : undefined,
  };
}

function isSubdomainOf(hostname: string, apex: string): boolean {
  return hostname === apex || hostname.endsWith("." + apex);
}

/** Used by the publish webhook to invalidate cache for a hostname. */
export async function invalidateDomainCache(
  env: Env,
  hostnames: string[]
): Promise<void> {
  for (const h of hostnames) {
    const list = await env.DOMAIN_CACHE.list({ prefix: `route:${h.toLowerCase()}:` });
    await Promise.all(list.keys.map((k) => env.DOMAIN_CACHE.delete(k.name)));
  }
}
