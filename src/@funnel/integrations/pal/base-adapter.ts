/**
 * Default `ProviderAdapter` skeleton. Concrete adapters extend this and
 * override the methods that matter for their provider; everything else
 * throws `NotImplementedError` so the contract is still satisfied without
 * provider-specific public methods leaking.
 */

import axios, { type AxiosInstance, type AxiosRequestConfig, AxiosError } from "axios";
import {
  NotImplementedError,
  WebhookVerificationError,
  classifyHttpError,
} from "./errors.js";
import { withRetry, type RetryOptions } from "./retry.js";
import type {
  CapabilityFlag,
  ConnectResult,
  HealthCheckResult,
  ListFilters,
  ListResult,
  ProviderAdapter,
  ProviderLimits,
  ResourceType,
  StatusResult,
  WebhookEvent,
  WorkspaceId,
  WriteOptions,
} from "./types.js";
import { assertWriteOptions } from "./write-options.js";

export interface BaseAdapterConfig {
  /** Concrete subclass tells the base what its providerKey is. */
  providerKey: string;
  version: string;
  capabilityFlag: CapabilityFlag;
  supportedResources: ResourceType[];
  fallbackProviderKey?: string;
  /** HTTP base URL for the underlying provider. */
  baseURL?: string;
  /** Default headers (auth, app-id, version, etc.). */
  headers?: Record<string, string>;
  /** Default timeout in ms. */
  timeoutMs?: number;
}

/**
 * Thin axios wrapper that maps provider HTTP errors to typed PAL errors.
 * Adapters either call `this.http.request(...)` directly or use
 * `this.callWithRetry(...)` for write paths.
 */
export abstract class BaseAdapter implements ProviderAdapter {
  public readonly providerKey: string;
  public readonly version: string;
  public readonly capabilityFlag: CapabilityFlag;
  public readonly supportedResources: ResourceType[];
  public readonly fallbackProviderKey?: string;

  protected readonly http: AxiosInstance;

  constructor(cfg: BaseAdapterConfig) {
    this.providerKey = cfg.providerKey;
    this.version = cfg.version;
    this.capabilityFlag = cfg.capabilityFlag;
    this.supportedResources = cfg.supportedResources;
    this.fallbackProviderKey = cfg.fallbackProviderKey;
    this.http = axios.create({
      baseURL: cfg.baseURL,
      headers: cfg.headers,
      timeout: cfg.timeoutMs ?? 30_000,
      // Don't throw on 4xx — we want to inspect the body to classify the error.
      validateStatus: () => true,
    });
  }

  // --------------------------------------------------------------------------
  // Lifecycle — concrete adapters override these. Base impl is fail-fast.
  // --------------------------------------------------------------------------

  abstract connect(workspaceId: WorkspaceId, oauthCallbackUrl: string): Promise<ConnectResult>;
  abstract disconnect(workspaceId: WorkspaceId): Promise<void>;
  abstract status(workspaceId: WorkspaceId): Promise<StatusResult>;

  // --------------------------------------------------------------------------
  // CRUD defaults — adapters override the resources they handle.
  // --------------------------------------------------------------------------

  async create<T = unknown>(
    _resource: ResourceType,
    _payload: unknown,
    _opts: WriteOptions,
  ): Promise<T> {
    throw new NotImplementedError(this.providerKey, "create");
  }
  async read<T = unknown>(_resource: ResourceType, _id: string): Promise<T> {
    throw new NotImplementedError(this.providerKey, "read");
  }
  async update<T = unknown>(
    _resource: ResourceType,
    _id: string,
    _payload: unknown,
    _opts: WriteOptions,
  ): Promise<T> {
    throw new NotImplementedError(this.providerKey, "update");
  }
  async delete(_resource: ResourceType, _id: string, _opts: WriteOptions): Promise<void> {
    throw new NotImplementedError(this.providerKey, "delete");
  }
  async pause(_resource: ResourceType, _id: string, _opts: WriteOptions): Promise<void> {
    throw new NotImplementedError(this.providerKey, "pause");
  }
  async resume(_resource: ResourceType, _id: string, _opts: WriteOptions): Promise<void> {
    throw new NotImplementedError(this.providerKey, "resume");
  }
  async list<T = unknown>(_resource: ResourceType, _filters: ListFilters): Promise<ListResult<T>> {
    throw new NotImplementedError(this.providerKey, "list");
  }

  // --------------------------------------------------------------------------
  // Sync & webhooks — most adapters override.
  // --------------------------------------------------------------------------

  async sync(
    _workspaceId: WorkspaceId,
    since?: string,
  ): Promise<{ events: WebhookEvent[]; nextSince: string }> {
    return { events: [], nextSince: since ?? new Date().toISOString() };
  }
  webhookVerify(_headers: Record<string, string>, _body: string | Buffer): boolean {
    // Subclasses must override unless the provider literally has no webhooks.
    return false;
  }
  async webhookHandle(_verified: unknown): Promise<WebhookEvent[]> {
    throw new NotImplementedError(this.providerKey, "webhookHandle");
  }
  async replay(_webhookEventId: string): Promise<WebhookEvent[]> {
    // Default no-op (override when provider has a fetch-by-id endpoint).
    return [];
  }

  // --------------------------------------------------------------------------
  // Ops
  // --------------------------------------------------------------------------

  abstract limits(): ProviderLimits;

  async healthCheck(): Promise<HealthCheckResult> {
    const started = Date.now();
    try {
      // Cheap GET on whatever the subclass treats as "ping".
      await this.ping();
      return {
        ok: true,
        latencyMs: Date.now() - started,
        checkedAt: new Date().toISOString(),
        upstream: "up",
      };
    } catch (err) {
      return {
        ok: false,
        latencyMs: Date.now() - started,
        checkedAt: new Date().toISOString(),
        upstream: "down",
        notes: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /** Override for a provider-specific ping path. */
  protected async ping(): Promise<void> {
    if (!this.http.defaults.baseURL) return;
    const res = await this.http.get("/");
    if (res.status >= 500) {
      throw classifyHttpError(this.providerKey, res.status, res.data);
    }
  }

  // --------------------------------------------------------------------------
  // Internal helpers used by subclasses.
  // --------------------------------------------------------------------------

  /** Perform an HTTP call mapped to typed PAL errors. */
  protected async request<T = unknown>(cfg: AxiosRequestConfig): Promise<T> {
    try {
      const res = await this.http.request<T>(cfg);
      if (res.status >= 200 && res.status < 300) return res.data;
      throw classifyHttpError(
        this.providerKey,
        res.status,
        res.data,
        (res.headers["retry-after"] as string | undefined) ?? null,
      );
    } catch (err) {
      if (err instanceof AxiosError) {
        const status = err.response?.status ?? 0;
        if (status === 0) {
          // Network error — transient.
          throw classifyHttpError(this.providerKey, 503, { message: err.message });
        }
        throw classifyHttpError(
          this.providerKey,
          status,
          err.response?.data,
          err.response?.headers["retry-after"],
        );
      }
      throw err;
    }
  }

  /** Run an HTTP call with retry semantics. */
  protected async callWithRetry<T>(
    fn: () => Promise<T>,
    op: string,
    extras: Partial<RetryOptions> = {},
  ): Promise<T> {
    return withRetry(fn, { op, providerKey: this.providerKey, ...extras });
  }

  /** Validate WriteOptions in one place. */
  protected validateWrite(opts: WriteOptions): WriteOptions {
    return assertWriteOptions(this.providerKey, opts);
  }

  /** Helper for adapters that need to force a webhook-verify exception. */
  protected raiseVerifyFailure(reason = "Signature mismatch"): never {
    throw new WebhookVerificationError(this.providerKey, reason);
  }
}
