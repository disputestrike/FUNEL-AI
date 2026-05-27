export interface LeadFixture {
  lead_id: string;
  workspace_id: string;
  funnel_id: string;
  name: string;
  email: string;
  phone: string;
  consent: { tcpa: boolean; sms: boolean; marketing: boolean };
  utm: Record<string, string>;
  submitted_at: string;
}

let n = 0;
export function fixtureLead(overrides: Partial<LeadFixture> = {}): LeadFixture {
  n += 1;
  return {
    lead_id: `lead_${n.toString().padStart(6, "0")}`,
    workspace_id: "ws_test",
    funnel_id: "fn_test",
    name: `Test Lead ${n}`,
    email: `lead${n}@example.test`,
    phone: `+1555${(2_000_000 + n).toString().slice(-7)}`,
    consent: { tcpa: true, sms: true, marketing: true },
    utm: { utm_source: "meta", utm_campaign: "launch" },
    submitted_at: new Date().toISOString(),
    ...overrides,
  };
}

export function fixtureLeads(count: number): LeadFixture[] {
  return Array.from({ length: count }, () => fixtureLead());
}
