/**
 * Form-submission handler for the renderer.
 *
 *   POST /__form-submit?funnel=fnl_xxx&workspace=ws_yyy
 *
 * Steps (must finish in <100ms):
 *   1. Validate funnel_token (HMAC) — bound to (funnel_id, version, hour).
 *   2. Honeypot check (`hp_email` must be empty).
 *   3. Cloudflare Turnstile verification (when token present).
 *   4. IP rate-limit via FORM_RATELIMIT binding.
 *   5. Resolve funnel + workspace (DOMAIN_CACHE-first), validate form schema.
 *   6. Write Lead row to Postgres (single round-trip).
 *   7. Enqueue lead_captured into LEAD_QUEUE (apps/api consumes).
 *   8. Enqueue server-side conversion into ANALYTICS_QUEUE for GA4/Meta/TikTok.
 *   9. Return 200 with redirect URL.
 *
 * RevTry dispatch (must dial within 60s) is owned by the apps/api consumer
 * of LEAD_QUEUE — we don't block the request path waiting for it.
 *
 * SMS auto-reply + in-app/push notifications are also fan-outs the consumer
 * triggers, NOT this hot path.
 */
import { ulid } from "ulid";
import type { Context } from "hono";
import type { HonoEnv } from "./env.js";
import { resolveRoute } from "./custom-domain/domain-resolver.js";
import { insertLead, sqlFor } from "./lib/db.js";
import { constantTimeEqual, hmacSha256Hex, normalizeEmailForHash, normalizePhoneForHash, sha256Hex } from "./lib/crypto.js";

export async function handleFormSubmit(c: Context<HonoEnv>): Promise<Response> {
  const url = new URL(c.req.url);
  const workspaceId = url.searchParams.get("workspace");
  const funnelId = url.searchParams.get("funnel");

  if (!workspaceId || !funnelId) {
    return c.json({ ok: false, error: "missing_params" }, 400);
  }

  // 1. Parse the body. We accept urlencoded (the default <form> POST) and JSON.
  const contentType = c.req.header("content-type") ?? "";
  let body: Record<string, string>;
  try {
    if (contentType.startsWith("application/json")) {
      body = (await c.req.json()) as Record<string, string>;
    } else {
      const fd = await c.req.formData();
      body = {};
      for (const [k, v] of fd.entries()) {
        if (typeof v === "string") body[k] = v;
      }
    }
  } catch {
    return c.json({ ok: false, error: "invalid_body" }, 400);
  }

  // 2. Honeypot — silently 200 so bots don't probe.
  if (typeof body["hp_email"] === "string" && body["hp_email"].length > 0) {
    return c.json({ ok: true, lead_id: null, next_url: c.env.APP_BASE_URL }, 200);
  }

  // 3. IP rate-limit.
  const ipHeader = c.req.header("cf-connecting-ip") ?? "";
  if (ipHeader && c.env.FORM_RATELIMIT) {
    const rl = await c.env.FORM_RATELIMIT.limit({ key: `form:${ipHeader}:${funnelId}` });
    if (!rl.success) return c.json({ ok: false, error: "rate_limited" }, 429);
  }

  // 4. Validate funnel_token (HMAC). The token rolls hourly; accept the current
  //    or previous hour bucket.
  const formToken = (body["funnel_token"] ?? "").trim();
  if (!formToken) {
    return c.json({ ok: false, error: "missing_token" }, 400);
  }

  const hostname = c.get("hostname");
  const route = await resolveRoute(c.env, hostname, null);
  if (route.kind !== "ok" || !route.row || route.row.funnel_id !== funnelId) {
    return c.json({ ok: false, error: "funnel_not_found" }, 404);
  }
  if (route.row.workspace_status !== "active") {
    return c.json({ ok: false, error: "workspace_blocked" }, 403);
  }

  const nowHour = Math.floor(Date.now() / 1000 / 3600);
  const expectedNow = await hmacSha256Hex(
    c.env.FORM_HMAC_SECRET,
    `${route.row.funnel_id}|${route.row.funnel_version_id}|${nowHour}`
  );
  const expectedPrev = await hmacSha256Hex(
    c.env.FORM_HMAC_SECRET,
    `${route.row.funnel_id}|${route.row.funnel_version_id}|${nowHour - 1}`
  );
  if (!constantTimeEqual(formToken, expectedNow) && !constantTimeEqual(formToken, expectedPrev)) {
    return c.json({ ok: false, error: "invalid_token" }, 401);
  }

  // 5. Turnstile (optional but strongly recommended).
  const turnstileToken = body["cf-turnstile-response"] ?? body["turnstile_token"];
  if (turnstileToken && c.env.TURNSTILE_SECRET_KEY) {
    const verified = await verifyTurnstile(c.env.TURNSTILE_SECRET_KEY, turnstileToken, ipHeader);
    if (!verified) return c.json({ ok: false, error: "captcha_failed" }, 400);
  }

  // 6. Extract canonical PII.
  const email = (body["email"] ?? "").toLowerCase().trim();
  const phone = (body["phone"] ?? "").trim();
  const fullName = body["full_name"] ?? body["name"] ?? "";
  if (!email && !phone) {
    return c.json({ ok: false, error: "missing_contact" }, 400);
  }

  // 7. Persist Lead — single round-trip to keep us under 100ms.
  const sql = sqlFor(c.env);
  const leadId = `lds_${ulid()}`;
  const consentId = `cns_${ulid()}`;
  const utm = c.get("utm") ?? {};
  const ipHash = c.get("ip_hash") ?? null;
  const country = c.get("geo_country") ?? null;
  const region = c.get("geo_region") ?? null;

  try {
    await insertLead(sql, {
      id: leadId,
      workspace_id: route.row.workspace_id,
      funnel_id: route.row.funnel_id,
      funnel_version_id: route.row.funnel_version_id,
      capture_source: "landing_page_form",
      capture_url: url.toString(),
      utm,
      ip_hash: ipHash,
      geo_country: country,
      geo_region: region,
      consent_id: consentId,
      attribution_blob: {
        visitor_id: c.get("visitor_id"),
        affiliate_code: c.get("affiliate_code"),
        referrer: c.get("referrer"),
        is_custom_domain: route.is_custom_domain,
      },
    });
  } catch (err) {
    console.error("[forms] insertLead failed", { err: String(err) });
    return c.json({ ok: false, error: "persist_failed" }, 500);
  }

  // 8. Fan-out queue jobs (LEAD_QUEUE → apps/api triggers SMS auto-reply,
  //    RevTry dial (<60s), in-app + push + email notifications).
  const emailHash = email ? await sha256Hex(normalizeEmailForHash(email)) : undefined;
  const phoneHash = phone ? await sha256Hex(normalizePhoneForHash(phone)) : undefined;

  c.executionCtx?.waitUntil(
    Promise.all([
      c.env.LEAD_QUEUE.send({
        job_id: `job_${ulid()}`,
        enqueued_at: new Date().toISOString(),
        workspace_id: route.row.workspace_id,
        funnel_id: route.row.funnel_id,
        funnel_version_id: route.row.funnel_version_id,
        page_id: "default",
        form_id: body["form_id"] ?? "default",
        capture_source: "landing_page_form",
        capture_url: url.toString(),
        fields: {
          full_name: fullName || null,
          email: email || null,
          phone: phone || null,
        },
        pii: {
          email_sha256: emailHash,
          phone_e164_sha256: phoneHash,
        },
        consent: {
          consent_id: consentId,
          consent_text_version: "v1",
          captured_at: new Date().toISOString(),
          ip_hash: ipHash ?? "",
          user_agent: c.get("user_agent") ?? "",
          marketing: body["consent_marketing"] === "1" || body["consent_marketing"] === "true",
          tcpa: body["consent_tcpa"] === "1" || body["consent_tcpa"] === "true",
          gdpr: body["consent_gdpr"] === "1" || body["consent_gdpr"] === "true",
        },
        utm,
        affiliate_code: c.get("affiliate_code"),
        referrer: c.get("referrer"),
        geo_country: country ?? undefined,
        geo_region: region ?? undefined,
        visitor_id: c.get("visitor_id"),
      }),
      // 9. Server-side analytics conversion (Conversions API).
      enqueueAnalyticsConversion(c, route.row, { emailHash, phoneHash, leadId }),
    ]).catch((err) => {
      console.error("[forms] background fanout failed", { err: String(err) });
    })
  );

  return c.json(
    {
      ok: true,
      lead_id: leadId,
      next_url: `https://${hostname}/thanks?fid=${encodeURIComponent(route.row.funnel_id)}`,
    },
    200
  );
}

async function verifyTurnstile(secret: string, token: string, ip: string): Promise<boolean> {
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token, remoteip: ip }),
    });
    const j = (await res.json()) as { success?: boolean };
    return !!j.success;
  } catch {
    return false;
  }
}

async function enqueueAnalyticsConversion(
  c: Context<HonoEnv>,
  row: { funnel_id: string; workspace_id: string; config_blob: unknown },
  hashes: { emailHash?: string; phoneHash?: string; leadId: string }
): Promise<void> {
  const cfg = (row.config_blob ?? {}) as {
    analytics?: { ga4_measurement_id?: string; meta_pixel_id?: string; tiktok_pixel_id?: string };
  };
  const a = cfg.analytics ?? {};
  const providers: Array<{
    provider: "ga4" | "meta" | "tiktok";
    pixel_id: string;
    event_name: string;
    event_id: string;
    event_time: number;
    user_data_hashed: Record<string, string>;
    custom_data?: Record<string, unknown>;
    action_source: "website";
    source_url: string;
  }> = [];
  const base = {
    event_name: "Lead",
    event_id: hashes.leadId,
    event_time: Math.floor(Date.now() / 1000),
    user_data_hashed: {
      ...(hashes.emailHash ? { em: hashes.emailHash } : {}),
      ...(hashes.phoneHash ? { ph: hashes.phoneHash } : {}),
    },
    action_source: "website" as const,
    source_url: c.req.url,
  };
  if (a.ga4_measurement_id) providers.push({ provider: "ga4", pixel_id: a.ga4_measurement_id, ...base });
  if (a.meta_pixel_id) providers.push({ provider: "meta", pixel_id: a.meta_pixel_id, ...base });
  if (a.tiktok_pixel_id) providers.push({ provider: "tiktok", pixel_id: a.tiktok_pixel_id, ...base });
  if (providers.length === 0) return;
  await c.env.ANALYTICS_QUEUE.send({
    job_id: `cv_${ulid()}`,
    funnel_id: row.funnel_id,
    workspace_id: row.workspace_id,
    providers,
  });
}
