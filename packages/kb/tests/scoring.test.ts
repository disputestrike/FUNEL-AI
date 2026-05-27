/**
 * Recency-weighted scoring tests.
 *
 * Independent of pgvector — directly checks the math behind:
 *   final_score = similarity × exp(-age * ln2 / half_life) × quality_score
 */
import { describe, it, expect } from "vitest";
import { computeRecencyWeight } from "../src/retrieval.js";

describe("recency weight", () => {
  it("decays exponentially with half-life", () => {
    const now = new Date("2026-06-01T00:00:00Z");
    const points = [
      { ageDays: 0, expect: 1 },
      { ageDays: 30, expect: Math.exp((-30 * Math.LN2) / 90) },
      { ageDays: 90, expect: 0.5 },
      { ageDays: 180, expect: 0.25 },
      { ageDays: 365, expect: Math.exp((-365 * Math.LN2) / 90) },
    ];
    for (const p of points) {
      const ingested = new Date(now.getTime() - p.ageDays * 86400000);
      const w = computeRecencyWeight(ingested, now, 90);
      expect(w).toBeCloseTo(p.expect, 4);
    }
  });

  it("never exceeds 1 for future-dated items (clock skew safety)", () => {
    const now = new Date("2026-06-01T00:00:00Z");
    const future = new Date(now.getTime() + 86400000);
    expect(computeRecencyWeight(future, now, 90)).toBe(1);
  });

  it("half-life parameter changes decay shape", () => {
    const now = new Date("2026-06-01T00:00:00Z");
    const ingested = new Date(now.getTime() - 60 * 86400000); // 60d old
    const w30 = computeRecencyWeight(ingested, now, 30);
    const w90 = computeRecencyWeight(ingested, now, 90);
    const w365 = computeRecencyWeight(ingested, now, 365);
    expect(w30).toBeLessThan(w90);
    expect(w90).toBeLessThan(w365);
    expect(w30).toBeCloseTo(0.25, 4);
  });
});

describe("composite score ordering", () => {
  function score(similarity: number, recency: number, quality: number) {
    return similarity * recency * Math.max(quality, 0.01);
  }
  it("fresh + medium similarity can beat ancient + perfect similarity", () => {
    const ancient = score(0.95, computeRecencyWeight(
      new Date("2025-01-01"), new Date("2026-06-01"), 90,
    ), 1);
    const fresh = score(0.75, computeRecencyWeight(
      new Date("2026-05-30"), new Date("2026-06-01"), 90,
    ), 1);
    expect(fresh).toBeGreaterThan(ancient);
  });

  it("low quality multiplier crushes high similarity", () => {
    const lowQ = score(0.95, 1.0, 0.1);
    const highQ = score(0.4, 1.0, 1.0);
    expect(highQ).toBeGreaterThan(lowQ);
  });
});
