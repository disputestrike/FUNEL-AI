/**
 * GoFunnelAI — Launch Strategy agent tests.
 *
 * Snapshots the deterministic strategy output for solar / dental / saas
 * fixtures. Also verifies the agent emits `launch_strategy_started` and
 * `launch_strategy_completed` events through the launch event sink.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { AdAngle, Platform } from "@funnel/shared/launch";

import { runLaunchStrategy } from "../../src/launch/strategy.js";
import {
  captureLaunchEvents,
  resetLaunchEventSink,
} from "../../src/launch/events.js";

import { dentalFixture, saasFixture, solarFixture } from "./fixtures.js";

describe("Launch Strategy agent (L2)", () => {
  beforeEach(() => {
    resetLaunchEventSink();
  });

  afterEach(() => {
    resetLaunchEventSink();
  });

  it("produces the canonical solar strategy", async () => {
    const capture = captureLaunchEvents();
    const strategy = await runLaunchStrategy(solarFixture);

    expect(strategy.creativeAngle).toBe(AdAngle.Pain);
    expect(strategy.offerSnapshot.industryKey).toBe("solar");
    expect(strategy.offerSnapshot.archetype).toBe("free_consult_booking");
    expect(strategy.primaryCta).toBe("Get my solar savings plan");
    expect(strategy.recommendedPlatforms.map((p) => p.platform)).toEqual([
      Platform.Meta,
      Platform.Google,
      Platform.YouTube,
    ]);
    expect(strategy).toMatchSnapshot();

    const events = capture();
    expect(events.map((e) => e.name)).toEqual([
      "launch_strategy_started",
      "launch_strategy_completed",
    ]);
    expect(events[1]?.payload).toMatchObject({
      campaignName: expect.stringContaining("SunPath"),
      creativeAngle: AdAngle.Pain,
    });
  });

  it("produces the canonical dental strategy with Convenience angle", async () => {
    const strategy = await runLaunchStrategy(dentalFixture);

    expect(strategy.creativeAngle).toBe(AdAngle.Convenience);
    expect(strategy.offerSnapshot.industryKey).toBe("dental");
    expect(strategy.primaryCta).toBe("Check my visit options");
    expect(strategy).toMatchSnapshot();
  });

  it("produces the canonical saas strategy with ROI angle and LinkedIn-first seeds", async () => {
    const strategy = await runLaunchStrategy(saasFixture);

    expect(strategy.creativeAngle).toBe(AdAngle.Roi);
    expect(strategy.offerSnapshot.industryKey).toBe("saas");
    expect(strategy.primaryCta).toBe("Calculate ROI");
    expect(strategy.recommendedPlatforms[0]?.platform).toBe(Platform.LinkedIn);
    expect(strategy).toMatchSnapshot();
  });

  it("respects awareness=hot by promoting Proof for non-SaaS verticals", async () => {
    const strategy = await runLaunchStrategy({
      ...solarFixture,
      funnel: { ...solarFixture.funnel, awareness: "hot" },
    });
    expect(strategy.creativeAngle).toBe(AdAngle.Proof);
  });

  it("uses an injected reasoner when supplied (production Anthropic path)", async () => {
    const strategy = await runLaunchStrategy(dentalFixture, {
      reasoner: {
        modelId: "claude-sonnet-4-6",
        reason: ({ input, offerIntel }) => ({
          campaignName: "Stub — Dental",
          objective: "Stub objective",
          primaryAudienceDesc: input.targetAudience?.primary ?? "stub primary",
          secondaryAudienceDesc: "stub secondary",
          painPoint: "stub pain",
          mainOffer: offerIntel.offerStack.corePromise,
          primaryCta: offerIntel.offerStack.mainCta,
          creativeAngle: AdAngle.Trust,
          creativeAngleRationale: "stub rationale",
          recommendedPlatforms: [
            { platform: Platform.Meta, rationale: "stub" },
          ],
          rationale: "stub",
          reasoningModel: "claude-sonnet-4-6",
          offerSnapshot: {
            industryKey: offerIntel.industryKey,
            industryLabel: offerIntel.industryLabel,
            archetype: offerIntel.archetype,
            kbVersion: offerIntel.kbVersion,
          },
        }),
      },
    });
    expect(strategy.campaignName).toBe("Stub — Dental");
    expect(strategy.creativeAngle).toBe(AdAngle.Trust);
  });
});
