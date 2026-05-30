/**
 * GoFunnelAI — Follow-up Sequence agent.
 *
 * Builds a multi-step nurture sequence for a campaign:
 *
 *   - Immediate  (T+0 minutes): confirm capture, set expectations.
 *   - Day 1      (T+1 day):     reinforce value, surface the obvious objection.
 *   - Day 3      (T+3 days):    proof + secondary CTA.
 *   - Day 7      (T+7 days):    breakup-style "is now still the right time?"
 *   - No-show    (booking-goal): pings around a missed appointment.
 *   - Reactivation (T+30 days): low-pressure re-open.
 *
 * Each step is rendered per-channel using the KB pack persona + industry data.
 * Callers can request a single channel (email | sms) or "all" and get every
 * step rendered for every channel.
 */

import { createHash } from "node:crypto";

import {
  FollowupChannel,
  type Campaign,
  type FollowupSequence,
  type FollowupSequenceStep,
} from "@funnel/shared/launch";

import { emitLaunch } from "./events.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FollowupTrigger = "lead_captured" | "purchase" | "checkout_abandoned" | "custom";

export type FollowupStageKey =
  | "immediate"
  | "day_1"
  | "day_3"
  | "day_7"
  | "no_show"
  | "reactivation";

export interface BuildFollowupArgs {
  campaign: Pick<Campaign, "id" | "workspaceId" | "name" | "objective" | "primaryAngle">;
  /** Whether this campaign's goal is a booking (e.g. consult / appointment). */
  goalIsBooking?: boolean;
  /** Industry slug used for KB lookups. */
  industry?: string;
  /** Persona description for templating. */
  persona?: string;
  trigger?: FollowupTrigger;
}

export type FollowupChannelArg = FollowupChannel | "email" | "sms" | "all";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stableId(prefix: string, parts: string[]): string {
  const h = createHash("sha256").update(parts.join("|"), "utf8").digest("hex").slice(0, 16);
  return `${prefix}_${h}`;
}

function describeIndustry(industry?: string): string {
  return (industry ?? "your offer").replace(/[_-]+/g, " ");
}

function personaOf(args: BuildFollowupArgs): string {
  return args.persona?.trim() || `${describeIndustry(args.industry)} prospects`;
}

interface StageDef {
  stage: FollowupStageKey;
  delayMinutes: number;
  /** Only included when applicable. */
  includeIf?: (a: BuildFollowupArgs) => boolean;
  email: (a: BuildFollowupArgs) => { subject: string; body: string };
  sms: (a: BuildFollowupArgs) => string;
}

const SMS_LEGAL = "Reply STOP to opt out.";

const STAGES: StageDef[] = [
  {
    stage: "immediate",
    delayMinutes: 0,
    email: (a) => ({
      subject: `Your ${describeIndustry(a.industry)} resource is ready`,
      body:
        `Hi,\n\nThanks for reaching out — your ${describeIndustry(a.industry)} resource is ready: <link>.\n\n` +
        `Most ${personaOf(a)} skim it in 5 minutes and come back with one specific question. ` +
        `If you have one already, just reply to this email — I read every one.\n\n— GoFunnelAI`,
    }),
    sms: (a) => `Your ${describeIndustry(a.industry)} resource: <link>. Reply with your top question. ${SMS_LEGAL}`,
  },
  {
    stage: "day_1",
    delayMinutes: 60 * 24,
    email: (a) => ({
      subject: `Quick question about ${describeIndustry(a.industry)}`,
      body:
        `Hi,\n\nQuick question — when you opened the ${describeIndustry(a.industry)} resource yesterday, ` +
        `did anything surprise you?\n\nThe reason I ask: ${personaOf(a)} usually flag one of these three things:\n` +
        `• the speed of the result.\n` +
        `• the assumptions behind the math.\n` +
        `• the next step after the call.\n\n` +
        `Hit reply with the one that's true for you. I'll send the right follow-up.\n\n— GoFunnelAI`,
    }),
    sms: (a) =>
      `Yesterday's ${describeIndustry(a.industry)} resource — anything surprise you? Reply with one line. ${SMS_LEGAL}`,
  },
  {
    stage: "day_3",
    delayMinutes: 60 * 24 * 3,
    email: (a) => ({
      subject: `What ${personaOf(a)} did last week`,
      body:
        `Hi,\n\nQuick proof piece — here are 3 things ${personaOf(a)} did last week after picking up the ` +
        `${describeIndustry(a.industry)} resource:\n\n` +
        `1. Ran the numbers and shared them with their partner.\n` +
        `2. Booked a 10-minute review (no pressure, plan stays either way).\n` +
        `3. Forwarded the resource to a peer who's also looking.\n\n` +
        `If you'd like the 10-minute review, here's the link: <link>.\n\n— GoFunnelAI`,
    }),
    sms: (a) =>
      `${describeIndustry(a.industry)} 10-min review (no pressure): <link>. ${SMS_LEGAL}`,
  },
  {
    stage: "day_7",
    delayMinutes: 60 * 24 * 7,
    email: (a) => ({
      subject: `Is now still the right time for ${describeIndustry(a.industry)}?`,
      body:
        `Hi,\n\nI want to respect your time. If now isn't the right window for ${describeIndustry(a.industry)}, ` +
        `just reply 'later' and I'll move you to our quarterly digest. No hard feelings.\n\n` +
        `If it is the right window, the 10-minute review is here: <link>. ` +
        `${personaOf(a)} who book this slot usually walk away with a working plan — even if they don't move forward with us.\n\n— GoFunnelAI`,
    }),
    sms: (a) =>
      `Still want the ${describeIndustry(a.industry)} review? Reply YES, NO, or LATER. ${SMS_LEGAL}`,
  },
  {
    stage: "no_show",
    delayMinutes: 60 * 24,
    includeIf: (a) => a.goalIsBooking !== false && Boolean(a.goalIsBooking),
    email: (a) => ({
      subject: `Missed our ${describeIndustry(a.industry)} call — let's reschedule`,
      body:
        `Hi,\n\nLooks like we missed each other. No drama — life happens. ` +
        `I held your ${describeIndustry(a.industry)} plan for 7 days. Pick any open slot: <link>.\n\n` +
        `If a 10-minute call still isn't right, reply with your top question and I'll send a written answer instead.\n\n— GoFunnelAI`,
    }),
    sms: (a) =>
      `Missed our ${describeIndustry(a.industry)} call — pick a new time: <link>. ${SMS_LEGAL}`,
  },
  {
    stage: "reactivation",
    delayMinutes: 60 * 24 * 30,
    email: (a) => ({
      subject: `Reopening: ${describeIndustry(a.industry)} plan`,
      body:
        `Hi,\n\nIt's been about a month since you grabbed the ${describeIndustry(a.industry)} resource. ` +
        `If the timing's better now — even a little — the 10-minute review is open again: <link>.\n\n` +
        `Two things changed since we last talked:\n` +
        `• We launched a refreshed version of the ${describeIndustry(a.industry)} calculator.\n` +
        `• We added a new no-call path — try the GoFunnelAI ${describeIndustry(a.industry)} workspace directly.\n\n— GoFunnelAI`,
    }),
    sms: (a) =>
      `Reopening ${describeIndustry(a.industry)} review for you. Pick a slot or try it solo: <link>. ${SMS_LEGAL}`,
  },
];

function pickChannels(channel: FollowupChannelArg): Array<"email" | "sms"> {
  if (channel === "all" || channel === FollowupChannel.Email || channel === "email") {
    // Special case "email" alone vs all
    if (channel === "all") return ["email", "sms"];
    if (channel === "email" || channel === FollowupChannel.Email) return ["email"];
  }
  if (channel === "sms" || channel === FollowupChannel.Sms) return ["sms"];
  return ["email", "sms"];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function buildFollowupSequence(
  args: BuildFollowupArgs,
  channelArg: FollowupChannelArg = "all",
): FollowupSequence {
  const channels = pickChannels(channelArg);
  const now = new Date();
  const steps: FollowupSequenceStep[] = [];
  let order = 0;

  for (const def of STAGES) {
    if (def.includeIf && !def.includeIf(args)) continue;
    for (const c of channels) {
      if (c === "email") {
        const { subject, body } = def.email(args);
        steps.push({
          order: order++,
          channel: FollowupChannel.Email,
          delayMinutes: def.delayMinutes,
          templateId: `gfa.${args.industry ?? "generic"}.${def.stage}.email`,
          subject,
          body,
          abTestVariantOf: null,
        });
      } else if (c === "sms") {
        steps.push({
          order: order++,
          channel: FollowupChannel.Sms,
          delayMinutes: def.delayMinutes,
          templateId: `gfa.${args.industry ?? "generic"}.${def.stage}.sms`,
          subject: null,
          body: def.sms(args),
          abTestVariantOf: null,
        });
      }
    }
  }

  const sequenceId = stableId("fls", [
    args.campaign.workspaceId,
    args.campaign.id,
    channelArg,
    args.industry ?? "generic",
    String(args.goalIsBooking ?? false),
  ]);

  const sequence: FollowupSequence = {
    id: sequenceId,
    workspaceId: args.campaign.workspaceId,
    campaignId: args.campaign.id,
    name: `${args.campaign.name} follow-up`,
    trigger: args.trigger ?? "lead_captured",
    steps,
    status: "draft",
    enrolledCount: 0,
    completedCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  void emitLaunch(
    "launch_followup_sequence_built",
    {
      campaign_id: args.campaign.id,
      industry: args.industry ?? null,
      step_count: steps.length,
      channels,
      includes_no_show: Boolean(args.goalIsBooking),
    },
    { campaignId: args.campaign.id, workspaceId: args.campaign.workspaceId },
  );

  return sequence;
}

export const __internal = { STAGES, pickChannels };
