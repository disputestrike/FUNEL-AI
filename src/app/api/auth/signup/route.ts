/**
 * POST /api/auth/signup
 *
 * Creates a new email + password user, hashes the password (bcrypt cost 12),
 * provisions their first workspace + owner WorkspaceMember row, and returns
 * `{ ok: true }`. The client is expected to immediately call
 * `signIn("credentials", { email, password, callbackUrl: "/welcome" })`
 * to actually start a session — this endpoint only persists state.
 *
 * Validation:
 *   - email   must match a basic RFC 5322 shape
 *   - password must be >= 8 characters
 *   - name    must be non-empty after trim
 *
 * Failures:
 *   - 400 invalid input
 *   - 409 email already registered (OAuth user with the same address
 *         also returns 409 to avoid revealing the auth method)
 *   - 500 unexpected DB error
 */
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma, withAdminContext, newId } from "@funnel/db";
import { ensureWorkspaceForUser } from "@/lib/auth";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BCRYPT_COST = 12;

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const parsed = parseSignupBody(body);
  if (!parsed.ok) {
    return NextResponse.json(
      { ok: false, error: parsed.error },
      { status: 400 },
    );
  }
  const { name, email, password } = parsed.value;

  // Conflict check first — cheap, and returns the same 409 whether the
  // address belongs to a password user or an OAuth-only user (avoids
  // leaking which auth methods are bound to a given email).
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      { ok: false, error: "An account with that email already exists." },
      { status: 409 },
    );
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  const now = new Date();

  try {
    const user = await withAdminContext((tx) =>
      tx.user.create({
        data: {
          id: newId("user"),
          name,
          email,
          emailNormalized: email,
          passwordHash,
          passwordSetAt: now,
        },
        select: { id: true, email: true, name: true },
      }),
    );

    await ensureWorkspaceForUser({
      userId: user.id,
      email: user.email,
      name: user.name,
      source: "credentials",
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    // Treat unique-violation as a race with the conflict check above.
    if (err instanceof Error && /unique constraint/i.test(err.message)) {
      return NextResponse.json(
        { ok: false, error: "An account with that email already exists." },
        { status: 409 },
      );
    }
    console.error("[api/auth/signup] failed", err);
    return NextResponse.json(
      { ok: false, error: "Could not create account. Try again." },
      { status: 500 },
    );
  }
}

interface SignupInput {
  name: string;
  email: string;
  password: string;
}

type ParseResult =
  | { ok: true; value: SignupInput }
  | { ok: false; error: string };

function parseSignupBody(body: unknown): ParseResult {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Request body must be JSON." };
  }
  const b = body as Record<string, unknown>;

  const rawName = typeof b.name === "string" ? b.name.trim() : "";
  const rawEmail =
    typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
  const rawPassword = typeof b.password === "string" ? b.password : "";

  if (!rawName) {
    return { ok: false, error: "Name is required." };
  }
  if (!EMAIL_RE.test(rawEmail)) {
    return { ok: false, error: "Enter a valid email address." };
  }
  if (rawPassword.length < 8) {
    return {
      ok: false,
      error: "Password must be at least 8 characters.",
    };
  }

  return {
    ok: true,
    value: { name: rawName, email: rawEmail, password: rawPassword },
  };
}
