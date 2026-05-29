/**
 * GoFunnelAI short-link Worker.
 *
 *   gofnl.co/abc123       302 → published funnel URL
 *   gofnl.co/health       200 OK
 *   gofnl.co/             302 → FALLBACK_URL (marketing)
 *   gofnl.co/robots.txt   200 disallow all
 *
 * The hot path is one KV read + one 302 response. On miss we hit Postgres
 * through Hyperdrive and write back to KV.
 *
 * Click counting: every successful redirect enqueues a CLICK_COUNTER_QUEUE
 * job. A separate consumer batches writes back to Postgres so the hot path
 * never blocks on `UPDATE short_links SET click_count = ...`.
 *
 * SLO: p99 < 30ms worldwide on cache hit.
 */
import { Hono } from "hono";
import { neon } from "@neondatabase/serverless";
import type { Env } from "./env.js";

interface ShortLinkRow {
  code: string;
  target_url: string;
  funnel_id: string | null;
  workspace_id: string;
  vanity: boolean;
  deleted: boolean;
}

interface CacheEntry {
  row: ShortLinkRow | null;
  ts: number;
}

const RESERVED_PATHS = new Set([
  "health",
  "healthz",
  "readyz",
  "robots.txt",
  "favicon.ico",
  "sitemap.xml",
]);

const app = new Hono<{ Bindings: Env }>();

// ---- Health --------------------------------------------------------------

app.get("/health", (c) => c.json({ ok: true, service: "short-links", ts: new Date().toISOString() }));
app.get("/healthz", (c) => c.json({ ok: true, service: "short-links" }));

app.get("/readyz", async (c) => {
  let dbOk = false;
  try {
    const sql = neon(c.env.DB?.connectionString ?? c.env.DATABASE_URL);
    await sql`SELECT 1`;
    dbOk = true;
  } catch {
    dbOk = false;
  }
  return c.json({ ok: dbOk, service: "short-links", checks: { db: dbOk } }, dbOk ? 200 : 503);
});

// ---- robots.txt — never index short links ------------------------------

app.get("/robots.txt", (c) =>
  c.body("User-agent: *\nDisallow: /\n", 200, { "content-type": "text/plain" })
);

app.get("/favicon.ico", (c) => c.body(null, 204));

// ---- Apex redirect to marketing ----------------------------------------

app.get("/", (c) => c.redirect(c.env.FALLBACK_URL, 302));

// ---- The code lookup ---------------------------------------------------

app.get("/:code", async (c) => {
  const codeRaw = c.req.param("code");
  if (!codeRaw) return c.redirect(c.env.FALLBACK_URL, 302);

  // Strip any trailing dot or whitespace.
  const code = codeRaw.trim().replace(/\.+$/, "");
  if (!code || code.length > 64 || !/^[A-Za-z0-9_-]+$/.test(code)) {
    return c.redirect(c.env.FALLBACK_URL, 302);
  }
  if (RESERVED_PATHS.has(code.toLowerCase())) return c.redirect(c.env.FALLBACK_URL, 302);

  // Rate-limit per IP.
  const ip = c.req.header("cf-connecting-ip") ?? "anon";
  if (c.env.REDIRECT_RATELIMIT) {
    const rl = await c.env.REDIRECT_RATELIMIT.limit({ key: `r:${ip}` });
    if (!rl.success) return c.body("Too many requests", 429, { "retry-after": "60" });
  }

  // KV-SWR lookup.
  const cacheKey = `link:${code.toLowerCase()}`;
  const cached = (await c.env.SHORT_LINK_CACHE.get(cacheKey, "json").catch(() => null)) as
    | CacheEntry
    | null;

  const freshTtl = Number(c.env.CACHE_TTL_FRESH_SECONDS) || 300;
  const staleTtl = Number(c.env.CACHE_TTL_STALE_SECONDS) || 86400;
  const now = Date.now();

  if (cached) {
    const ageSec = (now - cached.ts) / 1000;
    if (ageSec <= staleTtl) {
      if (cached.row === null) {
        return c.redirect(c.env.FALLBACK_URL, 302);
      }
      // Fire-and-forget click increment.
      c.executionCtx?.waitUntil(incrementClickCount(c.env, cached.row.code));
      const isStale = ageSec > freshTtl;
      if (isStale) {
        // Background refresh.
        c.executionCtx?.waitUntil(
          refreshCache(c.env, cacheKey, code).catch(() => undefined)
        );
      }
      return redirectTo(c, cached.row.target_url);
    }
  }

  // Miss → DB query.
  const row = await lookupCode(c.env, code);
  await c.env.SHORT_LINK_CACHE.put(
    cacheKey,
    JSON.stringify({ row, ts: now }),
    { expirationTtl: row ? staleTtl + 60 : 60 }
  );

  if (!row) return c.redirect(c.env.FALLBACK_URL, 302);

  c.executionCtx?.waitUntil(incrementClickCount(c.env, row.code));
  return redirectTo(c, row.target_url);
});

// 404 default
app.notFound((c) => c.redirect(c.env.FALLBACK_URL, 302));

app.onError((err, c) => {
  console.error("[short-links] uncaught", { err: String(err) });
  return c.redirect(c.env.FALLBACK_URL, 302);
});

// ---- helpers ----------------------------------------------------------

async function lookupCode(env: Env, code: string): Promise<ShortLinkRow | null> {
  const sql = neon(env.DB?.connectionString ?? env.DATABASE_URL);
  const rows = (await sql(
    `SELECT code, target_url, funnel_id, workspace_id, vanity,
            (deleted_at IS NOT NULL) AS deleted
       FROM short_links
       WHERE code = $1
       LIMIT 1`,
    [code]
  )) as Array<{
    code: string;
    target_url: string;
    funnel_id: string | null;
    workspace_id: string;
    vanity: boolean;
    deleted: boolean;
  }>;
  const r = rows[0];
  if (!r || r.deleted) return null;
  return r;
}

async function refreshCache(env: Env, cacheKey: string, code: string): Promise<void> {
  const row = await lookupCode(env, code);
  const staleTtl = Number(env.CACHE_TTL_STALE_SECONDS) || 86400;
  await env.SHORT_LINK_CACHE.put(
    cacheKey,
    JSON.stringify({ row, ts: Date.now() }),
    { expirationTtl: row ? staleTtl + 60 : 60 }
  );
}

async function incrementClickCount(env: Env, code: string): Promise<void> {
  // We batch increments via the queue — the consumer aggregates and writes
  // once every N seconds.
  try {
    await env.CLICK_COUNTER_QUEUE.send({
      code,
      count: 1,
      ts: new Date().toISOString(),
    });
  } catch (err) {
    // Best-effort. A dropped click count is not a hot-path failure.
    console.warn("[short-links] click enqueue failed", { code, err: String(err) });
  }
}

import type { Context } from "hono";
function redirectTo(c: Context<{ Bindings: Env }>, target: string): Response {
  // Forward UTM + visitor cookies through the redirect.
  const incomingUrl = new URL(c.req.url);
  let out: URL;
  try {
    out = new URL(target);
  } catch {
    return c.redirect(c.env.FALLBACK_URL, 302);
  }
  // Append any incoming UTM params if the target doesn't have them already.
  for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "ref"]) {
    const v = incomingUrl.searchParams.get(k);
    if (v && !out.searchParams.has(k)) out.searchParams.set(k, v);
  }
  return c.redirect(out.toString(), 302);
}

export default app;
