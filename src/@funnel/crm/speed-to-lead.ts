/**
 * The <60-second enforcer (PRD §3 acceptance: "lead_captured →
 * lead_revtry_call_started P95 < 60s").
 *
 * Flow on `lead_captured`:
 *   1. Within 100ms (this function runs async to capture API)
 *      a. Fire an SMS auto-reply (if `consent.sms` and TCPA-safe).
 *      b. Enqueue a RevTry outbound call (consent.calls + DNC check OK).
 *      c. Notify the funnel owner via in-app + email.
 *   2. If RevTry is unreachable OR DNC/TCPA blocks the call, fall back to
 *      email-only.
 *
 * The function is wired by injection — `@funnel/revtry` and
 * `@funnel/notifications` register their handlers at boot via
 * `setSpeedToLeadHandlers`. This avoids a hard build cycle between
 * packages (revtry depends on the lead row, crm depends on revtry's dial).
 */

import type { ContactId, LeadId } from "./ids.js";
import { getStore, type CrmStore, type WorkspaceId } from "./store.js";
import { emitCrm } from "./bus.js";
import { recordActivity } from "./activity-timeline.js";
import { scoreLead } from "./leads.js";

export interface SpeedToLeadContext {
  workspace_id: WorkspaceId;
  lead_id: LeadId;
  contact_id: ContactId;
  industry?: string;
  enrichment?: Record<string, unknown>;
}

export type SpeedToLeadOutcome =
  | { kind: "called"; call_id: string }
  | { kind: "sms_only"; message_id: string; reason: string }
  | { kind: "email_only"; reason: string }
  | { kind: "blocked"; reason: string };

export interface SpeedToLeadHandlers {
  /** Send the lead an SMS auto-reply. Resolve `null` to skip silently. */
  sendSmsAutoReply?: (ctx: SpeedToLeadContext) => Promise<{ message_id: string } | null>;
  /** Place a RevTry outbound call. Resolve `null` to fall through. */
  enqueueRevtryCall?: (ctx: SpeedToLeadContext) => Promise<{ call_id: string } | null>;
  /** Notify the funnel owner (in-app + email). */
  notifyOwner?: (ctx: SpeedToLeadContext, body: { lead_id: LeadId; first_name?: string | null }) => Promise<void>;
  /** Check the global suppression / DNC list. Resolve `true` to block. */
  isSuppressed?: (ctx: SpeedToLeadContext) => Promise<{ suppressed: boolean; reason?: string }>;
}

let handlers: SpeedToLeadHandlers = {};
export function setSpeedToLeadHandlers(h: SpeedToLeadHandlers): void {
  handlers = { ...handlers, ...h };
}

const SLA_BUDGET_MS = 60_000;

export async function runSpeedToLead(ctx: SpeedToLeadContext, store: CrmStore = getStore()): Promise<SpeedToLeadOutcome> {
  const t0 = Date.now();
  const lead = await store.getLead(ctx.workspace_id, ctx.lead_id);
  if (!lead) return { kind: "blocked", reason: "lead_not_found" };
  const contact = await store.getContact(ctx.workspace_id, ctx.contact_id);
  if (!contact) return { kind: "blocked", reason: "contact_not_found" };

  // 0) DNC / global suppression hard-gate ------------------------------------
  if (handlers.isSuppressed) {
    const s = await handlers.isSuppressed(ctx);
    if (s.suppressed) {
      await recordActivity({
        workspace_id: ctx.workspace_id,
        contact_id: ctx.contact_id,
        lead_id: ctx.lead_id,
        kind: "note",
        actor_user_id: null,
        metadata: { speed_to_lead: "blocked", reason: s.reason ?? "suppressed" },
      });
      return { kind: "blocked", reason: s.reason ?? "suppressed" };
    }
  }
  if (contact.do_not_contact) {
    return { kind: "blocked", reason: "do_not_contact" };
  }

  // 1) Async scoring — non-blocking but kicked off now ------------------------
  void scoreLead(ctx.workspace_id, ctx.lead_id, { industry: ctx.industry, enrichment: ctx.enrichment }).catch((err) => {
    // eslint-disable-next-line no-console
    console.error("scoring failed", { lead_id: ctx.lead_id, err: String(err) });
  });

  // 2) SMS auto-reply (sms consent + phone present) ---------------------------
  let smsResult: { message_id: string } | null = null;
  if (contact.consent?.sms && contact.phone_e164 && handlers.sendSmsAutoReply) {
    try {
      smsResult = await handlers.sendSmsAutoReply(ctx);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("speed_to_lead.sms failed", { err: String(err) });
    }
  }

  // 3) RevTry dial (calls consent + phone) -----------------------------------
  let callResult: { call_id: string } | null = null;
  if (contact.consent?.calls && contact.phone_e164 && handlers.enqueueRevtryCall) {
    // Watchdog: bail if we've already burned > SLA budget.
    if (Date.now() - t0 < SLA_BUDGET_MS) {
      try {
        callResult = await handlers.enqueueRevtryCall(ctx);
        if (callResult) {
          await emitCrm("lead_revtry_enqueued", {
            workspace_id: ctx.workspace_id,
            occurred_at: new Date().toISOString(),
            lead_id: ctx.lead_id,
            attempt_n: 1,
            scheduled_for: new Date().toISOString(),
            reason: "speed_to_lead",
          });
        }
      } catch (err) {
        // RevTry down → fall through to email-only.
        // eslint-disable-next-line no-console
        console.warn("speed_to_lead.revtry failed; falling back", { err: String(err) });
      }
    }
  }

  // 4) Owner notification (in-app + email) ------------------------------------
  if (handlers.notifyOwner) {
    try {
      await handlers.notifyOwner(ctx, { lead_id: ctx.lead_id, first_name: contact.first_name ?? null });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("speed_to_lead.notify failed", { err: String(err) });
    }
  }

  if (callResult) return { kind: "called", call_id: callResult.call_id };
  if (smsResult) return { kind: "sms_only", message_id: smsResult.message_id, reason: "no_call_path" };
  return { kind: "email_only", reason: "no_voice_or_sms_path" };
}
