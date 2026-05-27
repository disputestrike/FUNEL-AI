/**
 * Day 1 — Connect a traffic source.
 *
 * In-app tooltip on second login of Day 1 + email reminder at 24h, 9–11am
 * user-local. Both suppressed once `traffic_source_connected` has fired.
 *
 * Doc 06a §3 Day 1.
 */

import { TriggerDeps, runIntervention } from "./_common.js";

export const TEMPLATE_ID_EMAIL = "source_reminder_d1";
export const TEMPLATE_ID_TOOLTIP = "connect_source_tooltip";

export async function fireD1ConnectSource(args: {
  user_id: string;
  workspace_id: string;
  deps: TriggerDeps;
}): Promise<void> {
  const ctx = {
    user_id: args.user_id,
    workspace_id: args.workspace_id,
    kind: "d1_connect_source" as const,
  };

  // Email reminder.
  await runIntervention({
    ctx,
    deps: args.deps,
    channel: "email",
    sender: "cs_rep",
    template_id: TEMPLATE_ID_EMAIL,
    user_facing: true,
    async run(state) {
      if (state.source_connected_at) {
        return { ok: false, reason: "source_already_connected" };
      }
      await args.deps.email.send({
        to_user_id: state.user_id,
        workspace_id: state.workspace_id,
        template_id: TEMPLATE_ID_EMAIL,
        from_persona: "cs_rep",
        variables: {
          industry: state.industry,
          cs_rep: "Jamie",
        },
        idempotency_key: `source-d1:${state.user_id}:${state.signed_up_at.slice(0, 10)}`,
      });
      return { ok: true, result: null };
    },
  });

  // In-app tooltip — queued, the UI shows it on the user's next login.
  await runIntervention({
    ctx: { ...ctx, kind: "d1_connect_source" },
    deps: args.deps,
    channel: "in_app",
    sender: "system",
    template_id: TEMPLATE_ID_TOOLTIP,
    user_facing: true,
    async run(state) {
      if (state.source_connected_at) {
        return { ok: false, reason: "source_already_connected" };
      }
      await args.deps.notifications.enqueue({
        user_id: state.user_id,
        workspace_id: state.workspace_id,
        template_id: TEMPLATE_ID_TOOLTIP,
        channel: "in_app",
        sender_persona: "system",
        variables: {
          step_count: 4,
          providers: ["meta", "google", "tiktok"],
        },
        send_at: new Date().toISOString(),
        suppress_if: ["traffic_source_connected"],
        dedupe_key: `tooltip-d1:${state.user_id}:${state.signed_up_at.slice(0, 10)}`,
      });
      return { ok: true, result: null };
    },
  });
}
