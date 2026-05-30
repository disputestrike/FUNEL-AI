/**
 * Runway Gen-3 video adapter — short-form video ads (6-12s).
 *
 * Capability: REVIEW-GATED — generated video output ALWAYS goes through human
 * approval before any ad spend hits it (cost variance + quality variance).
 * Auth: Runway API key.
 * Endpoints: POST /v1/image_to_video, POST /v1/text_to_video, GET /v1/tasks/{id}
 * Fallback: Veo (M6) → static-image fallback.
 */

import crypto from "node:crypto";
import { BaseAdapter, type BaseAdapterConfig } from "../pal/base-adapter.js";
import { PermanentError, WebhookVerificationError } from "../pal/errors.js";
import type {
  ConnectResult,
  ProviderLimits,
  ResourceType,
  StatusResult,
  WebhookEvent,
  WriteOptions,
} from "../pal/types.js";

export interface RunwayConfig {
  apiKey: string;
  baseURL?: string;
  webhookSecret?: string;
  /** "gen3a_turbo" | "gen3a" | "veo" — defaults to gen3a_turbo. */
  defaultModel?: string;
}

export interface RunwayVideoRequest {
  prompt: string;
  /** Reference image URL or base64 data: URL for image-to-video. */
  promptImage?: string;
  duration?: 5 | 10;
  ratio?: "16:9" | "9:16" | "1:1";
  watermark?: boolean;
  seed?: number;
  motionAmount?: number;
  webhookUrl?: string;
}

export class RunwayAdapter extends BaseAdapter {
  private readonly webhookSecret?: string;
  private readonly defaultModel: string;

  constructor(cfg: RunwayConfig) {
    const baseCfg: BaseAdapterConfig = {
      providerKey: "runway",
      version: "1.0.0",
      capabilityFlag: "REVIEW-GATED",
      supportedResources: ["video", "creative"],
      fallbackProviderKey: "flux",
      baseURL: cfg.baseURL ?? "https://api.runwayml.com",
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        "X-Runway-Version": "2024-11-06",
        "content-type": "application/json",
      },
      timeoutMs: 60_000,
    };
    super(baseCfg);
    this.webhookSecret = cfg.webhookSecret;
    this.defaultModel = cfg.defaultModel ?? "gen3a_turbo";
  }

  async connect(workspaceId: string): Promise<ConnectResult> {
    return {
      connectionId: `cn_runway_${workspaceId}`,
      externalAccountId: `runway_${workspaceId}`,
      scopesGranted: ["video:create", "video:read"],
      refreshAvailable: false,
    };
  }
  async disconnect(): Promise<void> {}
  async status(): Promise<StatusResult> {
    const h = await this.healthCheck();
    return { connected: true, scopesGranted: ["video:create"], scopesMissing: [], degraded: !h.ok };
  }

  override async create<T = unknown>(
    resource: ResourceType,
    payload: unknown,
    opts: WriteOptions,
  ): Promise<T> {
    this.validateWrite(opts);
    if (resource !== "video" && resource !== "creative") {
      throw new PermanentError(this.providerKey, "unsupported_resource", `runway unsupported ${resource}`);
    }
    // Runway is REVIEW-GATED — we ALWAYS stage unless the caller flips the explicit override
    // (which the orchestrator does after a human approval).
    if (opts.reviewGated !== false) {
      return {
        stagedActionId: `staged_runway_${opts.idempotencyKey}`,
        adapter: this.providerKey,
        reason: "review_gated",
        payload,
      } as T;
    }
    const req = payload as RunwayVideoRequest;
    const url = req.promptImage ? "/v1/image_to_video" : "/v1/text_to_video";
    return this.callWithRetry(
      () =>
        this.request<T>({
          method: "POST",
          url,
          headers: { "Idempotency-Key": opts.idempotencyKey },
          data: {
            model: this.defaultModel,
            promptText: req.prompt,
            promptImage: req.promptImage,
            duration: req.duration ?? 5,
            ratio: req.ratio ?? "16:9",
            watermark: req.watermark ?? false,
            seed: req.seed,
            motionAmount: req.motionAmount,
            webhookUrl: req.webhookUrl,
          },
        }),
      "runway.create_video",
    );
  }

  override async read<T = unknown>(_resource: ResourceType, id: string): Promise<T> {
    return this.request<T>({ method: "GET", url: `/v1/tasks/${id}` });
  }

  override webhookVerify(headers: Record<string, string>, body: string | Buffer): boolean {
    if (!this.webhookSecret) return false;
    const sig = headers["x-runway-signature"] ?? headers["X-Runway-Signature"];
    const ts = headers["x-runway-timestamp"] ?? headers["X-Runway-Timestamp"];
    if (!sig || !ts) return false;
    const payload = typeof body === "string" ? body : body.toString("utf8");
    const expected = crypto
      .createHmac("sha256", this.webhookSecret)
      .update(`${ts}.${payload}`)
      .digest("hex");
    try {
      return crypto.timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"));
    } catch {
      return false;
    }
  }

  override async webhookHandle(payload: unknown): Promise<WebhookEvent[]> {
    const p = payload as { id?: string; status?: string; output?: unknown; createdAt?: string };
    if (!p?.id) throw new WebhookVerificationError(this.providerKey, "Missing task id");
    return [
      {
        id: `runway_${p.id}`,
        type: `runway.task.${p.status ?? "unknown"}`,
        resource: "video",
        resourceId: p.id,
        occurredAt: p.createdAt ?? new Date().toISOString(),
        payload: { status: p.status, output: p.output },
        raw: payload,
      },
    ];
  }

  limits(): ProviderLimits {
    return {
      rateLimit: { requestsPerMinute: 30, burstBucket: 5 },
      dailyQuota: { cost: 50 },
      monthlyCost: { estimatedUSD: 600, capUSD: 1_500 },
    };
  }
}

export const runwayFactory = (config?: Record<string, unknown>) =>
  new RunwayAdapter({
    apiKey: (config?.apiKey as string) ?? process.env.RUNWAY_API_KEY ?? "",
    webhookSecret: (config?.webhookSecret as string) ?? process.env.RUNWAY_WEBHOOK_SECRET,
    baseURL: config?.baseURL as string,
  });
