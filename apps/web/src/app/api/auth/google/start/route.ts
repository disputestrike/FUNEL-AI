/**
 * Legacy /api/auth/google/start — superseded by Auth.js. Bounces to
 * the Auth.js sign-in path so any old bookmark or email link keeps working.
 */
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const next = url.searchParams.get("next") ?? "/dashboard";
  const target = new URL(
    `/api/auth/signin/google?callbackUrl=${encodeURIComponent(next)}`,
    url.origin,
  );
  return NextResponse.redirect(target, { status: 303 });
}
