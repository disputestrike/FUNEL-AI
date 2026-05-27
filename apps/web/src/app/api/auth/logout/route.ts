import { NextResponse } from "next/server";
import { AUTH_COOKIE } from "@/lib/auth-cookie";

/**
 * Clears the mock session cookie and bounces back to the home page.
 */
export async function POST(req: Request) {
  const origin = new URL(req.url).origin;
  const res = NextResponse.redirect(`${origin}/`, { status: 303 });
  res.cookies.set(AUTH_COOKIE, "", {
    path: "/",
    maxAge: 0,
    sameSite: "lax",
  });
  return res;
}

export async function GET(req: Request) {
  return POST(req);
}
