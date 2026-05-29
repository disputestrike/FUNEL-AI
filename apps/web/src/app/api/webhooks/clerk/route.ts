/**
 * Legacy Clerk webhook endpoint — superseded by Auth.js + Google.
 *
 * Kept around so any in-flight Clerk webhook delivery (DNS, retry queues)
 * gets a clean 410 instead of timing out. The Clerk dashboard should be
 * pointed at a new endpoint or deleted entirely.
 */
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json(
    {
      error: "gone",
      detail:
        "GoFunnelAI moved off Clerk to Auth.js + Google. Disable this webhook in the Clerk dashboard.",
    },
    { status: 410 },
  );
}
