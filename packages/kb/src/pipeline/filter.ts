/**
 * LLM-as-judge filter.
 *
 * Every raw ingested item is gated by Haiku 4.5 (chosen for speed + cost —
 * we filter thousands of items per night). The judge returns:
 *
 *   {
 *     "keep": boolean,
 *     "section": <one of KB_SECTIONS>,
 *     "quality": 0..1,
 *     "reason": "...",
 *     "confidence": 0..1
 *   }
 *
 * Items with `keep=true` are passed to the embedder and enter the candidate
 * queue. Items with `keep=false` are dropped but the verdict is event-logged
 * for later eval / model improvement.
 *
 * The prompt is intentionally strict — better to under-keep than to pollute
 * the KB. The domain-expert review step is the final approval, not the LLM.
 */
import type { Anthropic } from "@anthropic-ai/sdk";
import { KB_SECTIONS, type KBSection } from "../types.js";
import type { RawIngestedItem } from "../ingestion/types.js";

export interface FilterVerdict {
  keep: boolean;
  section: KBSection;
  quality: number;
  reason: string;
  confidence: number;
  judge_model: string;
}

export interface FilterDeps {
  anthropic: Anthropic;
  model?: string;
  /** Hard cap on parallel judge calls. */
  concurrency?: number;
}

const DEFAULT_MODEL = "claude-haiku-4-5";

const SYSTEM_PROMPT = `You are a content quality judge for GoFunnelAI's Industry Knowledge Base.

You receive a raw piece of ingested content (news article, RSS post, Reddit thread, ad creative, transcript snippet, or conversion signal) and decide whether it belongs in our retrieval index for an industry vertical.

KEEP IF:
- The content contains concrete, sourceable, industry-specific information that would help generate a high-converting funnel for that vertical
- Specifically useful: buyer pain phrasings, urgency triggers, ad angles being tested by competitors, regulatory updates, conversion benchmarks, named compliance rules
- It's not duplicative of common knowledge already in the pack template

DROP IF:
- Generic marketing fluff, listicles, SEO content with no substance
- Off-topic for the vertical
- Defamatory, NSFW, or politically inflammatory in a way that taints the KB
- Personally identifiable information (names + addresses) — these must not enter the KB
- Anything that promotes a specific competitor product line (we want angles, not endorsements)

Return STRICT JSON with no commentary, matching this schema:
{
  "keep": true | false,
  "section": "<one of: ${KB_SECTIONS.join(", ")}>",
  "quality": <number 0..1>,
  "reason": "<one sentence>",
  "confidence": <number 0..1>
}

Quality scale:
  0.0–0.3 — low, drop or candidate-only
  0.3–0.6 — workable
  0.6–0.9 — strong
  0.9–1.0 — gold (verbatim buyer phrase, sourced benchmark, regulatory citation)`;

function buildUserPrompt(item: RawIngestedItem): string {
  return [
    `Industry: ${item.industry}`,
    `Geo: ${item.geo}`,
    `Language: ${item.language}`,
    `Source: ${item.source}`,
    `Title: ${item.title ?? "(none)"}`,
    `URL: ${item.source_url ?? "(none)"}`,
    `Published: ${item.published_at.toISOString()}`,
    ``,
    `Content:`,
    item.content.slice(0, 6000),
  ].join("\n");
}

function safeParseVerdict(text: string, fallbackSection: KBSection): FilterVerdict | null {
  // Strip code fences if the model wrapped its JSON.
  const cleaned = text
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  try {
    const parsed = JSON.parse(cleaned) as Partial<FilterVerdict>;
    const section = (KB_SECTIONS as readonly string[]).includes(parsed.section ?? "")
      ? (parsed.section as KBSection)
      : fallbackSection;
    return {
      keep: Boolean(parsed.keep),
      section,
      quality: clamp01(Number(parsed.quality ?? 0)),
      reason: typeof parsed.reason === "string" ? parsed.reason : "",
      confidence: clamp01(Number(parsed.confidence ?? 0)),
      judge_model: "",
    };
  } catch {
    return null;
  }
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

/**
 * Judge a single item. Returns a verdict; on transient LLM errors returns
 * `keep=false` with a low-confidence reason so the orchestrator can drop
 * it without crashing the run.
 */
export async function judgeOne(
  deps: FilterDeps,
  item: RawIngestedItem,
): Promise<FilterVerdict> {
  const model = deps.model ?? DEFAULT_MODEL;
  try {
    const resp = await deps.anthropic.messages.create({
      model,
      max_tokens: 256,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserPrompt(item) }],
    });
    const text = resp.content
      .filter((c): c is { type: "text"; text: string } => c.type === "text")
      .map((c) => c.text)
      .join("\n");
    const parsed = safeParseVerdict(text, item.section);
    if (!parsed) {
      return {
        keep: false,
        section: item.section,
        quality: 0,
        reason: "judge returned non-JSON",
        confidence: 0,
        judge_model: model,
      };
    }
    parsed.judge_model = model;
    return parsed;
  } catch (err) {
    return {
      keep: false,
      section: item.section,
      quality: 0,
      reason: `judge error: ${String(err).slice(0, 200)}`,
      confidence: 0,
      judge_model: model,
    };
  }
}

/**
 * Judge a batch with bounded concurrency.
 */
export async function judgeBatch(
  deps: FilterDeps,
  items: RawIngestedItem[],
): Promise<Array<{ item: RawIngestedItem; verdict: FilterVerdict }>> {
  const concurrency = Math.max(1, Math.min(deps.concurrency ?? 8, 32));
  const results: Array<{ item: RawIngestedItem; verdict: FilterVerdict }> = [];
  let cursor = 0;

  const workers = Array.from({ length: concurrency }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      const item = items[i];
      if (!item) return;
      const verdict = await judgeOne(deps, item);
      results[i] = { item, verdict };
    }
  });
  await Promise.all(workers);
  return results.filter(Boolean);
}
