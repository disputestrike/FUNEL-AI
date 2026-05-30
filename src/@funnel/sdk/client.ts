/**
 * FunnelClient — the entry point for the TypeScript SDK.
 *
 * Wraps ofetch with:
 *   - Automatic Bearer-key auth
 *   - Exponential backoff retries on 429 + transient 5xx
 *   - X-RateLimit-* awareness (sleeps on remaining=0)
 *   - Idempotency-Key auto-generated for mutations
 *   - Typed error classification (see ./errors.ts)
 *
 * Usage:
 *   const funnel = new FunnelClient({ apiKey: process.env.FUNNEL_API_KEY! });
 *   const lead = await funnel.leads.create({ email: "alice@example.com" });
 */

import { ofetch, type $Fetch, FetchError } from "ofetch";
import { classifyError, RateLimitError } from "./errors.js";
import { FunnelsResource } from "./resources/funnels.js";
import { LeadsResource } from "./resources/leads.js";
import { ContactsResource } from "./resources/contacts.js";
import { CampaignsResource } from "./resources/campaigns.js";
import { IntegrationsResource } from "./resources/integrations.js";
import { AnalyticsResource } from "./resources/analytics.js";
import { WebhooksResource } from "./resources/webhooks.js";
import { VoiceCallsResource } from "./resources/voice-calls.js";
import { BookingsResource } from "./resources/bookings.js";

export interface FunnelClientOptions {
  /** Workspace API key — `fnl_live_…` or `fnl_test_…`. */
  apiKey: string;
  /** Override the API host. Defaults to https://api.gofunnelai.com */
  baseUrl?: string;
  /** API version path segment. Defaults to "v1". */
  version?: "v1";
  /** Max retries on 429 + transient 5xx. Defaults to 3. */
  maxRetries?: number;
  /** Fetch implementation (test override). Defaults to global fetch. */
  fetch?: typeof globalThis.fetch;
  /** Extra headers to send with every request. */
  headers?: Record<string, string>;
  /** Default request timeout in ms. Defaults to 30s. */
  timeoutMs?: number;
  /** User-Agent suffix (e.g. "my-app/1.2.3"). */
  userAgentSuffix?: string;
}

const SDK_VERSION = "1.0.0";

/** Cryptographically-random idempotency key (UUIDv4-ish). */
function newIdempotencyKey(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  // Fallback for very old runtimes.
  return "id-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const MUTATING_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);

export interface RequestOptions {
  query?: Record<string, unknown>;
  body?: unknown;
  headers?: Record<string, string>;
  /** Provide to override the auto-generated key. */
  idempotencyKey?: string;
  signal?: AbortSignal;
}

export class FunnelClient {
  readonly funnels: FunnelsResource;
  readonly leads: LeadsResource;
  readonly contacts: ContactsResource;
  readonly campaigns: CampaignsResource;
  readonly integrations: IntegrationsResource;
  readonly analytics: AnalyticsResource;
  readonly webhooks: WebhooksResource;
  readonly voiceCalls: VoiceCallsResource;
  readonly bookings: BookingsResource;

  private readonly fetcher: $Fetch;
  private readonly maxRetries: number;

  constructor(options: FunnelClientOptions) {
    if (!options.apiKey?.startsWith("fnl_")) {
      throw new Error("FunnelClient: apiKey must start with `fnl_`.");
    }
    const baseUrl = (options.baseUrl ?? "https://api.gofunnelai.com").replace(/\/$/, "");
    const version = options.version ?? "v1";

    this.maxRetries = options.maxRetries ?? 3;

    this.fetcher = ofetch.create({
      baseURL: `${baseUrl}/${version}`,
      timeout: options.timeoutMs ?? 30_000,
      retry: 0, // we own retries
      fetch: options.fetch,
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        Accept: "application/json",
        "User-Agent": `funnel-sdk-ts/${SDK_VERSION}${options.userAgentSuffix ? ` ${options.userAgentSuffix}` : ""}`,
        ...(options.headers ?? {}),
      },
    });

    this.funnels = new FunnelsResource(this);
    this.leads = new LeadsResource(this);
    this.contacts = new ContactsResource(this);
    this.campaigns = new CampaignsResource(this);
    this.integrations = new IntegrationsResource(this);
    this.analytics = new AnalyticsResource(this);
    this.webhooks = new WebhooksResource(this);
    this.voiceCalls = new VoiceCallsResource(this);
    this.bookings = new BookingsResource(this);
  }

  /** Internal — used by resource classes. Exposed for advanced users. */
  async request<T>(method: string, path: string, opts: RequestOptions = {}): Promise<T> {
    const upperMethod = method.toUpperCase();
    const headers: Record<string, string> = { ...(opts.headers ?? {}) };
    if (MUTATING_METHODS.has(upperMethod)) {
      headers["Idempotency-Key"] = opts.idempotencyKey ?? newIdempotencyKey();
      if (opts.body !== undefined) headers["Content-Type"] = "application/json";
    }

    let attempt = 0;
    // First attempt + maxRetries retries.
    while (true) {
      try {
        return (await this.fetcher<T>(path, {
          method: upperMethod,
          query: opts.query,
          body: opts.body,
          headers,
          signal: opts.signal,
        })) as T;
      } catch (err) {
        const error = toFunnelError(err);
        const shouldRetry =
          attempt < this.maxRetries &&
          (error instanceof RateLimitError || (error.status >= 500 && error.status < 600));
        if (!shouldRetry) throw error;

        const sleepMs =
          error instanceof RateLimitError
            ? Math.min(error.retryAfterSec, 30) * 1000
            : Math.min(2 ** attempt * 250, 4_000) + Math.floor(Math.random() * 250);

        await new Promise((r) => setTimeout(r, sleepMs));
        attempt++;
      }
    }
  }
}

function toFunnelError(err: unknown) {
  if (err instanceof FetchError) {
    const status = err.response?.status ?? 0;
    const retryAfter = Number(err.response?.headers.get("retry-after") ?? "0") || undefined;
    return classifyError(status, err.data, retryAfter);
  }
  if (err instanceof Error && err.name === "AbortError") throw err;
  return classifyError(0, { error: { code: "network_error", type: "server_error", message: String(err) } });
}
