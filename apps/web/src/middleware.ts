import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE } from "@/lib/auth-cookie";

/**
 * Auth gate (stubbed for launch UX).
 *
 * Reads the `mock-auth-session` cookie set by /signup and /login.
 * If absent, any request to a protected path bounces to /login.
 *
 * Real auth (Auth.js / Clerk / WorkOS) will replace this without
 * changing the protected-paths list.
 */
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/funnels",
  "/crm",
  "/campaigns",
  "/billing",
  "/settings",
  "/welcome",
  "/onboarding",
  "/generate",
];

function isProtected(pathname: string) {
  return PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (!isProtected(pathname)) {
    return NextResponse.next();
  }

  const session = req.cookies.get(AUTH_COOKIE)?.value;
  if (session) {
    return NextResponse.next();
  }

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Skip Next internals, public files, and the API surface.
  matcher: ["/((?!_next/|api/|favicon.ico|brand/|images/|robots.txt|sitemap.xml).*)"],
};
