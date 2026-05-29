/**
 * Custom POST /api/auth/signout — clears the Auth.js session cookie and
 * redirects to "/". Used by server-rendered "Sign out" buttons and by
 * the chrome-extension client. The default Auth.js signout flow (/api/auth/[...nextauth])
 * still works for the client SDK.
 */
import { NextResponse } from "next/server";
import { signOut } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  await signOut({ redirect: false });
  const url = new URL("/", req.url);
  return NextResponse.redirect(url, { status: 303 });
}
