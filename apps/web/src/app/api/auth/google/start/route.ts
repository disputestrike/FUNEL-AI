import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { AUTH_COOKIE } from "@/lib/auth-cookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GOOGLE_STATE_COOKIE = "gofunnel-google-state";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const nextPath = sanitizeNext(url.searchParams.get("next"));
  const clientId = process.env.GOOGLE_CLIENT_ID ?? process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? process.env.GOOGLE_OAUTH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    const response = NextResponse.redirect(new URL(nextPath, url.origin), { status: 303 });
    response.cookies.set(AUTH_COOKIE, encodeSession("local-google-user@gofunnelai.com"), authCookieOptions());
    return response;
  }

  const state = randomUUID();
  const redirectUri = `${url.origin}/api/auth/google/callback`;
  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "openid email profile");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("prompt", "select_account");

  const response = NextResponse.redirect(authUrl, { status: 303 });
  response.cookies.set(
    GOOGLE_STATE_COOKIE,
    encodeURIComponent(JSON.stringify({ state, nextPath, ts: Date.now() })),
    { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 600 },
  );
  return response;
}

function sanitizeNext(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
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
