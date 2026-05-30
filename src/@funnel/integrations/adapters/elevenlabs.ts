/**
 * ElevenLabs TTS adapter — 5 voice personas, 10 languages.
 *
 * Capability: DIRECT
 * Auth: API key.
 * Endpoints:
 *   POST /v1/text-to-speech/{voice_id}
 *   POST /v1/text-to-speech/{voice_id}/stream
 *   POST /v1/voices/add
 *   GET  /v1/voices
 * Rate: plan-tier concurrency.
 * Fallback: OpenAI TTS → Azure Speech.
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
  WriteOptions,
} from "../pal/types.js";

export interface ElevenLabsConfig {
  apiKey: string;
  baseURL?: string;
  /** Default model id (multilingual v2 by default). */
  defaultModelId?: string;
}

export interface TTSRequest {
  voiceId: string;
  text: string;
  modelId?: string;
  languageCode?: string;
  voiceSettings?: {
    stability?: number;
    similarity_boost?: number;
    style?: number;
    use_speaker_boost?: boolean;
  };
  /** Stream vs full file. */
  stream?: boolean;
  /** Optional output format. */
  outputFormat?: "mp3_44100_128" | "mp3_44100_192" | "pcm_16000" | "pcm_22050" | "pcm_24000" | "pcm_44100" | "ulaw_8000";
}

export class ElevenLabsAdapter extends BaseAdapter {
  private readonly defaultModelId: string;

  constructor(cfg: ElevenLabsConfig) {
    const baseCfg: BaseAdapterConfig = {
      providerKey: "elevenlabs",
      version: "1.0.0",
      capabilityFlag: "DIRECT",
      supportedResources: ["voice"],
      fallbackProviderKey: "openai",
      baseURL: cfg.baseURL ?? "https://api.elevenlabs.io",
      headers: { "xi-api-key": cfg.apiKey, "content-type": "application/json" },
      timeoutMs: 60_000,
    };
    super(baseCfg);
    this.defaultModelId = cfg.defaultModelId ?? "eleven_multilingual_v2";
  }

  async connect(workspaceId: string): Promise<ConnectResult> {
    return {
      connectionId: `cn_elevenlabs_${workspaceId}`,
      externalAccountId: `el_${workspaceId}`,
      scopesGranted: ["tts:write", "voices:write"],
      refreshAvailable: false,
    };
  }
  async disconnect(): Promise<void> {}
  async status(): Promise<StatusResult> {
    const h = await this.healthCheck();
    return { connected: true, scopesGranted: ["tts:write"], scopesMissing: [], degraded: !h.ok };
  }

  override async create<T = unknown>(
    resource: ResourceType,
    payload: unknown,
    opts: WriteOptions,
  ): Promise<T> {
    this.validateWrite(opts);
    if (resource !== "voice") throw new PermanentError(this.providerKey, "unsupported_resource", `elevenlabs unsupported ${resource}`);
    const req = payload as TTSRequest;
    if (!req.voiceId || !req.text) throw new PermanentError(this.providerKey, "invalid_payload", "voiceId and text required");
    if (opts.dryRun) return { dryRun: true, estimated_chars: req.text.length } as T;
    const path = req.stream
      ? `/v1/text-to-speech/${req.voiceId}/stream`
      : `/v1/text-to-speech/${req.voiceId}`;
    return this.callWithRetry(
      () =>
        this.request<T>({
          method: "POST",
          url: path,
          params: req.outputFormat ? { output_format: req.outputFormat } : undefined,
          headers: { "Idempotency-Key": opts.idempotencyKey },
          data: {
            model_id: req.modelId ?? this.defaultModelId,
            text: req.text,
            language_code: req.languageCode,
            voice_settings: req.voiceSettings ?? { stability: 0.5, similarity_boost: 0.75 },
          },
          responseType: req.stream ? "stream" : "arraybuffer",
        }),
      "elevenlabs.tts",
    );
  }

  /** Clone a voice from samples (voice cloning). */
  async cloneVoice(name: string, files: Buffer[], opts: WriteOptions): Promise<{ voice_id: string }> {
    this.validateWrite(opts);
    // Multipart upload — caller hands us pre-read Buffers, we marshal to form-data.
    const FormData = (await import("form-data")).default;
    const form = new FormData();
    form.append("name", name);
    files.forEach((b, i) => form.append("files", b, `sample_${i}.mp3`));
    return this.callWithRetry(
      () =>
        this.request<{ voice_id: string }>({
          method: "POST",
          url: "/v1/voices/add",
          headers: { ...form.getHeaders(), "Idempotency-Key": opts.idempotencyKey },
          data: form,
        }),
      "elevenlabs.clone_voice",
    );
  }

  override async list<T = unknown>(
    _resource: ResourceType,
    _filters: ListFilters,
  ): Promise<ListResult<T>> {
    const res = await this.request<{ voices: T[] }>({ method: "GET", url: "/v1/voices" });
    return { items: res.voices };
  }

  override webhookVerify(): boolean {
    return false;
  }
  override async webhookHandle(): Promise<WebhookEvent[]> {
    return [];
  }

  limits(): ProviderLimits {
    return {
      rateLimit: { requestsPerSecond: 5, burstBucket: 10 },
      monthlyCost: { estimatedUSD: 99, capUSD: 500 },
    };
  }
}

export const elevenlabsFactory = (config?: Record<string, unknown>) =>
  new ElevenLabsAdapter({
    apiKey: (config?.apiKey as string) ?? process.env.ELEVENLABS_API_KEY ?? "",
    baseURL: config?.baseURL as string,
  });
