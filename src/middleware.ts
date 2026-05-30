/**
 * Auth + public-route policy for the marketing-and-app monorepo.
 *
 * Public routes are everything a logged-out prospect can see (marketing,
 * the funnel grader, the public funnel render path `/f/[slug]`, legal docs,
 * webhooks, sign-in/sign-up). Everything else is gated by Auth.js;
 * unauthenticated requests get bounced to `/login?callbackUrl=…`.
 *
 * Security headers from `lib/platform/security` are applied on every response.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { applySecurityHeaders } from "@/lib/platform/security";
import { isInternalPreviewMode } from "@/lib/session";

const PUBLIC_PATHS = [
  "/",
  "/pricing",
  "/industries",
  "/about",
  "/grade",
  "/help",
  "/community",
  "/academy",
  "/awards",
  "/wins",
  "/marketplace",
  "/affiliate",
  "/contact",
  "/careers",
  "/press",
  "/blog",
  "/legal",
  "/privacy",
  "/terms",
  "/vs",
  "/f",
  "/login",
  "/signup",
  "/api/auth",
  "/api/webhooks",
  "/api/healthz",
  "/api/readyz",
  "/api/email-capture",
  "/api/share",
  "/api/domains",
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
}

export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (isPublic(pathname)) {
    const res = NextResponse.next();
    applySecurityHeaders(res.headers);
    return res;
  }

  // INTERNAL_PREVIEW_MODE=1 — bypass the login wall entirely. Dashboard
  // pages still call getSession() which returns a synthetic team session,
  // so the app works exactly as if the user were signed in. Use ONLY for
  // not-yet-public deploys where the dashboard is shared with the internal
  // team and trusted collaborators.
  if (isInternalPreviewMode()) {
    const res = NextResponse.next();
    applySecurityHeaders(res.headers);
    return res;
  }

  if (!req.auth) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname + req.nextUrl.search);
    const res = NextResponse.redirect(loginUrl);
    applySecurityHeaders(res.headers);
    return res;
  }

  const res = NextResponse.next();
  applySecurityHeaders(res.headers);
  return res;
});

export const config = {
  matcher: [
    // Skip Next internals and static assets (including /brand for the logos
    // we use on the login screen).
    "/((?!_next/static|_next/image|favicon.ico|brand/|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico)$).*)",
  ],
};
