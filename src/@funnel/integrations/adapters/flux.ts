/**
 * Flux (via Replicate) adapter — ad creative imagery, brand-styled hero shots.
 *
 * Capability: DIRECT
 * Auth: Replicate API token (vault).
 * Endpoints: POST /v1/predictions, GET /v1/predictions/{id}
 * Webhooks: Replicate webhook on completion (HMAC-signed).
 * Rate: 10 concurrent predictions per workspace.
 * Fallback: ideogram → stock library.
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

export interface FluxConfig {
  apiToken: string;
  webhookSigningSecret?: string;
  /** Replicate model: `black-forest-labs/flux-1.1-pro` etc. */
  defaultModel?: string;
}

export interface FluxImageRequest {
  prompt: string;
  /** Brand voice / style hooks; we inject these into the prompt. */
  brand?: { palette?: string[]; mood?: string; voice?: string; logo_lockup?: string };
  aspect_ratio?: "1:1" | "16:9" | "9:16" | "4:5" | "5:4" | "3:2" | "2:3";
  num_outputs?: number;
  output_format?: "webp" | "jpg" | "png";
  output_quality?: number;
  prompt_strength?: number;
  /** Optional image input for img2img. */
  image?: string;
  /** Negative prompt. */
  negative_prompt?: string;
  /** Random seed. */
  seed?: number;
  /** Workspace webhook URL to receive completion. */
  webhookUrl?: string;
}

export class FluxAdapter extends ReplicateBaseAdapter {
  constructor(cfg: FluxConfig) {
    super({
      providerKey: "flux",
      version: "1.0.0",
      capabilityFlag: "DIRECT",
      supportedResources: ["image", "creative"],
      fallbackProviderKey: "ideogram",
      apiToken: cfg.apiToken,
      webhookSigningSecret: cfg.webhookSigningSecret,
      defaultModel: cfg.defaultModel ?? "black-forest-labs/flux-1.1-pro",
    });
  }

  async connect(workspaceId: string): Promise<ConnectResult> {
    return {
      connectionId: `cn_flux_${workspaceId}`,
      externalAccountId: this.apiToken.slice(-6),
      scopesGranted: ["predictions:write"],
      refreshAvailable: false,
    };
  }
  async disconnect(): Promise<void> {}
  async status(): Promise<StatusResult> {
    const h = await this.healthCheck();
    return { connected: true, scopesGranted: ["predictions:write"], scopesMissing: [], degraded: !h.ok, degradedReason: h.notes };
  }

  override async create<T = unknown>(
    resource: ResourceType,
    payload: unknown,
    opts: WriteOptions,
  ): Promise<T> {
    this.validateWrite(opts);
    if (resource !== "image" && resource !== "creative") {
      throw new PermanentError(this.providerKey, "unsupported_resource", `flux unsupported ${resource}`);
    }
    const req = payload as FluxImageRequest;
    const finalPrompt = composeBrandedPrompt(req);
    if (opts.reviewGated) {
      return {
        stagedActionId: `staged_flux_${opts.idempotencyKey}`,
        prompt: finalPrompt,
        reason: "review_gated",
      } as T;
    }
    if (opts.dryRun) {
      return { dryRun: true, prompt: finalPrompt } as T;
    }
    const pred = await this.createPrediction(
      {
        prompt: finalPrompt,
        aspect_ratio: req.aspect_ratio ?? "1:1",
        output_format: req.output_format ?? "webp",
        output_quality: req.output_quality ?? 92,
        num_outputs: req.num_outputs ?? 1,
        prompt_strength: req.prompt_strength,
        image: req.image,
        negative_prompt: req.negative_prompt,
        seed: req.seed,
      },
      {
        idempotencyKey: opts.idempotencyKey,
        model: this.defaultModel,
        webhookUrl: req.webhookUrl,
      },
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
      monthlyCost: { estimatedUSD: 240, capUSD: 1_000 },
    };
  }
}

function composeBrandedPrompt(req: FluxImageRequest): string {
  const parts = [req.prompt];
  if (req.brand?.palette?.length) parts.push(`palette: ${req.brand.palette.join(", ")}`);
  if (req.brand?.mood) parts.push(`mood: ${req.brand.mood}`);
  if (req.brand?.voice) parts.push(`voice: ${req.brand.voice}`);
  if (req.brand?.logo_lockup) parts.push(`logo lockup: ${req.brand.logo_lockup}`);
  parts.push("high quality, photorealistic, marketing-ready");
  return parts.join(". ");
}

export const fluxFactory = (config?: Record<string, unknown>) =>
  new FluxAdapter({
    apiToken: (config?.apiToken as string) ?? process.env.REPLICATE_API_TOKEN ?? "",
    webhookSigningSecret: (config?.webhookSigningSecret as string) ?? process.env.REPLICATE_WEBHOOK_SECRET,
    defaultModel: config?.defaultModel as string,
  });
