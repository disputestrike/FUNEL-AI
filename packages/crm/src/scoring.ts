/**
 * Industry-specific lead scoring.
 *
 * Scoring is deterministic per `model_version` so the resulting features
 * hash + score are reproducible (see Doc 03 §A.5 `lead_scored.features_hash`).
 *
 * Defaults shipped here cover solar (per Doc 02b KB pack), home services,
 * coaching/consulting, and a generic fallback. Workspaces can register
 * overrides via `registerScoringRules` at boot.
 */

import { z } from "zod";
import type { LeadRow } from "./store.js";
import type { ContactRow } from "./contacts.js";

export const MODEL_VERSION = "2026.05-default";

export interface ScoreInputs {
  lead: LeadRow;
  contact: ContactRow | null;
  /** Industry slug — e.g. `solar`, `roofing`, `coaching`, `medspa`. */
  industry: string;
  /** Optional enrichment blob (firmographic / employee count / etc). */
  enrichment?: Record<string, unknown>;
}

export interface ScoreResult {
  score: number; // 0..100
  band: "hot" | "warm" | "cold";
  reasons: string[];
  features_hash: string;
  model_version: string;
}

export type ScoringRule = (inputs: ScoreInputs) => { delta: number; reason?: string } | null;

export interface ScoringRuleset {
  industry: string;
  rules: ScoringRule[];
  /** Score thresholds for band assignment. */
  hot_at?: number;
  warm_at?: number;
}

// ---------- Default rule sets ----------

const generic: ScoringRule[] = [
  ({ contact }) => (contact?.email_normalized ? { delta: 8, reason: "email_provided" } : null),
  ({ contact }) => (contact?.phone_e164 ? { delta: 12, reason: "phone_provided" } : null),
  ({ contact }) => (contact?.full_name ? { delta: 5, reason: "name_provided" } : null),
  ({ lead }) => (lead.geo_country === "US" ? { delta: 5, reason: "geo_us" } : null),
  ({ lead }) =>
    Object.keys(lead.utm).length > 0 ? { delta: 4, reason: "utm_tracked" } : null,
  ({ contact }) =>
    contact?.consent?.marketing ? { delta: 6, reason: "marketing_consent" } : null,
  ({ contact }) => (contact?.consent?.sms ? { delta: 4, reason: "sms_consent" } : null),
];

const solar: ScoringRule[] = [
  ...generic,
  ({ enrichment }) => {
    const monthly = (enrichment?.electric_bill_usd_month as number) ?? 0;
    if (monthly >= 250) return { delta: 25, reason: "high_electric_bill" };
    if (monthly >= 150) return { delta: 15, reason: "mid_electric_bill" };
    if (monthly > 0 && monthly < 80) return { delta: -10, reason: "low_electric_bill" };
    return null;
  },
  ({ enrichment }) =>
    enrichment?.home_ownership === "owner" ? { delta: 20, reason: "homeowner" } : null,
  ({ enrichment }) =>
    enrichment?.roof_age_years && (enrichment.roof_age_years as number) < 15
      ? { delta: 8, reason: "young_roof" }
      : null,
  ({ enrichment }) =>
    enrichment?.credit_band === "excellent" ? { delta: 10, reason: "credit_excellent" } : null,
];

const roofing: ScoringRule[] = [
  ...generic,
  ({ enrichment }) =>
    enrichment?.home_ownership === "owner" ? { delta: 18, reason: "homeowner" } : null,
  ({ enrichment }) =>
    enrichment?.urgency === "leaking" ? { delta: 25, reason: "urgent_leak" } : null,
  ({ enrichment }) =>
    (enrichment?.roof_age_years as number) > 20 ? { delta: 12, reason: "old_roof" } : null,
];

const coaching: ScoringRule[] = [
  ...generic,
  ({ enrichment }) =>
    enrichment?.budget_band === ">5k" ? { delta: 20, reason: "high_budget" } : null,
  ({ enrichment }) =>
    enrichment?.role && /founder|ceo|owner/i.test(enrichment.role as string)
      ? { delta: 15, reason: "decision_maker" }
      : null,
];

const medspa: ScoringRule[] = [
  ...generic,
  ({ enrichment }) =>
    enrichment?.procedure_interest === "botox" ? { delta: 10, reason: "core_procedure" } : null,
  ({ enrichment }) =>
    enrichment?.timing === "this_month" ? { delta: 25, reason: "near_term_timing" } : null,
];

const RULES = new Map<string, ScoringRule[]>([
  ["generic", generic],
  ["solar", solar],
  ["roofing", roofing],
  ["coaching", coaching],
  ["consulting", coaching],
  ["medspa", medspa],
  ["aesthetics", medspa],
]);

/** Register or override rules for an industry. */
export function registerScoringRules(industry: string, rules: ScoringRule[]): void {
  RULES.set(industry.toLowerCase(), rules);
}

export const ScoreInputsSchema = z.object({
  industry: z.string(),
});

/** Compute a score for the lead. Deterministic given identical inputs + model_version. */
export async function scoreLead(inputs: ScoreInputs): Promise<ScoreResult> {
  const industry = (inputs.industry ?? "generic").toLowerCase();
  const rules = RULES.get(industry) ?? generic;
  let score = 0;
  const reasons: string[] = [];
  for (const rule of rules) {
    const out = rule(inputs);
    if (!out) continue;
    score += out.delta;
    if (out.reason) reasons.push(out.reason);
  }
  score = Math.max(0, Math.min(100, Math.round(score)));
  const band: "hot" | "warm" | "cold" = score >= 70 ? "hot" : score >= 40 ? "warm" : "cold";
  const features_hash = await stableHash({
    lead_id: inputs.lead.id,
    industry,
    enrichment_keys: Object.keys(inputs.enrichment ?? {}).sort(),
    reasons,
  });
  return { score, band, reasons, features_hash, model_version: MODEL_VERSION };
}

async function stableHash(obj: unknown): Promise<string> {
  const str = JSON.stringify(obj);
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
