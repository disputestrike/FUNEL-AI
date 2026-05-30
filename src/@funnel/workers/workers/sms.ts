/**
 * SMS worker — SignalWire (not Twilio).
 *
 * Hard gates (refuse + DLQ before send):
 *   - TCPA opt-out: workspace-level + per-recipient opt-out checked.
 *   - DNC list (federal + state). HARD-GATE — if the number is on a DNC
 *     list, we refuse and route to DLQ for compliance review.
 *
 * Soft retries: provider 5xx, transient network errors.
 */

import { z } from "zod";

import { buildWorker } from "../worker-base.js";
import { emitInternal } from "../events-bridge.js";
import { log } from "../monitoring.js";

const SmsJobSchema = z.object({
  workspace_id: z.string().min(1),
  to_e164: z.string().regex(/^\+[1-9]\d{1,14}$/),
  from_e164: z.string().regex(/^\+[1-9]\d{1,14}$/),
  body: z.string().min(1).max(1600),
  category: z.enum(["transactional", "lead_reply", "marketing"]).default("transactional"),
  /** Optional lead identifier for analytics. */
  lead_id: z.string().nullable().default(null),
  idempotency_key: z.string().optional(),
});

interface SignalwireAdapter {
  sendSms(input: { from: string; to: string; body: string; idempotency_key?: string }): Promise<{
    message_id: string;
    accepted: boolean;
  }>;
}

interface ComplianceModule {
  isOnDncList(phoneE164: string): Promise<{ on_list: boolean; list_name?: string }>;
  isOptedOut(args: { workspace_id: string; phoneE164: string; category: string }): Promise<boolean>;
}

interface IntegrationsModule {
  getSignalwireAdapter(): Promise<SignalwireAdapter>;
}

class TerminalRefusalError extends Error {
  constructor(public reason: "dnc" | "opt_out", message: string) {
    super(message);
    this.name = "TerminalRefusalError";
  }
}

export const smsWorker = buildWorker(
  { queue: "sms" },
  {
    name: "sms.send",
    schema: SmsJobSchema,
    idempotencyKey: (d) => d.idempotency_key ?? `sms:${d.to_e164}:${d.body}`,
    async run({ job, data }) {
      const compliance = (await import("@funnel/compliance")) as unknown as ComplianceModule;

      // HARD GATE 1: DNC list.
      const dnc = await compliance.isOnDncList(data.to_e164).catch((err) => {
        // If the DNC check fails, we MUST refuse (fail-closed) for legal
        // safety, not fail-open.
        log("error", {
          msg: "DNC check failed — fail-closed",
          queue: "sms",
          job_id: String(job.id),
          error: (err as Error).message,
        });
        return { on_list: true, list_name: "dnc_check_failed" };
      });
      if (dnc.on_list) {
        emitInternal("sms_refused_dnc", {
          workspace_id: data.workspace_id,
          list_name: dnc.list_name ?? "unknown",
        });
        // Make this terminal — no retry.
        job.opts.attempts = job.attemptsMade + 1;
        throw new TerminalRefusalError("dnc", `recipient on DNC list (${dnc.list_name ?? "unknown"})`);
      }

      // HARD GATE 2: TCPA / workspace opt-out.
      const optedOut = await compliance
        .isOptedOut({ workspace_id: data.workspace_id, phoneE164: data.to_e164, category: data.category })
        .catch(() => true);
      if (optedOut) {
        emitInternal("sms_refused_opt_out", {
          workspace_id: data.workspace_id,
          category: data.category,
        });
        job.opts.attempts = job.attemptsMade + 1;
        throw new TerminalRefusalError("opt_out", "recipient opted out");
      }

      const integrations = (await import("@funnel/integrations")) as unknown as IntegrationsModule;
      const adapter = await integrations.getSignalwireAdapter();

      const result = await adapter.sendSms({
        from: data.from_e164,
        to: data.to_e164,
        body: data.body,
        idempotency_key: data.idempotency_key,
      });

      if (!result.accepted) {
        throw new Error(`signalwire rejected sms: message_id=${result.message_id}`);
      }

      emitInternal("sms_sent", {
        workspace_id: data.workspace_id,
        lead_id: data.lead_id,
        category: data.category,
        message_id: result.message_id,
      });

      return { message_id: result.message_id };
    },
  },
);

export { TerminalRefusalError };
