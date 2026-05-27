/**
 * OpenAI fallback client (GPT-4o / GPT-4o-mini).
 *
 * Used when Anthropic is rate-limited, down, or out of fallback budget.
 * Uses JSON mode + a manually validated Zod schema (OpenAI's `response_format`
 * with `json_schema` would also work).
 */
import OpenAI from "openai";
import type { z } from "zod";
import { OPENAI_MODEL_IDS, type AgentError, type ModelId } from "../types.js";
import { llmCallCents } from "./pricing.js";

export interface OpenAIStructuredCallParams<TSchema extends z.ZodTypeAny> {
  model: ModelId;
  systemPrompt: string;
  userPrompt: string;
  outputSchema: TSchema;
  outputSchemaName: string;
  outputSchemaDescription: string;
  maxTokens?: number;
  temperature?: number;
  abortSignal?: AbortSignal;
  onChunk?: (delta: string) => void;
}

export interface OpenAIStructuredCallResult<T> {
  output: T;
  raw: string;
  inputTokens: number;
  outputTokens: number;
  costCents: number;
  modelUsed: ModelId;
}

export interface OpenAIClientOptions {
  apiKey?: string;
  sdk?: OpenAI;
}

export class OpenAIClient {
  readonly sdk: OpenAI;

  constructor(opts: OpenAIClientOptions = {}) {
    if (opts.sdk) {
      this.sdk = opts.sdk;
    } else {
      const apiKey = opts.apiKey ?? process.env["OPENAI_API_KEY"];
      if (!apiKey) throw new Error("OpenAIClient: OPENAI_API_KEY missing");
      this.sdk = new OpenAI({ apiKey });
    }
  }

  async structuredCall<TSchema extends z.ZodTypeAny>(
    params: OpenAIStructuredCallParams<TSchema>,
  ): Promise<OpenAIStructuredCallResult<z.infer<TSchema>>> {
    const apiModel = OPENAI_MODEL_IDS[params.model] ?? params.model;

    try {
      const stream = await this.sdk.chat.completions.create(
        {
          model: apiModel,
          max_tokens: params.maxTokens ?? 4096,
          temperature: params.temperature ?? 0.7,
          stream: true,
          stream_options: { include_usage: true },
          messages: [
            { role: "system", content: params.systemPrompt },
            { role: "user", content: params.userPrompt },
          ],
          response_format: { type: "json_object" },
        },
        { signal: params.abortSignal },
      );

      let accumulated = "";
      let inputTokens = 0;
      let outputTokens = 0;

      for await (const chunk of stream) {
        const delta = chunk.choices?.[0]?.delta?.content ?? "";
        if (delta) {
          accumulated += delta;
          params.onChunk?.(delta);
        }
        if (chunk.usage) {
          inputTokens = chunk.usage.prompt_tokens ?? 0;
          outputTokens = chunk.usage.completion_tokens ?? 0;
        }
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(accumulated);
      } catch (e) {
        const err: AgentError = {
          kind: "schema_invalid",
          errors: [],
          raw: accumulated.slice(0, 500),
        };
        throw err;
      }

      const validation = params.outputSchema.safeParse(parsed);
      if (!validation.success) {
        const err: AgentError = {
          kind: "schema_invalid",
          errors: validation.error.issues,
          raw: JSON.stringify(parsed).slice(0, 2000),
        };
        throw err;
      }

      const costCents = llmCallCents(params.model, { inputTokens, outputTokens });

      return {
        output: validation.data as z.infer<TSchema>,
        raw: accumulated,
        inputTokens,
        outputTokens,
        costCents,
        modelUsed: params.model,
      };
    } catch (err) {
      if (typeof err === "object" && err !== null && "kind" in err) {
        throw err;
      }
      throw normalizeOpenAIError(err);
    }
  }
}

export function normalizeOpenAIError(err: unknown): AgentError {
  if (typeof err === "object" && err !== null) {
    const e = err as { status?: number; message?: string };
    if (e.status === 429) {
      return { kind: "rate_limit", provider: "openai", message: e.message ?? "rate limit" };
    }
    if (e.status === 401 || e.status === 403) {
      return { kind: "auth", provider: "openai", message: e.message ?? "auth failed" };
    }
    if (e.status && [500, 502, 503, 504].includes(e.status)) {
      return {
        kind: "transient",
        httpStatus: e.status as 500 | 502 | 503 | 504,
        provider: "openai",
        message: e.message ?? "transient",
      };
    }
    return { kind: "unknown", message: e.message ?? "openai error", raw: err };
  }
  return { kind: "unknown", message: String(err), raw: err };
}
