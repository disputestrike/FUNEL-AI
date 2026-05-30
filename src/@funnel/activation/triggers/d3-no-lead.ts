/**
 * Day 3 — No lead captured.
 *
 * Sends a plaintext founder-persona email with a 15-min "funnel tune-up"
 * Calendly link. Doc 06a §3 Day 3 + template `founder_d3` in §6.
 */

import { TriggerDeps, runIntervention } from "./_common.js";

export const TEMPLATE_ID = "founder_d3";

export async function fireD3NoLead(args: {
  user_id: string;
  workspace_id: string;
  deps: TriggerDeps;
  founder_first_name?: string;
  calendly_link?: string;
}): Promise<void> {
  const ctx = {
    user_id: args.user_id,
    workspace_id: args.workspace_id,
    kind: "d3_no_lead" as const,
  };

  await runIntervention({
    ctx,
    deps: args.deps,
    channel: "email",
    sender: "founder",
    template_id: TEMPLATE_ID,
    user_facing: true,
    async run(state) {
      // Skip if the user already captured a lead (event might have raced).
      if (state.first_lead_at) {
        return { ok: false, reason: "lead_already_captured" };
      }
      await args.deps.email.send({
        to_user_id: state.user_id,
        workspace_id: state.workspace_id,
        template_id: TEMPLATE_ID,
        from_persona: "founder",
        variables: {
          founder_first_name: args.founder_first_name ?? "Ben",
          calendly_link:
            args.calendly_link ?? "https://calendly.com/funnel-ai/15min-tuneup",
          industry: state.industry,
        },
        idempotency_key: `d3:${state.user_id}:${state.signed_up_at.slice(0, 10)}`,
      });
      return { ok: true, result: null };
    },
  });
}
