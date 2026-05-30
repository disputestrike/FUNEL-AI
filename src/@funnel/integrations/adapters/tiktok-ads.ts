/**
 * TikTok Business API adapter — campaign/adgroup/ad CRUD + reporting + lead.
 *
 * Capability: DIRECT
 * Auth: OAuth2 — Ad Account Management, Audience Management, Reporting,
 *       Lead Generation
 * Endpoints:
 *   /open_api/v1.3/campaign/create/
 *   /open_api/v1.3/adgroup/create/
 *   /open_api/v1.3/ad/create/
 *   /open_api/v1.3/report/integrated/get/
 *   /open_api/v1.3/lead/list/
 * Webhooks: Lead webhook, Auth-status webhook.
 * Rate: 10 QPS/advertiser; 1200 req/min app-wide.
 * Fallback: meta-ads (Reels overlap).
 */

import crypto from "node:crypto";
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
  WriteOptions,
} from "../pal/types.js";

export const TIKTOK_SCOPES = [
  "Ad Account Management",
  "Audience Management",
  "Reporting",
  "Lead Generation",
] as const;

export interface TikTokAdsConfig {
  accessToken: string;
  advertiserId: string;
  appId: string;
  appSecret: string;
  baseURL?: string;
  /** App-secret-signed webhook tokens. */
  webhookSecret?: string;
}

export class TikTokAdsAdapter extends BaseAdapter {
  private readonly accessToken: string;
  private readonly advertiserId: string;
  private readonly webhookSecret?: string;

  constructor(cfg: TikTokAdsConfig) {
    const baseCfg: BaseAdapterConfig = {
      providerKey: "tiktok-ads",
      version: "1.0.0",
      capabilityFlag: "DIRECT",
      supportedResources: ["campaign", "adset", "ad", "audience", "creative", "lead"],
      fallbackProviderKey: "meta-ads",
      baseURL: cfg.baseURL ?? "https://business-api.tiktok.com",
      headers: { "Access-Token": cfg.accessToken, "content-type": "application/json" },
      timeoutMs: 30_000,
    };
    super(baseCfg);
    this.accessToken = cfg.accessToken;
    this.advertiserId = cfg.advertiserId;
    this.webhookSecret = cfg.webhookSecret;
  }

  async connect(workspaceId: string, oauthCallbackUrl: string): Promise<ConnectResult> {
    const authorizeUrl = new URL("https://business-api.tiktok.com/portal/auth");
    authorizeUrl.searchParams.set("app_id", "PLACEHOLDER");
    authorizeUrl.searchParams.set("redirect_uri", oauthCallbackUrl);
    authorizeUrl.searchParams.set("state", `tt_${workspaceId}`);
    return {
      connectionId: `cn_tiktok_${workspaceId}`,
      externalAccountId: this.advertiserId,
      scopesGranted: [...TIKTOK_SCOPES],
      refreshAvailable: false,
      authorizeUrl: authorizeUrl.toString(),
      oauthState: `tt_${workspaceId}`,
    };
  }
  async disconnect(): Promise<void> {}
  async status(): Promise<StatusResult> {
    const h = await this.healthCheck();
    return { connected: !!this.accessToken, scopesGranted: [...TIKTOK_SCOPES], scopesMissing: [], degraded: !h.ok };
  }

  override async create<T = unknown>(
    resource: ResourceType,
    payload: unknown,
    opts: WriteOptions,
  ): Promise<T> {
    this.validateWrite(opts);
    if (opts.reviewGated) {
      return { stagedActionId: `staged_tiktok_${opts.idempotencyKey}`, reason: "review_gated" } as T;
    }
    const path = this.pathForResource(resource, "create");
    return this.callWithRetry(
      () =>
        this.request<T>({
          method: "POST",
          url: path,
          headers: { "Idempotency-Key": opts.idempotencyKey },
          data: { advertiser_id: this.advertiserId, ...(payload as object) },
        }),
      `tiktok.create_${resource}`,
    );
  }

  override async read<T = unknown>(resource: ResourceType, id: string): Promise<T> {
    const path = this.pathForResource(resource, "get");
    return this.request<T>({
      method: "GET",
      url: path,
      params: { advertiser_id: this.advertiserId, [this.idKeyFor(resource)]: id },
    });
  }

  override async update<T = unknown>(
    resource: ResourceType,
    id: string,
    payload: unknown,
    opts: WriteOptions,
  ): Promise<T> {
    this.validateWrite(opts);
    const path = this.pathForResource(resource, "update");
    return this.callWithRetry(
      () =>
        this.request<T>({
          method: "POST",
          url: path,
          headers: { "Idempotency-Key": opts.idempotencyKey },
          data: {
            advertiser_id: this.advertiserId,
            [this.idKeyFor(resource)]: id,
            ...(payload as object),
          },
        }),
      `tiktok.update_${resource}`,
    );
  }

  override async delete(resource: ResourceType, id: string, opts: WriteOptions): Promise<void> {
    this.validateWrite(opts);
    const path = this.pathForResource(resource, "delete");
    await this.callWithRetry(
      () =>
        this.request({
          method: "POST",
          url: path,
          data: { advertiser_id: this.advertiserId, [this.idKeyFor(resource)]: id },
        }),
      `tiktok.delete_${resource}`,
    );
  }

  override async pause(resource: ResourceType, id: string, opts: WriteOptions): Promise<void> {
    await this.update(resource, id, { operation_status: "DISABLE" }, opts);
  }
  override async resume(resource: ResourceType, id: string, opts: WriteOptions): Promise<void> {
    await this.update(resource, id, { operation_status: "ENABLE" }, opts);
  }

  override async list<T = unknown>(
    resource: ResourceType,
    filters: ListFilters,
  ): Promise<ListResult<T>> {
    const path = this.pathForResource(resource, "get");
    const res = await this.request<{ data: { list: T[]; page_info?: { has_more: boolean; cursor?: string } } }>({
      method: "GET",
      url: path,
      params: {
        advertiser_id: this.advertiserId,
        page_size: filters.limit ?? 50,
        cursor: filters.cursor,
      },
    });
    return { items: res.data.list, nextCursor: res.data.page_info?.has_more ? res.data.page_info.cursor : undefined };
  }

  override webhookVerify(headers: Record<string, string>, body: string | Buffer): boolean {
    if (!this.webhookSecret) return false;
    const sig = headers["x-tt-signature"] ?? headers["X-TT-Signature"];
    const ts = headers["x-tt-timestamp"] ?? headers["X-TT-Timestamp"];
    if (!sig || !ts) return false;
    const payload = typeof body === "string" ? body : body.toString("utf8");
    const expected = crypto
      .createHmac("sha256", this.webhookSecret)
      .update(`${ts}${payload}`)
      .digest("hex");
    try {
      return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
    } catch {
      return false;
    }
  }

  override async webhookHandle(payload: unknown): Promise<WebhookEvent[]> {
    const p = payload as {
      event?: string;
      timestamp?: number;
      data?: { lead_id?: string; advertiser_id?: string; status?: string; campaign_id?: string };
    };
    if (!p?.event) return [];
    const ts = new Date((p.timestamp ?? Date.now() / 1000) * 1000).toISOString();
    if (p.event === "lead_create") {
      return [
        {
          id: `tiktok_lead_${p.data?.lead_id}`,
          type: "lead.captured",
          resource: "lead",
          resourceId: p.data?.lead_id,
          occurredAt: ts,
          payload: p.data,
          raw: payload,
        },
      ];
    }
    return [
      {
        id: `tiktok_${p.event}_${p.timestamp}`,
        type: `tiktok.${p.event}`,
        resource: "campaign",
        resourceId: p.data?.campaign_id,
        occurredAt: ts,
        payload: p.data,
        raw: payload,
      },
    ];
  }

  limits(): ProviderLimits {
    return {
      rateLimit: { requestsPerSecond: 10, requestsPerMinute: 1_200 },
      monthlyCost: { estimatedUSD: 0 },
    };
  }

  private pathForResource(resource: ResourceType, action: "create" | "update" | "delete" | "get"): string {
    const map: Record<string, string> = {
      campaign: "campaign",
      adset: "adgroup",
      ad: "ad",
      creative: "creative",
      audience: "dmp/custom_audience",
      lead: "lead",
    };
    const r = map[resource];
    if (!r) throw new PermanentError(this.providerKey, "unsupported_resource", `tiktok unsupported ${resource}`);
    return `/open_api/v1.3/${r}/${action}/`;
  }

  private idKeyFor(resource: ResourceType): string {
    if (resource === "adset") return "adgroup_id";
    return `${resource}_id`;
  }
}

export const tiktokAdsFactory = (config?: Record<string, unknown>) =>
  new TikTokAdsAdapter({
    accessToken: (config?.accessToken as string) ?? process.env.TIKTOK_ACCESS_TOKEN ?? "",
    advertiserId: (config?.advertiserId as string) ?? process.env.TIKTOK_ADVERTISER_ID ?? "",
    appId: (config?.appId as string) ?? process.env.TIKTOK_APP_ID ?? "",
    appSecret: (config?.appSecret as string) ?? process.env.TIKTOK_APP_SECRET ?? "",
    webhookSecret: (config?.webhookSecret as string) ?? process.env.TIKTOK_WEBHOOK_SECRET,
    baseURL: config?.baseURL as string,
  });
