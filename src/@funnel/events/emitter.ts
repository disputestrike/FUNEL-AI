/**
 * Typed emitter.
 *
 * `emit(name, props, ctx)`:
 *   1. Validate `props` against the schema in `EVENT_SCHEMAS` (loud throw in dev).
 *   2. Wrap in the canonical Envelope shape (Doc 03 §0).
 *   3. Batch + flush to each registered sink (analytics, audit, learning,
 *      notification).
 *   4. Idempotency via `event_id` (caller-supplied or auto-generated).
 *   5. Graceful degradation: per-sink failures are logged but never bubble —
 *      we cannot let a sink outage break the host service.
 */

import { EnvelopeSchema, type Envelope, type ActorType, type PiiClass } from "./envelope.js";
import { bucketOf } from "./taxonomy.js";
import { getSchema } from "./schemas.js";

export interface EmitContext {
  workspace_id?: string | null;
  account_tier?: string | null;
  actor?: {
    type: ActorType;
    user_id?: string | null;
    impersonator_user_id?: string | null;
    api_key_id?: string | null;
    admin_session_id?: string | null;
  };
  subject?: { type: string; id?: string | null };
  trace_id?: string;
  request_id?: string | null;
  ip_hash?: string | null;
  user_agent_class?: string | null;
  geography?: string | null;
  consent?: Envelope["consent"];
  occurred_at?: string;
  event_id?: string;
  pii_class?: PiiClass;
}

export interface Sink {
  name: string;
  /** Async per-event. Errors are caught by the emitter; sink should NOT throw. */
  receive(envelope: Envelope): Promise<void> | void;
}

const sinks: Sink[] = [];

export function registerSink(sink: Sink): void {
  sinks.push(sink);
}

export function clearSinks(): void {
  sinks.length = 0;
}

/** Logger surface — caller can swap in pino/winston. Defaults to console. */
export interface EmitterLogger {
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
}
let logger: EmitterLogger = {
  warn: (msg, meta) => console.warn(`[events] ${msg}`, meta ?? {}),
  error: (msg, meta) => console.error(`[events] ${msg}`, meta ?? {}),
};
export function setLogger(l: EmitterLogger): void {
  logger = l;
}

function newEventId(): string {
  return `evt_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

function newTraceId(): string {
  return `trc_${Math.random().toString(36).slice(2, 14)}`;
}

export async function emit(
  event_name: string,
  properties: Record<string, unknown>,
  ctx: EmitContext = {},
): Promise<Envelope | null> {
  // Reject unknown events loudly in dev; silently drop in prod (after warn).
  if (!bucketOf(event_name)) {
    logger.warn("emit_unknown_event", { event_name });
    if (process.env.NODE_ENV !== "production") {
      throw new Error(`unknown event: ${event_name}`);
    }
    return null;
  }
  const schema = getSchema(event_name);
  if (!schema) {
    logger.error("emit_missing_schema", { event_name });
    return null;
  }
  try {
    schema.parse(properties);
  } catch (err) {
    logger.error("emit_schema_invalid", { event_name, error: String(err) });
    if (process.env.NODE_ENV !== "production") throw err;
    return null;
  }

  const envelope: Envelope = EnvelopeSchema.parse({
    event_id: ctx.event_id ?? newEventId(),
    event_name,
    schema_version: 1,
    occurred_at: ctx.occurred_at ?? new Date().toISOString(),
    ingested_at: new Date().toISOString(),
    tenancy: {
      workspace_id: ctx.workspace_id ?? null,
      account_tier: ctx.account_tier ?? null,
    },
    actor: {
      type: ctx.actor?.type ?? "system",
      user_id: ctx.actor?.user_id ?? null,
      impersonator_user_id: ctx.actor?.impersonator_user_id ?? null,
      api_key_id: ctx.actor?.api_key_id ?? null,
      admin_session_id: ctx.actor?.admin_session_id ?? null,
    },
    subject: {
      type: ctx.subject?.type ?? "system",
      id: ctx.subject?.id ?? null,
    },
    context: {
      trace_id: ctx.trace_id ?? newTraceId(),
      request_id: ctx.request_id ?? null,
      ip_hash: ctx.ip_hash ?? null,
      user_agent_class: ctx.user_agent_class ?? null,
      geography: ctx.geography ?? null,
    },
    consent: ctx.consent ?? undefined,
    properties,
    pii_class: ctx.pii_class ?? "none",
  });

  // Fan out — each sink is independent; one failing doesn't block the others.
  await Promise.all(
    sinks.map(async (s) => {
      try {
        await s.receive(envelope);
      } catch (err) {
        logger.error("sink_failed", { sink: s.name, error: String(err) });
      }
    }),
  );

  return envelope;
}
