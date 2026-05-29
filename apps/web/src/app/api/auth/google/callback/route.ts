/**
 * Legacy /api/auth/google/callback — superseded by Auth.js's own callback
 * at /api/auth/callback/google. If anything still hits here (cached OAuth
 * redirect URI in Google Cloud Console), bounce them through the correct
 * Auth.js callback so they land on /dashboard cleanly.
 */
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const target = new URL(`/api/auth/callback/google${url.search}`, url.origin);
  return NextResponse.redirect(target, { status: 307 });
}
