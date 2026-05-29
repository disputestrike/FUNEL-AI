/**
 * GoFunnelAI — Audience Targeting agent tests.
 *
 * Snapshots the platform-specific audience profile for solar / dental / saas
 * across Meta, Google, LinkedIn, and TikTok, and verifies the agent emits
 * `launch_audience_built`.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Platform } from "@funnel/shared/launch";

import { buildAudience } from "../../src/launch/audience-targeting.js";
import { runLaunchStrategy } from "../../src/launch/strategy.js";
import {
  captureLaunchEvents,
  resetLaunchEventSink,
} from "../../src/launch/events.js";

import { dentalFixture, saasFixture, solarFixture } from "./fixtures.js";

describe("Audience Targeting agent (L2)", () => {
  beforeEach(() => {
    resetLaunchEventSink();
  });

  afterEach(() => {
    resetLaunchEventSink();
  });

  it("builds a Meta audience for solar with locations, age, interests, and exclusions", async () => {
    const capture = captureLaunchEvents();
    const strategy = await runLaunchStrategy(solarFixture);
    const profile = await buildAudience(strategy, Platform.Meta, {
      funnel: solarFixture.funnel,
      lookalikeSource: "ca_solar_installs_2026",
    });

    expect(profile.platform).toBe(Platform.Meta);
    expect(profile.kbPackId).toBe("solar-us-en");
    if (profile.targeting.platform !== Platform.Meta) throw new Error("wrong platform");
    expect(profile.targeting.params.locations).toEqual(["US"]);
    expect(profile.targeting.params.age).toEqual({ min: 35, max: 70 });
    expect(profile.targeting.params.interests).toContain("Renewable energy");
    expect(profile.targeting.params.exclusions).toContain("Renters");
    expect(profile.targeting.params.lookalikeSource).toBe("ca_solar_installs_2026");
    expect(profile).toMatchSnapshot();

    expect(capture().find((e) => e.name === "launch_audience_built")).toBeTruthy();
  });

  it("builds a Google audience for solar with keywords, negatives, and ad groups", async () => {
    const strategy = await runLaunchStrategy(solarFixture);
    const profile = await buildAudience(strategy, Platform.Google, {
      funnel: solarFixture.funnel,
    });
    if (profile.targeting.platform !== Platform.Google) throw new Error("wrong platform");
    expect(profile.targeting.params.keywords).toContain("solar tax credit 2026");
    expect(profile.targeting.params.negativeKeywords).toContain("solar eclipse");
    expect(profile.targeting.params.matchTypes).toEqual(["exact", "phrase"]);
    expect(profile.targeting.params.adGroups).toHaveLength(2);
    expect(profile).toMatchSnapshot();
  });

  it("builds a LinkedIn audience for saas with job titles, industries, and seniority", async () => {
    const strategy = await runLaunchStrategy(saasFixture);
    const profile = await buildAudience(strategy, Platform.LinkedIn, {
      funnel: saasFixture.funnel,
    });
    if (profile.targeting.platform !== Platform.LinkedIn) throw new Error("wrong platform");
    expect(profile.targeting.params.jobTitles).toContain("Head of Marketing");
    expect(profile.targeting.params.industries).toContain("Computer Software");
    expect(profile.targeting.params.seniority).toContain("Director");
    expect(profile.targeting.params.companySize).toContain("51-200");
    expect(profile).toMatchSnapshot();
  });

  it("builds a TikTok audience for dental with interest clusters and creators", async () => {
    const strategy = await runLaunchStrategy(dentalFixture);
    const profile = await buildAudience(strategy, Platform.TikTok, {
      funnel: dentalFixture.funnel,
    });
    if (profile.targeting.platform !== Platform.TikTok) throw new Error("wrong platform");
    expect(profile.targeting.params.interestClusters.length).toBeGreaterThan(0);
    expect(profile.targeting.params.contentCategories).toContain("Family");
    expect(profile.targeting.params.creators).toContain("Family vloggers");
    expect(profile).toMatchSnapshot();
  });

  it("falls back to a generic profile for unsupported platforms", async () => {
    const strategy = await runLaunchStrategy(solarFixture);
    const profile = await buildAudience(strategy, Platform.Reddit, {
      funnel: solarFixture.funnel,
    });
    if (
      profile.targeting.platform === Platform.Meta ||
      profile.targeting.platform === Platform.Google ||
      profile.targeting.platform === Platform.LinkedIn ||
      profile.targeting.platform === Platform.TikTok
    ) {
      throw new Error("expected generic params");
    }
    expect(profile.targeting.params.interests.length).toBeGreaterThan(0);
    expect(profile.targeting.params.notes).toMatch(/Reddit/);
  });
});
