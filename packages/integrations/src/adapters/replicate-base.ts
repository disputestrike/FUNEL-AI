/**
 * Shared base for Replicate-hosted image/video models (Flux, Ideogram, Runway).
 * Replicate webhooks are HMAC-signed via Svix-style headers; we share that
 * verification logic here.
 */

import crypto from "node:crypto";
import { BaseAdapter, type BaseAdapterConfig } from "../pal/base-adapter.js";
import { WebhookVerificationError } from "../pal/errors.js";
import type { ResourceType, WebhookEvent } from "../pal/types.js";

export interface ReplicatePrediction<I = unknown, O = unknown> {
  id: string;
  version?: string;
  model?: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  input: I;
  output?: O;
  error?: string;
  created_at: string;
  completed_at?: string;
  urls?: { get?: string; cancel?: string };
  metrics?: { predict_time?: number };
}

export interface ReplicateBaseConfig {
  providerKey: string;
  version: string;
  /** Default model `owner/name` or `owner/name:version_hash`. */
  defaultModel: string;
  apiToken: string;
  webhookSigningSecret?: string;
  supportedResources: ResourceType[];
  capabilityFlag: "DIRECT" | "REVIEW-GATED" | "BRIDGED";
  fallbackProviderKey?: string;
}

export abstract class ReplicateBaseAdapter extends BaseAdapter {
  protected readonly apiToken: string;
  protected readonly defaultModel: string;
  protected readonly webhookSigningSecret?: string;

  constructor(cfg: ReplicateBaseConfig) {
    const baseCfg: BaseAdapterConfig = {
      providerKey: cfg.providerKey,
      version: cfg.version,
      capabilityFlag: cfg.capabilityFlag,
      supportedResources: cfg.supportedResources,
      fallbackProviderKey: cfg.fallbackProviderKey,
      baseURL: "https://api.replicate.com",
      headers: {
        Authorization: `Token ${cfg.apiToken}`,
        "content-type": "application/json",
      },
    };
    super(baseCfg);
    this.apiToken = cfg.apiToken;
    this.defaultModel = cfg.defaultModel;
    this.webhookSigningSecret = cfg.webhookSigningSecret;
  }

  protected async createPrediction<I, O>(
    input: I,
    opts: { idempotencyKey: string; model?: string; webhookUrl?: string },
  ): Promise<ReplicatePrediction<I, O>> {
    const model = opts.model ?? this.defaultModel;
    return this.callWithRetry(
      () =>
        this.request<ReplicatePrediction<I, O>>({
          method: "POST",
          url: model.includes(":") ? "/v1/predictions" : `/v1/models/${model}/predictions`,
          headers: { "Idempotency-Key": opts.idempotencyKey, Prefer: "wait=0" },
          data: {
            ...(model.includes(":") ? { version: model.split(":")[1] } : {}),
            input,
            ...(opts.webhookUrl ? { webhook: opts.webhookUrl, webhook_events_filter: ["completed"] } : {}),
          },
        }),
      `${this.providerKey}.create_prediction`,
    );
  }

  protected async getPrediction<O>(id: string): Promise<ReplicatePrediction<unknown, O>> {
    return this.request<ReplicatePrediction<unknown, O>>({
      method: "GET",
      url: `/v1/predictions/${id}`,
    });
  }

  /** Cancel an in-flight prediction. */
  protected async cancelPrediction(id: string): Promise<void> {
    await this.request({ method: "POST", url: `/v1/predictions/${id}/cancel` });
  }

  override webhookVerify(headers: Record<string, string>, body: string | Buffer): boolean {
    if (!this.webhookSigningSecret) return false;
    const id = headers["webhook-id"] ?? headers["Webhook-Id"];
    const timestamp = headers["webhook-timestamp"] ?? headers["Webhook-Timestamp"];
    const signature = headers["webhook-signature"] ?? headers["Webhook-Signature"];
    if (!id || !timestamp || !signature) return false;
    const payload = typeof body === "string" ? body : body.toString("utf8");
    const signedContent = `${id}.${timestamp}.${payload}`;
    const secret = this.webhookSigningSecret.startsWith("whsec_")
      ? this.webhookSigningSecret.slice(6)
      : this.webhookSigningSecret;
    const secretBytes = Buffer.from(secret, "base64");
    const expected = crypto.createHmac("sha256", secretBytes).update(signedContent).digest("base64");
    // Signature header is `v1,base64sig v1,base64sig2`.
    const candidates = signature.split(" ").map((s) => s.split(",")[1]);
    return candidates.some((c) => c && safeEqual(c, expected));
  }

  override async webhookHandle(payload: unknown): Promise<WebhookEvent[]> {
    const p = payload as ReplicatePrediction;
    if (!p?.id) throw new WebhookVerificationError(this.providerKey, "Replicate webhook missing id");
    return [
      {
        id: `${this.providerKey}_${p.id}`,
        type: `replicate.prediction.${p.status}`,
        resource: this.predictionResource(),
        resourceId: p.id,
        occurredAt: p.completed_at ?? p.created_at,
        payload: { status: p.status, output: p.output, error: p.error, metrics: p.metrics },
        raw: p,
      },
    ];
  }

  protected abstract predictionResource(): ResourceType;
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, "base64"), Buffer.from(b, "base64"));
}
