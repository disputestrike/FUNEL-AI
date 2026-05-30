/**
 * Customer-facing labels for orchestrator agents.
 *
 * RULE: NOTHING in the UI may show class names, model IDs, step indexes,
 * or raw JSON. Every agent flowing through the SSE stream gets mapped here
 * to a friendly label + description before it touches the DOM.
 */

import type { AgentName } from "@funnel/orchestrator/types";

export interface AgentLabel {
  /** Friendly label shown next to the status dot. */
  label: string;
  /** Short progress description shown while the agent is running. */
  runningHint: string;
  /** Short description shown after the agent completes. */
  doneHint: string;
}

export const AGENT_LABELS: Record<AgentName, AgentLabel> = {
  planner: {
    label: "📋 Planning your campaign",
    runningHint: "Choosing the right funnel for your audience…",
    doneHint: "Strategy set.",
  },
  hook: {
    label: "✍️ Writing your hook",
    runningHint: "Drafting the headline that earns the click…",
    doneHint: "Headline ready.",
  },
  page: {
    label: "🎨 Designing your page",
    runningHint: "Laying out hero, proof, and CTA blocks…",
    doneHint: "Page sections assembled.",
  },
  lead_magnet: {
    label: "📄 Creating your lead magnet",
    runningHint: "Putting together a kit your audience will actually use…",
    doneHint: "Lead magnet drafted.",
  },
  image: {
    label: "🖼️ Generating visuals",
    runningHint: "Rendering your hero image…",
    doneHint: "Visuals delivered.",
  },
  video: {
    label: "🎬 Producing video",
    runningHint: "Stitching together your intro clip…",
    doneHint: "Video ready.",
  },
  ad_copy: {
    label: "📢 Writing your ads",
    runningHint: "Drafting ad variants for paid traffic…",
    doneHint: "Ad copy ready.",
  },
  audience: {
    label: "🎯 Targeting your audience",
    runningHint: "Profiling who this should reach…",
    doneHint: "Targeting locked in.",
  },
  email: {
    label: "✉️ Drafting follow-up emails",
    runningHint: "Writing your nurture sequence…",
    doneHint: "Email sequence drafted.",
  },
  sms: {
    label: "💬 Writing SMS sequences",
    runningHint: "Drafting short, polite reminders…",
    doneHint: "SMS sequence drafted.",
  },
  voice_script: {
    label: "🗣️ Preparing your voice assistant",
    runningHint: "Scripting the qualifying call…",
    doneHint: "Voice script ready.",
  },
  upsell: {
    label: "💎 Designing upsells",
    runningHint: "Building the value ladder…",
    doneHint: "Upsell ladder ready.",
  },
  fact_check: {
    label: "🔍 Verifying claims",
    runningHint: "Checking that every claim has a source…",
    doneHint: "Claims verified.",
  },
  compliance: {
    label: "⚖️ Reviewing for compliance",
    runningHint: "Reviewing for region-specific rules…",
    doneHint: "Compliance cleared.",
  },
  qa: {
    label: "✨ Final quality check",
    runningHint: "Running the final read-through…",
    doneHint: "Quality check passed.",
  },
  brand_guardian: {
    label: "🎨 Brand alignment",
    runningHint: "Aligning to your colors and voice…",
    doneHint: "Brand aligned.",
  },
};

/** Order in which to display agents in the progress list. */
export const AGENT_DISPLAY_ORDER: AgentName[] = [
  "planner",
  "audience",
  "brand_guardian",
  "hook",
  "page",
  "lead_magnet",
  "image",
  "ad_copy",
  "email",
  "sms",
  "voice_script",
  "upsell",
  "video",
  "fact_check",
  "compliance",
  "qa",
];
