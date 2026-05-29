/**
 * GoFunnelAI — Platform Recommendation agent tests.
 *
 * Snapshots fitScores for solar/dental/saas, then verifies the heuristic
 * invariants the cockpit depends on:
 *   - B2B SaaS: LinkedIn > Google > Meta and TikTok pruned out
 *   - Consumer (dental): Google + Meta > LinkedIn (always pruned out)
 *   - Regulated (med_spa simulated): TikTok carries a compliance penalty
 *   - Budget allocation: totals match the requested daily budget
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Platform } from "@funnel/shared/launch";

import { recommendPlatforms } from "../../src/launch/platform-rec.js";
import { runLaunchStrategy } from "../../src/launch/strategy.js";
import {
  captureLaunchEvents,
  resetLaunchEventSink,
} from "../../src/launch/events.js";

import { dentalFixture, saasFixture, solarFixture } from "./fixtures.js";

describe("Platform Recommendation agent (L2)", () => {
  beforeEach(() => {
    resetLaunchEventSink();
  });

  afterEach(() => {
    resetLaunchEventSink();
  });

  it("recommends Meta + Google + YouTube for solar", async () => {
    const capture = captureLaunchEvents();
    const strategy = await runLaunchStrategy(solarFixture);
    const recs = await recommendPlatforms(strategy, solarFixture.funnel, {
      totalDailyBudgetUsd: 200,
    });

    const platforms = recs.map((r) => r.platform);
    expect(platforms[0]).toBe(Platform.Meta);
    expect(platforms).toContain(Platform.Google);
    expect(platforms).toContain(Platform.YouTube);
    expect(platforms).not.toContain(Platform.LinkedIn);

    const total = recs.reduce((acc, r) => acc + r.recommendedBudgetDaily, 0);
    expect(total).toBe(200);
    expect(recs).toMatchSnapshot();

    const events = capture();
    expect(events.find((e) => e.name === "launch_platforms_recommended")).toBeTruthy();
  });

  it("recommends Google + Meta for dental and excludes LinkedIn", async () => {
    const strategy = await runLaunchStrategy(dentalFixture);
    const recs = await recommendPlatforms(strategy, dentalFixture.funnel, {
      totalDailyBudgetUsd: 150,
    });

    const platforms = recs.map((r) => r.platform);
    expect(platforms[0]).toBe(Platform.Google);
    expect(platforms).toContain(Platform.Meta);
    expect(platforms).not.toContain(Platform.LinkedIn);
    expect(recs).toMatchSnapshot();
  });

  it("recommends LinkedIn + Google for saas, drops TikTok and Snapchat", async () => {
    const strategy = await runLaunchStrategy(saasFixture);
    const recs = await recommendPlatforms(strategy, saasFixture.funnel, {
      totalDailyBudgetUsd: 300,
    });

    const platforms = recs.map((r) => r.platform);
    expect(platforms[0]).toBe(Platform.LinkedIn);
    expect(platforms[1]).toBe(Platform.Google);
    expect(platforms).not.toContain(Platform.TikTok);
    expect(platforms).not.toContain(Platform.Snapchat);

    const linkedin = recs.find((r) => r.platform === Platform.LinkedIn)!;
    const google = recs.find((r) => r.platform === Platform.Google)!;
    expect(linkedin.fitScore).toBeGreaterThan(google.fitScore - 5);

    expect(recs).toMatchSnapshot();
  });

  it("applies compliance penalties on regulated verticals", async () => {
    // Synthesise an insurance strategy and verify TikTok has a non-zero
    // compliance penalty surfaced in signals.complianceFit < 100.
    const insuranceStrategy = await runLaunchStrategy({
      ...solarFixture,
      funnel: { ...solarFixture.funnel, industry: "Insurance" },
    });
    const recs = await recommendPlatforms(
      insuranceStrategy,
      { ...solarFixture.funnel, industry: "Insurance" },
      { totalDailyBudgetUsd: 100, includeAll: true },
    );
    const tiktok = recs.find((r) => r.platform === Platform.TikTok)!;
    expect(tiktok.signals.complianceFit).toBeLessThan(100);
    expect(tiktok.rationale).toMatch(/compliance/i);
  });

  it("honours excludePlatforms", async () => {
    const strategy = await runLaunchStrategy(solarFixture);
    const recs = await recommendPlatforms(strategy, solarFixture.funnel, {
      totalDailyBudgetUsd: 100,
      excludePlatforms: [Platform.Meta],
    });
    expect(recs.map((r) => r.platform)).not.toContain(Platform.Meta);
  });
});
