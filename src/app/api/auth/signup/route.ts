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
import {
  checkSignupRateLimit,
  clientIpFrom,
} from "@/lib/auth/rate-limit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BCRYPT_COST = 12;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 72;   // bcrypt's effective input ceiling; > 72 = DoS
const NAME_MAX = 200;
const EMAIL_MAX = 254;     // RFC 5321 max addr-spec length
const BODY_MAX_BYTES = 4096;

export const runtime = "nodejs";

export async function POST(request: Request) {
  // Reject oversized bodies before parsing — prevents amplification attacks
  // where a 10 MB JSON body forces us through full parse + validation.
  const lenHeader = request.headers.get("content-length");
  if (lenHeader && Number(lenHeader) > BODY_MAX_BYTES) {
    return NextResponse.json(
      { ok: false, error: "Payload too large." },
      { status: 413 },
    );
  }

  // Rate-limit per IP before any DB work or bcrypt — see src/lib/auth/rate-limit.ts.
  const ip = clientIpFrom(request.headers);
  const rl = await checkSignupRateLimit(ip);
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, error: "Too many signups from this network. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(rl.retryAfterSeconds) },
      },
    );
  }

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
  if (rawName.length > NAME_MAX) {
    return { ok: false, error: `Name must be ${NAME_MAX} characters or less.` };
  }
  if (!EMAIL_RE.test(rawEmail) || rawEmail.length > EMAIL_MAX) {
    return { ok: false, error: "Enter a valid email address." };
  }
  if (rawPassword.length < PASSWORD_MIN) {
    return {
      ok: false,
      error: `Password must be at least ${PASSWORD_MIN} characters.`,
    };
  }
  // bcrypt silently truncates past 72 bytes AND is CPU-bound at cost 12.
  // Anything longer is purely a DoS vector.
  if (rawPassword.length > PASSWORD_MAX) {
    return {
      ok: false,
      error: `Password must be ${PASSWORD_MAX} characters or less.`,
    };
  }

  return {
    ok: true,
    value: { name: rawName, email: rawEmail, password: rawPassword },
  };
}
