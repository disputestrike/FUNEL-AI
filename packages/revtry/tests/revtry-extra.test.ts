import { afterEach, describe, expect, it, vi } from "vitest";

import {
  generateScript,
  getPersonaProfile,
  InMemoryCallStore,
  isDemoMode,
  PERSONA_VOICE_MAP,
  queueOutboundDial,
  resetQueueForTests,
  setDemoCallStore,
  setDemoEmitter,
  setOutboundDialEnqueuer,
  simulateOutboundCall,
  voiceIdForScript,
} from "../src/index.js";

describe("persona-voice-map", () => {
  it("has all five brand personas", () => {
    expect(Object.keys(PERSONA_VOICE_MAP).sort()).toEqual([
      "coach",
      "funnel",
      "maestro",
      "maven",
      "rebel",
    ]);
  });

  it("falls back to funnel for unknown personas", () => {
    expect(getPersonaProfile("???").persona).toBe("funnel");
    expect(getPersonaProfile(null).persona).toBe("funnel");
  });

  it("voiceIdForScript pulls from the map", () => {
    expect(voiceIdForScript({ persona: "maven" })).toBe(PERSONA_VOICE_MAP.maven.voice_id);
  });
});

describe("script generator — persona + lang interpolation", () => {
  it("interpolates first_name and business_name", () => {
    const s = generateScript({
      workspace_id: "w",
      industry: "solar",
      persona: "homeowner",
      language: "en",
      business_name: "Acme",
      lead_data: { first_name: "Bea" },
    });
    expect(s.opener).toContain("Bea");
    expect(s.opener).toContain("Acme");
  });

  it("returns a German recording disclosure when language is de", () => {
    const s = generateScript({
      workspace_id: "w",
      industry: "x",
      persona: "y",
      language: "de",
    });
    expect(s.recording_disclosure).toMatch(/aufgezeichnet/i);
  });

  it("uses persona-tinted default opener when not in starter library", () => {
    const s = generateScript({
      workspace_id: "w",
      industry: "saas",
      persona: "rebel",
      language: "en",
      business_name: "Acme",
      lead_data: { first_name: "Bea", funnel_offer: "the demo" },
    });
    expect(s.opener).toContain("Bea");
    expect(s.opener.toLowerCase()).toMatch(/skip the script/);
  });
});

describe("demo mode", () => {
  afterEach(() => {
    resetQueueForTests();
    vi.useRealTimers();
  });

  it("isDemoMode is true when SIGNALWIRE keys are missing in dev", () => {
    expect(isDemoMode({ NODE_ENV: "development" })).toBe(true);
    expect(
      isDemoMode({ NODE_ENV: "development", SIGNALWIRE_PROJECT_ID: "x", SIGNALWIRE_API_TOKEN: "y" }),
    ).toBe(false);
    expect(isDemoMode({ NODE_ENV: "production" })).toBe(false);
    expect(isDemoMode({ REVTRY_DEMO_MODE: "1", NODE_ENV: "production" })).toBe(true);
  });

  it("simulator drives queued -> ringing -> in_progress -> completed", async () => {
    const store = new InMemoryCallStore();
    let n = 0;
    const events: string[] = [];
    const { call, completion } = simulateOutboundCall(
      {
        workspace_id: "w",
        lead_id: "lds_1",
        funnel_id: "fnl_1",
        from_e164: "+18005551234",
        to_e164: "+15555550101",
      },
      {
        store,
        newId: () => `cll_${n++}`,
        emit: (name) => {
          events.push(name);
        },
        speedFactor: 0,
      },
    );
    expect(call.state).toBe("queued");
    const final = await completion;
    expect(final.state).toBe("completed");
    expect(final.outcome).toBe("booked");
    expect(events).toContain("revtry_call_started");
    expect(events).toContain("revtry_call_completed");
  });

  it("queueOutboundDial uses the registered enqueuer when set", async () => {
    setOutboundDialEnqueuer(async (input) => ({
      call_id: `cll_real_${input.lead_id}`,
      enqueued_at: new Date().toISOString(),
      demo: false,
    }));
    const result = await queueOutboundDial({
      workspace_id: "w",
      lead_id: "lds_1",
      funnel_id: "fnl_1",
      phone_e164: "+15555550100",
      deadline_at: new Date().toISOString(),
    });
    expect(result.demo).toBe(false);
    expect(result.call_id).toBe("cll_real_lds_1");
  });

  it("queueOutboundDial falls through to the demo simulator", async () => {
    const env = { ...process.env };
    delete process.env.SIGNALWIRE_PROJECT_ID;
    delete process.env.SIGNALWIRE_API_TOKEN;
    process.env.NODE_ENV = "development";
    try {
      const store = new InMemoryCallStore();
      setDemoCallStore(store);
      const events: string[] = [];
      setDemoEmitter((name) => {
        events.push(name);
      });
      const result = await queueOutboundDial({
        workspace_id: "w",
        lead_id: "lds_2",
        funnel_id: "fnl_1",
        phone_e164: "+15555550100",
        deadline_at: new Date().toISOString(),
      });
      expect(result.demo).toBe(true);
      expect(result.call_id).toMatch(/^cll_demo_/);
    } finally {
      Object.assign(process.env, env);
    }
  });
});
