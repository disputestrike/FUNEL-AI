/**
 * Day 7 — Activated path.
 *
 * If the user is activated by D7: trigger the referral ask + Awards milestone
 * tracker email. Awards Bronze itself was minted at activation time by the
 * Success Path (see ./success-path.ts), but the Milestone email is a separate
 * weekly nudge with the celebration card embedded.
 *
 * Doc 06a §3 Day 7 — Activated branch.
 */

import {
  AwardsTracker,
  ReferralAskTrigger,
} from "../success-path.js";
import { TriggerDeps, runIntervention } from "./_common.js";

export const TEMPLATE_ID = "awards_bronze_milestone";

export async function fireD7Activated(args: {
  user_id: string;
  workspace_id: string;
  deps: TriggerDeps;
  awards: AwardsTracker;
  referrals: ReferralAskTrigger;
  referral_incentive_cents?: number;
}): Promise<void> {
  const ctx = {
    user_id: args.user_id,
    workspace_id: args.workspace_id,
    kind: "d7_activated" as const,
  };

  await runIntervention({
    ctx,
    deps: args.deps,
    channel: "email",
    sender: "cs_rep",
    template_id: TEMPLATE_ID,
    user_facing: true,
    async run(state) {
      if (!state.activated_at) {
        // Day-7 fired but user not actually activated — wrong branch.
        return { ok: false, reason: "not_activated" };
      }

      // Bronze badge — idempotent.
      const award = await args.awards.awardBronze({
        user_id: state.user_id,
        workspace_id: state.workspace_id,
      });

      // Referral ask (idempotent inside provider).
      const ref = await args.referrals.triggerReferralAsk({
        user_id: state.user_id,
        workspace_id: state.workspace_id,
        incentive_cents: args.referral_incentive_cents ?? 2500,
      });

      await args.deps.email.send({
        to_user_id: state.user_id,
        workspace_id: state.workspace_id,
        template_id: TEMPLATE_ID,
        from_persona: "cs_rep",
        variables: {
          award_level: award.level,
          share_card_url: award.share_card_url,
          referral_campaign_id: ref.referral_campaign_id,
          referral_credit_cents: args.referral_incentive_cents ?? 2500,
        },
        idempotency_key: `d7-activated:${state.user_id}:${state.signed_up_at.slice(0, 10)}`,
      });
      return { ok: true, result: { award, referral_campaign_id: ref.referral_campaign_id } };
    },
  });
}
