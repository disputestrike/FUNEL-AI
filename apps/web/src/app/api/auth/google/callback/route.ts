import { NextResponse } from "next/server";

import { AUTH_COOKIE } from "@/lib/auth-cookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GOOGLE_STATE_COOKIE = "gofunnel-google-state";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = url.origin;
  const statePayload = readCookie(req, GOOGLE_STATE_COOKIE);
  const expected = parseState(statePayload);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code || !expected || expected.state !== state) {
    return NextResponse.redirect(`${origin}/login?error=google_auth_state`, { status: 303 });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID ?? process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${origin}/login?error=google_auth_missing`, { status: 303 });
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: `${origin}/api/auth/google/callback`,
    }),
  });
  const token = await tokenResponse.json().catch(() => null) as { access_token?: string } | null;
  if (!tokenResponse.ok || !token?.access_token) {
    return NextResponse.redirect(`${origin}/login?error=google_auth_token`, { status: 303 });
  }

  const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  const profile = await profileResponse.json().catch(() => null) as { email?: string } | null;
  if (!profileResponse.ok || !profile?.email) {
    return NextResponse.redirect(`${origin}/login?error=google_auth_profile`, { status: 303 });
  }

  const response = NextResponse.redirect(new URL(expected.nextPath ?? "/dashboard", origin), { status: 303 });
  response.cookies.set(AUTH_COOKIE, encodeSession(profile.email), authCookieOptions());
  response.cookies.set(GOOGLE_STATE_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}

function readCookie(req: Request, name: string) {
  const cookie = req.headers.get("cookie") ?? "";
  return cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

function parseState(value?: string) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as {
      state?: string;
      nextPath?: string;
      ts?: number;
    };
    if (!parsed.state || !parsed.nextPath || !parsed.ts) return null;
    if (Date.now() - parsed.ts > 10 * 60 * 1000) return null;
    return parsed;
  } catch {
    return null;
  }
}

function encodeSession(email: string) {
  return encodeURIComponent(JSON.stringify({ email, provider: "google", ts: Date.now() }));
}

function authCookieOptions() {
  return {
    httpOnly: false,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  };
}
