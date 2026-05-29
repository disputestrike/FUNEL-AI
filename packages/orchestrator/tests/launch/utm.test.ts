import { describe, expect, it, beforeEach } from "vitest";

import { Platform, AdAngle } from "@funnel/shared/launch";

import {
  DEFAULT_SHORT_HOST,
  UTM_SOURCE_BY_PLATFORM,
  generateUtmLinks,
  generateChannelUtmLink,
} from "../../src/launch/utm.js";
import {
  captureLaunchEvents,
  resetLaunchEventSink,
} from "../../src/launch/events.js";

const baseCampaign = {
  id: "cmp_solar_001",
  workspaceId: "ws_acme",
  name: "Solar Savings Plan Q2",
  audienceProfileIds: ["aud_homeowners_175bill"],
};

describe("utm.generateUtmLinks", () => {
  beforeEach(() => {
    resetLaunchEventSink();
  });

  it("produces one row per variant with the right source/medium mapping", async () => {
    const rows = await generateUtmLinks(baseCampaign, [
      { id: "v1", angle: AdAngle.Roi, platform: Platform.Meta },
      { id: "v2", angle: AdAngle.Speed, platform: Platform.Google },
      { id: "v3", angle: AdAngle.Pain, platform: Platform.YouTube },
    ]);
    expect(rows).toHaveLength(3);
    const m = rows.find((r) => r.utmSource === "meta");
    expect(m?.utmMedium).toBe(UTM_SOURCE_BY_PLATFORM[Platform.Meta].medium);
    const g = rows.find((r) => r.utmSource === "google");
    expect(g?.utmMedium).toBe("cpc");
    const y = rows.find((r) => r.utmSource === "youtube");
    expect(y?.utmMedium).toBe("paid_video");
  });

  it("encodes variant_<id>_<angle> into utm_content", async () => {
    const rows = await generateUtmLinks(baseCampaign, [
      { id: "v77", angle: AdAngle.Proof, platform: Platform.Meta },
    ]);
    expect(rows[0]?.utmContent).toBe("variant_v77_proof");
  });

  it("renders a gofnl.co short URL by default", async () => {
    const rows = await generateUtmLinks(baseCampaign, [
      { id: "v1", angle: AdAngle.Roi, platform: Platform.Meta },
    ]);
    expect(rows[0]?.shortUrl).toMatch(new RegExp(`^https://${DEFAULT_SHORT_HOST}/[a-z0-9]+$`));
    expect(rows[0]?.shortCode).toBeTruthy();
  });

  it("is idempotent — same inputs yield same short codes", async () => {
    const a = await generateUtmLinks(baseCampaign, [
      { id: "v1", angle: AdAngle.Roi, platform: Platform.Meta },
    ]);
    const b = await generateUtmLinks(baseCampaign, [
      { id: "v1", angle: AdAngle.Roi, platform: Platform.Meta },
    ]);
    expect(a[0]?.shortCode).toEqual(b[0]?.shortCode);
    expect(a[0]?.id).toEqual(b[0]?.id);
  });

  it("uses the audience profile id as utm_term when none provided", async () => {
    const rows = await generateUtmLinks(baseCampaign, [
      { id: "v1", angle: AdAngle.Roi, platform: Platform.Meta },
    ]);
    expect(rows[0]?.utmTerm).toBe("aud_homeowners_175bill");
  });

  it("respects explicit audience override on a variant", async () => {
    const rows = await generateUtmLinks(baseCampaign, [
      { id: "v1", angle: AdAngle.Roi, platform: Platform.Meta, audience: "high_intent_tx" },
    ]);
    expect(rows[0]?.utmTerm).toBe("high_intent_tx");
  });

  it("delegates short-link persistence to the injected service", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const rows = await generateUtmLinks(
      baseCampaign,
      [{ id: "v1", angle: AdAngle.Roi, platform: Platform.Meta }],
      {
        shortLinkService: {
          create: async (args) => {
            calls.push(args);
            return { code: "custom1", shortUrl: "https://gofnl.co/custom1" };
          },
        },
      },
    );
    expect(calls).toHaveLength(1);
    expect(rows[0]?.shortCode).toBe("custom1");
    expect(rows[0]?.shortUrl).toBe("https://gofnl.co/custom1");
  });

  it("emits launch_utm_generated", async () => {
    const captured = captureLaunchEvents();
    await generateUtmLinks(baseCampaign, [
      { id: "v1", angle: AdAngle.Roi, platform: Platform.Meta },
    ]);
    const events = captured();
    expect(events).toHaveLength(1);
    expect(events[0]?.name).toBe("launch_utm_generated");
    expect(events[0]?.payload).toMatchObject({ variant_count: 1 });
  });

  it("supports email + sms channel UTM rows", async () => {
    const emailRow = await generateChannelUtmLink({
      campaign: baseCampaign,
      channel: "email",
      variantId: "welcome",
    });
    expect(emailRow.utmSource).toBe("email");
    expect(emailRow.utmMedium).toBe("email");
    const smsRow = await generateChannelUtmLink({
      campaign: baseCampaign,
      channel: "sms",
      variantId: "welcome",
    });
    expect(smsRow.utmSource).toBe("sms");
    expect(smsRow.utmMedium).toBe("sms");
  });
});
