import { NextResponse } from "next/server";

import { buildEnterpriseReadinessSnapshot } from "@/lib/enterprise";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET(): NextResponse {
  return NextResponse.json(buildEnterpriseReadinessSnapshot(), {
    headers: {
      "cache-control": "no-store",
    },
  });
}
