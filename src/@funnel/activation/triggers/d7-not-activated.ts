/**
 * Day 7 — Not-activated "save" path.
 *
 * Extends Pro Boost by 7 more days (one-time max) and sends the founder
 * `save_offer_d7` email with a Calendly link for a personal funnel audit.
 *
 * Doc 06a §3 Day 7 — Not-activated.
 */

import { extendProBoost } from "../save-offers.js";
import { TriggerDeps, runIntervention } from "./_common.js";

export const TEMPLATE_ID = "save_offer_d7";

export async function fireD7NotActivated(args: {
  user_id: string;
  workspace_id: string;
  deps: TriggerDeps;
  founder_first_name?: string;
  calendly_link?: string;
}): Promise<void> {
  const ctx = {
    user_id: args.user_id,
    workspace_id: args.workspace_id,
    kind: "d7_not_activated" as const,
  };

  await runIntervention({
    ctx,
    deps: args.deps,
    channel: "email",
    sender: "founder",
    template_id: TEMPLATE_ID,
    user_facing: true,
    async run(state) {
      if (state.activated_at) {
        return { ok: false, reason: "already_activated" };
      }

      // Try to extend Pro Boost; only emit the save email if either the
      // extension succeeds OR the user has already been extended (in which
      // case we still send the personal audit offer).
      const ext = await extendProBoost({
        user_id: state.user_id,
        workspace_id: state.workspace_id,
        days: 7,
        store: args.deps.store,
        emit: args.deps.emit,
      });

      if (
        !ext.applied &&
        ext.reason !== "already_extended" &&
        ext.reason !== "ok"
      ) {
        return { ok: false, reason: `cannot_extend:${ext.reason}` };
      }

      await args.deps.email.send({
        to_user_id: state.user_id,
        workspace_id: state.workspace_id,
        template_id: TEMPLATE_ID,
        from_persona: "founder",
        variables: {
          founder_first_name: args.founder_first_name ?? "Ben",
          calendly_link:
            args.calendly_link ?? "https://calendly.com/funnel-ai/audit",
          boost_end_date: ext.new_expiry ?? state.pro_boost_extends_until,
          cs_rep: "Jamie",
        },
        idempotency_key: `d7-save:${state.user_id}:${state.signed_up_at.slice(0, 10)}`,
      });
      return { ok: true, result: ext };
    },
  });
}
