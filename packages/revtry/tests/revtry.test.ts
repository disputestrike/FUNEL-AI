import { describe, expect, it } from "vitest";

import {
  consentRuleForState,
  consume,
  creditCycle,
  defaultLanguageForCountry,
  generateScript,
  InMemoryCallStore,
  InMemoryMinutesLedgerStore,
  isSundayLocal,
  OVERAGE_CENTS_PER_MIN,
  placeOutboundCall,
  recordOutcome,
  retentionUntil,
  withinTcpaHours,
} from "../src/index.js";

let n = 0;
const newId = (e: string) => `${e}_${(n++).toString().padStart(6, "0")}`;

describe("state rules", () => {
  it("CA is two-party, TX is one-party", () => {
    expect(consentRuleForState("CA")).toBe("two_party");
    expect(consentRuleForState("TX")).toBe("one_party");
  });

  it("TCPA hours allow 9am, block 10pm", () => {
    expect(withinTcpaHours(9)).toBe(true);
    expect(withinTcpaHours(22)).toBe(false);
    expect(withinTcpaHours(7)).toBe(false);
  });

  it("retention is +7 years", () => {
    const start = "2026-05-26T12:00:00.000Z";
    expect(retentionUntil(start).startsWith("2033-")).toBe(true);
  });
});

describe("language", () => {
  it("maps country to language", () => {
    expect(defaultLanguageForCountry("US")).toBe("en");
    expect(defaultLanguageForCountry("MX")).toBe("es");
    expect(defaultLanguageForCountry("FR")).toBe("fr");
    expect(defaultLanguageForCountry("XX")).toBe("en");
  });
});

describe("scripts", () => {
  it("returns a complete bundle with recording disclosure + opt-out", () => {
    const s = generateScript({ workspace_id: "w", industry: "solar", persona: "homeowner", language: "en" });
    expect(s.opener).toContain("solar")
    expect(s.tcpa_opt_out_line).toMatch(/remove me/i);
    expect(s.recording_disclosure).toMatch(/recorded/i);
  });

  it("Spanish recording disclosure", () => {
    const s = generateScript({ workspace_id: "w", industry: "solar", persona: "homeowner", language: "es" });
    expect(s.recording_disclosure).toMatch(/grabad/i);
  });
});

describe("minutes ledger", () => {
  it("credits a plan cycle once (idempotent)", async () => {
    const store = new InMemoryMinutesLedgerStore();
    const a = await creditCycle(
      { workspace_id: "w", cycle: "2026-05", plan: "starter" },
      { store, newId },
    );
    const b = await creditCycle(
      { workspace_id: "w", cycle: "2026-05", plan: "starter" },
      { store, newId },
    );
    expect(a?.minutes_delta).toBe(100);
    expect(b).toBeNull();
  });

  it("consume produces overage when balance dips below zero", async () => {
    const store = new InMemoryMinutesLedgerStore();
    await creditCycle(
      { workspace_id: "w", cycle: "2026-05", plan: "starter" },
      { store, newId },
    );
    const r1 = await consume(
      { workspace_id: "w", cycle: "2026-05", call_id: "c1", duration_sec: 95 * 60 },
      { store, newId },
    );
    expect(r1.overage_minutes).toBe(0);
    const r2 = await consume(
      { workspace_id: "w", cycle: "2026-05", call_id: "c2", duration_sec: 30 * 60 },
      { store, newId },
    );
    expect(r2.overage_minutes).toBeGreaterThan(0);
    expect(r2.overage_cents).toBe(r2.overage_minutes * OVERAGE_CENTS_PER_MIN);
  });
});

describe("dial", () => {
  it("blocks federal DNC hard", async () => {
    const store = new InMemoryCallStore();
    const consent = { insert: async (e: any) => e, hasOptOut: async () => false, recordOptOut: async () => {} };
    const sw = { placeCall: async () => ({ provider_call_id: "sw_1" }) };
    const r = await placeOutboundCall(
      {
        workspace_id: "w",
        lead_id: "lds_1",
        funnel_id: "fnl_1",
        from_e164: "+18005551234",
        to_e164: "+15555550101",
        language: "en",
        callee_local_hour: 14,
      },
      {
        store,
        consentStore: consent as any,
        newId,
        dnc: {
          isOnFederalDnc: async () => true,
          isOnStateDnc: async () => false,
          isOnInternalDnc: async () => false,
        },
        signalwire: sw,
        answerUrlFor: () => "https://x.com/a",
        statusCallbackUrlFor: () => "https://x.com/s",
      },
    );
    expect(r.blocked_reason).toBe("federal_dnc");
    expect(r.call.state).toBe("blocked_dnc");
  });

  it("blocks quiet hours", async () => {
    const store = new InMemoryCallStore();
    const consent = { insert: async (e: any) => e, hasOptOut: async () => false, recordOptOut: async () => {} };
    const sw = { placeCall: async () => ({ provider_call_id: "sw_1" }) };
    const r = await placeOutboundCall(
      {
        workspace_id: "w",
        lead_id: "lds_1",
        funnel_id: "fnl_1",
        from_e164: "+18005551234",
        to_e164: "+15555550101",
        language: "en",
        callee_local_hour: 22,
      },
      {
        store,
        consentStore: consent as any,
        newId,
        dnc: {
          isOnFederalDnc: async () => false,
          isOnStateDnc: async () => false,
          isOnInternalDnc: async () => false,
        },
        signalwire: sw,
        answerUrlFor: () => "https://x.com/a",
        statusCallbackUrlFor: () => "https://x.com/s",
      },
    );
    expect(r.blocked_reason).toBe("tcpa_quiet_hours");
  });

  it("places a call when all gates pass", async () => {
    const store = new InMemoryCallStore();
    const consent = { insert: async (e: any) => e, hasOptOut: async () => false, recordOptOut: async () => {} };
    const sw = { placeCall: async () => ({ provider_call_id: "sw_1" }) };
    const r = await placeOutboundCall(
      {
        workspace_id: "w",
        lead_id: "lds_1",
        funnel_id: "fnl_1",
        from_e164: "+18005551234",
        to_e164: "+15555550101",
        language: "en",
        callee_local_hour: 14,
      },
      {
        store,
        consentStore: consent as any,
        newId,
        dnc: {
          isOnFederalDnc: async () => false,
          isOnStateDnc: async () => false,
          isOnInternalDnc: async () => false,
        },
        signalwire: sw,
        answerUrlFor: () => "https://x.com/a",
        statusCallbackUrlFor: () => "https://x.com/s",
      },
    );
    expect(r.call.state).toBe("ringing");
    expect(r.call.provider_call_id).toBe("sw_1");
  });
});

describe("outcome sync", () => {
  it("records outcome + charges ledger + syncs to CRM (idempotent)", async () => {
    const store = new InMemoryCallStore();
    const lstore = new InMemoryMinutesLedgerStore();
    await creditCycle(
      { workspace_id: "w", cycle: new Date().toISOString().slice(0, 7), plan: "starter" },
      { store: lstore, newId },
    );
    // Seed a completed call.
    await store.insert({
      id: "cll_1",
      workspace_id: "w",
      lead_id: "lds_1",
      funnel_id: null,
      direction: "outbound",
      from_e164: "+18005551234",
      to_e164: "+15555550101",
      language: "en",
      script_version: "1.0.0",
      provider: "signalwire",
      provider_call_id: "sw_1",
      state: "in_progress",
      duration_sec: 0,
      recording_url: null,
      recording_retention_until: null,
      outcome: null,
      transcript_url: null,
      consent_recording: "preamble_played",
      consent_state_rule: "one_party",
      hangup_reason: null,
      created_at: new Date().toISOString(),
      started_at: new Date().toISOString(),
      ended_at: null,
    });

    let crmCalls = 0;
    const crm = {
      recordCallOutcome: async () => {
        crmCalls++;
      },
    };
    const first = await recordOutcome(
      { call_id: "cll_1", outcome: "booked", duration_sec: 120 },
      { store, ledger: { store: lstore, newId }, crm },
    );
    expect(first.outcome).toBe("booked");
    const second = await recordOutcome(
      { call_id: "cll_1", outcome: "booked", duration_sec: 120 },
      { store, ledger: { store: lstore, newId }, crm },
    );
    expect(second.outcome).toBe("booked");
    expect(crmCalls).toBe(1);  // idempotent — only one CRM sync
  });
});
