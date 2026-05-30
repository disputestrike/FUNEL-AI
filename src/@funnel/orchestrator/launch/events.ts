/**
 * GoFunnelAI — Launch Center agent event surface.
 *
 * Each Launch Center agent emits one or more events through this thin
 * dispatcher so callers (the workflow engine, the cockpit UI, the audit ledger)
 * can subscribe without each agent importing the global `@funnel/events`
 * emitter directly. A no-op default sink keeps tests and standalone calls
 * silent while production wiring routes through the typed event bus.
 *
 * Event naming convention: `launch_<noun>_<verb>` (snake_case).
 *
 * Brand: GoFunnelAI. Domain: gofunnelai.com.
 */

export type LaunchEventName =
  | "launch_strategy_started"
  | "launch_strategy_completed"
  | "launch_platforms_recommended"
  | "launch_audience_built"
  | "launch_utm_generated"
  | "launch_tracking_checklist_built"
  | "launch_tracking_checklist_evaluated"
  | "launch_retargeting_plan_built"
  | "launch_followup_sequence_built"
  | "launch_score_computed"
  | "launch_export_started"
  | "launch_export_completed"
  | "launch_export_failed";

export interface LaunchEvent<P = Record<string, unknown>> {
  name: LaunchEventName;
  campaignId: string | null;
  workspaceId: string | null;
  ts: string;
  payload: P;
}

export type LaunchEventSink = (event: LaunchEvent) => void | Promise<void>;

const noopSink: LaunchEventSink = () => {};

let currentSink: LaunchEventSink = noopSink;
const recorded: LaunchEvent[] = [];

/** Set the active launch event sink. Returns the previous sink. */
export function setLaunchEventSink(sink: LaunchEventSink): LaunchEventSink {
  const prev = currentSink;
  currentSink = sink;
  return prev;
}

/** Replace the sink with the default no-op sink. */
export function resetLaunchEventSink(): void {
  currentSink = noopSink;
  recorded.length = 0;
}

/**
 * Capture emitted events into an in-memory buffer (additive — does not replace
 * the active sink). Useful inside tests:
 *
 *   const captured = captureLaunchEvents();
 *   await buildSomething(...);
 *   expect(captured()).toHaveLength(1);
 */
export function captureLaunchEvents(): () => LaunchEvent[] {
  recorded.length = 0;
  const previous = currentSink;
  currentSink = async (event) => {
    recorded.push(event);
    await previous(event);
  };
  return () => [...recorded];
}

/**
 * Emit a launch event. Best-effort: sink errors are swallowed and logged so a
 * misbehaving telemetry pipeline cannot break an agent's primary work.
 */
export async function emitLaunch<P extends Record<string, unknown>>(
  name: LaunchEventName,
  payload: P,
  meta: { campaignId?: string | null; workspaceId?: string | null } = {},
): Promise<void> {
  const event: LaunchEvent<P> = {
    name,
    campaignId: meta.campaignId ?? null,
    workspaceId: meta.workspaceId ?? null,
    ts: new Date().toISOString(),
    payload,
  };
  try {
    await currentSink(event as LaunchEvent);
  } catch (err) {
    // Never throw — the host agent must finish.
    // eslint-disable-next-line no-console
    console.warn("[launch.events] sink_failed", { name, error: String(err) });
  }
}
