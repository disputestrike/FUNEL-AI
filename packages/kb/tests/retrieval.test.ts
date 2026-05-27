/**
 * Retrieval correctness (mocked pgvector).
 *
 * The Prisma client is stubbed with a minimal `$queryRawUnsafe` that returns
 * fake rows including a pre-computed `similarity`. We assert:
 *   - recency-weighted scoring boosts recent items above ancient ones.
 *   - quality_score filtering works.
 *   - top_k truncation works.
 *   - cache hit on a repeated query.
 *   - section_filter parameter is propagated.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { retrieve, clearCache, computeRecencyWeight } from "../src/retrieval.js";
import type { RetrievalQuery } from "../src/types.js";

interface FakeRow {
  id: string;
  industry: string;
  geo: string;
  language: string;
  section: string;
  content: string;
  source: string;
  source_url: string | null;
  license: string;
  quality_score: number;
  active: boolean;
  ingested_at: Date;
  expires_at: Date | null;
  similarity: number;
}

function makeFakePrisma(rows: FakeRow[], capture?: { sql: string[]; params: unknown[][] }) {
  return {
    async $queryRawUnsafe(sql: string, ...params: unknown[]) {
      if (capture) {
        capture.sql.push(sql);
        capture.params.push(params);
      }
      return rows;
    },
  } as unknown as Parameters<typeof retrieve>[0]["prisma"];
}

const stubEmbed = async (_text: string): Promise<number[]> => {
  return new Array(3072).fill(0).map((_v, i) => (i === 0 ? 1 : 0));
};

beforeEach(() => {
  clearCache();
});

describe("computeRecencyWeight", () => {
  it("returns 1 for zero-age items", () => {
    const now = new Date("2026-06-01T00:00:00Z");
    expect(computeRecencyWeight(now, now, 90)).toBe(1);
  });
  it("halves at the half-life", () => {
    const ingested = new Date("2026-03-03T00:00:00Z"); // 90 days before
    const now = new Date("2026-06-01T00:00:00Z");
    const w = computeRecencyWeight(ingested, now, 90);
    expect(w).toBeGreaterThan(0.49);
    expect(w).toBeLessThan(0.51);
  });
  it("decays further beyond the half-life", () => {
    const ingested = new Date("2025-12-03T00:00:00Z"); // 180 days before
    const now = new Date("2026-06-01T00:00:00Z");
    const w = computeRecencyWeight(ingested, now, 90);
    expect(w).toBeGreaterThan(0.24);
    expect(w).toBeLessThan(0.26);
  });
});

describe("retrieve()", () => {
  const fixedNow = () => new Date("2026-06-01T00:00:00Z");
  const baseQuery: RetrievalQuery = {
    industry: "solar",
    geo: "us-az",
    language: "en",
    query_text: "what hooks work for bill-shock buyers?",
    top_k: 5,
    recency_half_life_days: 90,
    min_quality: 0,
    exclude_expired: true,
    include_candidates: false,
  };

  it("returns rows sorted by score with recency weighting applied", async () => {
    const rows: FakeRow[] = [
      {
        id: "c1",
        industry: "solar",
        geo: "us-az",
        language: "en",
        section: "ad_angles",
        content: "ancient strong-similarity row",
        source: "rss",
        source_url: null,
        license: "internal",
        quality_score: 1,
        active: true,
        ingested_at: new Date("2025-01-01T00:00:00Z"), // ~500d old
        expires_at: null,
        similarity: 0.95,
      },
      {
        id: "c2",
        industry: "solar",
        geo: "us-az",
        language: "en",
        section: "ad_angles",
        content: "fresh moderate-similarity row",
        source: "rss",
        source_url: null,
        license: "internal",
        quality_score: 1,
        active: true,
        ingested_at: new Date("2026-05-30T00:00:00Z"),
        expires_at: null,
        similarity: 0.75,
      },
    ];
    const prisma = makeFakePrisma(rows);
    const results = await retrieve({ prisma, embed: stubEmbed, now: fixedNow }, baseQuery);
    expect(results.length).toBe(2);
    // Fresh row should win because recency_weight crushes the ancient row.
    expect(results[0]!.chunk.id).toBe("c2");
    expect(results[1]!.chunk.id).toBe("c1");
    expect(results[0]!.score).toBeGreaterThan(results[1]!.score);
  });

  it("filters out items below min_quality", async () => {
    const rows: FakeRow[] = [
      {
        id: "c-good",
        industry: "solar",
        geo: "us-az",
        language: "en",
        section: "pain_points",
        content: "good",
        source: "rss",
        source_url: null,
        license: "internal",
        quality_score: 0.9,
        active: true,
        ingested_at: fixedNow(),
        expires_at: null,
        similarity: 0.5,
      },
      {
        id: "c-bad",
        industry: "solar",
        geo: "us-az",
        language: "en",
        section: "pain_points",
        content: "bad",
        source: "rss",
        source_url: null,
        license: "internal",
        quality_score: 0.1,
        active: true,
        ingested_at: fixedNow(),
        expires_at: null,
        similarity: 0.9,
      },
    ];
    const prisma = makeFakePrisma(rows);
    const results = await retrieve(
      { prisma, embed: stubEmbed, now: fixedNow },
      { ...baseQuery, min_quality: 0.5 },
    );
    expect(results.length).toBe(1);
    expect(results[0]!.chunk.id).toBe("c-good");
  });

  it("truncates to top_k", async () => {
    const rows: FakeRow[] = Array.from({ length: 10 }, (_v, i) => ({
      id: `c${i}`,
      industry: "solar",
      geo: "us-az",
      language: "en",
      section: "ad_angles",
      content: `row ${i}`,
      source: "rss",
      source_url: null,
      license: "internal",
      quality_score: 1,
      active: true,
      ingested_at: fixedNow(),
      expires_at: null,
      similarity: 0.9 - i * 0.05,
    }));
    const prisma = makeFakePrisma(rows);
    const results = await retrieve(
      { prisma, embed: stubEmbed, now: fixedNow },
      { ...baseQuery, top_k: 3 },
    );
    expect(results.length).toBe(3);
  });

  it("caches identical queries", async () => {
    let calls = 0;
    const prisma = {
      async $queryRawUnsafe() {
        calls++;
        return [];
      },
    } as unknown as Parameters<typeof retrieve>[0]["prisma"];
    await retrieve({ prisma, embed: stubEmbed, now: fixedNow }, baseQuery);
    await retrieve({ prisma, embed: stubEmbed, now: fixedNow }, baseQuery);
    expect(calls).toBe(1);
  });

  it("propagates section_filter into SQL params", async () => {
    const capture = { sql: [] as string[], params: [] as unknown[][] };
    const prisma = makeFakePrisma([], capture);
    await retrieve(
      { prisma, embed: stubEmbed, now: fixedNow },
      { ...baseQuery, section_filter: ["ad_angles", "pain_points"] },
    );
    expect(capture.params.length).toBe(1);
    const params = capture.params[0]!;
    // params: [literal, industry, geo, language, sections]
    expect(params[4]).toEqual(["ad_angles", "pain_points"]);
  });
});
