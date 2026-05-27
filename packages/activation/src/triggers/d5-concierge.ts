/**
 * Day 5 — Concierge escalation.
 *
 * Auto-creates a CS task to call the user within 4 business hours. Scale and
 * Agency tier accounts that aren't activated escalate directly to the founder
 * with a personal email within 24h (Doc 06a §6 escalation path).
 */

import { TriggerDeps, runIntervention } from "./_common.js";

export const TEMPLATE_ID_FOUNDER_EMAIL = "founder_concierge_d5";

export async function fireD5Concierge(args: {
  user_id: string;
  workspace_id: string;
  deps: TriggerDeps;
  founder_first_name?: string;
}): Promise<void> {
  const ctx = {
    user_id: args.user_id,
    workspace_id: args.workspace_id,
    kind: "d5_concierge" as const,
  };

  const state = await args.deps.store.load(args.user_id);
  const isHighTier =
    state && (state.plan_tier === "scale" || state.plan_tier === "agency");
  const role: "founder" | "cs_rep" = isHighTier ? "founder" : "cs_rep";

  // 1. Create the CS task (always — internal alert, ignores opt-out).
  await runIntervention({
    ctx,
    deps: args.deps,
    channel: "call_task",
    sender: role,
    template_id: null,
    user_facing: false,
    async run(s) {
      if (s.first_lead_at) return { ok: false, reason: "lead_already_captured" };
      const sla = new Date(Date.now() + 4 * 3_600_000).toISOString();
      await args.deps.cs_tasks.createTask({
        user_id: s.user_id,
        workspace_id: s.workspace_id,
        kind: isHighTier ? "founder_personal" : "concierge_call",
        assignee_role: isHighTier ? "founder" : "cs_rep",
        sla_due_at: sla,
        notes: [
          `Day 5 concierge — no lead captured.`,
          `Plan: ${s.plan_tier}.`,
          `Industry: ${s.industry ?? "unknown"}.`,
          `Funnel created: ${s.funnel_created_at ?? "no"}.`,
          `Source connected: ${s.source_connected_at ?? "no"}.`,
        ].join("\n"),
        idempotency_key: `d5-task:${s.user_id}:${s.signed_up_at.slice(0, 10)}`,
      });
      return { ok: true, result: null };
    },
  });

  // 2. Founder personal email — only for Scale/Agency tiers.
  if (isHighTier) {
    await runIntervention({
      ctx: { ...ctx, kind: "d5_concierge" },
      deps: args.deps,
      channel: "email",
      sender: "founder",
      template_id: TEMPLATE_ID_FOUNDER_EMAIL,
      user_facing: true,
      async run(s) {
        if (s.first_lead_at) return { ok: false, reason: "lead_already_captured" };
        await args.deps.email.send({
          to_user_id: s.user_id,
          workspace_id: s.workspace_id,
          template_id: TEMPLATE_ID_FOUNDER_EMAIL,
          from_persona: "founder",
          variables: {
            founder_first_name: args.founder_first_name ?? "Ben",
            plan_tier: s.plan_tier,
          },
          idempotency_key: `d5-founder:${s.user_id}:${s.signed_up_at.slice(0, 10)}`,
        });
        return { ok: true, result: null };
      },
    });
  }
}
