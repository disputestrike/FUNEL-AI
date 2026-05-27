/**
 * Default in-process prompt-cache adapter.
 *
 * The real production cache is Anthropic's prompt cache (set via `cache_control`
 * markers on system/user blocks). This adapter generates deterministic keys
 * for cache invalidation observability and wraps content with `cache_control`
 * markers that the AnthropicClient honors.
 */
import { createHash } from "node:crypto";
import type { PromptCacheClient } from "../types.js";

export class DefaultPromptCacheClient implements PromptCacheClient {
  key(namespace: string, version: number | string, dims: Record<string, string>): string {
    const keys = Object.keys(dims).sort();
    const tail = keys.map((k) => `${k}=${dims[k]}`).join("|");
    const h = createHash("sha256")
      .update(`${namespace}:v${version}:${tail}`)
      .digest("hex")
      .slice(0, 16);
    return `${namespace}:v${version}:${h}`;
  }

  markEphemeral(content: string, _key: string): {
    content: string;
    cache_control: { type: "ephemeral" };
  } {
    return { content, cache_control: { type: "ephemeral" } };
  }
}
