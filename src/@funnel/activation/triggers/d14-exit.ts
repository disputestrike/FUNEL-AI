/**
 * Day 14 — Exit branch (not activated).
 *
 * Three behaviors based on activity:
 *   - logged in past 5 days → exit-survey email ("Help us understand")
 *   - dormant 7+ days → 14-day pause then a single re-engagement
 *   - either case → also create CS-lead final-outreach call task
 *
 * Doc 06a §3 Day 14 — Not activated.
 */

import { TriggerDeps, runIntervention } from "./_common.js";

export const TEMPLATE_ID_SURVEY = "exit_survey_d14";
export const TEMPLATE_ID_REENGAGE = "reengagement_pause_d14";

export async function fireD14Exit(args: {
  user_id: string;
  workspace_id: string;
  deps: TriggerDeps;
  founder_first_name?: string;
  /** Override for tests; in prod we read from auth-svc. */
  last_login_at?: string | null;
}): Promise<void> {
  const ctx = {
    user_id: args.user_id,
    workspace_id: args.workspace_id,
    kind: "d14_exit" as const,
  };

  // 1. Create the final-outreach CS task — always.
  await runIntervention({
    ctx,
    deps: args.deps,
    channel: "call_task",
    sender: "cs_lead",
    template_id: null,
    user_facing: false,
    async run(state) {
      if (state.activated_at) return { ok: false, reason: "activated" };
      await args.deps.cs_tasks.createTask({
        user_id: state.user_id,
        workspace_id: state.workspace_id,
        kind: "final_outreach",
        assignee_role: "cs_lead",
        sla_due_at: new Date(Date.now() + 24 * 3_600_000).toISOString(),
        notes: `D14 not activated. Plan: ${state.plan_tier}. Industry: ${state.industry ?? "unknown"}.`,
        idempotency_key: `d14-task:${state.user_id}:${state.signed_up_at.slice(0, 10)}`,
      });
      return { ok: true, result: null };
    },
  });

  // 2. Email — choose exit survey vs. reengagement pause.
  await runIntervention({
    ctx: { ...ctx, kind: "d14_exit" },
    deps: args.deps,
    channel: "email",
    sender: "founder",
    template_id: TEMPLATE_ID_SURVEY,
    user_facing: true,
    async run(state) {
      if (state.activated_at) return { ok: false, reason: "activated" };

      const lastLogin = args.last_login_at ?? state.last_action_at;
      const daysSinceLogin = lastLogin
        ? Math.floor((Date.now() - Date.parse(lastLogin)) / 86_400_000)
        : 999;

      const template =
        daysSinceLogin <= 5 ? TEMPLATE_ID_SURVEY : TEMPLATE_ID_REENGAGE;
      await args.deps.email.send({
        to_user_id: state.user_id,
        workspace_id: state.workspace_id,
        template_id: template,
        from_persona: "founder",
        variables: {
          founder_first_name: args.founder_first_name ?? "Ben",
          days_since_login: daysSinceLogin,
        },
        idempotency_key: `d14-exit:${state.user_id}:${state.signed_up_at.slice(0, 10)}`,
      });
      return { ok: true, result: { template } };
    },
  });
}
