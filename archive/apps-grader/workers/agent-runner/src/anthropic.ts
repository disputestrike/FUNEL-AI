/**
 * Thin wrapper around the Anthropic SDK that:
 *  - returns a strict-JSON object validated by a zod schema,
 *  - tracks token usage and cache reads so the cost meter can charge,
 *  - enables prompt caching on the system block (system is identical across
 *    every audit, so we get ~90% input-token savings after first call).
 */

import Anthropic from "@anthropic-ai/sdk";
import type { ZodSchema } from "zod";

import { estimateCostCents } from "./cost-governor.js";

export interface AgentCallInput {
  apiKey: string;
  model: string;
  system: string;
  user: string;
  /** Optional screenshot for vision agents. */
  visionImageUrl?: string;
  maxTokens?: number;
  timeoutMs?: number;
}

export interface AgentCallResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
  rawText?: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  costCents: number;
  durationMs: number;
}

export async function callAgent<T>(
  schema: ZodSchema<T>,
  input: AgentCallInput,
): Promise<AgentCallResult<T>> {
  const client = new Anthropic({ apiKey: input.apiKey });
  const start = Date.now();

  const userContent: Anthropic.MessageParam["content"] = [];
  if (input.visionImageUrl) {
    userContent.push({
      type: "image",
      source: { type: "url", url: input.visionImageUrl },
    } as unknown as Anthropic.ImageBlockParam);
  }
  userContent.push({ type: "text", text: input.user });

  try {
    const resp = await Promise.race([
      client.messages.create({
        model: input.model,
        max_tokens: input.maxTokens ?? 1024,
        system: [
          {
            type: "text",
            text: input.system,
            // @ts-expect-error — SDK accepts this; types lag.
            cache_control: { type: "ephemeral" },
          },
        ] as unknown as string,
        messages: [{ role: "user", content: userContent }],
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("agent_timeout")), input.timeoutMs ?? 12_000),
      ),
    ]);

    const durationMs = Date.now() - start;

    const text = resp.content
      .filter((c) => c.type === "text")
      .map((c) => (c.type === "text" ? c.text : ""))
      .join("\n");

    const usage = resp.usage as unknown as {
      input_tokens: number;
      output_tokens: number;
      cache_read_input_tokens?: number;
    };
    const inputTokens = usage?.input_tokens ?? 0;
    const outputTokens = usage?.output_tokens ?? 0;
    const cacheReadTokens = usage?.cache_read_input_tokens ?? 0;
    const costCents = estimateCostCents(input.model, inputTokens, outputTokens, cacheReadTokens);

    const json = extractJsonBlock(text);
    if (!json) {
      return {
        ok: false,
        error: "no_json_block",
        rawText: text,
        inputTokens,
        outputTokens,
        cacheReadTokens,
        costCents,
        durationMs,
      };
    }

    const parsed = schema.safeParse(JSON.parse(json));
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.toString(),
        rawText: text,
        inputTokens,
        outputTokens,
        cacheReadTokens,
        costCents,
        durationMs,
      };
    }

    return {
      ok: true,
      data: parsed.data,
      rawText: text,
      inputTokens,
      outputTokens,
      cacheReadTokens,
      costCents,
      durationMs,
    };
  } catch (err) {
    const durationMs = Date.now() - start;
    return {
      ok: false,
      error: String(err),
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      costCents: 0,
      durationMs,
    };
  }
}

/**
 * Pull the first JSON object out of an agent response. Handles markdown
 * fences (```json...```) and leading/trailing prose.
 */
export function extractJsonBlock(text: string): string | null {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) return fenceMatch[1]!.trim();

  // Find the first balanced JSON object.
  let depth = 0;
  let start = -1;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0 && start !== -1) {
        return text.slice(start, i + 1);
      }
    }
  }
  return null;
}
