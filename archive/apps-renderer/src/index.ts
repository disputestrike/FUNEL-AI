/**
 * Funnel renderer — Cloudflare Worker entrypoint.
 *
 * Routes (in priority order):
 *
 *   GET  /healthz                      Liveness probe.
 *   GET  /readyz                       Readiness probe.
 *   GET  /__form-submit                Form pre-flight (CORS).
 *   POST /__form-submit                Lead capture; proxies to apps/api.
 *   GET  /__rss                        Per-funnel optional RSS.
 *   GET  /robots.txt                   Search-engine policy per surface.
 *   GET  /sitemap.xml                  Per-funnel sitemap.
 *   GET  /*                            The page itself. SSR'd HTML.
 *
 * The hot path is:
 *   1. resolve hostname → workspace + funnel via DOMAIN_CACHE KV → DB
 *   2. KV-SWR page-HTML cache lookup
 *   3. on miss: query published_funnels for the snapshot, render via
 *      @funnel/ui's FunnelRenderer, inject analytics + AI disclosure
 *   4. write back to cache, respond
 *
 * SLO: p99 cache-hit < 50ms, p99 cache-miss < 800ms worldwide.
 */
import { Hono } from "hono";
import type { HonoEnv } from "./env.js";
import { requestContextMiddleware } from "./lib/request-context.js";
import { resolveRoute } from "./custom-domain/domain-resolver.js";
import { buildCacheKey, deviceFromUA, readCache, writeCache } from "./edge-cache.js";
import { renderPage } from "./render.js";
import { handleFormSubmit } from "./forms.js";
import { registerHealthRoutes } from "./health.js";
import { NotFoundPage, ServerErrorPage } from "./error-pages/index.js";
import { SuspendedPage } from "./suspended-page.js";
import { renderToStaticMarkup } from "react-dom/server";

const app = new Hono<HonoEnv>();

// 1. Per-request context (hostname, visitor id, UTM, IP hash, geo).
app.use("*", requestContextMiddleware);

// 2. Health/readyz mounted before everything else.
registerHealthRoutes(app as never);

// 2a. Internal cache purge — called by apps/api after a publish/unpublish or
//     custom-domain removal. Bearer-authenticated with INTERNAL_INGEST_SECRET.
app.post("/__purge", async (c) => {
  const auth = c.req.header("authorization") ?? "";
  const expected = `Bearer ${c.env.INTERNAL_INGEST_SECRET}`;
  if (!c.env.INTERNAL_INGEST_SECRET || auth !== expected) {
    return c.json({ error: "unauthorized" }, 401);
  }
  let body: { hostnames?: string[]; funnel_ids?: string[] };
  try {
    body = (await c.req.json()) as { hostnames?: string[]; funnel_ids?: string[] };
  } catch {
    return c.json({ error: "invalid_body" }, 400);
  }
  const { invalidateDomainCache } = await import("./custom-domain/domain-resolver.js");
  const { purgeFunnel } = await import("./edge-cache.js");
  const hostnames = (body.hostnames ?? []).filter(
    (h) => typeof h === "string" && /^[a-z0-9.-]+$/i.test(h)
  );
  const funnelIds = (body.funnel_ids ?? []).filter((f) => typeof f === "string");
  let pages = 0;
  await invalidateDomainCache(c.env, hostnames);
  for (const fid of funnelIds) {
    pages += await purgeFunnel(c.env, fid);
  }
  return c.json({ ok: true, hostnames: hostnames.length, pages });
});

// 3. Form submission — must run before the wildcard page route.
app.options("/__form-submit", (c) => {
  c.header("access-control-allow-origin", c.req.header("origin") ?? "*");
  c.header("access-control-allow-methods", "POST, OPTIONS");
  c.header("access-control-allow-headers", "content-type, x-funnel-token");
  c.header("access-control-max-age", "600");
  return c.body(null, 204);
});

app.post("/__form-submit", async (c) => {
  return handleFormSubmit(c);
});

// 4. robots.txt — block crawlers on suspended/paused funnels, allow on live.
app.get("/robots.txt", async (c) => {
  const hostname = c.get("hostname");
  const route = await resolveRoute(c.env, hostname, null);
  const allow = route.kind === "ok";
  const body = allow
    ? `User-agent: *\nAllow: /\nSitemap: https://${hostname}/sitemap.xml\n`
    : `User-agent: *\nDisallow: /\n`;
  return c.body(body, 200, { "content-type": "text/plain; charset=utf-8" });
});

// 5. sitemap.xml — single page per funnel for now.
app.get("/sitemap.xml", async (c) => {
  const hostname = c.get("hostname");
  const route = await resolveRoute(c.env, hostname, null);
  if (route.kind !== "ok" || !route.row) return c.notFound();
  const url = `https://${hostname}/`;
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${url}</loc><changefreq>daily</changefreq><priority>1.0</priority></url>
</urlset>`;
  return c.body(body, 200, { "content-type": "application/xml; charset=utf-8" });
});

// 6. The page route — wildcard so we can support /, /:funnelSlug, /:funnelSlug/:pageSlug.
app.get("/*", async (c) => {
  const hostname = c.get("hostname");
  const url = new URL(c.req.url);

  // First path segment is treated as funnel slug when present.
  const parts = url.pathname.split("/").filter(Boolean);
  const funnelSlug = parts[0] && /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/.test(parts[0]) ? parts[0] : null;

  // Apex hostname → marketing site (302 to the app marketing domain).
  if (hostname === c.env.APEX_DOMAIN || hostname === `www.${c.env.APEX_DOMAIN}`) {
    return c.redirect(c.env.APP_BASE_URL, 302);
  }

  let route;
  try {
    route = await resolveRoute(c.env, hostname, funnelSlug);
  } catch (err) {
    console.error("[renderer] resolveRoute failed", { hostname, err: String(err) });
    const html = renderToStaticMarkup(
      ServerErrorPage(c.env.APP_BASE_URL, c.get("request_id"))
    );
    return c.html("<!doctype html>" + html, 500);
  }

  if (route.kind === "marketing_redirect") {
    return c.redirect(c.env.APP_BASE_URL, 302);
  }

  if (route.kind === "blocked_workspace") {
    const status =
      route.row?.workspace_status === "suspended"
        ? "suspended"
        : route.row?.workspace_status === "closed"
          ? "closed"
          : "blocked";
    const html = renderToStaticMarkup(
      SuspendedPage({ status: status as never, contactEmail: "support@gofunnelai.com" })
    );
    return c.html("<!doctype html>" + html, 503, {
      "retry-after": "3600",
      "cache-control": "public, max-age=60",
    });
  }

  if (route.kind === "not_found" || !route.row) {
    const html = renderToStaticMarkup(NotFoundPage(c.env.APP_BASE_URL));
    return c.html("<!doctype html>" + html, 404);
  }

  // Attach resolved info to context vars for downstream helpers.
  const row = route.row;
  c.set("resolved", {
    workspace_id: row.workspace_id,
    workspace_status: row.workspace_status,
    funnel_id: row.funnel_id,
    funnel_version_id: row.funnel_version_id,
    funnel_slug: row.funnel_slug,
    funnel_status: row.funnel_status,
    custom_domain: route.custom_domain,
    is_custom_domain: route.is_custom_domain,
    funnel_json: {
      copy: row.copy_blob,
      design: row.design_blob,
      config: row.config_blob,
      compliance: row.compliance_blob,
    },
    brand_tokens: row.brand_colors,
    free_tier:
      row.workspace_plan === "trial" ||
      row.workspace_plan === "free" ||
      row.workspace_plan === "starter",
  });

  // 6a. Cache key + SWR check.
  const ua = c.get("user_agent");
  const device = deviceFromUA(ua);
  const locale = c.env.DEFAULT_LOCALE;
  const cacheKey = await buildCacheKey({
    funnel_id: row.funnel_id,
    funnel_version_id: row.funnel_version_id,
    locale,
    device,
  });

  const cached = await readCache(c.env, cacheKey);
  if (cached && cached.fresh) {
    return c.html(cached.entry.html, 200, {
      ...cached.entry.headers,
      "x-funnel-cache": "hit",
      "x-funnel-id": row.funnel_id,
    });
  }

  // 6b. Render — either a fresh render on miss, or background revalidation on stale.
  const renderTask = (async () => {
    const html = await renderPage(c.env, c, row, { locale, device });
    await writeCache(c.env, cacheKey, row.funnel_id, {
      html,
      headers: { "content-type": "text/html; charset=utf-8" },
      stored_at: Date.now(),
      funnel_version_id: row.funnel_version_id,
    });
    return html;
  })();

  if (cached) {
    // Stale-while-revalidate: serve the stale body, refresh in background.
    c.executionCtx?.waitUntil(renderTask.catch(() => undefined));
    return c.html(cached.entry.html, 200, {
      ...cached.entry.headers,
      "x-funnel-cache": "stale",
      "x-funnel-id": row.funnel_id,
    });
  }

  let html: string;
  try {
    html = await renderTask;
  } catch (err) {
    console.error("[renderer] render failed", { hostname, err: String(err) });
    const errHtml = renderToStaticMarkup(
      ServerErrorPage(c.env.APP_BASE_URL, c.get("request_id"))
    );
    return c.html("<!doctype html>" + errHtml, 500);
  }
  return c.html(html, 200, {
    "x-funnel-cache": "miss",
    "x-funnel-id": row.funnel_id,
  });
});

// Final fallthrough — should be unreachable, but keep it explicit.
app.notFound((c) => {
  const html = renderToStaticMarkup(NotFoundPage(c.env.APP_BASE_URL));
  return c.html("<!doctype html>" + html, 404);
});

app.onError((err, c) => {
  console.error("[renderer] uncaught", { err: String(err), stack: (err as Error).stack });
  const html = renderToStaticMarkup(
    ServerErrorPage(c.env.APP_BASE_URL, c.get("request_id") ?? "unknown")
  );
  return c.html("<!doctype html>" + html, 500);
});

export default app;
