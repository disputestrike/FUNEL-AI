/**
 * Day 0 — Welcome.
 *
 * Within 60s of `user_signed_up`: a Resend email containing the 90-sec demo
 * video link, plus an in-app full-screen takeover queued for the user's first
 * dashboard load. For Scale/Agency signups, fire an internal Slack ping to
 * #cs-vip with the founder mention.
 *
 * Doc 06a Â§3 Day 0.
 */

import { TriggerDeps, runIntervention } from "./_common.js";

export const TEMPLATE_ID_WELCOME = "welcome_d0";
export const TEMPLATE_ID_TAKEOVER = "welcome_takeover_d0";

export async function fireD0Welcome(args: {
  user_id: string;
  workspace_id: string;
  deps: TriggerDeps;
  variables?: {
    first_name?: string;
    industry?: string;
    cs_rep?: string;
    demo_video_url?: string;
  };
}): Promise<void> {
  const ctx = {
    user_id: args.user_id,
    workspace_id: args.workspace_id,
    kind: "d0_welcome" as const,
  };

  // 1. Email (Resend).
  await runIntervention({
    ctx,
    deps: args.deps,
    channel: "email",
    sender: "cs_rep",
    template_id: TEMPLATE_ID_WELCOME,
    user_facing: true,
    async run(state) {
      await args.deps.email.send({
        to_user_id: state.user_id,
        workspace_id: state.workspace_id,
        template_id: TEMPLATE_ID_WELCOME,
        from_persona: "cs_rep",
        variables: {
          first_name: args.variables?.first_name ?? null,
          industry: state.industry ?? args.variables?.industry ?? "your industry",
          cs_rep: args.variables?.cs_rep ?? "Jamie",
          demo_video_url:
            args.variables?.demo_video_url ?? "https://gofunnelai.com/learn/first-funnel",
        },
        idempotency_key: `welcome:${state.user_id}:${state.signed_up_at.slice(0, 10)}`,
      });
      return { ok: true, result: null };
    },
  });

  // 2. Queue in-app takeover (notification engine).
  await runIntervention({
    ctx: { ...ctx, kind: "d0_welcome" },
    deps: args.deps,
    channel: "in_app",
    sender: "system",
    template_id: TEMPLATE_ID_TAKEOVER,
    user_facing: true,
    async run(state) {
      await args.deps.notifications.enqueue({
        user_id: state.user_id,
        workspace_id: state.workspace_id,
        template_id: TEMPLATE_ID_TAKEOVER,
        channel: "in_app",
        sender_persona: "system",
        variables: { industry: state.industry ?? null },
        send_at: new Date().toISOString(),
        suppress_if: ["funnel_created"],
        dedupe_key: `takeover:${state.user_id}:${state.signed_up_at.slice(0, 10)}`,
      });
      return { ok: true, result: null };
    },
  });

  // 3. Slack ping to #cs-vip for high-tier signups.
  if (
    args.variables &&
    (await loadState(args)) // ensure state exists
  ) {
    const state = await args.deps.store.load(args.user_id);
    if (state && (state.plan_tier === "scale" || state.plan_tier === "agency")) {
      await runIntervention({
        ctx: { ...ctx, kind: "d0_welcome" },
        deps: args.deps,
        channel: "internal_slack",
        sender: "system",
        template_id: null,
        user_facing: false,
        async run(s) {
          await args.deps.slack.postToChannel({
            channel: "#cs-vip",
            text_fallback: `New ${s.plan_tier} signup: ${s.user_id} (${s.industry ?? "n/a"})`,
            blocks: [
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: `:rocket: *New ${s.plan_tier} signup* — ${s.user_id} (industry: ${s.industry ?? "n/a"}). Founder review in next 5d.`,
                },
              },
            ],
            idempotency_key: `vip-ping:${s.user_id}`,
          });
          return { ok: true, result: null };
        },
      });
    }
  }
}

async function loadState(args: { user_id: string; deps: TriggerDeps }): Promise<boolean> {
  return !!(await args.deps.store.load(args.user_id));
}
