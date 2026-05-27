/**
 * Concierge Playbook â€” call scripts + email templates + escalation logic.
 *
 * Codifies Doc 06a Â§6:
 *   - Six-dimension diagnostic scoresheet
 *   - Five named email templates
 *   - Escalation ladder Tier 0 â†’ Tier 4
 *   - Founder-personal-email gate (Scale/Agency stuck at Day 5)
 */

import { ulid } from "ulid";

import { ActivationEventEmitter, LifecycleStore } from "./success-path.js";
import {
  CONCIERGE_DIMENSIONS,
  ConciergeDimension,
  ConciergeScoresheet,
  PlanTier,
} from "./types.js";

/* ===== Email template catalog ========================================= */

export const CONCIERGE_EMAIL_TEMPLATES = {
  connect_source_nudge: {
    id: "source_reminder_d1",
    subject: "One thing left before your funnel starts working",
    persona: "cs_rep",
    variables: ["first_name", "industry", "cs_rep"],
  },
  first_lead_help: {
    id: "founder_d3",
    subject: "noticed you haven't seen a lead yet",
    persona: "founder",
    variables: ["first_name", "founder_first_name", "calendly_link"],
  },
  tune_up_offer: {
    id: "founder_concierge_d5",
    subject: "20 minutes, on me â€” let's find what's in the way",
    persona: "founder",
    variables: ["first_name", "founder_first_name", "plan_tier", "calendly_link"],
  },
  save_offer: {
    id: "save_offer_d7",
    subject: "Extending your Pro Boost â€” let's get you a win in week 2",
    persona: "founder",
    variables: ["first_name", "cs_rep", "boost_end_date", "calendly_link"],
  },
  paid_upgrade_ask: {
    id: "upgrade_ask_d14",
    subject: "You're activated. Time to scale.",
    persona: "cs_rep",
    variables: [
      "first_name",
      "industry",
      "days_to_first_lead",
      "percentile",
      "recommended_tier",
      "tier_benefit_1",
      "tier_benefit_2",
      "tier_benefit_3",
      "discount_code",
      "expiry",
    ],
  },
} as const;

export type ConciergeTemplateName = keyof typeof CONCIERGE_EMAIL_TEMPLATES;

/* ===== Diagnostic scoresheet builder ================================= */

export interface ScoresheetInput {
  workspace_id: string;
  user_id: string;
  called_by_user_id: string;
  caller_role: "cs_rep" | "cs_lead" | "founder";
  /** Dimension scores 0..5 (integer). */
  scores: Record<ConciergeDimension, number>;
  notes?: Partial<Record<ConciergeDimension, string>>;
  user_promise_quote?: string | null;
  action_items?: string[];
}

export function buildScoresheet(input: ScoresheetInput): ConciergeScoresheet {
  // Validate score range.
  for (const d of CONCIERGE_DIMENSIONS) {
    const v = input.scores[d];
    if (!Number.isInteger(v) || v < 0 || v > 5) {
      throw new Error(`scoresheet: dimension ${d} must be 0..5 (got ${v})`);
    }
  }
  const escalation_level = mapRoleToEscalation(input.caller_role);
  return {
    workspace_id: input.workspace_id,
    user_id: input.user_id,
    called_at: new Date().toISOString(),
    called_by_user_id: input.called_by_user_id,
    caller_role: input.caller_role,
    scores: { ...input.scores },
    notes: Object.fromEntries(
      CONCIERGE_DIMENSIONS.map((d) => [d, input.notes?.[d] ?? ""] as const),
    ) as Record<ConciergeDimension, string>,
    user_promise_quote: input.user_promise_quote ?? null,
    action_items: input.action_items ?? [],
    escalation_level,
  };
}

/**
 * Map caller role â†’ escalation tier (Doc 06a Â§6).
 * Tier 0 = automated. Tier 1 = CS rep. Tier 2 = CS lead. Tier 3 = founder.
 * Tier 4 = founder + legal (out of scope for the playbook code itself).
 */
function mapRoleToEscalation(role: ScoresheetInput["caller_role"]): 0 | 1 | 2 | 3 | 4 {
  switch (role) {
    case "cs_rep":
      return 1;
    case "cs_lead":
      return 2;
    case "founder":
      return 3;
  }
}

/* ===== Founder-personal-email gate ==================================== */

/**
 * Decides whether the founder must personally email this account by Day 5.
 *
 * Rule (Doc 06a Â§6): Scale-tier or Agency-tier signups stuck at Day 5
 * without activation get a founder email within 24h.
 */
export async function shouldFounderEmail(args: {
  user_id: string;
  store: LifecycleStore;
  now?: () => Date;
}): Promise<{ should: boolean; reason: string }> {
  const now = (args.now ?? (() => new Date()))();
  const state = await args.store.load(args.user_id);
  if (!state) return { should: false, reason: "no_state" };
  if (state.activated_at) return { should: false, reason: "already_activated" };
  if (state.coaching_opt_out) return { should: false, reason: "coaching_opt_out" };
  if (state.workspace_suspended || state.workspace_canceled) {
    return { should: false, reason: "workspace_terminal" };
  }
  const ageHours = (now.getTime() - Date.parse(state.signed_up_at)) / 3_600_000;
  if (ageHours < 5 * 24) return { should: false, reason: "too_early" };
  if (state.plan_tier !== "scale" && state.plan_tier !== "agency") {
    return { should: false, reason: "tier_below_threshold" };
  }
  return { should: true, reason: "high_tier_stuck_at_d5" };
}

/* ===== Escalation path (programmatic) ================================ */

/**
 * Compute the recommended escalation level for the current account state.
 * Used by the CS leadership UI to highlight overdue cases. Doc 06a Â§6.
 */
export function recommendedEscalationLevel(args: {
  plan_tier: PlanTier;
  ageHours: number;
  activated: boolean;
  publicComplaint?: boolean;
  arrAtRiskUsd?: number;
}): 0 | 1 | 2 | 3 | 4 {
  if (args.activated) return 0;

  // Default automation tier.
  let level: 0 | 1 | 2 | 3 | 4 = 0;

  if (args.ageHours >= 48 && args.ageHours < 5 * 24) level = 1;
  if (args.ageHours >= 5 * 24) level = 2;
  if (args.plan_tier === "scale" || args.plan_tier === "agency") {
    if (args.ageHours >= 5 * 24) level = 3;
  }
  if (args.publicComplaint) level = 3;
  if ((args.arrAtRiskUsd ?? 0) >= 25_000) level = 3;
  return level;
}

/* ===== Persistence & event emission =================================== */

export interface ConciergeStore {
  saveScoresheet(s: ConciergeScoresheet & { id: string }): Promise<void>;
}

export async function logScoresheet(args: {
  scoresheet: ConciergeScoresheet;
  store: ConciergeStore;
  emit: ActivationEventEmitter;
}): Promise<{ id: string }> {
  const id = ulid();
  await args.store.saveScoresheet({ ...args.scoresheet, id });
  await args.emit("concierge_scoresheet_logged", {
    id,
    user_id: args.scoresheet.user_id,
    workspace_id: args.scoresheet.workspace_id,
    caller_role: args.scoresheet.caller_role,
    escalation_level: args.scoresheet.escalation_level,
    scores: args.scoresheet.scores,
    called_at: args.scoresheet.called_at,
  });
  return { id };
}

/* ===== Call script renderer =========================================== */

export interface CallScriptInput {
  first_name: string;
  cs_rep_name: string;
  founder_first_name: string;
  plan_tier: PlanTier;
}

/**
 * Returns the appropriate Day-5 outreach script (Doc 06a Â§6).
 *
 * The text body is intentionally not chunked into blocks â€” CS reps copy/paste
 * into their dialer. Persona switches between CS rep and founder based on
 * plan tier.
 */
export function renderD5CallScript(input: CallScriptInput): {
  variant: "cs_rep" | "founder";
  body: string;
} {
  const isHighTier = input.plan_tier === "scale" || input.plan_tier === "agency";
  if (isHighTier) {
    return {
      variant: "founder",
      body:
        `${input.first_name}, it's ${input.founder_first_name} from GoFunnelAI. ` +
        `I personally watch every Scale and Agency account in their first week, ` +
        `and you're on Day 5 without a lead. I want to spend 20 minutes with you, ` +
        `on me, to fix whatever's in the way. Are you good to share screens right ` +
        `now or would tomorrow morning work?`,
    };
  }
  return {
    variant: "cs_rep",
    body:
      `Hi ${input.first_name}, this is ${input.cs_rep_name} from GoFunnelAI. ` +
      `I'm not calling to sell you anything â€” I noticed you got your funnel ` +
      `published but no leads have come in yet, and I want to figure out why ` +
      `with you. Do you have 10 minutes right now or should I call back?\n\n` +
      `Pull up your dashboard with me. Let's look at three things: where your ` +
      `traffic is coming from, what your funnel looks like to a visitor, and ` +
      `whether RevTry has the right phone number to call from.\n\n` +
      `Before we hang up â€” what's the one thing that, if GoFunnelAI did it for ` +
      `you in the next 7 days, would make this a no-brainer to keep using?`,
  };
}
