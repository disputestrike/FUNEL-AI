/**
 * Anthropic client wrapper.
 *
 * Wraps @anthropic-ai/sdk to:
 *   1. Emit AgentEvent chunks while streaming.
 *   2. Force structured output via tool_use ("output_schema" pattern).
 *   3. Apply cache_control markers to system + user blocks.
 *   4. Normalize errors to AgentError taxonomy.
 *   5. Return token + cache-hit counts for cost accounting.
 *
 * Production: the real Anthropic SDK is used. Tests inject a mock client.
 */
import Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";
import { ANTHROPIC_MODEL_IDS, type AgentError, type ModelId } from "../types.js";
import { llmCallCents } from "./pricing.js";

export interface AnthropicCacheableBlock {
  /** Block content as a string. */
  text: string;
  /** Marks this block for ephemeral cache (5min default; 1h on Sonnet/Opus 4.x). */
  cacheable: boolean;
}

export interface AnthropicStructuredCallParams<TSchema extends z.ZodTypeAny> {
  model: ModelId;
  /** System blocks, in order. Cacheable blocks must come first for max prefix hit. */
  systemBlocks: AnthropicCacheableBlock[];
  /** Cacheable user-prefix blocks (KB excerpts, brand tokens, etc.). */
  userPrefixBlocks: AnthropicCacheableBlock[];
  /** The fresh user tail (not cached). */
  userTail: string;
  /** Zod schema describing the desired output. We feed Anthropic the JSON Schema via tool_use. */
  outputSchema: TSchema;
  outputSchemaName: string;
  outputSchemaDescription: string;
  maxTokens?: number;
  temperature?: number;
  abortSignal?: AbortSignal;
  /** Optional on-chunk callback for streaming UI. */
  onChunk?: (delta: string) => void;
}

export interface AnthropicStructuredCallResult<T> {
  output: T;
  raw: string;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  cacheWriteTokens: number;
  costCents: number;
  modelUsed: ModelId;
}

/** Minimal interface the agents need; the real SDK satisfies this. */
export interface AnthropicLike {
  messages: {
    create(params: unknown): Promise<unknown>;
    stream?(params: unknown): Promise<unknown>;
  };
}

export interface AnthropicClientOptions {
  apiKey?: string;
  /** Allow injection for tests. */
  sdk?: Anthropic;
  defaultHeaders?: Record<string, string>;
}

export class AnthropicClient {
  readonly sdk: Anthropic;

  constructor(opts: AnthropicClientOptions = {}) {
    if (opts.sdk) {
      this.sdk = opts.sdk;
    } else {
      const apiKey = opts.apiKey ?? process.env["ANTHROPIC_API_KEY"];
      if (!apiKey) {
        throw new Error("AnthropicClient: ANTHROPIC_API_KEY missing");
      }
      this.sdk = new Anthropic({
        apiKey,
        defaultHeaders: {
          // Enable extended-context prompt caching for Sonnet/Opus 4.x.
          "anthropic-beta": "prompt-caching-2024-07-31",
          ...(opts.defaultHeaders ?? {}),
        },
      });
    }
  }

  /**
   * Structured streaming call. Uses Anthropic tool_use to force a JSON output
   * matching the Zod schema, then validates locally.
   */
  async structuredCall<TSchema extends z.ZodTypeAny>(
    params: AnthropicStructuredCallParams<TSchema>,
  ): Promise<AnthropicStructuredCallResult<z.infer<TSchema>>> {
    const apiModel = ANTHROPIC_MODEL_IDS[params.model] ?? params.model;
    const jsonSchema = zodToJsonSchema(params.outputSchema);

    // Build system blocks with cache_control markers.
    const system = params.systemBlocks.map((b) => ({
      type: "text" as const,
      text: b.text,
      ...(b.cacheable ? { cache_control: { type: "ephemeral" as const } } : {}),
    }));

    // Build user content blocks: cacheable prefix first, then the fresh tail.
    const userContent: Array<{
      type: "text";
      text: string;
      cache_control?: { type: "ephemeral" };
    }> = [];
    for (const block of params.userPrefixBlocks) {
      userContent.push({
        type: "text",
        text: block.text,
        ...(block.cacheable ? { cache_control: { type: "ephemeral" } } : {}),
      });
    }
    userContent.push({ type: "text", text: params.userTail });

    const tools = [
      {
        name: params.outputSchemaName,
        description: params.outputSchemaDescription,
        input_schema: jsonSchema,
      },
    ];

    try {
      const stream = await this.sdk.messages.stream(
        {
          model: apiModel,
          max_tokens: params.maxTokens ?? 4096,
          temperature: params.temperature ?? 0.7,
          system,
          messages: [
            {
              role: "user",
              content: userContent,
            },
          ],
          tools,
          tool_choice: { type: "tool", name: params.outputSchemaName },
        },
        { signal: params.abortSignal },
      );

      let toolInputJson = "";
      let lastDelta = "";

      stream.on("text", (text: string) => {
        if (params.onChunk && text) {
          lastDelta = text;
          params.onChunk(text);
        }
      });

      stream.on("inputJson", (partialJson: string) => {
        if (params.onChunk && partialJson) {
          params.onChunk(partialJson);
        }
        toolInputJson = partialJson;
      });

      const finalMessage = await stream.finalMessage();

      // Extract structured output from tool_use block.
      let parsed: unknown = null;
      for (const block of finalMessage.content) {
        if (block.type === "tool_use" && block.name === params.outputSchemaName) {
          parsed = block.input;
          break;
        }
      }

      if (parsed == null) {
        // Fallback: try last accumulated JSON.
        if (toolInputJson) {
          try {
            parsed = JSON.parse(toolInputJson);
          } catch {
            /* fall through */
          }
        }
      }

      if (parsed == null) {
        throw normalizeAnthropicError(
          new Error("Anthropic returned no tool_use block matching schema"),
          "anthropic",
        );
      }

      const validation = params.outputSchema.safeParse(parsed);
      if (!validation.success) {
        const err: AgentError = {
          kind: "schema_invalid",
          errors: validation.error.issues,
          raw: JSON.stringify(parsed),
        };
        throw err;
      }

      const usage = finalMessage.usage;
      const inputTokens = (usage?.input_tokens ?? 0) as number;
      const outputTokens = (usage?.output_tokens ?? 0) as number;
      const cachedInputTokens = ((usage as { cache_read_input_tokens?: number })?.cache_read_input_tokens ?? 0) as number;
      const cacheWriteTokens = ((usage as { cache_creation_input_tokens?: number })?.cache_creation_input_tokens ?? 0) as number;

      const costCents = llmCallCents(params.model, {
        inputTokens: inputTokens + cacheWriteTokens,
        outputTokens,
        cachedInputTokens,
      });

      return {
        output: validation.data as z.infer<TSchema>,
        raw: lastDelta || toolInputJson,
        inputTokens,
        outputTokens,
        cachedInputTokens,
        cacheWriteTokens,
        costCents,
        modelUsed: params.model,
      };
    } catch (err) {
      if (isAgentError(err)) throw err;
      throw normalizeAnthropicError(err, "anthropic");
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isAgentError(x: unknown): x is AgentError {
  return typeof x === "object" && x !== null && "kind" in x;
}

export function normalizeAnthropicError(err: unknown, provider: string): AgentError {
  if (typeof err === "object" && err !== null) {
    const e = err as { status?: number; message?: string; headers?: Record<string, string> };
    if (e.status === 429) {
      const retry = e.headers?.["retry-after"];
      return {
        kind: "rate_limit",
        provider,
        retryAfterMs: retry ? Number(retry) * 1000 : undefined,
        message: e.message ?? "rate limited",
      };
    }
    if (e.status === 401 || e.status === 403) {
      return { kind: "auth", provider, message: e.message ?? "auth failed" };
    }
    if (e.status && [500, 502, 503, 504].includes(e.status)) {
      return {
        kind: "transient",
        httpStatus: e.status as 500 | 502 | 503 | 504,
        provider,
        message: e.message ?? "transient",
      };
    }
    const msg = e.message ?? "unknown anthropic error";
    if (/policy/i.test(msg) || /content_policy/i.test(msg)) {
      return { kind: "content_policy", provider, reason: msg };
    }
    return { kind: "unknown", message: msg, raw: err };
  }
  return { kind: "unknown", message: String(err), raw: err };
}

/**
 * Minimal Zod → JSON Schema converter (subset sufficient for our agents).
 * For complex unions/intersections we lean on zod-to-json-schema if available,
 * but the inline converter avoids a hard dep.
 */
export function zodToJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  return zodInner(schema);
}

function zodInner(schema: z.ZodTypeAny): Record<string, unknown> {
  const def = schema._def as { typeName?: string } & Record<string, unknown>;
  const name = def.typeName;

  switch (name) {
    case "ZodObject": {
      const shape = (def["shape"] as () => Record<string, z.ZodTypeAny>)();
      const properties: Record<string, unknown> = {};
      const required: string[] = [];
      for (const [key, value] of Object.entries(shape)) {
        properties[key] = zodInner(value);
        if (!value.isOptional()) required.push(key);
      }
      return {
        type: "object",
        properties,
        required,
        additionalProperties: false,
      };
    }
    case "ZodArray": {
      return {
        type: "array",
        items: zodInner(def["type"] as z.ZodTypeAny),
        ...(def["minLength"] ? { minItems: (def["minLength"] as { value: number }).value } : {}),
        ...(def["maxLength"] ? { maxItems: (def["maxLength"] as { value: number }).value } : {}),
      };
    }
    case "ZodString": {
      const checks = (def["checks"] ?? []) as Array<{ kind: string; value?: unknown }>;
      const o: Record<string, unknown> = { type: "string" };
      for (const c of checks) {
        if (c.kind === "min") o["minLength"] = c.value;
        if (c.kind === "max") o["maxLength"] = c.value;
        if (c.kind === "regex") o["pattern"] = String(c.value).replace(/^\//, "").replace(/\/[gimsuy]*$/, "");
        if (c.kind === "email") o["format"] = "email";
        if (c.kind === "url") o["format"] = "uri";
      }
      return o;
    }
    case "ZodNumber": {
      const checks = (def["checks"] ?? []) as Array<{ kind: string; value?: unknown }>;
      const o: Record<string, unknown> = { type: "number" };
      for (const c of checks) {
        if (c.kind === "int") o["type"] = "integer";
        if (c.kind === "min") o["minimum"] = c.value;
        if (c.kind === "max") o["maximum"] = c.value;
      }
      return o;
    }
    case "ZodBoolean":
      return { type: "boolean" };
    case "ZodEnum":
      return { type: "string", enum: def["values"] as string[] };
    case "ZodNativeEnum":
      return { type: "string", enum: Object.values(def["values"] as Record<string, string>) };
    case "ZodLiteral":
      return { const: def["value"] };
    case "ZodOptional":
      return zodInner(def["innerType"] as z.ZodTypeAny);
    case "ZodNullable":
      return { ...zodInner(def["innerType"] as z.ZodTypeAny), nullable: true };
    case "ZodDefault":
      return zodInner(def["innerType"] as z.ZodTypeAny);
    case "ZodUnion":
    case "ZodDiscriminatedUnion": {
      const options = (def["options"] as z.ZodTypeAny[]) ?? [];
      return { anyOf: options.map(zodInner) };
    }
    case "ZodTuple": {
      const items = ((def["items"] as z.ZodTypeAny[]) ?? []).map(zodInner);
      return { type: "array", items, minItems: items.length, maxItems: items.length };
    }
    case "ZodRecord":
      return {
        type: "object",
        additionalProperties: zodInner(def["valueType"] as z.ZodTypeAny),
      };
    case "ZodAny":
    case "ZodUnknown":
      return {};
    default:
      return {};
  }
}
