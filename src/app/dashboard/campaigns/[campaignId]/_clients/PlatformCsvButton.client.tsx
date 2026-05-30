"use client";

/**
 * Per-platform "Export CSV" button.
 *
 * Hits GET /api/launch/campaigns/{id}/copy/{platform}.csv which streams a
 * CSV laid out in the platform-native column order (Meta Ads Manager,
 * Google Ads Editor, TikTok Ads Manager, LinkedIn Campaign Manager).
 */
import { Download } from "lucide-react";

export function PlatformCsvButton({
  campaignId,
  platform,
}: {
  campaignId: string;
  platform: string;
}) {
  const href = `/api/launch/campaigns/${campaignId}/copy/${platform}.csv`;
  return (
    <a
      href={href}
      download
      className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
    >
      <Download className="h-3 w-3" />
      Export CSV
    </a>
  );
}
