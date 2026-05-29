import { NextResponse } from "next/server";

import { getEnterpriseReadiness } from "@/lib/platform/enterprise-readiness";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  const report = getEnterpriseReadiness();
  return NextResponse.json(report, {
    headers: { "cache-control": "no-store" },
  });
}
