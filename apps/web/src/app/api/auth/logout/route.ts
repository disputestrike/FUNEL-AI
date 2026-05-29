/**
 * Compatibility endpoint — `<form action="/api/auth/logout" method="post" />`
 * keeps working after the move to Auth.js. We call signOut() and then bounce
 * to /, clearing the legacy workspace cookie on the way out.
 */
import { NextResponse } from "next/server";
import { signOut } from "@/lib/auth";
import { WORKSPACE_COOKIE } from "@/lib/auth/current-user";

export const runtime = "nodejs";

export async function POST(req: Request) {
  await signOut({ redirect: false });
  const origin = new URL(req.url).origin;
  const res = NextResponse.redirect(`${origin}/`, { status: 303 });
  res.cookies.set(WORKSPACE_COOKIE, "", {
    path: "/",
    maxAge: 0,
    sameSite: "lax",
  });
  return res;
}

export async function GET(req: Request) {
  return POST(req);
}
