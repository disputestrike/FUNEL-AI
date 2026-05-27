/**
 * OpenAI adapter — Realtime API (voice onboarding) + fallback chat completions
 * + embeddings.
 *
 * Capability: DIRECT
 * Auth: API key (vault).
 * Endpoints:
 *   POST /v1/realtime/sessions
 *   wss://api.openai.com/v1/realtime
 *   POST /v1/chat/completions
 *   POST /v1/embeddings
 * Rate: tier-based; voice onboarding capped at 30 concurrent sessions on D90.
 * Webhooks: none.
 * Fallback: anthropic (text) / elevenlabs+whisper (voice).
 */

import { BaseAdapter, type BaseAdapterConfig } from "../pal/base-adapter.js";
import { PermanentError, NotImplementedError } from "../pal/errors.js";
import type {
  ConnectResult,
  HealthCheckResult,
  ProviderLimits,
  ResourceType,
  StatusResult,
  WriteOptions,
  WebhookEvent,
} from "../pal/types.js";

export interface OpenAIConfig {
  apiKey: string;
  organization?: string;
  project?: string;
  baseURL?: string;
  defaultChatModel?: string;
  defaultRealtimeModel?: string;
  defaultEmbeddingModel?: string;
}

export interface ChatCompletionRequest {
  model?: string;
  messages: Array<{ role: "system" | "user" | "assistant" | "tool"; content: string; tool_call_id?: string; name?: string }>;
  tools?: Array<{ type: "function"; function: { name: string; description?: string; parameters: unknown } }>;
  tool_choice?: "auto" | "none" | "required" | { type: "function"; function: { name: string } };
  response_format?: { type: "text" | "json_object" | "json_schema"; json_schema?: unknown };
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  user?: string;
}

export interface RealtimeSessionRequest {
  model?: string;
  voice?: "alloy" | "echo" | "shimmer" | "verse" | "ballad" | "ash" | "sage" | "coral";
  modalities?: Array<"audio" | "text">;
  instructions?: string;
  input_audio_format?: "pcm16" | "g711_ulaw" | "g711_alaw";
  output_audio_format?: "pcm16" | "g711_ulaw" | "g711_alaw";
  turn_detection?: { type: "server_vad" | "none"; threshold?: number; silence_duration_ms?: number };
}

export class OpenAIAdapter extends BaseAdapter {
  private readonly apiKey: string;
  private readonly defaultChatModel: string;
  private readonly defaultRealtimeModel: string;
  private readonly defaultEmbeddingModel: string;

  constructor(cfg: OpenAIConfig) {
    const baseCfg: BaseAdapterConfig = {
      providerKey: "openai",
      version: "1.0.0",
      capabilityFlag: "DIRECT",
      supportedResources: ["completion", "message", "voice"],
      fallbackProviderKey: "anthropic",
      baseURL: cfg.baseURL ?? "https://api.openai.com",
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        ...(cfg.organization ? { "OpenAI-Organization": cfg.organization } : {}),
        ...(cfg.project ? { "OpenAI-Project": cfg.project } : {}),
        "content-type": "application/json",
      },
      timeoutMs: 120_000,
    };
    super(baseCfg);
    this.apiKey = cfg.apiKey;
    this.defaultChatModel = cfg.defaultChatModel ?? "gpt-4o";
    this.defaultRealtimeModel = cfg.defaultRealtimeModel ?? "gpt-4o-realtime-preview-2024-12-17";
    this.defaultEmbeddingModel = cfg.defaultEmbeddingModel ?? "text-embedding-3-large";
  }

  async connect(workspaceId: string): Promise<ConnectResult> {
    return {
      connectionId: `cn_openai_${workspaceId}`,
      externalAccountId: this.apiKey.slice(-6),
      scopesGranted: ["chat:write", "embeddings:write", "realtime:create"],
      refreshAvailable: false,
    };
  }
  async disconnect(): Promise<void> {}
  async status(): Promise<StatusResult> {
    const h = await this.healthCheck();
    return {
      connected: !!this.apiKey,
      scopesGranted: ["chat:write", "embeddings:write", "realtime:create"],
      scopesMissing: [],
      degraded: !h.ok,
      degradedReason: h.notes,
    };
  }

  override async create<T = unknown>(
    resource: ResourceType,
    payload: unknown,
    opts: WriteOptions,
  ): Promise<T> {
    this.validateWrite(opts);
    if (opts.reviewGated) {
      return { stagedActionId: `staged_openai_${opts.idempotencyKey}`, reason: "review_gated" } as T;
    }
    switch (resource) {
      case "completion":
      case "message":
        return this.chatCompletion(payload as ChatCompletionRequest, opts) as Promise<T>;
      case "voice":
        return this.createRealtimeSession(payload as RealtimeSessionRequest, opts) as Promise<T>;
      default:
        throw new PermanentError(this.providerKey, "unsupported_resource", `openai unsupported ${resource}`);
    }
  }

  private async chatCompletion(req: ChatCompletionRequest, opts: WriteOptions): Promise<unknown> {
    return this.callWithRetry(
      () =>
        this.request({
          method: "POST",
          url: "/v1/chat/completions",
          headers: { "Idempotency-Key": opts.idempotencyKey },
          data: {
            model: req.model ?? this.defaultChatModel,
            messages: req.messages,
            tools: req.tools,
            tool_choice: req.tool_choice,
            response_format: req.response_format,
            temperature: req.temperature ?? 0.7,
            max_tokens: req.max_tokens,
            stream: false,
            user: req.user,
          },
        }),
      "openai.chat_completion",
    );
  }

  /**
   * Returns an ephemeral client_secret + session id used to upgrade to the
   * WebRTC handshake. Caller hands the secret to the browser which then
   * opens `wss://api.openai.com/v1/realtime?model=...` with
   * `Authorization: Bearer <client_secret>`.
   */
  async createRealtimeSession(
    req: RealtimeSessionRequest,
    opts: WriteOptions,
  ): Promise<{ id: string; client_secret: { value: string; expires_at: number }; model: string }> {
    return this.callWithRetry(
      () =>
        this.request<{ id: string; client_secret: { value: string; expires_at: number }; model: string }>({
          method: "POST",
          url: "/v1/realtime/sessions",
          headers: { "Idempotency-Key": opts.idempotencyKey },
          data: {
            model: req.model ?? this.defaultRealtimeModel,
            voice: req.voice ?? "verse",
            modalities: req.modalities ?? ["audio", "text"],
            instructions: req.instructions,
            input_audio_format: req.input_audio_format ?? "pcm16",
            output_audio_format: req.output_audio_format ?? "pcm16",
            turn_detection: req.turn_detection ?? { type: "server_vad" },
          },
        }),
      "openai.create_realtime_session",
    );
  }

  /** Embeddings — used by KB ingestion + vector search. */
  async embeddings(input: string[], model?: string): Promise<{ data: Array<{ embedding: number[] }> }> {
    return this.callWithRetry(
      () =>
        this.request({
          method: "POST",
          url: "/v1/embeddings",
          data: { model: model ?? this.defaultEmbeddingModel, input },
        }),
      "openai.embeddings",
    );
  }

  override webhookVerify(): boolean {
    return false;
  }
  override async webhookHandle(): Promise<WebhookEvent[]> {
    return [];
  }
  override async replay(): Promise<WebhookEvent[]> {
    throw new NotImplementedError(this.providerKey, "replay");
  }

  limits(): ProviderLimits {
    return {
      rateLimit: { requestsPerMinute: 3_500 },
      dailyQuota: { tokens: 5_000_000 },
      monthlyCost: { estimatedUSD: 800, capUSD: 5_000 },
    };
  }

  override async healthCheck(): Promise<HealthCheckResult> {
    const started = Date.now();
    try {
      await this.request({ method: "GET", url: "/v1/models" });
      return { ok: true, latencyMs: Date.now() - started, checkedAt: new Date().toISOString(), upstream: "up" };
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
}

export const openaiFactory = (config?: Record<string, unknown>) =>
  new OpenAIAdapter({
    apiKey: (config?.apiKey as string) ?? process.env.OPENAI_API_KEY ?? "",
    organization: (config?.organization as string) ?? process.env.OPENAI_ORG_ID,
    project: (config?.project as string) ?? process.env.OPENAI_PROJECT,
    baseURL: config?.baseURL as string,
  });
