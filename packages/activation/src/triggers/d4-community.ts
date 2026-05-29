/**
 * Day 4 — Community pull-in.
 *
 * Sends an email + in-app banner inviting the user into the industry-specific
 * Circle/Slack community channel. Doc 06a Â§3 Day 4.
 */

import { TriggerDeps, runIntervention } from "./_common.js";

export const TEMPLATE_ID_EMAIL = "community_invite_d4";
export const TEMPLATE_ID_BANNER = "community_invite_banner";

const INDUSTRY_TO_CHANNEL: Record<string, string> = {
  real_estate: "https://community.gofunnelai.com/c/real-estate",
  coaching: "https://community.gofunnelai.com/c/coaching",
  finance: "https://community.gofunnelai.com/c/finance",
  health: "https://community.gofunnelai.com/c/health",
  fitness: "https://community.gofunnelai.com/c/fitness",
  legal: "https://community.gofunnelai.com/c/legal",
};

export function communityLinkFor(industry: string | null): string {
  if (!industry) return "https://community.gofunnelai.com/c/general";
  return INDUSTRY_TO_CHANNEL[industry] ?? "https://community.gofunnelai.com/c/general";
}

export async function fireD4Community(args: {
  user_id: string;
  workspace_id: string;
  deps: TriggerDeps;
}): Promise<void> {
  const ctx = {
    user_id: args.user_id,
    workspace_id: args.workspace_id,
    kind: "d4_community" as const,
  };

  await runIntervention({
    ctx,
    deps: args.deps,
    channel: "email",
    sender: "cs_rep",
    template_id: TEMPLATE_ID_EMAIL,
    user_facing: true,
    async run(state) {
      const link = communityLinkFor(state.industry);
      await args.deps.email.send({
        to_user_id: state.user_id,
        workspace_id: state.workspace_id,
        template_id: TEMPLATE_ID_EMAIL,
        from_persona: "cs_rep",
        variables: {
          industry: state.industry ?? "your peers",
          community_link: link,
        },
        idempotency_key: `d4-email:${state.user_id}:${state.signed_up_at.slice(0, 10)}`,
      });
      return { ok: true, result: null };
    },
  });

  await runIntervention({
    ctx: { ...ctx, kind: "d4_community" },
    deps: args.deps,
    channel: "in_app",
    sender: "system",
    template_id: TEMPLATE_ID_BANNER,
    user_facing: true,
    async run(state) {
      await args.deps.notifications.enqueue({
        user_id: state.user_id,
        workspace_id: state.workspace_id,
        template_id: TEMPLATE_ID_BANNER,
        channel: "in_app",
        sender_persona: "system",
        variables: {
          industry: state.industry,
          community_link: communityLinkFor(state.industry),
        },
        send_at: new Date().toISOString(),
        suppress_if: [],
        dedupe_key: `d4-banner:${state.user_id}:${state.signed_up_at.slice(0, 10)}`,
      });
      return { ok: true, result: null };
    },
  });
}
