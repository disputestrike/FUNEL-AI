/**
 * Internal-only endpoints — bearer-authenticated with INTERNAL_INGEST_SECRET.
 *
 *   POST /internal/renderer/purge
 *     Body: { "hostnames": ["solar-x9k.gofunnelai.com", ...] }
 *     Tells the renderer to invalidate its DOMAIN_CACHE for those hostnames.
 *     The renderer worker exposes its own purge endpoint at /__purge that this
 *     handler proxies to, falling back to a queue if the worker is unreachable.
 *
 *   GET  /internal/custom-domains/status?hostname=...
 *     Proxies Cloudflare for SaaS status to the renderer's "DNS not configured
 *     yet" error page (see apps/renderer/src/custom-domain/ssl.ts).
 *
 * These routes are NOT exposed via tRPC because they have no workspace
 * context and are called from edge workers, not browsers.
 */
import { Hono } from "hono";

interface InternalEnv {
  INTERNAL_INGEST_SECRET: string;
  RENDERER_PURGE_URL?: string;
  CLOUDFLARE_API_TOKEN?: string;
  CLOUDFLARE_ZONE_ID?: string;
}

type InternalHono = Hono<{ Bindings: InternalEnv }>;

export function buildInternalRoutes(): InternalHono {
  const r: InternalHono = new Hono();

  // Authentication for every route in this scope.
  r.use("*", async (c, next) => {
    const auth = c.req.header("authorization") ?? "";
    const expected = `Bearer ${c.env.INTERNAL_INGEST_SECRET}`;
    if (!c.env.INTERNAL_INGEST_SECRET || auth !== expected) {
      return c.json({ error: "unauthorized" }, 401);
    }
    await next();
  });

  // POST /internal/renderer/purge { hostnames: string[] }
  r.post("/renderer/purge", async (c) => {
    let body: { hostnames?: string[] };
    try {
      body = (await c.req.json()) as { hostnames?: string[] };
    } catch {
      return c.json({ error: "invalid_body" }, 400);
    }
    const hostnames = (body.hostnames ?? []).filter(
      (h) => typeof h === "string" && /^[a-z0-9.-]+$/i.test(h)
    );
    if (hostnames.length === 0) {
      return c.json({ ok: true, purged: 0 });
    }

    // Forward to the renderer's internal purge endpoint if configured.
    const url = c.env.RENDERER_PURGE_URL;
    if (url) {
      await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${c.env.INTERNAL_INGEST_SECRET}`,
        },
        body: JSON.stringify({ hostnames }),
      }).catch((err) => {
        console.error("[internal] renderer purge forward failed", { err: String(err) });
      });
    }
    return c.json({ ok: true, purged: hostnames.length });
  });

  // GET /internal/custom-domains/status?hostname=...
  r.get("/custom-domains/status", async (c) => {
    const hostname = c.req.query("hostname");
    if (!hostname) return c.json({ error: "missing_hostname" }, 400);
    if (!c.env.CLOUDFLARE_API_TOKEN || !c.env.CLOUDFLARE_ZONE_ID) {
      return c.json({
        hostname,
        status: "pending",
        ssl_status: "unknown",
        verification: null,
      });
    }
    try {
      const res = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${c.env.CLOUDFLARE_ZONE_ID}/custom_hostnames?hostname=${encodeURIComponent(hostname)}`,
        { headers: { authorization: `Bearer ${c.env.CLOUDFLARE_API_TOKEN}` } }
      );
      const j = (await res.json()) as {
        success?: boolean;
        result?: Array<{
          id: string;
          hostname: string;
          status: string;
          ssl?: { status?: string; method?: string; type?: string };
          ownership_verification?: { name?: string; value?: string; type?: string };
        }>;
      };
      const first = j.result?.[0];
      if (!j.success || !first) {
        return c.json({ hostname, status: "deleted", ssl_status: "unknown", verification: null });
      }
      return c.json({
        hostname: first.hostname,
        status: first.status,
        ssl_status: first.ssl?.status ?? "unknown",
        verification: first.ownership_verification
          ? {
              method: first.ssl?.method ?? "txt",
              record_name: first.ownership_verification.name,
              record_value: first.ownership_verification.value,
            }
          : null,
      });
    } catch (err) {
      return c.json({ error: "cloudflare_unavailable", detail: String(err) }, 502);
    }
  });

  return r;
}
