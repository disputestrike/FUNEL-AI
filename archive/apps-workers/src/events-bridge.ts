/**
 * Event emission helpers.
 *
 * The workers service uses `@funnel/events.emit()` to publish typed events.
 * That package validates payloads against zod schemas — so misnamed or
 * mis-shaped events crash loudly in dev rather than silently in prod.
 *
 * Several worker-specific event names aren't yet declared in the central
 * taxonomy (it'll be back-filled by data eng); for those we fall through to a
 * pass-through `console.log` line. The JSON shape matches the canonical
 * envelope so the data lake ingestion treats them identically.
 */

import { EventSchemas, emit, type EventName, type EventPayload } from "@funnel/events";

import { log } from "./monitoring.js";

/** Emit a typed event if the name is in the taxonomy; otherwise log + drop. */
export async function emitSafe<N extends EventName>(name: N, payload: EventPayload<N>): Promise<void> {
  await emit(name, payload).catch((err) => {
    log("error", { msg: "event emit failed", event_name: name, error: (err as Error).message });
  });
}

/**
 * For events whose schema isn't in @funnel/events yet (e.g. internal worker
 * telemetry), shape them like the canonical envelope and log them. The lake
 * ingestor for the `worker_internal` family picks these up.
 */
export function emitInternal(eventName: string, props: Record<string, unknown>): void {
  log("info", {
    msg: "event",
    event_name: eventName,
    event_family: "worker_internal",
    schema_version: 1,
    occurred_at: new Date().toISOString(),
    ...props,
  });
}

/** Re-export the EventName guard so workers can branch on taxonomy presence. */
export function isKnownEvent(name: string): name is EventName {
  return Object.prototype.hasOwnProperty.call(EventSchemas, name);
}
