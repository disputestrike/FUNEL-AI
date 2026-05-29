/**
 * Fixtures dedicated to the Copy / Creative-Brief / Ad-Policy tests.
 *
 * Kept separate from `fixtures.ts` (which targets the Strategy agent's
 * `RunLaunchStrategyInput` shape) because the L2 copy/brief/policy agents
 * consume the slimmer `LaunchStrategy` interface defined in `copy.ts`.
 *
 * Three industry archetypes:
 *   - SOLAR        — high-ticket home services, savings-driven.
 *   - DENTAL       — local medical, attribution-sensitive.
 *   - SUPPLEMENTS  — heavily-regulated; many policy traps.
 */

import type { LaunchStrategy } from "../../src/launch/copy.js";

export const SOLAR_STRATEGY: LaunchStrategy = {
  brand: "GoFunnelAI",
  industry: "solar",
  audience: "homeowners with $250+ monthly power bills",
  offer: "Personalized rooftop savings plan",
  valueProp: "See your exact rooftop savings",
  painPoint: "rising power bills",
  payoff: "save up to $1,800 per year",
  proofPoint: "12,400 homeowners",
  timeToValue: "under 90 seconds",
  ctaPrimary: "Get my free quote",
  urlPath: { segment1: "solar", segment2: "savings" },
  locale: "en-US",
};

export const DENTAL_STRATEGY: LaunchStrategy = {
  brand: "BrightSmile Dental",
  industry: "dental",
  audience: "adults in Austin overdue for a cleaning",
  offer: "$1 first visit with full exam + cleaning",
  valueProp: "A confident smile, near you",
  painPoint: "sensitivity and stained teeth",
  payoff: "first visit for $1",
  proofPoint: "1,200 patients",
  timeToValue: "your first opening this week",
  ctaPrimary: "Book my visit",
  urlPath: { segment1: "austin", segment2: "new-patient" },
  locale: "en-US",
};

export const SUPPLEMENTS_STRATEGY: LaunchStrategy = {
  brand: "VitalLine",
  industry: "supplements",
  audience: "adults 35+ tracking daily energy",
  offer: "30-day daily wellness bundle",
  valueProp: "Daily wellness, simplified",
  painPoint: "afternoon energy crashes",
  payoff: "feel steady through 4pm",
  proofPoint: "9,800 daily users",
  timeToValue: "in 14 days",
  ctaPrimary: "Try the bundle",
  urlPath: { segment1: "wellness", segment2: "energy" },
  locale: "en-US",
};

/**
 * A LaunchStrategy variant deliberately stuffed with policy-trap claims —
 * used for the negative half of the compliance regression suite.
 */
export const SUPPLEMENTS_BAD_STRATEGY: LaunchStrategy = {
  ...SUPPLEMENTS_STRATEGY,
  valueProp: "Cures diabetes naturally",
  painPoint: "your diabetes",
  payoff: "guaranteed weight loss",
  proofPoint: "FDA approved",
  ctaPrimary: "Get cure now",
};
