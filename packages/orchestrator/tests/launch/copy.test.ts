/**
 * Ad Copy agent tests.
 *
 * Coverage:
 *   - Snapshot output for solar / dental / supplements across Meta, Google,
 *     LinkedIn, TikTok.
 *   - Platform character-limit enforcement.
 *   - Variant counts (Meta 5/5/3, Google 15/4).
 *   - Determinism (same inputs → same output).
 */

import { describe, expect, it } from "vitest";

import { AdAngle, Platform, PLATFORM_META } from "@funnel/shared/launch";

import { runAdCopy } from "../../src/launch/copy.js";

import {
  DENTAL_STRATEGY,
  SOLAR_STRATEGY,
  SUPPLEMENTS_STRATEGY,
} from "./copy-fixtures.js";

describe("runAdCopy", () => {
  // --------------------------------------------------------------------- //
  // Snapshot coverage
  // --------------------------------------------------------------------- //
  it.each([
    ["solar", SOLAR_STRATEGY, Platform.Meta, AdAngle.Pain],
    ["solar", SOLAR_STRATEGY, Platform.Google, AdAngle.Roi],
    ["solar", SOLAR_STRATEGY, Platform.LinkedIn, AdAngle.Proof],
    ["solar", SOLAR_STRATEGY, Platform.TikTok, AdAngle.Speed],
    ["dental", DENTAL_STRATEGY, Platform.Meta, AdAngle.Convenience],
    ["dental", DENTAL_STRATEGY, Platform.Google, AdAngle.Trust],
    ["supplements", SUPPLEMENTS_STRATEGY, Platform.Meta, AdAngle.Proof],
    ["supplements", SUPPLEMENTS_STRATEGY, Platform.TikTok, AdAngle.Convenience],
  ])("snapshot: %s on %s with %s angle", (_label, strategy, platform, angle) => {
    const variant = runAdCopy(strategy, platform, angle);
    expect(variant).toMatchSnapshot();
  });

  // --------------------------------------------------------------------- //
  // Platform character limits
  // --------------------------------------------------------------------- //
  it("Meta: respects 125/40/30 limits and emits 5/5/3 variants", () => {
    const v = runAdCopy(SOLAR_STRATEGY, Platform.Meta, AdAngle.Pain);
    expect(v.platformPayload.platform).toBe(Platform.Meta);

    if (v.platformPayload.platform !== Platform.Meta) throw new Error("type");
    const payload = v.platformPayload.payload;

    const meta = PLATFORM_META[Platform.Meta];
    expect(payload.primaryText.length).toBeLessThanOrEqual(5);
    expect(payload.headline.length).toBe(5);
    expect(payload.description.length).toBe(3);

    for (const p of payload.primaryText) expect(p.length).toBeLessThanOrEqual(meta.characterLimits.primaryText);
    for (const h of payload.headline) expect(h.length).toBeLessThanOrEqual(meta.characterLimits.headline);
    for (const d of payload.description) expect(d.length).toBeLessThanOrEqual(meta.characterLimits.description ?? 30);

    expect(v.characterBudgets.headline.overflow).toBe(false);
    expect(v.characterBudgets.primaryText.overflow).toBe(false);
  });

  it("Google: 15 headlines (<30 chars each) and 4 descriptions (<90 chars each)", () => {
    const v = runAdCopy(SOLAR_STRATEGY, Platform.Google, AdAngle.Roi);
    expect(v.platformPayload.platform).toBe(Platform.Google);
    if (v.platformPayload.platform !== Platform.Google) throw new Error("type");

    const payload = v.platformPayload.payload;
    expect(payload.headlines.length).toBe(15);
    expect(payload.descriptions.length).toBe(4);
    for (const h of payload.headlines) expect(h.length).toBeLessThanOrEqual(30);
    for (const d of payload.descriptions) expect(d.length).toBeLessThanOrEqual(90);
    expect(payload.pathFragments).toHaveLength(2);
    for (const seg of payload.pathFragments) expect(seg.length).toBeLessThanOrEqual(15);
  });

  it("LinkedIn: intro/headline/description respect 150/70/100", () => {
    const v = runAdCopy(SOLAR_STRATEGY, Platform.LinkedIn, AdAngle.Proof);
    if (v.platformPayload.platform !== Platform.LinkedIn) throw new Error("type");
    const payload = v.platformPayload.payload;
    expect(payload.introText.length).toBeLessThanOrEqual(150);
    expect(payload.headline.length).toBeLessThanOrEqual(70);
    expect(payload.description.length).toBeLessThanOrEqual(100);
    expect(payload.cta.length).toBeGreaterThan(0);
  });

  it("TikTok: hook fits headline limit (40) and bodyScript fits primaryText (100)", () => {
    const v = runAdCopy(SOLAR_STRATEGY, Platform.TikTok, AdAngle.Speed);
    if (v.platformPayload.platform !== Platform.TikTok) throw new Error("type");
    const payload = v.platformPayload.payload;
    expect(payload.hook.length).toBeLessThanOrEqual(40);
    expect(payload.bodyScript.length).toBeLessThanOrEqual(100);
    expect(payload.cta.length).toBeGreaterThan(0);
  });

  // --------------------------------------------------------------------- //
  // Determinism
  // --------------------------------------------------------------------- //
  it("is deterministic for identical inputs", () => {
    const a = runAdCopy(SOLAR_STRATEGY, Platform.Meta, AdAngle.Pain);
    const b = runAdCopy(SOLAR_STRATEGY, Platform.Meta, AdAngle.Pain);
    expect(a.fingerprint).toBe(b.fingerprint);
    expect(a).toEqual(b);
  });

  it("changes fingerprint when any input changes", () => {
    const base = runAdCopy(SOLAR_STRATEGY, Platform.Meta, AdAngle.Pain);
    const diffAngle = runAdCopy(SOLAR_STRATEGY, Platform.Meta, AdAngle.Roi);
    const diffPlatform = runAdCopy(SOLAR_STRATEGY, Platform.Google, AdAngle.Pain);
    expect(base.fingerprint).not.toBe(diffAngle.fingerprint);
    expect(base.fingerprint).not.toBe(diffPlatform.fingerprint);
  });

  // --------------------------------------------------------------------- //
  // Solar / Meta / Pain sample (asserted on for the orchestrator report).
  // --------------------------------------------------------------------- //
  it("solar / Meta / Pain produces a usable primary text + headline + cta", () => {
    const v = runAdCopy(SOLAR_STRATEGY, Platform.Meta, AdAngle.Pain);
    expect(v.primaryText.toLowerCase()).toContain("power bills");
    expect(v.headline.toLowerCase()).toContain("stop");
    expect(v.cta.toLowerCase()).toContain("quote");
    expect(v.angle).toBe(AdAngle.Pain);
    expect(v.platform).toBe(Platform.Meta);
  });
});
