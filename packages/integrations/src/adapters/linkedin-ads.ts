/**
 * LinkedIn Marketing API adapter — Sponsored Content + Lead Gen Forms.
 *
 * Capability: DIRECT (gated on LinkedIn Marketing Developer Platform review).
 * Auth: OAuth2 3-legged — r_ads, rw_ads, r_ads_reporting,
 *       r_organization_social, w_organization_social,
 *       r_marketing_leadgen_automation
 * Endpoints (REST API, header `X-Restli-Protocol-Version: 2.0.0`):
 *   /rest/adAccounts/{id}/adCampaigns
 *   /rest/adAccounts/{id}/adCampaignGroups
 *   /rest/leadFormResponses
 *   /rest/adAnalytics
 * Webhooks: Lead Sync webhook (when allowlisted).
 * Rate: 100 req/sec/app; 500k/day.
 * Fallback: manual CSV export.
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

export const LINKEDIN_ADS_SCOPES = [
  "r_ads",
  "rw_ads",
  "r_ads_reporting",
  "r_organization_social",
  "w_organization_social",
  "r_marketing_leadgen_automation",
] as const;

export interface LinkedInAdsConfig {
  accessToken: string;
  adAccountId: string;
  organizationUrn?: string;
  baseURL?: string;
  /** Used to validate Lead Sync HMAC payloads. */
  webhookSecret?: string;
  /** REST version date (e.g. "202411"). */
  versionDate?: string;
}

export class LinkedInAdsAdapter extends BaseAdapter {
  private readonly accessToken: string;
  private readonly adAccountId: string;
  private readonly webhookSecret?: string;
  private readonly versionDate: string;

  constructor(cfg: LinkedInAdsConfig) {
    const versionDate = cfg.versionDate ?? "202411";
    const baseCfg: BaseAdapterConfig = {
      providerKey: "linkedin-ads",
      version: "1.0.0",
      capabilityFlag: "DIRECT",
      supportedResources: ["campaign", "adset", "ad", "creative", "lead", "audience"],
      baseURL: cfg.baseURL ?? "https://api.linkedin.com",
      headers: {
        Authorization: `Bearer ${cfg.accessToken}`,
        "X-Restli-Protocol-Version": "2.0.0",
        "LinkedIn-Version": versionDate,
        "content-type": "application/json",
      },
      timeoutMs: 30_000,
    };
    super(baseCfg);
    this.accessToken = cfg.accessToken;
    this.adAccountId = cfg.adAccountId.replace(/^urn:li:sponsoredAccount:/, "");
    this.webhookSecret = cfg.webhookSecret;
    this.versionDate = versionDate;
  }

  async connect(workspaceId: string, oauthCallbackUrl: string): Promise<ConnectResult> {
    const authorizeUrl = new URL("https://www.linkedin.com/oauth/v2/authorization");
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("scope", LINKEDIN_ADS_SCOPES.join(" "));
    authorizeUrl.searchParams.set("redirect_uri", oauthCallbackUrl);
    authorizeUrl.searchParams.set("state", `li_${workspaceId}`);
    return {
      connectionId: `cn_linkedin_ads_${workspaceId}`,
      externalAccountId: this.adAccountId,
      scopesGranted: [...LINKEDIN_ADS_SCOPES],
      refreshAvailable: true,
      authorizeUrl: authorizeUrl.toString(),
      oauthState: `li_${workspaceId}`,
    };
  }
  async disconnect(): Promise<void> {}
  async status(): Promise<StatusResult> {
    const h = await this.healthCheck();
    return { connected: !!this.accessToken, scopesGranted: [...LINKEDIN_ADS_SCOPES], scopesMissing: [], degraded: !h.ok };
  }

  override async create<T = unknown>(
    resource: ResourceType,
    payload: unknown,
    opts: WriteOptions,
  ): Promise<T> {
    this.validateWrite(opts);
    if (opts.reviewGated) {
      return { stagedActionId: `staged_li_${opts.idempotencyKey}`, reason: "review_gated" } as T;
    }
    const path = this.pathForResource(resource);
    return this.callWithRetry(
      () =>
        this.request<T>({
          method: "POST",
          url: path,
          headers: { "X-LinkedIn-Idempotency-Key": opts.idempotencyKey },
          data: payload,
        }),
      `linkedin.create_${resource}`,
    );
  }

  override async read<T = unknown>(resource: ResourceType, id: string): Promise<T> {
    return this.request<T>({ method: "GET", url: `${this.pathForResource(resource)}/${id}` });
  }

  override async update<T = unknown>(
    resource: ResourceType,
    id: string,
    payload: unknown,
    opts: WriteOptions,
  ): Promise<T> {
    this.validateWrite(opts);
    return this.callWithRetry(
      () =>
        this.request<T>({
          method: "POST",
          url: `${this.pathForResource(resource)}/${id}`,
          headers: { "X-RestLi-Method": "PARTIAL_UPDATE", "X-LinkedIn-Idempotency-Key": opts.idempotencyKey },
          data: { patch: { $set: payload } },
        }),
      `linkedin.update_${resource}`,
    );
  }

  override async delete(resource: ResourceType, id: string, opts: WriteOptions): Promise<void> {
    this.validateWrite(opts);
    await this.request({ method: "DELETE", url: `${this.pathForResource(resource)}/${id}` });
  }

  override async pause(resource: ResourceType, id: string, opts: WriteOptions): Promise<void> {
    await this.update(resource, id, { status: "PAUSED" }, opts);
  }
  override async resume(resource: ResourceType, id: string, opts: WriteOptions): Promise<void> {
    await this.update(resource, id, { status: "ACTIVE" }, opts);
  }

  override async list<T = unknown>(
    resource: ResourceType,
    filters: ListFilters,
  ): Promise<ListResult<T>> {
    const path = this.pathForResource(resource);
    const res = await this.request<{ elements: T[]; paging?: { count: number; start: number; total?: number } }>({
      method: "GET",
      url: path,
      params: { count: filters.limit ?? 50, start: filters.cursor ?? 0, q: "search" },
    });
    return { items: res.elements ?? [], nextCursor: undefined, total: res.paging?.total };
  }

  /** Pull lead form responses since a checkpoint. */
  async listLeadFormResponses(formUrn: string, since: string): Promise<unknown[]> {
    const res = await this.request<{ elements: unknown[] }>({
      method: "GET",
      url: "/rest/leadFormResponses",
      params: {
        q: "owner",
        "owner.sponsoredAccount": `urn:li:sponsoredAccount:${this.adAccountId}`,
        "owner.leadGenForm": formUrn,
        submittedAfter: since,
      },
    });
    return res.elements ?? [];
  }

  override webhookVerify(headers: Record<string, string>, body: string | Buffer): boolean {
    if (!this.webhookSecret) return false;
    const sig = headers["x-li-signature"] ?? headers["X-LI-Signature"];
    if (!sig) return false;
    const payload = typeof body === "string" ? body : body.toString("utf8");
    const expected = crypto.createHmac("sha256", this.webhookSecret).update(payload).digest("hex");
    try {
      return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
    } catch {
      return false;
    }
  }

  override async webhookHandle(payload: unknown): Promise<WebhookEvent[]> {
    const p = payload as { eventType?: string; eventTime?: number; resource?: { leadGenForm?: string; submission?: unknown } };
    if (!p?.eventType) return [];
    const ts = new Date((p.eventTime ?? Date.now() / 1000) * 1000).toISOString();
    return [
      {
        id: `linkedin_${p.eventType}_${p.eventTime}`,
        type: `linkedin.${p.eventType}`,
        resource: p.eventType.includes("lead") ? "lead" : "campaign",
        occurredAt: ts,
        payload: p.resource,
        raw: payload,
      },
    ];
  }

  limits(): ProviderLimits {
    return {
      rateLimit: { requestsPerSecond: 100, requestsPerDay: 500_000 },
      monthlyCost: { estimatedUSD: 0 },
    };
  }

  private pathForResource(resource: ResourceType): string {
    switch (resource) {
      case "campaign":
        return `/rest/adAccounts/${this.adAccountId}/adCampaigns`;
      case "adset":
        return `/rest/adAccounts/${this.adAccountId}/adCampaignGroups`;
      case "ad":
        return `/rest/adAccounts/${this.adAccountId}/creatives`;
      case "creative":
        return `/rest/adAccounts/${this.adAccountId}/creatives`;
      case "lead":
        return "/rest/leadFormResponses";
      case "audience":
        return `/rest/dmpSegments`;
      default:
        throw new PermanentError(this.providerKey, "unsupported_resource", `linkedin unsupported ${resource}`);
    }
  }
}

export const linkedinAdsFactory = (config?: Record<string, unknown>) =>
  new LinkedInAdsAdapter({
    accessToken: (config?.accessToken as string) ?? process.env.LINKEDIN_ACCESS_TOKEN ?? "",
    adAccountId: (config?.adAccountId as string) ?? process.env.LINKEDIN_AD_ACCOUNT_ID ?? "",
    organizationUrn: config?.organizationUrn as string,
    webhookSecret: (config?.webhookSecret as string) ?? process.env.LINKEDIN_WEBHOOK_SECRET,
    versionDate: config?.versionDate as string,
  });
