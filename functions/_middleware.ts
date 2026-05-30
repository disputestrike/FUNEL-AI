/**
 * Cloudflare Pages middleware for apps/web.
 *
 * Responsibilities:
 *  - Inject request-id / trace-id headers for downstream observability.
 *  - Apply security headers (HSTS, CSP, XFO, referrer-policy, permissions-policy).
 *  - Strip the apex host onto a marketing redirect when it isn't already on www.
 *  - Forward auth cookies untouched into the Next runtime.
 *
 * This file is shipped to Pages as a Functions middleware. Pages will run it
 * before invoking the @cloudflare/next-on-pages worker.
 */

interface Env {
  ENVIRONMENT: string;
  WEB_PUBLIC_URL: string;
  API_BASE_URL: string;
}

type PagesContext = EventContext<Env, string, Record<string, unknown>>;

const SECURITY_HEADERS: Record<string, string> = {
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy":
    "camera=(), microphone=(), geolocation=(self), interest-cohort=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-site",
};

function buildCsp(env: Env): string {
  const apiOrigin = new URL(env.API_BASE_URL).origin;
  // Stripe + PayPal + Sentry + Cloudflare Analytics + LaunchDarkly + Turnstile.
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://js.stripe.com https://www.paypal.com https://challenges.cloudflare.com https://static.cloudflareinsights.com https://*.ingest.sentry.io https://app.launchdarkly.com`,
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    `img-src 'self' data: blob: https:`,
    `font-src 'self' data: https://fonts.gstatic.com`,
    `connect-src 'self' ${apiOrigin} https://*.ingest.sentry.io https://api.stripe.com https://www.paypal.com https://api-iam.intercom.io wss://*.launchdarkly.com https://app.launchdarkly.com https://clientstream.launchdarkly.com https://events.launchdarkly.com`,
    `frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://www.paypal.com https://challenges.cloudflare.com`,
    `worker-src 'self' blob:`,
    `media-src 'self' blob: https:`,
    `manifest-src 'self'`,
    `upgrade-insecure-requests`,
  ].join("; ");
}

export const onRequest: PagesFunction<Env> = async (
  context: PagesContext,
) => {
  const { request, next, env } = context;
  const url = new URL(request.url);

  // Bare-apex marketing redirect: gofunnelai.com -> www.gofunnelai.com (preserves SEO).
  if (env.ENVIRONMENT === "production" && url.hostname === "gofunnelai.com") {
    const dest = new URL(url.toString());
    dest.hostname = "www.gofunnelai.com";
    return Response.redirect(dest.toString(), 308);
  }

  // Inject request id if absent so the API can correlate across hops.
  const reqHeaders = new Headers(request.headers);
  if (!reqHeaders.get("x-request-id")) {
    reqHeaders.set("x-request-id", crypto.randomUUID());
  }
  const forwarded = new Request(request, { headers: reqHeaders });
  const response = await next(forwarded);

  // Apply security headers to every HTML response.
  const ct = response.headers.get("content-type") ?? "";
  if (ct.includes("text/html")) {
    const merged = new Headers(response.headers);
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) merged.set(k, v);
    merged.set("Content-Security-Policy", buildCsp(env));
    merged.set("x-request-id", reqHeaders.get("x-request-id") ?? "");
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: merged,
    });
  }
  return response;
};
