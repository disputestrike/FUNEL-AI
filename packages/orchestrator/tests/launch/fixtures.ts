/**
 * Shared fixtures for Launch Center L2 agent tests.
 *
 * Three industries cover the bulk of the heuristic surface:
 *   - solar:  consumer + regulated savings claims + homeowner persona
 *   - dental: consumer + local-intent + family persona
 *   - saas:   B2B + buying committee + LinkedIn-first
 *
 * Brand: GoFunnelAI.
 */

import type { RunLaunchStrategyInput } from "../../src/launch/strategy.js";

export const solarFixture: RunLaunchStrategyInput = {
  funnelId: "fun_solar_001",
  workspaceId: "ws_solar_001",
  goal: "Book qualified solar consultations from homeowners with high power bills",
  funnel: {
    funnelId: "fun_solar_001",
    workspaceId: "ws_solar_001",
    industry: "Solar installation",
    geography: "US",
    offer: "Cut wasted power spend with a source-backed solar savings plan.",
    targetCustomer: "US homeowners with $175+ monthly power bills",
    awareness: "cold",
  },
  brand: {
    workspaceId: "ws_solar_001",
    brandName: "SunPath",
    primaryColor: "#0F4C81",
    voiceRegister: "warm",
  },
  targetAudience: {
    primary: "Homeowners aged 35-65 with rising power bills in sun-heavy states",
  },
};

export const dentalFixture: RunLaunchStrategyInput = {
  funnelId: "fun_dental_001",
  workspaceId: "ws_dental_001",
  goal: "Drive new patient appointment bookings",
  funnel: {
    funnelId: "fun_dental_001",
    workspaceId: "ws_dental_001",
    industry: "Dental",
    geography: "US",
    offer: "Free new-patient benefits check and visit-options guide.",
    targetCustomer: "Families with insurance shopping for a primary dentist",
    awareness: "cold",
  },
  brand: {
    workspaceId: "ws_dental_001",
    brandName: "BrightSmile Dental",
    primaryColor: "#16A085",
    voiceRegister: "warm",
  },
};

export const saasFixture: RunLaunchStrategyInput = {
  funnelId: "fun_saas_001",
  workspaceId: "ws_saas_001",
  goal: "Generate qualified demo requests from RevOps leaders",
  funnel: {
    funnelId: "fun_saas_001",
    workspaceId: "ws_saas_001",
    industry: "B2B SaaS",
    geography: "US",
    offer: "Quantify ROI in 90 seconds before booking the demo.",
    targetCustomer: "RevOps and demand-gen leaders at 50-500 person SaaS companies",
    awareness: "cold",
    pricePointCents: 99_00,
  },
  brand: {
    workspaceId: "ws_saas_001",
    brandName: "PipelineLift",
    primaryColor: "#1F2937",
    voiceRegister: "authoritative",
  },
};
