/**
 * Day 14 — Paid upgrade ask (activated branch).
 *
 * In-app modal + email with a 20%-off-first-month code expiring in 72h.
 * Doc 06a §3 Day 14 — Activated, free tier.
 *
 * If the user is already on a paid tier, we substitute a cross-sell email
 * (RevTry minute pack + Silver milestone).
 */

import { TriggerDeps, runIntervention } from "./_common.js";

export const TEMPLATE_ID_UPGRADE = "upgrade_ask_d14";
export const TEMPLATE_ID_CROSSSELL = "crosssell_revtry_silver";

export async function fireD14PaidAsk(args: {
  user_id: string;
  workspace_id: string;
  deps: TriggerDeps;
  variables?: {
    percentile?: number;
    recommended_tier?: string;
    tier_benefits?: [string, string, string];
  };
}): Promise<void> {
  const ctx = {
    user_id: args.user_id,
    workspace_id: args.workspace_id,
    kind: "d14_paid_ask" as const,
  };

  await runIntervention({
    ctx,
    deps: args.deps,
    channel: "email",
    sender: "cs_rep",
    template_id: TEMPLATE_ID_UPGRADE,
    user_facing: true,
    async run(state) {
      if (!state.activated_at) {
        return { ok: false, reason: "not_activated" };
      }
      const isFree = state.plan_tier === "free" || state.plan_tier === "pro_boost";
      const templateId = isFree ? TEMPLATE_ID_UPGRADE : TEMPLATE_ID_CROSSSELL;
      const code = isFree ? "WIN20" : null;
      const expiry = new Date(Date.now() + 72 * 3_600_000).toISOString();
      const daysToFirstLead = state.first_lead_at
        ? Math.floor(
            (Date.parse(state.first_lead_at) - Date.parse(state.signed_up_at)) /
              86_400_000,
          )
        : null;

      await args.deps.email.send({
        to_user_id: state.user_id,
        workspace_id: state.workspace_id,
        template_id: templateId,
        from_persona: "cs_rep",
        variables: {
          days_to_first_lead: daysToFirstLead,
          percentile: args.variables?.percentile ?? 70,
          industry: state.industry,
          recommended_tier:
            args.variables?.recommended_tier ?? (isFree ? "pro" : "scale"),
          tier_benefit_1:
            args.variables?.tier_benefits?.[0] ??
            "Unlimited published funnels",
          tier_benefit_2:
            args.variables?.tier_benefits?.[1] ?? "RevTry voice minutes included",
          tier_benefit_3:
            args.variables?.tier_benefits?.[2] ?? "Priority CS rep",
          discount_code: code,
          expiry,
        },
        idempotency_key: `d14-paid:${state.user_id}:${state.signed_up_at.slice(0, 10)}`,
      });

      // In-app modal alongside the email.
      await args.deps.notifications.enqueue({
        user_id: state.user_id,
        workspace_id: state.workspace_id,
        template_id: templateId,
        channel: "in_app",
        sender_persona: "cs_rep",
        variables: { discount_code: code, expiry },
        send_at: new Date().toISOString(),
        suppress_if: ["subscription_upgraded"],
        dedupe_key: `d14-paid-modal:${state.user_id}:${state.signed_up_at.slice(0, 10)}`,
      });

      return { ok: true, result: { template: templateId } };
    },
  });
}
