/**
 * PAL contract — every adapter implements this exact shape.
 * Source of truth: docs/04-integration-matrix-and-pal.md §A.2.
 *
 * Channel-agnostic by design: the orchestrator says
 * `adapter.create("campaign", payload, opts)` — the adapter maps to the
 * underlying provider's REST/SDK call.
 */

export type WorkspaceId = string;

export type ResourceType =
  | "campaign"
  | "adset"
  | "ad"
  | "creative"
  | "post"
  | "comment"
  | "message"
  | "call"
  | "sms"
  | "subscription"
  | "invoice"
  | "customer"
  | "payment_method"
  | "email"
  | "contact"
  | "list"
  | "event"
  | "booking"
  | "lead"
  | "audience"
  | "completion"
  | "image"
  | "video"
  | "voice"
  | "lookup"
  | "enrichment"
  | "tax_validation"
  | "dnc_check";

/** Three-state capability flag from doc 04 §A. */
export type CapabilityFlag = "DIRECT" | "REVIEW-GATED" | "BRIDGED";

export interface ConnectResult {
  connectionId: string;
  externalAccountId: string;
  scopesGranted: string[];
  expiresAt?: string;
  refreshAvailable: boolean;
  /** OAuth state value the caller must store and check on callback. */
  oauthState?: string;
  /** Authorize URL the user is redirected to. Absent for API-key providers. */
  authorizeUrl?: string;
}

export interface StatusResult {
  connected: boolean;
  scopesGranted: string[];
  scopesMissing: string[];
  expiresAt?: string;
  lastSyncAt?: string;
  lastWebhookAt?: string;
  degraded: boolean;
  degradedReason?: string;
}

export interface WriteOptions {
  /** Required on every state-changing call. Adapter must dedupe on this. */
  idempotencyKey: string;
  /** When true, adapter MUST stage the action, not execute. Returns a stub with a `stagedActionId`. */
  reviewGated?: boolean;
  /** Validate only. */
  dryRun?: boolean;
  /** Tracing / observability propagation. */
  traceId?: string;
  /** Optional workspace scope for adapters that aren't strictly workspace-scoped at the contract level. */
  workspaceId?: WorkspaceId;
}

export interface ListFilters {
  cursor?: string;
  limit?: number;
  since?: string;
  until?: string;
  status?: string;
  q?: string;
  /** Free-form provider-specific filter keys. */
  extra?: Record<string, unknown>;
}

export interface ListResult<T = unknown> {
  items: T[];
  nextCursor?: string;
  total?: number;
}

/**
 * The canonical event a webhook (or polling sync) emits into our internal bus.
 * One row in the `webhook_events` table per `id`.
 */
export interface WebhookEvent {
  /** Stable adapter-assigned id. Must round-trip through `replay()`. */
  id: string;
  type: string;
  resource: ResourceType;
  resourceId?: string;
  occurredAt: string;
  payload: unknown;
  /** Original provider body kept for 30d in R2 for replay + audit. */
  raw?: unknown;
}

/** Alias used by callers that want the broader "ProviderEvent" name. */
export type ProviderEvent = WebhookEvent;

export interface ProviderLimits {
  rateLimit: {
    requestsPerSecond?: number;
    requestsPerMinute?: number;
    requestsPerHour?: number;
    requestsPerDay?: number;
    burstBucket?: number;
    /** Provider-specific bucket name when relevant (Meta BUC, Google ops/day, etc.). */
    bucket?: string;
  };
  dailyQuota?: {
    calls?: number;
    tokens?: number;
    cost?: number;
  };
  monthlyCost?: {
    estimatedUSD: number;
    capUSD?: number;
  };
}

export interface HealthCheckResult {
  ok: boolean;
  latencyMs: number;
  checkedAt: string;
  upstream?: "up" | "degraded" | "down";
  notes?: string;
}

export interface StagedAction {
  /** Compound id, e.g. `staged_<adapter>_<idempotencyKey>`. */
  stagedActionId: string;
  adapter: string;
  resource: ResourceType;
  payload: unknown;
  reason: "review_gated" | "regulatory" | "policy";
  createdAt: string;
}

/**
 * The interface every adapter implements. No provider-specific public methods —
 * orchestrator + retry + observability are coded once against this shape.
 */
export interface ProviderAdapter {
  readonly providerKey: string;
  readonly version: string;
  readonly supportedResources: ResourceType[];
  readonly capabilityFlag: CapabilityFlag;
  /** Provider this adapter falls back to on outage. Empty for terminal providers. */
  readonly fallbackProviderKey?: string;

  // --- Lifecycle ---
  connect(workspaceId: WorkspaceId, oauthCallbackUrl: string): Promise<ConnectResult>;
  disconnect(workspaceId: WorkspaceId): Promise<void>;
  status(workspaceId: WorkspaceId): Promise<StatusResult>;

  // --- CRUD + lifecycle ---
  create<T = unknown>(resource: ResourceType, payload: unknown, opts: WriteOptions): Promise<T>;
  read<T = unknown>(resource: ResourceType, id: string): Promise<T>;
  update<T = unknown>(
    resource: ResourceType,
    id: string,
    payload: unknown,
    opts: WriteOptions,
  ): Promise<T>;
  delete(resource: ResourceType, id: string, opts: WriteOptions): Promise<void>;
  pause(resource: ResourceType, id: string, opts: WriteOptions): Promise<void>;
  resume(resource: ResourceType, id: string, opts: WriteOptions): Promise<void>;
  list<T = unknown>(resource: ResourceType, filters: ListFilters): Promise<ListResult<T>>;

  // --- Sync & webhooks ---
  sync(
    workspaceId: WorkspaceId,
    since?: string,
  ): Promise<{ events: WebhookEvent[]; nextSince: string }>;
  webhookVerify(headers: Record<string, string>, body: string | Buffer): boolean;
  webhookHandle(verifiedPayload: unknown): Promise<WebhookEvent[]>;
  replay(webhookEventId: string): Promise<WebhookEvent[]>;

  // --- Ops ---
  limits(): ProviderLimits;
  healthCheck(): Promise<HealthCheckResult>;
}

/** Factory signature kept narrow so the registry can store them homogeneously. */
export type AdapterFactory<T extends ProviderAdapter = ProviderAdapter> = (
  config?: Record<string, unknown>,
) => T;
