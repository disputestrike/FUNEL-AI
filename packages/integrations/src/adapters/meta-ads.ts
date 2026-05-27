/**
 * Meta Marketing API adapter (Facebook + Instagram).
 *
 * Capability: DIRECT
 * Auth: OAuth2 — scopes:
 *   ads_management, ads_read, business_management, pages_read_engagement,
 *   pages_manage_ads, leads_retrieval, instagram_basic, instagram_manage_insights
 * Endpoints:
 *   /act_{id}/campaigns, /act_{id}/adsets, /act_{id}/ads, /{ad_account}/insights
 *   /{form_id}/leads
 * Webhooks in:
 *   Lead Ads webhook (leadgen)
 *   Page webhooks (mention/comment/messages)
 *   Ad Account webhooks (account_review, delivery)
 * Rate: per-app + per-user BUC; 200 score/hr/ad-account.
 * Fallback: google-ads (cross-network rebalance).
 *
 * Webhook signature: SHA-256 HMAC of body with `appSecret`, sent as
 *   X-Hub-Signature-256: sha256=<hex>
 */

import crypto from "node:crypto";
import { BaseAdapter, type BaseAdapterConfig } from "../pal/base-adapter.js";
import { PermanentError, WebhookVerificationError } from "../pal/errors.js";
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

export const META_SCOPES = [
  "ads_management",
  "ads_read",
  "business_management",
  "pages_read_engagement",
  "pages_manage_ads",
  "leads_retrieval",
  "instagram_basic",
  "instagram_manage_insights",
] as const;

export interface MetaAdsConfig {
  /** Page-level access token (long-lived) or system-user token. */
  accessToken: string;
  appId: string;
  appSecret: string;
  /** Required to verify webhooks. */
  webhookVerifyToken: string;
  /** Meta-side ad account id (without `act_` prefix). */
  adAccountId: string;
  apiVersion?: string;
  baseURL?: string;
}

export class MetaAdsAdapter extends BaseAdapter {
  private readonly accessToken: string;
  private readonly appSecret: string;
  private readonly webhookVerifyToken: string;
  private readonly adAccountId: string;
  private readonly apiVersion: string;

  constructor(cfg: MetaAdsConfig) {
    const apiVersion = cfg.apiVersion ?? "v21.0";
    const baseCfg: BaseAdapterConfig = {
      providerKey: "meta-ads",
      version: "1.0.0",
      capabilityFlag: "DIRECT",
      supportedResources: ["campaign", "adset", "ad", "creative", "audience", "lead"],
      fallbackProviderKey: "google-ads",
      baseURL: `${cfg.baseURL ?? "https://graph.facebook.com"}/${apiVersion}`,
      headers: { "content-type": "application/json" },
      timeoutMs: 30_000,
    };
    super(baseCfg);
    this.accessToken = cfg.accessToken;
    this.appSecret = cfg.appSecret;
    this.webhookVerifyToken = cfg.webhookVerifyToken;
    this.adAccountId = cfg.adAccountId.replace(/^act_/, "");
    this.apiVersion = apiVersion;
  }

  async connect(workspaceId: WorkspaceId, oauthCallbackUrl: string): Promise<ConnectResult> {
    // Connect flow is driven by OAuthOrchestrator. We just describe the contract.
    const authorizeUrl = new URL("https://www.facebook.com/v21.0/dialog/oauth");
    authorizeUrl.searchParams.set("client_id", this.adAccountId || "PLACEHOLDER");
    authorizeUrl.searchParams.set("redirect_uri", oauthCallbackUrl);
    authorizeUrl.searchParams.set("scope", META_SCOPES.join(","));
    authorizeUrl.searchParams.set("state", `meta_${workspaceId}`);
    return {
      connectionId: `cn_meta_${workspaceId}`,
      externalAccountId: this.adAccountId,
      scopesGranted: [...META_SCOPES],
      refreshAvailable: false,
      authorizeUrl: authorizeUrl.toString(),
      oauthState: `meta_${workspaceId}`,
    };
  }

  async disconnect(_workspaceId: WorkspaceId): Promise<void> {
    await this.request({
      method: "DELETE",
      url: `/me/permissions`,
      params: { access_token: this.accessToken },
    }).catch(() => undefined);
  }

  async status(_workspaceId: WorkspaceId): Promise<StatusResult> {
    try {
      const me = await this.request<{ id: string }>({
        method: "GET",
        url: "/me",
        params: { access_token: this.accessToken, fields: "id,name" },
      });
      return {
        connected: !!me.id,
        scopesGranted: [...META_SCOPES],
        scopesMissing: [],
        degraded: false,
      };
    } catch (err) {
      return {
        connected: false,
        scopesGranted: [],
        scopesMissing: [...META_SCOPES],
        degraded: true,
        degradedReason: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // ---------------------------------------------------------------------------
  // CRUD
  // ---------------------------------------------------------------------------

  override async create<T = unknown>(
    resource: ResourceType,
    payload: unknown,
    opts: WriteOptions,
  ): Promise<T> {
    this.validateWrite(opts);
    if (opts.reviewGated) {
      return { stagedActionId: `staged_meta_${opts.idempotencyKey}`, reason: "review_gated" } as T;
    }
    const path = this.resourcePath(resource);
    return this.callWithRetry(
      () =>
        this.request<T>({
          method: "POST",
          url: path,
          params: { access_token: this.accessToken },
          data: { ...(payload as object), client_request_id: opts.idempotencyKey },
        }),
      `meta.create_${resource}`,
    );
  }

  override async read<T = unknown>(_resource: ResourceType, id: string): Promise<T> {
    return this.request<T>({
      method: "GET",
      url: `/${id}`,
      params: { access_token: this.accessToken, fields: "*" },
    });
  }

  override async update<T = unknown>(
    _resource: ResourceType,
    id: string,
    payload: unknown,
    opts: WriteOptions,
  ): Promise<T> {
    this.validateWrite(opts);
    return this.callWithRetry(
      () =>
        this.request<T>({
          method: "POST",
          url: `/${id}`,
          params: { access_token: this.accessToken },
          data: { ...(payload as object), client_request_id: opts.idempotencyKey },
        }),
      `meta.update_${id}`,
    );
  }

  override async delete(_resource: ResourceType, id: string, opts: WriteOptions): Promise<void> {
    this.validateWrite(opts);
    await this.request({
      method: "DELETE",
      url: `/${id}`,
      params: { access_token: this.accessToken },
    });
  }

  override async pause(_resource: ResourceType, id: string, opts: WriteOptions): Promise<void> {
    this.validateWrite(opts);
    await this.update("campaign", id, { status: "PAUSED" }, opts);
  }

  override async resume(_resource: ResourceType, id: string, opts: WriteOptions): Promise<void> {
    this.validateWrite(opts);
    await this.update("campaign", id, { status: "ACTIVE" }, opts);
  }

  override async list<T = unknown>(
    resource: ResourceType,
    filters: ListFilters,
  ): Promise<ListResult<T>> {
    const path = this.resourcePath(resource);
    const res = await this.request<{ data: T[]; paging?: { cursors?: { after?: string }; next?: string } }>({
      method: "GET",
      url: path,
      params: {
        access_token: this.accessToken,
        limit: filters.limit ?? 25,
        after: filters.cursor,
      },
    });
    return { items: res.data, nextCursor: res.paging?.cursors?.after };
  }

  // ---------------------------------------------------------------------------
  // Webhooks
  // ---------------------------------------------------------------------------

  override webhookVerify(headers: Record<string, string>, body: string | Buffer): boolean {
    // Initial verification handshake (GET) uses verify_token.
    if (headers["x-hub-verify-token"]) {
      return headers["x-hub-verify-token"] === this.webhookVerifyToken;
    }
    const sig =
      headers["x-hub-signature-256"] ??
      headers["X-Hub-Signature-256"] ??
      headers["x-hub-signature"] ??
      headers["X-Hub-Signature"];
    if (!sig) return false;
    const payload = typeof body === "string" ? body : body.toString("utf8");
    const algo = sig.startsWith("sha256=") ? "sha256" : "sha1";
    const expected = `${algo}=${crypto.createHmac(algo, this.appSecret).update(payload).digest("hex")}`;
    try {
      return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
    } catch {
      return false;
    }
  }

  override async webhookHandle(payload: unknown): Promise<WebhookEvent[]> {
    const p = payload as { entry?: Array<{ id: string; time: number; changes?: Array<{ field: string; value: unknown }>; messaging?: unknown }> };
    if (!p?.entry) throw new WebhookVerificationError(this.providerKey, "Missing entry[]");
    const out: WebhookEvent[] = [];
    for (const entry of p.entry) {
      const occurred = new Date(entry.time * 1000).toISOString();
      for (const change of entry.changes ?? []) {
        if (change.field === "leadgen") {
          const v = change.value as { leadgen_id: string; form_id: string; created_time: number };
          out.push({
            id: `meta_leadgen_${v.leadgen_id}`,
            type: "lead.captured",
            resource: "lead",
            resourceId: v.leadgen_id,
            occurredAt: new Date(v.created_time * 1000).toISOString(),
            payload: { formId: v.form_id, leadId: v.leadgen_id },
            raw: change,
          });
        } else if (change.field === "ad_account") {
          out.push({
            id: `meta_account_${entry.id}_${entry.time}`,
            type: `meta.${change.field}`,
            resource: "campaign",
            resourceId: entry.id,
            occurredAt: occurred,
            payload: change.value,
            raw: change,
          });
        }
      }
    }
    return out;
  }

  /** Retrieve a lead form submission by id. */
  async getLead(leadgenId: string): Promise<unknown> {
    return this.request({
      method: "GET",
      url: `/${leadgenId}`,
      params: { access_token: this.accessToken, fields: "field_data,created_time,ad_id,form_id" },
    });
  }

  // ---------------------------------------------------------------------------
  // Sync (polling fallback when webhooks are down).
  // ---------------------------------------------------------------------------

  override async sync(_workspaceId: WorkspaceId, since?: string): Promise<{ events: WebhookEvent[]; nextSince: string }> {
    const sinceTs = since ? Math.floor(new Date(since).getTime() / 1000) : 0;
    // Cheap: fetch insights deltas, leads inflow.
    const insights = await this.request<{ data: Array<{ ad_id: string; date_start: string; impressions: string; spend: string }> }>({
      method: "GET",
      url: `/act_${this.adAccountId}/insights`,
      params: {
        access_token: this.accessToken,
        level: "ad",
        date_preset: "yesterday",
        fields: "ad_id,impressions,spend,clicks",
      },
    }).catch(() => ({ data: [] }));
    const events: WebhookEvent[] = insights.data.map((r) => ({
      id: `meta_insights_${r.ad_id}_${r.date_start}`,
      type: "ad.insights.daily",
      resource: "ad",
      resourceId: r.ad_id,
      occurredAt: r.date_start,
      payload: r,
    }));
    return { events, nextSince: new Date().toISOString() };
  }

  private resourcePath(resource: ResourceType): string {
    switch (resource) {
      case "campaign":
        return `/act_${this.adAccountId}/campaigns`;
      case "adset":
        return `/act_${this.adAccountId}/adsets`;
      case "ad":
        return `/act_${this.adAccountId}/ads`;
      case "creative":
        return `/act_${this.adAccountId}/adcreatives`;
      case "audience":
        return `/act_${this.adAccountId}/customaudiences`;
      case "lead":
        return `/act_${this.adAccountId}/leadgen_forms`;
      default:
        throw new PermanentError(this.providerKey, "unsupported_resource", `meta unsupported ${resource}`);
    }
  }

  limits(): ProviderLimits {
    return {
      rateLimit: { requestsPerHour: 200, bucket: "BUC" },
      dailyQuota: { calls: 4_800 },
      monthlyCost: { estimatedUSD: 0 },
    };
  }
}

export const metaAdsFactory = (config?: Record<string, unknown>) =>
  new MetaAdsAdapter({
    accessToken: (config?.accessToken as string) ?? process.env.META_ACCESS_TOKEN ?? "",
    appId: (config?.appId as string) ?? process.env.META_APP_ID ?? "",
    appSecret: (config?.appSecret as string) ?? process.env.META_APP_SECRET ?? "",
    webhookVerifyToken: (config?.webhookVerifyToken as string) ?? process.env.META_WEBHOOK_VERIFY_TOKEN ?? "",
    adAccountId: (config?.adAccountId as string) ?? process.env.META_AD_ACCOUNT_ID ?? "",
    apiVersion: config?.apiVersion as string,
  });
