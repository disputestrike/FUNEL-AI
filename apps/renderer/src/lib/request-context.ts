/**
 * Per-request context derivation — extracts hostname, visitor_id, UTM, geo,
 * IP hash. Runs once per request via Hono middleware.
 */

import type { Context, MiddlewareHandler } from "hono";
import type { HonoEnv } from "../env.js";
import { newVisitorId, sha256Hex } from "./crypto.js";
import {
  buildSetCookie,
  COOKIE_AFFILIATE,
  COOKIE_VISITOR_ID,
  parseCookies,
} from "./cookies.js";

/**
 * Canonical hostname extraction. The Worker can be hit on either the configured
 * hostname or — in local dev — `localhost:8787`. We trust the `Host` header
 * because Cloudflare sets it from the actual SNI, not from a client header.
 */
export function hostnameOf(c: Context<HonoEnv>): string {
  const url = new URL(c.req.url);
  return url.hostname.toLowerCase();
}

export function pickUtm(url: URL): Record<string, string> {
  const out: Record<string, string> = {};
  const keys = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid", "ttclid"];
  for (const k of keys) {
    const v = url.searchParams.get(k);
    if (v) out[k] = v.slice(0, 200);
  }
  return out;
}

/** Cloudflare exposes geo on `request.cf` — best-effort. */
function geoOf(c: Context<HonoEnv>): { country?: string; region?: string } {
  const cf = (c.req.raw as unknown as { cf?: { country?: string; regionCode?: string; region?: string } }).cf;
  if (!cf) return {};
  return { country: cf.country, region: cf.regionCode ?? cf.region };
}

export const requestContextMiddleware: MiddlewareHandler<HonoEnv> = async (c, next) => {
  const cookies = parseCookies(c.req.header("cookie"));
  let visitorId = cookies[COOKIE_VISITOR_ID];
  let isNewVisitor = false;
  if (!visitorId || !/^[0-9a-f-]{20,40}$/.test(visitorId)) {
    visitorId = newVisitorId();
    isNewVisitor = true;
  }

  const url = new URL(c.req.url);
  const utm = pickUtm(url);
  const ipHeader =
    c.req.header("cf-connecting-ip") ??
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
    "";
  const ipHash = ipHeader ? await sha256Hex(`v1:${ipHeader}`) : "";
  const userAgent = c.req.header("user-agent") ?? "";
  const referrer = c.req.header("referer") ?? c.req.header("referrer") ?? undefined;
  const { country, region } = geoOf(c);

  // Affiliate code: ?ref=AFFCODE wins, otherwise persisted cookie.
  const refParam = url.searchParams.get("ref") ?? url.searchParams.get("aff");
  const affiliateCode = refParam ?? cookies[COOKIE_AFFILIATE];

  c.set("hostname", hostnameOf(c));
  c.set("visitor_id", visitorId);
  c.set("request_id", crypto.randomUUID());
  c.set("ip_hash", ipHash);
  c.set("user_agent", userAgent);
  if (referrer) c.set("referrer", referrer);
  if (country) c.set("geo_country", country);
  if (region) c.set("geo_region", region);
  c.set("utm", utm);
  if (affiliateCode) c.set("affiliate_code", affiliateCode.slice(0, 80));

  await next();

  // On the way out, set cookies (if needed).
  const headers = c.res.headers;
  const apex = c.env.APEX_DOMAIN;
  if (isNewVisitor) {
    headers.append(
      "set-cookie",
      buildSetCookie(COOKIE_VISITOR_ID, visitorId, {
        maxAgeSeconds: 60 * 60 * 24 * 365 * 2, // 2 years
        domain: hostnameOf(c).endsWith(apex) ? `.${apex}` : undefined,
        sameSite: "Lax",
      })
    );
  }
  if (refParam && refParam !== cookies[COOKIE_AFFILIATE]) {
    headers.append(
      "set-cookie",
      buildSetCookie(COOKIE_AFFILIATE, refParam.slice(0, 80), {
        maxAgeSeconds: 60 * 60 * 24 * 90, // 90-day attribution
        sameSite: "Lax",
      })
    );
  }
};
