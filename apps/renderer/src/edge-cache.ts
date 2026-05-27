/**
 * KV-backed page-HTML cache with stale-while-revalidate semantics.
 *
 * Cache key: hash(funnel_id + funnel_version_id + ab_variant_id + locale + device)
 *
 * On cache miss the renderer SSRs and writes the result.
 * On stale-hit the renderer serves the cached body immediately and revalidates
 *   in the background via `ctx.waitUntil()`.
 *
 * TTL fresh: env.CACHE_TTL_FRESH_SECONDS (60s default).
 * TTL stale: env.CACHE_TTL_STALE_SECONDS (3600s default).
 *
 * Invalidation: apps/api fires a publish webhook → `purgeByTag(funnel_id)`
 * which deletes every key with the corresponding `tag` index entry.
 */

import type { Env } from "./env.js";
import { sha256Hex } from "./lib/crypto.js";

export interface CacheKeyInputs {
  funnel_id: string;
  funnel_version_id: string;
  ab_variant_id?: string;
  locale: string;
  device: "mobile" | "desktop";
}

export async function buildCacheKey(inputs: CacheKeyInputs): Promise<string> {
  const raw = [
    inputs.funnel_id,
    inputs.funnel_version_id,
    inputs.ab_variant_id ?? "_base",
    inputs.locale,
    inputs.device,
  ].join("|");
  const h = await sha256Hex(raw);
  return `page:${h.slice(0, 32)}`;
}

export interface CachedPage {
  /** HTML body. */
  html: string;
  /** Stored response headers — limited subset. */
  headers: Record<string, string>;
  /** Stored timestamp for SWR window math. */
  stored_at: number;
  /** The funnel_version_id at store time — used to detect bypass. */
  funnel_version_id: string;
}

export async function readCache(
  env: Env,
  key: string
): Promise<{ entry: CachedPage; fresh: boolean } | null> {
  const raw = await env.PAGE_CACHE.get(key, "json").catch(() => null);
  if (!raw) return null;
  const entry = raw as CachedPage;
  const ageSec = (Date.now() - entry.stored_at) / 1000;
  const freshSec = Number(env.CACHE_TTL_FRESH_SECONDS) || 60;
  const staleSec = Number(env.CACHE_TTL_STALE_SECONDS) || 3600;
  if (ageSec > staleSec) return null;
  return { entry, fresh: ageSec <= freshSec };
}

export async function writeCache(
  env: Env,
  key: string,
  funnelId: string,
  entry: CachedPage
): Promise<void> {
  const staleSec = Number(env.CACHE_TTL_STALE_SECONDS) || 3600;
  await env.PAGE_CACHE.put(key, JSON.stringify(entry), {
    expirationTtl: staleSec + 60,
    // KV "tag" index entry — we store under a per-funnel namespace so we can
    // wipe everything for a funnel on publish.
    metadata: { funnel_id: funnelId },
  });
  // Maintain a per-funnel index for tag-purge.
  const indexKey = `idx:funnel:${funnelId}`;
  const existing = (await env.PAGE_CACHE.get(indexKey, "json")) as string[] | null;
  const next = Array.from(new Set([...(existing ?? []), key])).slice(-256);
  await env.PAGE_CACHE.put(indexKey, JSON.stringify(next), { expirationTtl: staleSec + 600 });
}

/** Invalidate every cached page for a funnel (called by publish webhook). */
export async function purgeFunnel(env: Env, funnelId: string): Promise<number> {
  const indexKey = `idx:funnel:${funnelId}`;
  const keys = ((await env.PAGE_CACHE.get(indexKey, "json")) as string[] | null) ?? [];
  await Promise.all([
    ...keys.map((k) => env.PAGE_CACHE.delete(k)),
    env.PAGE_CACHE.delete(indexKey),
  ]);
  return keys.length;
}

export function deviceFromUA(ua: string): "mobile" | "desktop" {
  return /Mobi|Android|iPhone|iPad|Phone/i.test(ua) ? "mobile" : "desktop";
}
