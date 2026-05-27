/**
 * LLM-as-judge filter tests.
 *
 * Anthropic SDK is stubbed. We verify:
 *   - Valid JSON verdict is parsed and returned.
 *   - Section field is clamped to the allowed set.
 *   - Malformed JSON drops the item.
 *   - judgeBatch processes items concurrently up to the cap.
 *   - judge_model is recorded on every verdict.
 */
import { describe, it, expect, vi } from "vitest";
import { judgeOne, judgeBatch, type FilterDeps } from "../src/pipeline/filter.js";
import type { RawIngestedItem } from "../src/ingestion/types.js";

function item(id: string): RawIngestedItem {
  return {
    external_id: id,
    industry: "solar",
    geo: "us-az",
    language: "en",
    section: "ad_angles",
    content: `body ${id}`,
    source_url: null,
    source: "rss",
    published_at: new Date(),
    license: "test",
  };
}

function stubAnthropic(responder: (item: string) => string): FilterDeps["anthropic"] {
  return {
    messages: {
      create: vi.fn(async ({ messages }: { messages: Array<{ content: string }> }) => {
        const userMsg = messages[0]?.content ?? "";
        return { content: [{ type: "text" as const, text: responder(userMsg) }] };
      }),
    },
  } as unknown as FilterDeps["anthropic"];
}

describe("judgeOne", () => {
  it("parses a valid keep verdict", async () => {
    const anthropic = stubAnthropic(() =>
      JSON.stringify({
        keep: true,
        section: "pain_points",
        quality: 0.7,
        reason: "verbatim buyer phrase present",
        confidence: 0.85,
      }),
    );
    const v = await judgeOne({ anthropic }, item("x"));
    expect(v.keep).toBe(true);
    expect(v.section).toBe("pain_points");
    expect(v.quality).toBe(0.7);
    expect(v.confidence).toBe(0.85);
    expect(v.judge_model).toBeTruthy();
  });

  it("falls back to input section when judge returns invalid section", async () => {
    const anthropic = stubAnthropic(() =>
      JSON.stringify({
        keep: true,
        section: "not_a_section",
        quality: 0.5,
        reason: "ok",
        confidence: 0.5,
      }),
    );
    const v = await judgeOne({ anthropic }, item("x"));
    expect(v.section).toBe("ad_angles"); // original
  });

  it("drops items when the judge returns non-JSON", async () => {
    const anthropic = stubAnthropic(() => "Sure thing! Here you go: keep this one.");
    const v = await judgeOne({ anthropic }, item("x"));
    expect(v.keep).toBe(false);
    expect(v.reason).toMatch(/non-JSON/);
  });

  it("handles fenced JSON code blocks", async () => {
    const anthropic = stubAnthropic(
      () =>
        "```json\n" +
        JSON.stringify({
          keep: false,
          section: "ad_angles",
          quality: 0.1,
          reason: "noise",
          confidence: 0.6,
        }) +
        "\n```",
    );
    const v = await judgeOne({ anthropic }, item("x"));
    expect(v.keep).toBe(false);
    expect(v.quality).toBe(0.1);
  });

  it("returns drop verdict on transport errors", async () => {
    const anthropic = {
      messages: {
        create: vi.fn(async () => {
          throw new Error("network blew up");
        }),
      },
    } as unknown as FilterDeps["anthropic"];
    const v = await judgeOne({ anthropic }, item("x"));
    expect(v.keep).toBe(false);
    expect(v.reason).toMatch(/judge error/);
  });
});

describe("judgeBatch", () => {
  it("processes every item exactly once", async () => {
    const anthropic = stubAnthropic(() =>
      JSON.stringify({
        keep: true,
        section: "ad_angles",
        quality: 0.6,
        reason: "ok",
        confidence: 0.7,
      }),
    );
    const items = ["a", "b", "c", "d", "e", "f"].map(item);
    const results = await judgeBatch({ anthropic, concurrency: 3 }, items);
    expect(results.length).toBe(items.length);
    expect(new Set(results.map((r) => r.item.external_id))).toEqual(
      new Set(["a", "b", "c", "d", "e", "f"]),
    );
  });

  it("honors concurrency cap", async () => {
    let inflight = 0;
    let peak = 0;
    const anthropic = {
      messages: {
        create: vi.fn(async () => {
          inflight++;
          peak = Math.max(peak, inflight);
          await new Promise((r) => setTimeout(r, 5));
          inflight--;
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  keep: true,
                  section: "ad_angles",
                  quality: 0.5,
                  reason: "ok",
                  confidence: 0.5,
                }),
              },
            ],
          };
        }),
      },
    } as unknown as FilterDeps["anthropic"];
    const items = Array.from({ length: 12 }, (_v, i) => item(`i${i}`));
    await judgeBatch({ anthropic, concurrency: 4 }, items);
    expect(peak).toBeLessThanOrEqual(4);
    expect(peak).toBeGreaterThan(1);
  });
});
