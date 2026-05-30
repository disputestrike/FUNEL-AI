/**
 * BullMQ-friendly outbound dial queue façade.
 *
 * The Speed-to-Lead worker calls `queueOutboundDial` after `lead_captured`.
 * That entrypoint is the public seam between CRM and RevTry — it must:
 *   1. Return immediately (the worker is on a 100ms latency budget).
 *   2. Allocate a `call_id` so the UI can subscribe to status updates.
 *   3. Hand off the actual placement to the voice worker (high priority,
 *      so the 60-sec SLA holds even when other queues are backed up).
 *
 * Implementation is intentionally pluggable — the production wiring binds
 * a real BullMQ queue at boot via `setOutboundDialEnqueuer`. In dev, demo
 * mode kicks in: we simulate the call instead.
 */

import { isDemoMode, simulateOutboundCall } from "./demo.js";
import { InMemoryCallStore, type CallStore } from "./store.js";

export interface QueueOutboundDialInput {
  workspace_id: string;
  lead_id: string;
  funnel_id: string;
  phone_e164: string;
  /** Optional caller-supplied from number; falls back to the workspace default. */
  from_e164?: string;
  /** Absolute SLA deadline for the dial. */
  deadline_at: string;
  /** Industry + persona used to select the script + voice. */
  industry?: string;
  persona?: string;
  language?: string;
  first_name?: string | null;
}

export interface QueueOutboundDialResult {
  call_id: string;
  /** ISO timestamp the queue accepted the job — used for SLA tracking. */
  enqueued_at: string;
  /** True if we ran the demo simulator instead of placing a real call. */
  demo: boolean;
}

export type OutboundDialEnqueuer = (input: QueueOutboundDialInput) => Promise<QueueOutboundDialResult>;

let enqueuer: OutboundDialEnqueuer | null = null;
let demoStore: CallStore | null = null;
let demoEmitter:
  | ((name: string, payload: Record<string, unknown>) => Promise<void> | void)
  | null = null;

/**
 * Register the production enqueuer. The voice worker calls this at boot
 * after constructing its BullMQ producer.
 */
export function setOutboundDialEnqueuer(fn: OutboundDialEnqueuer): void {
  enqueuer = fn;
}

/** Inject a CallStore for the demo simulator. Defaults to in-memory. */
export function setDemoCallStore(store: CallStore): void {
  demoStore = store;
}

/** Inject an event emitter for demo events. Defaults to a no-op. */
export function setDemoEmitter(
  fn: (name: string, payload: Record<string, unknown>) => Promise<void> | void,
): void {
  demoEmitter = fn;
}

let nDemo = 0;
function nextDemoId(): string {
  return `cll_demo_${Date.now().toString(36)}_${(nDemo++).toString(36)}`;
}

/**
 * Enqueue an outbound dial. The shape matches what
 * `apps/workers/src/workers/speed-to-lead.ts` already calls — see its
 * `RevTryModule.queueOutboundDial` interface.
 *
 * Resolution order:
 *   1. Production enqueuer if registered.
 *   2. Demo simulator if `isDemoMode()`.
 *   3. Throw — caller must have wired something.
 */
export async function queueOutboundDial(
  input: QueueOutboundDialInput,
): Promise<QueueOutboundDialResult> {
  const enqueued_at = new Date().toISOString();

  if (enqueuer) {
    return enqueuer(input);
  }

  if (isDemoMode()) {
    const store = demoStore ?? (demoStore = new InMemoryCallStore());
    const { call } = simulateOutboundCall(
      {
        workspace_id: input.workspace_id,
        lead_id: input.lead_id,
        funnel_id: input.funnel_id,
        from_e164: input.from_e164 ?? process.env.SIGNALWIRE_FROM_NUMBER ?? "+10000000000",
        to_e164: input.phone_e164,
        language: input.language,
        industry: input.industry,
        persona: input.persona,
        first_name: input.first_name ?? null,
      },
      {
        store,
        newId: () => nextDemoId(),
        emit: demoEmitter ?? undefined,
      },
    );
    return { call_id: call.id, enqueued_at, demo: true };
  }

  throw new Error(
    "queueOutboundDial: no enqueuer registered and not in demo mode. " +
      "Call setOutboundDialEnqueuer() at boot, or set REVTRY_DEMO_MODE=1.",
  );
}

/** For tests: clear any wiring. */
export function resetQueueForTests(): void {
  enqueuer = null;
  demoStore = null;
  demoEmitter = null;
  nDemo = 0;
}
