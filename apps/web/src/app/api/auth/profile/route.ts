/**
 * PATCH /api/auth/profile — update user-level preferences (timezone, locale).
 *
 * Auth required (Auth.js session). Other identity fields (name, avatar,
 * email) are read-only and managed through Google.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@funnel/db";

export const runtime = "nodejs";

const PrefsSchema = z.object({
  timezone: z.string().min(1).max(64).optional(),
  locale: z.string().min(2).max(20).optional(),
});

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  const parsed = PrefsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", detail: parsed.error.flatten() },
      { status: 422 },
    );
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      timezone: parsed.data.timezone ?? undefined,
      locale: parsed.data.locale ?? undefined,
      updatedAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true });
}
