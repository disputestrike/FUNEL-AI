/**
 * Inbound webhook router.
 *
 * For each provider:
 *   1. Persist the raw body in R2 keyed by `webhook_event_id` (30d) so
 *      `replay()` can re-run it.
 *   2. Run `adapter.webhookVerify(headers, body)`. On false → log security
 *      event + drop.
 *   3. Parse JSON / form / SOAP per provider and call
 *      `adapter.webhookHandle(verifiedPayload)`.
 *   4. Dedupe each ProviderEvent by `event.id`.
 *   5. Enqueue a `WebhookJob` for the downstream consumer (BullMQ).
 *
 * Production wires R2 + KV + BullMQ implementations; the package ships
 * in-memory fixtures for tests.
 */

import { ulid } from "ulid";
import type { ProviderAdapter, WebhookEvent } from "../pal/types.js";
import type { InboundWebhook, WebhookJob } from "../types.js";
import { WebhookVerificationError } from "../pal/errors.js";
import type { DedupeStore } from "./dedupe.js";

export interface RawWebhookStore {
  /** Persist the raw request body + headers. Returns the storage key. */
  put(raw: InboundWebhook): Promise<string>;
  get(webhookEventId: string): Promise<InboundWebhook | null>;
}

export interface JobQueue {
  enqueue(job: WebhookJob): Promise<void>;
}

export class InMemoryRawWebhookStore implements RawWebhookStore {
  private readonly s = new Map<string, InboundWebhook>();
  async put(raw: InboundWebhook): Promise<string> {
    this.s.set(raw.id, raw);
    return raw.id;
  }
  async get(id: string): Promise<InboundWebhook | null> {
    return this.s.get(id) ?? null;
  }
}

export class InMemoryJobQueue implements JobQueue {
  public readonly jobs: WebhookJob[] = [];
  async enqueue(job: WebhookJob): Promise<void> {
    this.jobs.push(job);
  }
}

export interface SecurityEventEmitter {
  /** Emit `integration_webhook_signature_failed` style security audit. */
  emitVerificationFailed(provider: string, headers: Record<string, string>): Promise<void>;
}

export interface WebhookRouterDeps {
  rawStore: RawWebhookStore;
  dedupe: DedupeStore;
  queue: JobQueue;
  /** Provider key → adapter. */
  adapters: Map<string, ProviderAdapter>;
  security?: SecurityEventEmitter;
}

export class WebhookRouter {
  constructor(private readonly deps: WebhookRouterDeps) {}

  /** Handle one inbound HTTP request. */
  async handle(args: {
    provider: string;
    headers: Record<string, string>;
    body: string | Buffer;
  }): Promise<{ accepted: boolean; webhookEventId?: string; events?: WebhookEvent[] }> {
    const adapter = this.deps.adapters.get(args.provider);
    if (!adapter) {
      throw new Error(`No adapter registered for provider ${args.provider}`);
    }

    const id = `whe_${ulid()}`;
    const raw: InboundWebhook = {
      id,
      provider: args.provider,
      receivedAt: new Date().toISOString(),
      headers: args.headers,
      body: typeof args.body === "string" ? args.body : args.body.toString("utf8"),
      verified: false,
    };
    await this.deps.rawStore.put(raw);

    // Verify before parsing.
    const ok = adapter.webhookVerify(args.headers, args.body);
    if (!ok) {
      await this.deps.security?.emitVerificationFailed(args.provider, args.headers);
      throw new WebhookVerificationError(args.provider);
    }
    raw.verified = true;
    await this.deps.rawStore.put(raw);

    // Parse + hand to adapter.
    const parsed = parseBody(args.headers, raw.body);
    const events = await adapter.webhookHandle(parsed);

    // Dedupe + enqueue.
    const fresh: WebhookEvent[] = [];
    for (const ev of events) {
      const seen = await this.deps.dedupe.seen(ev.id);
      if (seen) continue;
      await this.deps.dedupe.mark(ev.id, 60 * 60 * 24 * 7); // 7d
      fresh.push(ev);
    }
    if (fresh.length > 0) {
      await this.deps.queue.enqueue({
        webhookEventId: id,
        provider: args.provider,
        events: fresh,
        enqueuedAt: new Date().toISOString(),
      });
    }
    return { accepted: true, webhookEventId: id, events: fresh };
  }

  /** Replay path — operator-only; reaches into rawStore and re-runs handle. */
  async replay(webhookEventId: string): Promise<WebhookEvent[]> {
    const raw = await this.deps.rawStore.get(webhookEventId);
    if (!raw) throw new Error(`raw webhook ${webhookEventId} not found`);
    const adapter = this.deps.adapters.get(raw.provider);
    if (!adapter) throw new Error(`No adapter registered for ${raw.provider}`);
    return adapter.replay(webhookEventId);
  }
}

/**
 * Daily reconciliation job: for each provider that supports `sync()` we ask
 * the adapter to fetch everything new since the last successful sync.
 */
export interface ReconcileDeps {
  adapters: Map<string, ProviderAdapter>;
  queue: JobQueue;
  lastSyncStore: { get(p: string): Promise<string | null>; put(p: string, ts: string): Promise<void> };
}

export async function reconcileAll(deps: ReconcileDeps, workspaceId: string): Promise<void> {
  for (const [provider, adapter] of deps.adapters) {
    const since = (await deps.lastSyncStore.get(provider)) ?? undefined;
    try {
      const { events, nextSince } = await adapter.sync(workspaceId, since);
      if (events.length > 0) {
        await deps.queue.enqueue({
          webhookEventId: `recon_${provider}_${Date.now()}`,
          provider,
          events,
          enqueuedAt: new Date().toISOString(),
        });
      }
      await deps.lastSyncStore.put(provider, nextSince);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`reconcile failed for ${provider}`, err);
    }
  }
}

function parseBody(headers: Record<string, string>, body: string): unknown {
  const ct = (headers["content-type"] ?? headers["Content-Type"] ?? "").toLowerCase();
  if (ct.includes("application/json")) {
    try {
      return JSON.parse(body);
    } catch {
      return body;
    }
  }
  if (ct.includes("application/x-www-form-urlencoded")) {
    return Object.fromEntries(new URLSearchParams(body));
  }
  // SOAP/XML providers (VIES) get the raw body — their handler parses it.
  return body;
}
