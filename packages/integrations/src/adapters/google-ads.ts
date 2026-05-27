/**
 * Google Ads API adapter — Search + PMax + Demand Gen + Conversion upload.
 *
 * Capability: DIRECT
 * Auth: OAuth2 (scope `https://www.googleapis.com/auth/adwords`) + developer
 *       token + login-customer-id (manager).
 * Endpoints:
 *   customers:searchStream
 *   customers/{id}/campaigns:mutate
 *   customers/{id}/googleAds:search
 *   customers/{id}/conversionActions:mutate
 *   customers/{id}/customers:uploadClickConversions
 * Rate: 15k ops/day Basic; 40 QPS Standard.
 * Webhooks: none (polling on reports).
 * Fallback: meta-ads.
 */

import { BaseAdapter, type BaseAdapterConfig } from "../pal/base-adapter.js";
import { PermanentError } from "../pal/errors.js";
import type {
  ConnectResult,
  ListFilters,
  ListResult,
  ProviderLimits,
  ResourceType,
  StatusResult,
  WebhookEvent,
  WorkspaceId,
  WriteOptions,
} from "../pal/types.js";

export const GOOGLE_ADS_SCOPES = ["https://www.googleapis.com/auth/adwords"] as const;

export interface GoogleAdsConfig {
  accessToken: string;
  developerToken: string;
  /** Manager account if present. */
  loginCustomerId?: string;
  /** Customer (account) the operations target. */
  customerId: string;
  apiVersion?: string;
  baseURL?: string;
}

export class GoogleAdsAdapter extends BaseAdapter {
  private readonly accessToken: string;
  private readonly developerToken: string;
  private readonly loginCustomerId?: string;
  private readonly customerId: string;
  private readonly apiVersion: string;

  constructor(cfg: GoogleAdsConfig) {
    const apiVersion = cfg.apiVersion ?? "v17";
    const baseCfg: BaseAdapterConfig = {
      providerKey: "google-ads",
      version: "1.0.0",
      capabilityFlag: "DIRECT",
      supportedResources: ["campaign", "adset", "ad", "audience", "creative"],
      fallbackProviderKey: "meta-ads",
      baseURL: `${cfg.baseURL ?? "https://googleads.googleapis.com"}/${apiVersion}`,
      headers: {
        Authorization: `Bearer ${cfg.accessToken}`,
        "developer-token": cfg.developerToken,
        ...(cfg.loginCustomerId ? { "login-customer-id": cfg.loginCustomerId } : {}),
        "content-type": "application/json",
      },
      timeoutMs: 60_000,
    };
    super(baseCfg);
    this.accessToken = cfg.accessToken;
    this.developerToken = cfg.developerToken;
    this.loginCustomerId = cfg.loginCustomerId;
    this.customerId = cfg.customerId.replace(/-/g, "");
    this.apiVersion = apiVersion;
  }

  async connect(workspaceId: WorkspaceId, oauthCallbackUrl: string): Promise<ConnectResult> {
    const authorizeUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authorizeUrl.searchParams.set("scope", GOOGLE_ADS_SCOPES.join(" "));
    authorizeUrl.searchParams.set("access_type", "offline");
    authorizeUrl.searchParams.set("prompt", "consent");
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("redirect_uri", oauthCallbackUrl);
    authorizeUrl.searchParams.set("state", `gads_${workspaceId}`);
    return {
      connectionId: `cn_google_ads_${workspaceId}`,
      externalAccountId: this.customerId,
      scopesGranted: [...GOOGLE_ADS_SCOPES],
      refreshAvailable: true,
      authorizeUrl: authorizeUrl.toString(),
      oauthState: `gads_${workspaceId}`,
    };
  }
  async disconnect(): Promise<void> {}
  async status(): Promise<StatusResult> {
    const h = await this.healthCheck();
    return {
      connected: h.ok,
      scopesGranted: [...GOOGLE_ADS_SCOPES],
      scopesMissing: h.ok ? [] : [...GOOGLE_ADS_SCOPES],
      degraded: !h.ok,
      degradedReason: h.notes,
    };
  }

  // ---------------------------------------------------------------------------
  // CRUD via mutate. Each call wraps a single operation in an `operations[]`.
  // ---------------------------------------------------------------------------

  override async create<T = unknown>(
    resource: ResourceType,
    payload: unknown,
    opts: WriteOptions,
  ): Promise<T> {
    this.validateWrite(opts);
    if (opts.reviewGated) {
      return { stagedActionId: `staged_google_ads_${opts.idempotencyKey}`, reason: "review_gated" } as T;
    }
    const service = this.serviceForResource(resource);
    return this.callWithRetry(
      () =>
        this.request<T>({
          method: "POST",
          url: `/customers/${this.customerId}/${service}:mutate`,
          headers: { "x-goog-request-id": opts.idempotencyKey },
          data: {
            operations: [{ create: payload }],
            partialFailure: false,
            validateOnly: opts.dryRun ?? false,
          },
        }),
      `google_ads.create_${resource}`,
    );
  }

  override async read<T = unknown>(resource: ResourceType, id: string): Promise<T> {
    const gaql = this.gaqlForResource(resource, id);
    const res = await this.request<{ results: T[] }>({
      method: "POST",
      url: `/customers/${this.customerId}/googleAds:search`,
      data: { query: gaql, pageSize: 1 },
    });
    if (!res.results?.length) {
      throw new PermanentError(this.providerKey, "not_found", `${resource} ${id} not found`, 404);
    }
    return res.results[0]!;
  }

  override async update<T = unknown>(
    resource: ResourceType,
    id: string,
    payload: unknown,
    opts: WriteOptions,
  ): Promise<T> {
    this.validateWrite(opts);
    const service = this.serviceForResource(resource);
    return this.callWithRetry(
      () =>
        this.request<T>({
          method: "POST",
          url: `/customers/${this.customerId}/${service}:mutate`,
          headers: { "x-goog-request-id": opts.idempotencyKey },
          data: {
            operations: [
              {
                update: { resourceName: `customers/${this.customerId}/${service}/${id}`, ...(payload as object) },
                updateMask: Object.keys(payload as object).join(","),
              },
            ],
            partialFailure: false,
            validateOnly: opts.dryRun ?? false,
          },
        }),
      `google_ads.update_${resource}`,
    );
  }

  override async delete(resource: ResourceType, id: string, opts: WriteOptions): Promise<void> {
    this.validateWrite(opts);
    const service = this.serviceForResource(resource);
    await this.callWithRetry(
      () =>
        this.request({
          method: "POST",
          url: `/customers/${this.customerId}/${service}:mutate`,
          headers: { "x-goog-request-id": opts.idempotencyKey },
          data: {
            operations: [{ remove: `customers/${this.customerId}/${service}/${id}` }],
          },
        }),
      `google_ads.delete_${resource}`,
    );
  }

  override async pause(resource: ResourceType, id: string, opts: WriteOptions): Promise<void> {
    await this.update(resource, id, { status: "PAUSED" }, opts);
  }
  override async resume(resource: ResourceType, id: string, opts: WriteOptions): Promise<void> {
    await this.update(resource, id, { status: "ENABLED" }, opts);
  }

  override async list<T = unknown>(
    resource: ResourceType,
    filters: ListFilters,
  ): Promise<ListResult<T>> {
    const tableName = this.tableForResource(resource);
    const gaql = `SELECT ${tableName}.id, ${tableName}.name, ${tableName}.status FROM ${tableName} LIMIT ${filters.limit ?? 100}`;
    const res = await this.request<{ results: T[]; nextPageToken?: string }>({
      method: "POST",
      url: `/customers/${this.customerId}/googleAds:search`,
      data: { query: gaql, pageToken: filters.cursor },
    });
    return { items: res.results ?? [], nextCursor: res.nextPageToken };
  }

  /** Conversion upload — used by the orchestrator after a closed-won. */
  async uploadClickConversions(
    conversions: Array<{
      gclid: string;
      conversionActionId: string;
      conversionDateTime: string;
      conversionValue: number;
      currencyCode: string;
      orderId?: string;
    }>,
    opts: WriteOptions,
  ): Promise<unknown> {
    this.validateWrite(opts);
    return this.callWithRetry(
      () =>
        this.request({
          method: "POST",
          url: `/customers/${this.customerId}:uploadClickConversions`,
          headers: { "x-goog-request-id": opts.idempotencyKey },
          data: {
            conversions: conversions.map((c) => ({
              gclid: c.gclid,
              conversionAction: `customers/${this.customerId}/conversionActions/${c.conversionActionId}`,
              conversionDateTime: c.conversionDateTime,
              conversionValue: c.conversionValue,
              currencyCode: c.currencyCode,
              orderId: c.orderId,
            })),
            partialFailure: false,
            validateOnly: opts.dryRun ?? false,
          },
        }),
      "google_ads.upload_conversions",
    );
  }

  // No webhooks.
  override webhookVerify(): boolean {
    return false;
  }
  override async webhookHandle(): Promise<WebhookEvent[]> {
    return [];
  }

  limits(): ProviderLimits {
    return {
      rateLimit: { requestsPerSecond: 40, requestsPerDay: 15_000, bucket: "ops" },
      monthlyCost: { estimatedUSD: 0 },
    };
  }

  private serviceForResource(resource: ResourceType): string {
    switch (resource) {
      case "campaign":
        return "campaigns";
      case "adset":
        return "adGroups";
      case "ad":
        return "adGroupAds";
      case "audience":
        return "userLists";
      case "creative":
        return "assets";
      default:
        throw new PermanentError(this.providerKey, "unsupported_resource", `google_ads unsupported ${resource}`);
    }
  }

  private tableForResource(resource: ResourceType): string {
    switch (resource) {
      case "campaign":
        return "campaign";
      case "adset":
        return "ad_group";
      case "ad":
        return "ad_group_ad";
      case "audience":
        return "user_list";
      default:
        return "campaign";
    }
  }

  private gaqlForResource(resource: ResourceType, id: string): string {
    const t = this.tableForResource(resource);
    return `SELECT ${t}.id, ${t}.name, ${t}.status FROM ${t} WHERE ${t}.id = ${id}`;
  }
}

export const googleAdsFactory = (config?: Record<string, unknown>) =>
  new GoogleAdsAdapter({
    accessToken: (config?.accessToken as string) ?? process.env.GOOGLE_ADS_ACCESS_TOKEN ?? "",
    developerToken: (config?.developerToken as string) ?? process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? "",
    loginCustomerId: (config?.loginCustomerId as string) ?? process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID,
    customerId: (config?.customerId as string) ?? process.env.GOOGLE_ADS_CUSTOMER_ID ?? "",
    apiVersion: config?.apiVersion as string,
  });
