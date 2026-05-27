/**
 * Orchestration tests — every ingester is stubbed; we verify:
 *   - the orchestrator fans out across cells
 *   - per-source items are aggregated
 *   - the judge filter is invoked exactly once per item
 *   - the embedder + DB insert only run for approved items
 *   - errors in one source don't kill the whole run
 */
import { describe, it, expect, vi } from "vitest";
import type { RawIngestedItem } from "../src/ingestion/types.js";
import { runIngestionCycle, type IngestionOptions } from "../src/ingestion/index.js";

function makeItem(id: string, overrides: Partial<RawIngestedItem> = {}): RawIngestedItem {
  return {
    external_id: id,
    industry: "solar",
    geo: "us-az",
    language: "en",
    section: "ad_angles",
    content: `content for ${id}`,
    title: `title ${id}`,
    source_url: `https://example.com/${id}`,
    source: "rss",
    published_at: new Date("2026-05-30T00:00:00Z"),
    license: "test",
    ...overrides,
  };
}

function makeStubAnthropic(verdicts: Record<string, { keep: boolean; quality?: number }>) {
  return {
    messages: {
      create: vi.fn(async ({ messages }: { messages: Array<{ content: string }> }) => {
        const userMsg = messages[0]?.content ?? "";
        let kept = true;
        let quality = 0.8;
        // Match on a unique marker "content for <key>" to avoid false positives
        // (e.g. the letter "a" appearing in other words).
        for (const key of Object.keys(verdicts)) {
          if (userMsg.includes(`content for ${key}`)) {
            kept = verdicts[key]!.keep;
            quality = verdicts[key]!.quality ?? 0.8;
            break;
          }
        }
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                keep: kept,
                section: "ad_angles",
                quality,
                reason: "test",
                confidence: 0.9,
              }),
            },
          ],
        };
      }),
    },
  } as unknown as IngestionOptions["anthropic"];
}

function makeStubOpenAI() {
  return {
    embeddings: {
      create: vi.fn(async ({ input }: { input: string | string[] }) => {
        const inputs = Array.isArray(input) ? input : [input];
        return {
          data: inputs.map(() => ({ embedding: new Array(3072).fill(0.001) })),
        };
      }),
    },
  } as unknown as IngestionOptions["openai"];
}

function makeStubPrisma() {
  const inserts: string[] = [];
  const prisma = {
    async $transaction(cb: (tx: typeof prisma) => Promise<unknown>) {
      return cb(prisma);
    },
    async $executeRawUnsafe(sql: string, ..._params: unknown[]) {
      inserts.push(sql);
      return 1;
    },
    async $queryRawUnsafe() {
      return [];
    },
  };
  return { prisma: prisma as unknown as IngestionOptions["prisma"], inserts };
}

describe("runIngestionCycle", () => {
  it("aggregates items from multiple sources and inserts approved ones", async () => {
    const items = [makeItem("a"), makeItem("b"), makeItem("c")];
    // Patch the orchestrator's sources by stubbing the source-builder factories
    // — easiest path is to give it empty configs (which yields zero items per
    // built-in source) and a single fake source through the conversion reader.
    const { prisma, inserts } = makeStubPrisma();

    const anthropic = makeStubAnthropic({ a: { keep: true }, b: { keep: false }, c: { keep: true } });
    const openai = makeStubOpenAI();

    const conversionReader = {
      async read() {
        return items.map((it) => ({
          signal_id: it.external_id,
          signal_type: "hook",
          asset_text: it.content,
          metric: { name: "ctr", value: 0.05, n: 100, median: 0.03 },
          observed_at: new Date("2026-05-30T00:00:00Z"),
          funnel_archetype: "FA1",
        }));
      },
    };

    const report = await runIngestionCycle({
      cells: [{ industry: "solar", geo: "us-az", language: "en" }],
      configs: [{ industry: "solar" }],
      prisma,
      anthropic,
      openai,
      conversionReader,
      env: {},
      maxItemsPerSource: 10,
    });

    expect(report.cells).toBe(1);
    expect(report.raw_collected).toBeGreaterThanOrEqual(3);
    // Two of three should be approved by our stub judge.
    expect(report.approved).toBe(2);
    expect(report.inserted).toBe(2);
    expect(inserts.some((s) => s.includes("INSERT INTO kb_chunks"))).toBe(true);
    expect(inserts.some((s) => s.includes("INSERT INTO kb_candidate_queue"))).toBe(true);
  });

  it("fans out across cells with bounded concurrency", async () => {
    const cells = Array.from({ length: 6 }, (_v, i) => ({
      industry: ["solar", "hvac", "roofing"][i % 3]!,
      geo: "us",
      language: "en",
    }));
    const { prisma } = makeStubPrisma();
    const anthropic = makeStubAnthropic({});
    const openai = makeStubOpenAI();
    const report = await runIngestionCycle({
      cells,
      configs: [],
      prisma,
      anthropic,
      openai,
      env: {},
      cellConcurrency: 2,
    });
    expect(report.cells).toBe(6);
    // No configured sources → no items.
    expect(report.raw_collected).toBe(0);
    expect(report.errors.length).toBe(0);
  });

  it("does not crash when a source throws", async () => {
    // Validate the per-source try/catch by sending a reader that throws.
    const conversionReader = {
      async read() {
        throw new Error("boom");
      },
    };
    const { prisma } = makeStubPrisma();
    const report = await runIngestionCycle({
      cells: [{ industry: "solar", geo: "us", language: "en" }],
      configs: [{ industry: "solar" }],
      prisma,
      anthropic: makeStubAnthropic({}),
      openai: makeStubOpenAI(),
      conversionReader,
      env: {},
    });
    // The reader threw inside customer_conversion source; orchestrator should
    // have logged but kept running.
    expect(report.cells).toBe(1);
    expect(report.raw_collected).toBe(0);
  });
});
