/**
 * Day 2 â€” Traffic source still missing.
 *
 * 36h after signup, if no `traffic_source_connected` event: send RevTry-branded
 * SMS via SignalWire ("Need help launching ads? Reply YES"). If the user
 * replies YES, RevTry calls within 5 minutes.
 *
 * Channel substitution: if the user has `revtry_sms_opt_out`, the spec calls
 * for falling back to email. We honor that by routing through the
 * `source_reminder_d1` template a second time, persona = cs_rep.
 *
 * Doc 06a Â§3 Day 2.
 */

import { TriggerDeps, runIntervention } from "./_common.js";

export const TEMPLATE_ID_SMS = "revtry_d2_no_source_sms";
export const TEMPLATE_ID_EMAIL_FALLBACK = "source_reminder_d1";

/** Default copy of the SMS. The notification engine may A/B this. */
export const D2_SMS_BODY =
  "Hey {first_name}, this is RevTry from GoFunnelAI. Need help launching your first ads? Reply YES and I'll call within 5 minutes. Reply STOP to opt out.";

export async function fireD2NoSource(args: {
  user_id: string;
  workspace_id: string;
  deps: TriggerDeps;
  first_name?: string;
}): Promise<void> {
  const ctx = {
    user_id: args.user_id,
    workspace_id: args.workspace_id,
    kind: "d2_no_source" as const,
  };

  // Decide channel up-front: SignalWire SMS if not opted out, email otherwise.
  const state = await args.deps.store.load(args.user_id);
  const channel: "sms" | "email" =
    state && !state.revtry_sms_opt_out && !state.sms_opt_out ? "sms" : "email";

  await runIntervention({
    ctx,
    deps: args.deps,
    channel,
    sender: channel === "sms" ? "revtry" : "cs_rep",
    template_id: channel === "sms" ? TEMPLATE_ID_SMS : TEMPLATE_ID_EMAIL_FALLBACK,
    user_facing: true,
    async run(s) {
      if (s.source_connected_at) {
        return { ok: false, reason: "source_already_connected" };
      }
      const body = D2_SMS_BODY.replace("{first_name}", args.first_name ?? "there");

      if (channel === "sms") {
        await args.deps.sms.send({
          to_user_id: s.user_id,
          workspace_id: s.workspace_id,
          body,
          from_persona: "revtry",
          reply_keywords: ["YES", "STOP"],
          idempotency_key: `d2-sms:${s.user_id}:${s.signed_up_at.slice(0, 10)}`,
        });

        // Pre-emptively register the RevTry callback intent. Voice fires on
        // YES reply via the webhook (handled in @funnel/revtry); this call
        // arms it without dialing yet.
        await args.deps.revtry.startOutboundCall({
          to_user_id: s.user_id,
          workspace_id: s.workspace_id,
          purpose: "oauth_screenshare",
          callback_within_minutes: 5,
          idempotency_key: `d2-call-arm:${s.user_id}:${s.signed_up_at.slice(0, 10)}`,
        });
      } else {
        await args.deps.email.send({
          to_user_id: s.user_id,
          workspace_id: s.workspace_id,
          template_id: TEMPLATE_ID_EMAIL_FALLBACK,
          from_persona: "cs_rep",
          variables: {
            industry: s.industry,
            cs_rep: "Jamie",
            reason: "sms_opt_out_fallback",
          },
          idempotency_key: `d2-email-fallback:${s.user_id}:${s.signed_up_at.slice(0, 10)}`,
        });
      }
      return { ok: true, result: null };
    },
  });
}

/**
 * Webhook handler â€” fires when SignalWire reports an inbound "YES" from the
 * user. Spawns the actual RevTry call within 5 minutes.
 */
export async function onD2YesReply(args: {
  user_id: string;
  workspace_id: string;
  deps: TriggerDeps;
}): Promise<{ called: boolean }> {
  const state = await args.deps.store.load(args.user_id);
  if (!state) return { called: false };
  if (state.source_connected_at) return { called: false };
  // Confirm reply consent within the last 24h.
  const consent = await args.deps.revtry.hasReplyConsent({
    user_id: args.user_id,
    keyword: "YES",
    within_hours: 24,
  });
  if (!consent) return { called: false };
  await args.deps.revtry.startOutboundCall({
    to_user_id: args.user_id,
    workspace_id: args.workspace_id,
    purpose: "oauth_screenshare",
    callback_within_minutes: 5,
    idempotency_key: `d2-call:${args.user_id}:${state.signed_up_at.slice(0, 10)}:yes`,
  });
  await args.deps.emit("activation_intervention_completed", {
    user_id: args.user_id,
    workspace_id: args.workspace_id,
    kind: "d2_no_source",
    outcome: "call_initiated",
  });
  return { called: true };
}
