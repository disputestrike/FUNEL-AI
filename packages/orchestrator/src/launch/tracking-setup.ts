/**
 * GoFunnelAI — Tracking Setup agent.
 *
 * Builds the launch-readiness checklist for a campaign across the platforms
 * being launched. The checklist is the source of truth for `TrackingCoverage`
 * in the LaunchScore: items marked `required` must reach `passed` (or
 * `not_applicable`) for the campaign to clear the readiness floor.
 *
 * Each item carries:
 *   - `id`                stable item id (idempotent across rebuilds)
 *   - `key`               machine label (e.g. `pixel_meta`)
 *   - `label`             UI string
 *   - `status`            ChecklistStatus
 *   - `required`          boolean
 *   - `details`           human-readable instructions, surfaced inline in UI
 *   - `priority` (meta)   "required" | "recommended" | "optional"
 *   - `instructions`      step-by-step guidance (multi-line)
 *   - `autoCheck`         optional async probe (CRM ping, pixel sniff, etc.)
 *
 * The `priority`, `instructions`, and `autoCheck` fields live on the metadata
 * tuple returned from `buildTrackingChecklist` so the canonical `LaunchChecklist`
 * shape in `@funnel/shared/launch` stays untouched.
 */

import { createHash } from "node:crypto";

import {
  ChecklistStatus,
  Platform,
  type CampaignId,
  type FunnelId,
  type LaunchChecklist,
  type LaunchChecklistItem,
} from "@funnel/shared/launch";

import { emitLaunch } from "./events.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ItemPriority = "required" | "recommended" | "optional";

export interface ChecklistItemMeta {
  itemId: string;
  key: string;
  priority: ItemPriority;
  instructions: string;
  /** Optional auto-detection routine. Returns the resolved status. */
  autoCheck?: (ctx: AutoCheckContext) => Promise<ChecklistStatus> | ChecklistStatus;
}

export interface AutoCheckContext {
  funnelId: FunnelId;
  campaignId: CampaignId | null;
  workspaceId: string;
  platforms: Platform[];
  /** Caller-supplied capabilities (e.g. installed pixel IDs). */
  capabilities?: {
    metaPixelId?: string | null;
    googleTagId?: string | null;
    linkedInInsightTagId?: string | null;
    tiktokPixelId?: string | null;
    capiTokens?: Partial<Record<Platform, string>>;
    crmAttributionConfigured?: boolean;
    phoneTrackingNumber?: string | null;
    utmCoverageRatio?: number;
    conversionEvents?: string[];
  };
}

export interface BuildTrackingChecklistArgs {
  funnelId: FunnelId;
  campaignId?: CampaignId | null;
  workspaceId: string;
  platforms: Platform[];
  goal?: "appointment_booked" | "lead_captured" | "purchase_completed" | string;
  capabilities?: AutoCheckContext["capabilities"];
}

export interface BuiltLaunchChecklist {
  checklist: LaunchChecklist;
  meta: ChecklistItemMeta[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NOW = (): Date => new Date();

function stableId(prefix: string, parts: string[]): string {
  const h = createHash("sha256").update(parts.join("|"), "utf8").digest("hex").slice(0, 16);
  return `${prefix}_${h}`;
}

function statusForCount(items: LaunchChecklistItem[]): {
  passed: number;
  failed: number;
  pending: number;
  overall: ChecklistStatus;
} {
  let passed = 0;
  let failed = 0;
  let pending = 0;
  let hasRequiredOpen = false;

  for (const item of items) {
    if (item.status === ChecklistStatus.Passed || item.status === ChecklistStatus.NotApplicable) {
      passed += 1;
    } else if (item.status === ChecklistStatus.Failed) {
      failed += 1;
      if (item.required) hasRequiredOpen = true;
    } else if (item.status === ChecklistStatus.Skipped) {
      if (item.required) hasRequiredOpen = true;
    } else {
      pending += 1;
      if (item.required) hasRequiredOpen = true;
    }
  }

  let overall: ChecklistStatus;
  if (failed > 0) overall = ChecklistStatus.Failed;
  else if (hasRequiredOpen) overall = ChecklistStatus.InProgress;
  else overall = ChecklistStatus.Passed;

  return { passed, failed, pending, overall };
}

interface ItemDef {
  key: string;
  label: string;
  required: boolean;
  priority: ItemPriority;
  details: string;
  instructions: string;
  platform?: Platform;
  applies: (ctx: BuildTrackingChecklistArgs) => boolean;
  initialStatus?: (ctx: BuildTrackingChecklistArgs) => ChecklistStatus;
  autoCheck?: (ctx: AutoCheckContext) => Promise<ChecklistStatus> | ChecklistStatus;
}

const PLATFORM_PIXEL_INSTRUCTIONS: Record<Platform, { label: string; details: string; instructions: string; capabilityKey: keyof NonNullable<AutoCheckContext["capabilities"]> }> = {
  [Platform.Meta]: {
    label: "Meta Pixel installed",
    details: "Place the base pixel on every page of the funnel domain. Required to track conversions in Meta Ads Manager.",
    instructions: [
      "1. Open Meta Events Manager → Data Sources → Web → Add Pixel.",
      "2. Copy the base pixel snippet.",
      "3. Paste into the GoFunnelAI Launch Center → Tracking → Meta Pixel slot (or your site <head>).",
      "4. Open Test Events and confirm PageView fires on the published URL.",
    ].join("\n"),
    capabilityKey: "metaPixelId",
  },
  [Platform.Google]: {
    label: "Google Tag installed",
    details: "Install the Google Tag (gtag.js) so Google Ads conversions, GA4 events, and Enhanced Conversions can be measured.",
    instructions: [
      "1. In Google Ads → Tools → Conversions, add a tag for your goal (Lead/Purchase).",
      "2. Copy the gtag.js snippet OR connect via Google Tag Manager.",
      "3. Paste into the GoFunnelAI Launch Center → Tracking → Google Tag slot.",
      "4. Verify with Tag Assistant on the published URL.",
    ].join("\n"),
    capabilityKey: "googleTagId",
  },
  [Platform.LinkedIn]: {
    label: "LinkedIn Insight Tag installed",
    details: "The Insight Tag captures conversions and enables matched audiences for retargeting.",
    instructions: [
      "1. LinkedIn Campaign Manager → Analyze → Insight Tag → I will install the tag myself.",
      "2. Copy the tag snippet.",
      "3. Paste into the GoFunnelAI Launch Center → Tracking → LinkedIn slot.",
      "4. Wait 10–15 minutes and confirm the tag shows Active.",
    ].join("\n"),
    capabilityKey: "linkedInInsightTagId",
  },
  [Platform.TikTok]: {
    label: "TikTok Pixel installed",
    details: "The TikTok Pixel is required for conversion attribution and retargeting custom audiences on TikTok.",
    instructions: [
      "1. TikTok Ads Manager → Assets → Events → Web Events → Set Up.",
      "2. Pick Pixel and copy the base code.",
      "3. Paste into the GoFunnelAI Launch Center → Tracking → TikTok slot.",
      "4. Test in TikTok Pixel Helper before launching.",
    ].join("\n"),
    capabilityKey: "tiktokPixelId",
  },
  [Platform.YouTube]: {
    label: "YouTube / Google Ads tag installed",
    details: "YouTube uses the Google Ads tag for conversion measurement and remarketing.",
    instructions: [
      "1. In Google Ads, ensure the Google Tag from this campaign is also linked to your YouTube ad group.",
      "2. Verify Linked Accounts → YouTube channel under Tools → Linked Accounts.",
    ].join("\n"),
    capabilityKey: "googleTagId",
  },
  [Platform.X]: {
    label: "X / Twitter Pixel installed",
    details: "Required to measure conversions on X ads.",
    instructions: [
      "1. X Ads → Tools → Conversion Tracking → Create New Event Source.",
      "2. Copy the pixel JS.",
      "3. Install via GoFunnelAI Tracking page.",
    ].join("\n"),
    capabilityKey: "metaPixelId", // no dedicated capability slot — flagged optional
  },
  [Platform.Snapchat]: {
    label: "Snap Pixel installed",
    details: "Required for Snapchat ad attribution and retargeting.",
    instructions: [
      "1. Snap Ads Manager → Events Manager → Create Pixel.",
      "2. Copy the pixel snippet and install via GoFunnelAI.",
    ].join("\n"),
    capabilityKey: "metaPixelId",
  },
  [Platform.Pinterest]: {
    label: "Pinterest Tag installed",
    details: "Pinterest Tag enables conversion tracking and retargeting from your funnel.",
    instructions: [
      "1. Pinterest Business → Ads → Conversions → Install Tag.",
      "2. Copy the snippet and install via GoFunnelAI.",
    ].join("\n"),
    capabilityKey: "metaPixelId",
  },
  [Platform.Reddit]: {
    label: "Reddit Pixel installed",
    details: "Required to measure conversions on Reddit Ads.",
    instructions: [
      "1. Reddit Ads → Events Manager → Create Pixel.",
      "2. Copy the pixel snippet and install via GoFunnelAI.",
    ].join("\n"),
    capabilityKey: "metaPixelId",
  },
};

function pixelItemsFor(platforms: Platform[]): ItemDef[] {
  return platforms.map((platform) => {
    const meta = PLATFORM_PIXEL_INSTRUCTIONS[platform];
    return {
      key: `pixel_${platform}`,
      label: meta.label,
      required: true,
      priority: "required" as const,
      details: meta.details,
      instructions: meta.instructions,
      platform,
      applies: (ctx) => ctx.platforms.includes(platform),
      initialStatus: (ctx) => {
        const cap = ctx.capabilities?.[meta.capabilityKey];
        return cap ? ChecklistStatus.Passed : ChecklistStatus.Pending;
      },
      autoCheck: ({ capabilities }) => {
        const cap = capabilities?.[meta.capabilityKey];
        return cap ? ChecklistStatus.Passed : ChecklistStatus.Pending;
      },
    } satisfies ItemDef;
  });
}

const CONVERSION_EVENT_LABELS: Record<string, string> = {
  appointment_booked: "appointment_booked",
  lead_captured: "lead_captured",
  purchase_completed: "purchase_completed",
};

function commonItems(): ItemDef[] {
  return [
    {
      key: "conversion_event",
      label: "Conversion event configured",
      required: true,
      priority: "required",
      details:
        "At least one conversion event (appointment_booked / lead_captured / purchase_completed) must be wired up for every platform you launch on.",
      instructions: [
        "1. Decide your primary goal event: appointment_booked, lead_captured, or purchase_completed.",
        "2. In each platform's Events Manager, add a custom event with the same name.",
        "3. Map your funnel's success page to fire that event (built in to GoFunnelAI templates).",
      ].join("\n"),
      applies: () => true,
      initialStatus: (ctx) => {
        const want = CONVERSION_EVENT_LABELS[ctx.goal ?? "lead_captured"] ?? "lead_captured";
        return ctx.capabilities?.conversionEvents?.includes(want)
          ? ChecklistStatus.Passed
          : ChecklistStatus.Pending;
      },
      autoCheck: (ctx) => {
        const events = ctx.capabilities?.conversionEvents ?? [];
        return events.length > 0 ? ChecklistStatus.Passed : ChecklistStatus.Pending;
      },
    },
    {
      key: "capi_server_side",
      label: "Server-side conversions API enabled",
      required: false,
      priority: "recommended",
      details:
        "Conversions API (CAPI) bypasses ad blockers, ITP, and third-party cookie loss. Strongly recommended for accurate measurement.",
      instructions: [
        "1. In each platform's Events Manager, generate a CAPI access token.",
        "2. Add the token in GoFunnelAI Launch Center → Tracking → Server-Side Conversions.",
        "3. Run a test conversion and confirm CAPI receipt in the platform UI.",
      ].join("\n"),
      applies: () => true,
      initialStatus: (ctx) => {
        const tokens = Object.values(ctx.capabilities?.capiTokens ?? {}).filter(Boolean);
        return tokens.length > 0 ? ChecklistStatus.Passed : ChecklistStatus.Pending;
      },
      autoCheck: (ctx) => {
        const tokens = Object.values(ctx.capabilities?.capiTokens ?? {}).filter(Boolean);
        return tokens.length > 0 ? ChecklistStatus.Passed : ChecklistStatus.Pending;
      },
    },
    {
      key: "utm_links_applied",
      label: "UTM links applied to all variants",
      required: true,
      priority: "required",
      details:
        "Every ad variant must point to a UTM-tagged URL so downstream analytics can attribute spend to angle and audience.",
      instructions: [
        "1. Run the GoFunnelAI UTM agent.",
        "2. Confirm every variant in the cockpit has a UTM badge.",
        "3. Spot-check 1 variant per platform to verify the destination URL contains utm_source/medium/campaign.",
      ].join("\n"),
      applies: () => true,
      initialStatus: (ctx) => {
        const ratio = ctx.capabilities?.utmCoverageRatio ?? 0;
        return ratio >= 1 ? ChecklistStatus.Passed : ratio > 0 ? ChecklistStatus.InProgress : ChecklistStatus.Pending;
      },
      autoCheck: (ctx) => {
        const ratio = ctx.capabilities?.utmCoverageRatio ?? 0;
        if (ratio >= 1) return ChecklistStatus.Passed;
        if (ratio > 0) return ChecklistStatus.InProgress;
        return ChecklistStatus.Pending;
      },
    },
    {
      key: "crm_attribution",
      label: "CRM attribution mapped",
      required: true,
      priority: "required",
      details:
        "Leads need a UTM-aware destination so revenue can be attributed back to ad spend.",
      instructions: [
        "1. In your CRM (HubSpot / GoHighLevel / Salesforce), add hidden fields for utm_source, utm_medium, utm_campaign, utm_content, utm_term.",
        "2. Connect via GoFunnelAI Integrations.",
        "3. Submit a test lead and confirm UTM fields hydrate in CRM.",
      ].join("\n"),
      applies: () => true,
      initialStatus: (ctx) =>
        ctx.capabilities?.crmAttributionConfigured ? ChecklistStatus.Passed : ChecklistStatus.Pending,
      autoCheck: (ctx) =>
        ctx.capabilities?.crmAttributionConfigured ? ChecklistStatus.Passed : ChecklistStatus.Pending,
    },
    {
      key: "phone_call_tracking",
      label: "Phone call tracking",
      required: false,
      priority: "recommended",
      details:
        "If the funnel CTA includes a phone number, install a tracking number so calls are attributed to ad spend.",
      instructions: [
        "1. In GoFunnelAI → Tracking → Phone Tracking, provision a tracking number for this campaign.",
        "2. Update the funnel CTA / Thank You page with the tracking number.",
        "3. Forward to the actual sales line.",
      ].join("\n"),
      applies: () => true,
      initialStatus: (ctx) =>
        ctx.capabilities?.phoneTrackingNumber ? ChecklistStatus.Passed : ChecklistStatus.Pending,
      autoCheck: (ctx) =>
        ctx.capabilities?.phoneTrackingNumber ? ChecklistStatus.Passed : ChecklistStatus.Pending,
    },
  ];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build a launch checklist for the campaign. Idempotent — repeated calls with
 * the same args produce identical item ids.
 */
export function buildTrackingChecklist(
  funnelIdOrArgs: FunnelId | BuildTrackingChecklistArgs,
  platformsArg?: Platform[],
): BuiltLaunchChecklist {
  const args: BuildTrackingChecklistArgs =
    typeof funnelIdOrArgs === "string"
      ? { funnelId: funnelIdOrArgs, platforms: platformsArg ?? [], workspaceId: "" }
      : funnelIdOrArgs;

  const defs: ItemDef[] = [...pixelItemsFor(args.platforms), ...commonItems()];

  const items: LaunchChecklistItem[] = [];
  const meta: ChecklistItemMeta[] = [];
  const now = NOW();
  const checklistId = stableId("chk", [args.funnelId, args.campaignId ?? "no-campaign"]);

  for (const def of defs) {
    if (!def.applies(args)) continue;
    const itemId = stableId(
      "chki",
      [checklistId, def.key, ...(def.platform ? [def.platform] : [])],
    );
    const status = def.initialStatus ? def.initialStatus(args) : ChecklistStatus.Pending;
    items.push({
      id: itemId,
      key: def.key,
      label: def.label,
      status,
      required: def.required,
      details: def.details,
      evidenceUrl: null,
      completedAt: status === ChecklistStatus.Passed ? now : null,
      completedBy: null,
    });
    meta.push({
      itemId,
      key: def.key,
      priority: def.priority,
      instructions: def.instructions,
      autoCheck: def.autoCheck,
    });
  }

  const counts = statusForCount(items);
  const checklist: LaunchChecklist = {
    id: checklistId,
    campaignId: args.campaignId ?? args.funnelId, // fall back to funnel-scoped checklist
    items,
    passedCount: counts.passed,
    failedCount: counts.failed,
    pendingCount: counts.pending,
    overallStatus: counts.overall,
    lastEvaluatedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  void emitLaunch(
    "launch_tracking_checklist_built",
    {
      funnel_id: args.funnelId,
      platforms: args.platforms,
      item_count: items.length,
      required_count: items.filter((i) => i.required).length,
      overall_status: checklist.overallStatus,
    },
    { campaignId: args.campaignId ?? null, workspaceId: args.workspaceId },
  );

  return { checklist, meta };
}

/**
 * Walk the checklist's `autoCheck` hooks and return an updated checklist.
 */
export async function evaluateTrackingChecklist(
  built: BuiltLaunchChecklist,
  ctx: AutoCheckContext,
): Promise<BuiltLaunchChecklist> {
  const itemsById = new Map(built.checklist.items.map((i) => [i.id, i] as const));
  const now = NOW();
  for (const meta of built.meta) {
    if (!meta.autoCheck) continue;
    const next = await meta.autoCheck(ctx);
    const item = itemsById.get(meta.itemId);
    if (!item) continue;
    if (item.status === next) continue;
    itemsById.set(meta.itemId, {
      ...item,
      status: next,
      completedAt: next === ChecklistStatus.Passed ? now : item.completedAt,
    });
  }
  const items = [...itemsById.values()];
  const counts = statusForCount(items);
  const checklist: LaunchChecklist = {
    ...built.checklist,
    items,
    passedCount: counts.passed,
    failedCount: counts.failed,
    pendingCount: counts.pending,
    overallStatus: counts.overall,
    lastEvaluatedAt: now,
    updatedAt: now,
  };
  await emitLaunch(
    "launch_tracking_checklist_evaluated",
    {
      funnel_id: ctx.funnelId,
      overall_status: checklist.overallStatus,
      passed: counts.passed,
      failed: counts.failed,
      pending: counts.pending,
    },
    { campaignId: ctx.campaignId, workspaceId: ctx.workspaceId },
  );
  return { checklist, meta: built.meta };
}

export const __internal = { statusForCount, stableId, PLATFORM_PIXEL_INSTRUCTIONS };
