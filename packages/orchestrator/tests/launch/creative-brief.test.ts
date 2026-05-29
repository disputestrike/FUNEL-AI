/**
 * Creative Brief agent tests.
 *
 * Coverage:
 *   - Shape: every documented field is populated for every fixture.
 *   - Compliance notes route correctly per industry.
 *   - Output formats match the platform.
 *   - Determinism.
 */

import { describe, expect, it } from "vitest";

import { AdAngle, Platform } from "@funnel/shared/launch";

import { buildCreativeBrief } from "../../src/launch/creative-brief.js";

import {
  DENTAL_STRATEGY,
  SOLAR_STRATEGY,
  SUPPLEMENTS_STRATEGY,
} from "./copy-fixtures.js";

describe("buildCreativeBrief", () => {
  it("populates every required field for solar / Meta / Pain", () => {
    const brief = buildCreativeBrief(SOLAR_STRATEGY, Platform.Meta, AdAngle.Pain);
    expect(brief.audience).toBeTruthy();
    expect(brief.platform).toBe(Platform.Meta);
    expect(brief.angle).toBe(AdAngle.Pain);
    expect(brief.painPoint).toBe(SOLAR_STRATEGY.painPoint);
    expect(brief.visualConcept.length).toBeGreaterThan(40);
    expect(brief.headline.length).toBeGreaterThan(0);
    expect(brief.cta.length).toBeGreaterThan(0);
    expect(brief.brandStyle.primaryColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(brief.brandStyle.voice.length).toBeGreaterThan(0);
    expect(brief.requiredAssets.length).toBeGreaterThan(0);
    expect(brief.outputFormats.length).toBeGreaterThan(0);
  });

  it("routes industry-specific compliance notes to dental", () => {
    const brief = buildCreativeBrief(DENTAL_STRATEGY, Platform.Meta, AdAngle.Proof);
    const joined = brief.complianceNotes.join(" ").toLowerCase();
    expect(joined).toContain("release");
    expect(joined).toContain("outcome");
  });

  it("routes industry-specific compliance notes to supplements", () => {
    const brief = buildCreativeBrief(SUPPLEMENTS_STRATEGY, Platform.Meta, AdAngle.Proof);
    const joined = brief.complianceNotes.join(" ").toLowerCase();
    expect(joined).toContain("disease/cure claims".toLowerCase());
    expect(joined).toContain("before/after");
  });

  it("includes a before/after asset for Pain on solar", () => {
    const brief = buildCreativeBrief(SOLAR_STRATEGY, Platform.Meta, AdAngle.Pain);
    const kinds = brief.requiredAssets.map((a) => a.kind);
    expect(kinds).toContain("before_after_split");
  });

  it("includes a screen-record asset for Speed on solar", () => {
    const brief = buildCreativeBrief(SOLAR_STRATEGY, Platform.Meta, AdAngle.Speed);
    const kinds = brief.requiredAssets.map((a) => a.kind);
    expect(kinds).toContain("screen_record_video");
  });

  it("emits 9:16 output formats for TikTok", () => {
    const brief = buildCreativeBrief(SOLAR_STRATEGY, Platform.TikTok, AdAngle.Speed);
    expect(brief.outputFormats.every((f) => f.aspectRatio === "9:16")).toBe(true);
  });

  it("emits 16:9 output formats for YouTube", () => {
    const brief = buildCreativeBrief(SOLAR_STRATEGY, Platform.YouTube, AdAngle.Speed);
    expect(brief.outputFormats.every((f) => f.aspectRatio === "16:9")).toBe(true);
  });

  it("snapshot: solar / Meta / Pain", () => {
    const brief = buildCreativeBrief(SOLAR_STRATEGY, Platform.Meta, AdAngle.Pain);
    expect(brief).toMatchSnapshot();
  });

  it("snapshot: supplements / TikTok / Convenience", () => {
    const brief = buildCreativeBrief(SUPPLEMENTS_STRATEGY, Platform.TikTok, AdAngle.Convenience);
    expect(brief).toMatchSnapshot();
  });

  it("is deterministic for identical inputs", () => {
    const a = buildCreativeBrief(SOLAR_STRATEGY, Platform.Meta, AdAngle.Pain);
    const b = buildCreativeBrief(SOLAR_STRATEGY, Platform.Meta, AdAngle.Pain);
    expect(a.fingerprint).toBe(b.fingerprint);
    expect(a).toEqual(b);
  });
});
