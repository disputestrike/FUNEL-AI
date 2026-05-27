/**
 * Ideogram (via Replicate) adapter — typography-strong image gen, fallback
 * to Flux for hero shots that need crisp text.
 *
 * Capability: DIRECT
 * Auth: Replicate API token.
 */

import { ReplicateBaseAdapter } from "./replicate-base.js";
import { PermanentError } from "../pal/errors.js";
import type {
  ConnectResult,
  ListFilters,
  ListResult,
  ProviderLimits,
  ResourceType,
  StatusResult,
  WriteOptions,
} from "../pal/types.js";

export interface IdeogramConfig {
  apiToken: string;
  webhookSigningSecret?: string;
  defaultModel?: string;
}

export interface IdeogramRequest {
  prompt: string;
  aspect_ratio?: string;
  style_type?: "AUTO" | "GENERAL" | "REALISTIC" | "DESIGN" | "RENDER_3D" | "ANIME";
  magic_prompt_option?: "AUTO" | "ON" | "OFF";
  negative_prompt?: string;
  seed?: number;
  webhookUrl?: string;
}

export class IdeogramAdapter extends ReplicateBaseAdapter {
  constructor(cfg: IdeogramConfig) {
    super({
      providerKey: "ideogram",
      version: "1.0.0",
      capabilityFlag: "DIRECT",
      supportedResources: ["image", "creative"],
      fallbackProviderKey: "flux",
      apiToken: cfg.apiToken,
      webhookSigningSecret: cfg.webhookSigningSecret,
      defaultModel: cfg.defaultModel ?? "ideogram-ai/ideogram-v2",
    });
  }

  async connect(workspaceId: string): Promise<ConnectResult> {
    return {
      connectionId: `cn_ideogram_${workspaceId}`,
      externalAccountId: this.apiToken.slice(-6),
      scopesGranted: ["predictions:write"],
      refreshAvailable: false,
    };
  }
  async disconnect(): Promise<void> {}
  async status(): Promise<StatusResult> {
    const h = await this.healthCheck();
    return { connected: true, scopesGranted: ["predictions:write"], scopesMissing: [], degraded: !h.ok };
  }

  override async create<T = unknown>(
    resource: ResourceType,
    payload: unknown,
    opts: WriteOptions,
  ): Promise<T> {
    this.validateWrite(opts);
    if (resource !== "image" && resource !== "creative") {
      throw new PermanentError(this.providerKey, "unsupported_resource", `ideogram unsupported ${resource}`);
    }
    const req = payload as IdeogramRequest;
    if (opts.reviewGated) {
      return { stagedActionId: `staged_ideogram_${opts.idempotencyKey}`, reason: "review_gated" } as T;
    }
    const pred = await this.createPrediction(
      {
        prompt: req.prompt,
        aspect_ratio: req.aspect_ratio ?? "1:1",
        style_type: req.style_type ?? "AUTO",
        magic_prompt_option: req.magic_prompt_option ?? "AUTO",
        negative_prompt: req.negative_prompt,
        seed: req.seed,
      },
      { idempotencyKey: opts.idempotencyKey, model: this.defaultModel, webhookUrl: req.webhookUrl },
    );
    return pred as T;
  }

  override async read<T = unknown>(_resource: ResourceType, id: string): Promise<T> {
    return this.getPrediction(id) as unknown as T;
  }

  override async delete(_resource: ResourceType, id: string, opts: WriteOptions): Promise<void> {
    this.validateWrite(opts);
    await this.cancelPrediction(id);
  }

  override async list<T = unknown>(
    _resource: ResourceType,
    filters: ListFilters,
  ): Promise<ListResult<T>> {
    const res = await this.request<{ next: string | null; results: T[] }>({
      method: "GET",
      url: "/v1/predictions",
      params: { cursor: filters.cursor },
    });
    return { items: res.results, nextCursor: res.next ?? undefined };
  }

  protected predictionResource(): ResourceType {
    return "image";
  }

  limits(): ProviderLimits {
    return {
      rateLimit: { requestsPerMinute: 60, burstBucket: 10 },
      dailyQuota: { calls: 200 },
      monthlyCost: { estimatedUSD: 180, capUSD: 800 },
    };
  }
}

export const ideogramFactory = (config?: Record<string, unknown>) =>
  new IdeogramAdapter({
    apiToken: (config?.apiToken as string) ?? process.env.REPLICATE_API_TOKEN ?? "",
    webhookSigningSecret: (config?.webhookSigningSecret as string) ?? process.env.REPLICATE_WEBHOOK_SECRET,
  });
