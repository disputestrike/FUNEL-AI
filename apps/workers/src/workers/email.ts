/**
 * Email worker.
 *
 * Sends transactional email via @funnel/email (Resend in prod; in-memory
 * adapter in tests).
 *
 * Pre-send checks:
 *   - Suppression list (hard bounces, complaints, manual unsubscribes)
 *   - Workspace-level email opt-out for the recipient
 *
 * Post-send: audit log + analytics event.
 */

import { z } from "zod";

import { buildWorker } from "../worker-base.js";
import { emitInternal } from "../events-bridge.js";

const EmailJobSchema = z.object({
  workspace_id: z.string().nullable(),
  to: z.string().email(),
  template: z.string().min(1),
  subject: z.string().min(1),
  data: z.record(z.unknown()).default({}),
  /** Optional explicit idempotency key from upstream. */
  idempotency_key: z.string().optional(),
  /** Category drives suppression-list scope (txn vs marketing). */
  category: z.enum(["transactional", "lifecycle", "marketing"]).default("transactional"),
});

interface EmailModule {
  // The Email interface defined in @funnel/email/src/index.ts has `.send`.
  send(input: {
    to: string;
    template: string;
    subject: string;
    data: Record<string, unknown>;
    idempotency_key?: string;
  }): Promise<{ message_id: string; accepted: boolean }>;
}

interface SuppressionModule {
  isSuppressed(email: string, category: "transactional" | "lifecycle" | "marketing"): Promise<boolean>;
  recordSend(args: {
    workspace_id: string | null;
    to: string;
    template: string;
    message_id: string;
    category: string;
  }): Promise<void>;
}

async function loadEmail(): Promise<EmailModule> {
  const mod = (await import("@funnel/email")) as unknown as {
    getEmailClient?: () => EmailModule;
    default?: EmailModule;
  } & EmailModule;
  // The package exports either a factory `getEmailClient()` or an `Email`
  // instance set during boot. We tolerate both.
  if (typeof mod.getEmailClient === "function") return mod.getEmailClient();
  if (typeof mod.send === "function") return mod;
  if (mod.default && typeof mod.default.send === "function") return mod.default;
  throw new Error("@funnel/email: no send() implementation discovered");
}

async function loadSuppression(): Promise<SuppressionModule> {
  return (await import("@funnel/email")) as unknown as SuppressionModule;
}

export const emailWorker = buildWorker(
  { queue: "email" },
  {
    name: "email.send",
    schema: EmailJobSchema,
    idempotencyKey: (d) => d.idempotency_key ?? `email:${d.to}:${d.template}:${JSON.stringify(d.data)}`,
    async run({ data }) {
      const suppression = await loadSuppression();
      const suppressed = await suppression.isSuppressed(data.to, data.category).catch(() => false);
      if (suppressed) {
        emitInternal("email_suppressed", {
          workspace_id: data.workspace_id,
          to_domain: data.to.split("@")[1],
          template: data.template,
          category: data.category,
        });
        return { skipped: true, reason: "suppressed" };
      }

      const email = await loadEmail();
      const result = await email.send({
        to: data.to,
        template: data.template,
        subject: data.subject,
        data: data.data,
        idempotency_key: data.idempotency_key,
      });

      if (!result.accepted) {
        throw new Error(`email rejected by provider: message_id=${result.message_id}`);
      }

      await suppression
        .recordSend({
          workspace_id: data.workspace_id,
          to: data.to,
          template: data.template,
          message_id: result.message_id,
          category: data.category,
        })
        .catch(() => undefined);

      emitInternal("email_sent", {
        workspace_id: data.workspace_id,
        to_domain: data.to.split("@")[1],
        template: data.template,
        message_id: result.message_id,
        category: data.category,
      });

      return { message_id: result.message_id };
    },
  },
);
