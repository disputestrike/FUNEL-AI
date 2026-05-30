/**
 * Outbound webhooks worker.
 *
 * Sends a signed HTTP POST to the customer's webhook endpoint.
 *
 * Wire format:
 *   POST <endpoint>
 *   Content-Type: application/json
 *   X-Funnel-Event:        <event_name>
 *   X-Funnel-Event-Id:     <ulid>
 *   X-Funnel-Idempotency:  <stable key>
 *   X-Funnel-Timestamp:    <unix-ms>
 *   X-Funnel-Signature:    sha256=<hex>    ← HMAC-SHA256(timestamp + "." + body, secret)
 *   Body: <json envelope>
 *
 * Retry schedule (cumulative): 1m, 5m, 30m, 2h, 12h. After the 5th failure
 * the worker routes the job to the DLQ.
 *
 * The HMAC scheme matches Stripe's pattern (timestamp-prefixed) so customers
 * can reuse existing Stripe-style verification snippets.
 */

import { createHmac, randomUUID } from "node:crypto";

import { z } from "zod";

import { buildWorker } from "../worker-base.js";
import { emitInternal } from "../events-bridge.js";
import { log } from "../monitoring.js";

const WebhookJobSchema = z.object({
  workspace_id: z.string().min(1),
  endpoint_id: z.string().min(1),
  endpoint_url: z.string().url(),
  signing_secret: z.string().min(16),
  event_id: z.string().min(1),
  event_name: z.string().min(1),
  payload: z.record(z.unknown()),
  /** Caller-supplied idempotency key, otherwise event_id is used. */
  idempotency_key: z.string().optional(),
  /** Current attempt — 0-indexed; bumped on each requeue. */
  attempt: z.number().int().nonnegative().default(0),
});

export const RETRY_SCHEDULE_MS = [
  60_000, // 1m  → attempt 1
  5 * 60_000, // 5m  → attempt 2
  30 * 60_000, // 30m → attempt 3
  2 * 60 * 60_000, // 2h  → attempt 4
  12 * 60 * 60_000, // 12h → attempt 5
] as const;

export const MAX_ATTEMPTS = RETRY_SCHEDULE_MS.length;

function sign(secret: string, timestamp: number, body: string): string {
  const mac = createHmac("sha256", secret);
  mac.update(`${timestamp}.${body}`);
  return `sha256=${mac.digest("hex")}`;
}

export const webhooksOutboundWorker = buildWorker(
  { queue: "webhooks-outbound" },
  {
    name: "webhooks-outbound.send",
    schema: WebhookJobSchema,
    idempotencyKey: (d) =>
      // Idempotency must reflect *delivery*, not just event id, so a customer
      // retry of the same event from another source still dedupes.
      `webhook:${d.endpoint_id}:${d.event_id}`,
    async run({ job, data }) {
      const idem = data.idempotency_key ?? data.event_id;
      const body = JSON.stringify({
        id: data.event_id,
        type: data.event_name,
        workspace_id: data.workspace_id,
        created_at: new Date().toISOString(),
        data: data.payload,
      });
      const timestamp = Date.now();
      const signature = sign(data.signing_secret, timestamp, body);

      let response: Response;
      try {
        response = await fetch(data.endpoint_url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "user-agent": "Funnel-Webhooks/1.0",
            "x-funnel-event": data.event_name,
            "x-funnel-event-id": data.event_id,
            "x-funnel-idempotency": idem,
            "x-funnel-timestamp": String(timestamp),
            "x-funnel-signature": signature,
            "x-funnel-delivery-id": randomUUID(),
          },
          body,
          // 10s timeout — webhook receivers are expected to ack fast.
          signal: AbortSignal.timeout(10_000),
        });
      } catch (err) {
        return reschedule(job as never, data, `network_error: ${(err as Error).message}`);
      }

      if (response.status >= 200 && response.status < 300) {
        emitInternal("webhook_delivered", {
          workspace_id: data.workspace_id,
          endpoint_id: data.endpoint_id,
          event_id: data.event_id,
          status: response.status,
          attempt: data.attempt + 1,
        });
        return { delivered: true, status: response.status };
      }

      return reschedule(job as never, data, `http_${response.status}`);
    },
  },
);

async function reschedule(
  job: { id?: string | number | undefined; opts: { attempts?: number }; attemptsMade: number; queue: { add: (name: string, data: unknown, opts: { delay?: number }) => Promise<unknown> } },
  data: z.infer<typeof WebhookJobSchema>,
  reason: string,
): Promise<{ rescheduled: boolean; attempt: number; reason: string } | never> {
  const nextAttempt = data.attempt + 1;
  if (nextAttempt >= MAX_ATTEMPTS) {
    // Terminal — set attempts so BullMQ marks it failed (and the failed
    // handler routes to DLQ).
    log("warn", {
      msg: "webhook delivery exhausted retries — routing to DLQ",
      queue: "webhooks-outbound",
      endpoint_id: data.endpoint_id,
      attempts: nextAttempt,
      reason,
    });
    emitInternal("webhook_dead_lettered", {
      workspace_id: data.workspace_id,
      endpoint_id: data.endpoint_id,
      event_id: data.event_id,
      reason,
    });
    job.opts.attempts = job.attemptsMade + 1;
    throw new Error(`webhook delivery failed after ${nextAttempt} attempts: ${reason}`);
  }
  const delay = RETRY_SCHEDULE_MS[nextAttempt] ?? RETRY_SCHEDULE_MS[RETRY_SCHEDULE_MS.length - 1] ?? 60_000;
  log("info", {
    msg: "webhook delivery failed — re-queueing",
    queue: "webhooks-outbound",
    endpoint_id: data.endpoint_id,
    next_attempt: nextAttempt,
    delay_ms: delay,
    reason,
  });
  emitInternal("webhook_delivery_retrying", {
    workspace_id: data.workspace_id,
    endpoint_id: data.endpoint_id,
    event_id: data.event_id,
    next_attempt: nextAttempt,
    delay_ms: delay,
    reason,
  });
  await job.queue.add(
    "webhooks-outbound.send",
    { ...data, attempt: nextAttempt },
    { delay },
  );
  return { rescheduled: true, attempt: nextAttempt, reason };
}

export { sign as signWebhook };
