/**
 * Analytics sink — forwards events to the analytics warehouse (PostHog +
 * Cloudflare Analytics Engine in production). For dev / tests we ship an
 * in-memory implementation.
 */

import type { Envelope } from "../envelope.js";
import type { Sink } from "../emitter.js";

export interface AnalyticsForwarder {
  forward(envelope: Envelope): Promise<void>;
}

export function analyticsSink(forwarder: AnalyticsForwarder): Sink {
  return {
    name: "analytics",
    async receive(envelope) {
      await forwarder.forward(envelope);
    },
  };
}

export class InMemoryAnalyticsForwarder implements AnalyticsForwarder {
  public readonly events: Envelope[] = [];
  async forward(envelope: Envelope): Promise<void> {
    this.events.push(envelope);
  }
}
