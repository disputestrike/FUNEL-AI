/**
 * Thin re-export of @funnel/events with safe fallbacks so the api app never
 * crashes if a new event name is wired up before the schema is published.
 */

import { emit as rawEmit } from "@funnel/events";

export async function emitEvent<N extends Parameters<typeof rawEmit>[0]>(
  name: N,
  payload: Parameters<typeof rawEmit<N>>[1],
): Promise<void> {
  try {
    await rawEmit(name, payload);
  } catch (err) {
    // Schema validation failed — log loudly, never block the request path.
    // Sentry capture happens in error middleware.
    // eslint-disable-next-line no-console
    console.error("[events] emit failed", { name, err });
  }
}
