/**
 * Anthropic Claude adapter — primary reasoning + agent loop.
 *
 * Capability: DIRECT
 * Auth: workspace-scoped API key (vault-stored)
 * Endpoints: POST /v1/messages, POST /v1/messages?stream=true,
 *            POST /v1/messages/batches, files API
 * Rate budget: 50 RPM Tier 1 → 4000 RPM Tier 4; per-workspace soft cap
 *              1M tokens/day default.
 * Webhooks: none (poll the batches API).
 * Fallback: openai.ts (degraded mode).
 *
 * Features wired:
 *   - Prompt caching via `cache_control: { type: "ephemeral" }`.
 *   - Tool use (`tools` + `tool_choice`).
 *   - Streaming (`stream: true`).
 *   - Batches (`/v1/messages/batches`).
 */

import crypto from "node:crypto";
import { BaseAdapter, type BaseAdapterConfig } from "../pal/base-adapter.js";
import {
  AuthError,
  NotImplementedError,
  PermanentError,
  classifyHttpError,
} from "../pal/errors.js";
import type {
  ConnectResult,
  HealthCheckResult,
  ListFilters,
  ListResult,
  ProviderLimits,
  ResourceType,
  StatusResult,
  WriteOptions,
  WebhookEvent,
} from "../pal/types.js";

export interface AnthropicConfig {
  apiKey: string;
  /** Default model when caller doesn't specify one. */
  defaultModel?: string;
  /** Anthropic-version header. */
  apiVersion?: string;
  baseURL?: string;
  /** Optional org-level rate budget exposed via limits(). */
  tier?: 1 | 2 | 3 | 4;
}

export interface AnthropicMessageRequest {
  model?: string;
  system?:
    | string
    | Array<{ type: "text"; text: string; cache_control?: { type: "ephemeral" } }>;
  messages: Array<{
    role: "user" | "assistant";
    content:
      | string
      | Array<
          | { type: "text"; text: string; cache_control?: { type: "ephemeral" } }
          | { type: "image"; source: { type: "base64"; media_type: string; data: string } }
          | { type: "tool_use"; id: string; name: string; input: unknown }
          | { type: "tool_result"; tool_use_id: string; content: unknown }
        >;
  }>;
  tools?: Array<{ name: string; description?: string; input_schema: unknown }>;
  tool_choice?: { type: "auto" | "any" | "tool"; name?: string };
  max_tokens: number;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
  metadata?: { user_id?: string };
  /** Workspace-scoped idempotency hint. */
  idempotency_key?: string;
}

const RPM_BY_TIER: Record<1 | 2 | 3 | 4, number> = {
  1: 50,
  2: 1_000,
  3: 2_000,
  4: 4_000,
};

export class AnthropicAdapter extends BaseAdapter {
  private readonly apiKey: string;
  private readonly defaultModel: string;
  private readonly tier: 1 | 2 | 3 | 4;

  constructor(cfg: AnthropicConfig) {
    const baseCfg: BaseAdapterConfig = {
      providerKey: "anthropic",
      version: "1.0.0",
      capabilityFlag: "DIRECT",
      supportedResources: ["completion", "message"],
      fallbackProviderKey: "openai",
      baseURL: cfg.baseURL ?? "https://api.anthropic.com",
      headers: {
        "x-api-key": cfg.apiKey,
        "anthropic-version": cfg.apiVersion ?? "2023-06-01",
        "anthropic-beta": "prompt-caching-2024-07-31,message-batches-2024-09-24",
        "content-type": "application/json",
      },
      timeoutMs: 120_000,
    };
    super(baseCfg);
    this.apiKey = cfg.apiKey;
    this.defaultModel = cfg.defaultModel ?? "claude-opus-4-7";
    this.tier = cfg.tier ?? 1;
  }

  async connect(workspaceId: string): Promise<ConnectResult> {
    // API-key flow: caller writes the key into TokenStore via OAuthOrchestrator.storeApiKey.
    return {
      connectionId: `cn_anthropic_${workspaceId}`,
      externalAccountId: hashKey(this.apiKey),
      scopesGranted: ["messages:write", "batches:write", "files:write"],
      refreshAvailable: false,
    };
  }

  async disconnect(_workspaceId: string): Promise<void> {
    // No remote revoke — token deletion happens at the vault layer.
  }

  async status(_workspaceId: string): Promise<StatusResult> {
    const h = await this.healthCheck();
    return {
      connected: !!this.apiKey,
      scopesGranted: ["messages:write", "batches:write", "files:write"],
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
    if (resource !== "completion" && resource !== "message") {
      throw new PermanentError(this.providerKey, "unsupported_resource", `Anthropic does not support resource ${resource}`);
    }
    const req = payload as AnthropicMessageRequest;
    if (!req?.messages?.length) {
      throw new PermanentError(this.providerKey, "invalid_payload", "messages[] is required");
    }
    if (opts.dryRun) {
      return { dryRun: true, estimated_tokens: estimateTokens(req) } as T;
    }
    if (opts.reviewGated) {
      return {
        stagedActionId: `staged_anthropic_${opts.idempotencyKey}`,
        adapter: this.providerKey,
        resource,
        reason: "review_gated",
      } as T;
    }
    return this.callWithRetry(async () => {
      const body = {
        model: req.model ?? this.defaultModel,
        max_tokens: req.max_tokens,
        system: req.system,
        messages: req.messages,
        tools: req.tools,
        tool_choice: req.tool_choice,
        temperature: req.temperature ?? 0.7,
        top_p: req.top_p,
        stream: false,
        metadata: req.metadata,
      };
      return this.request<T>({
        method: "POST",
        url: "/v1/messages",
        headers: {
          "idempotency-key": opts.idempotencyKey,
          ...(req.idempotency_key ? { "anthropic-idempotency-key": req.idempotency_key } : {}),
        },
        data: body,
      });
    }, "anthropic.create_message");
  }

  /** Submit a batch — message volume bulk-discounted. */
  async createBatch(
    requests: Array<{ custom_id: string; params: AnthropicMessageRequest }>,
    opts: WriteOptions,
  ): Promise<{ id: string; processing_status: string }> {
    this.validateWrite(opts);
    return this.callWithRetry(
      () =>
        this.request<{ id: string; processing_status: string }>({
          method: "POST",
          url: "/v1/messages/batches",
          headers: { "idempotency-key": opts.idempotencyKey },
          data: { requests },
        }),
      "anthropic.create_batch",
    );
  }

  override async read<T = unknown>(resource: ResourceType, id: string): Promise<T> {
    if (resource !== "completion") throw new NotImplementedError(this.providerKey, `read ${resource}`);
    return this.request<T>({ method: "GET", url: `/v1/messages/batches/${id}` });
  }

  override async list<T = unknown>(
    resource: ResourceType,
    filters: ListFilters,
  ): Promise<ListResult<T>> {
    if (resource !== "completion") {
      throw new NotImplementedError(this.providerKey, `list ${resource}`);
    }
    const res = await this.request<{ data: T[]; has_more: boolean; last_id?: string }>({
      method: "GET",
      url: "/v1/messages/batches",
      params: { limit: filters.limit ?? 20, after_id: filters.cursor },
    });
    return { items: res.data, nextCursor: res.has_more ? res.last_id : undefined };
  }

  // No webhooks — polling on batches.
  override webhookVerify(): boolean {
    return false;
  }
  override async webhookHandle(): Promise<WebhookEvent[]> {
    return [];
  }

  limits(): ProviderLimits {
    return {
      rateLimit: {
        requestsPerMinute: RPM_BY_TIER[this.tier],
      },
      dailyQuota: { tokens: 1_000_000 },
      monthlyCost: { estimatedUSD: 1_500, capUSD: 5_000 },
    };
  }

  override async healthCheck(): Promise<HealthCheckResult> {
    const started = Date.now();
    try {
      // Cheapest valid messages call: 1 token output.
      await this.request({
        method: "POST",
        url: "/v1/messages",
        data: {
          model: this.defaultModel,
          max_tokens: 1,
          messages: [{ role: "user", content: "." }],
        },
      });
      return {
        ok: true,
        latencyMs: Date.now() - started,
        checkedAt: new Date().toISOString(),
        upstream: "up",
      };
    } catch (err) {
      if (err instanceof AuthError) {
        return {
          ok: false,
          latencyMs: Date.now() - started,
          checkedAt: new Date().toISOString(),
          upstream: "down",
          notes: `auth: ${err.message}`,
        };
      }
      return {
        ok: false,
        latencyMs: Date.now() - started,
        checkedAt: new Date().toISOString(),
        upstream: "degraded",
        notes: err instanceof Error ? err.message : String(err),
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hashKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex").slice(0, 16);
}

function estimateTokens(req: AnthropicMessageRequest): number {
  // Rough char/4 heuristic — good enough for dry-run budgeting.
  let chars = 0;
  for (const m of req.messages) {
    if (typeof m.content === "string") chars += m.content.length;
    else {
      for (const block of m.content) {
        if (block.type === "text") chars += block.text.length;
      }
    }
  }
  if (typeof req.system === "string") chars += req.system.length;
  else if (Array.isArray(req.system)) chars += req.system.reduce((acc, s) => acc + s.text.length, 0);
  return Math.ceil(chars / 4);
}

/** Capability flag for the registry. */
export const ANTHROPIC_CAPABILITY = "DIRECT" as const;

export const anthropicFactory = (config?: Record<string, unknown>) =>
  new AnthropicAdapter({
    apiKey: (config?.apiKey as string) ?? process.env.ANTHROPIC_API_KEY ?? "",
    defaultModel: (config?.defaultModel as string) ?? "claude-opus-4-7",
    apiVersion: config?.apiVersion as string,
    baseURL: config?.baseURL as string,
    tier: (config?.tier as 1 | 2 | 3 | 4) ?? 1,
  });
