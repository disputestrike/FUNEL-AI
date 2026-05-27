/**
 * Pure score-aggregation logic.
 *
 * Kept entirely free of side effects so it's trivially unit-testable
 * against all 2^5 = 32 combinations of agent ok/fail.
 */

import {
  GRADE_THRESHOLDS,
  SCORE_WEIGHTS,
  type AgentName,
  type Confidence,
  type FinalScore,
  type Improvement,
  type LetterGrade,
  type SubScores,
} from "@funnel/shared";
import type {
  ComplianceAgentOutput,
  FormAgentOutput,
  HookAgentOutput,
  SpeedAgentOutput,
  TrustAgentOutput,
} from "@funnel/shared";

export type AgentResult<T> = { ok: true; data: T } | { ok: false; error: string };

export interface AllAgentResults {
  hook: AgentResult<HookAgentOutput>;
  form: AgentResult<FormAgentOutput>;
  trust: AgentResult<TrustAgentOutput>;
  speed: AgentResult<SpeedAgentOutput>;
  compliance: AgentResult<ComplianceAgentOutput>;
}

export function gradeFromScore(score: number): LetterGrade {
  for (const t of GRADE_THRESHOLDS) {
    if (score >= t.min) return t.grade;
  }
  return "F";
}

/**
 * Aggregate the five agent results into a `FinalScore`.
 *
 * Degraded behavior:
 *  - if N of 5 agents failed, we still produce a score by re-normalizing the
 *    remaining weights so the user never sees a penalty for our outage.
 *  - if ALL five fail, returns null (caller marks audit `failed`).
 */
export function aggregate(results: AllAgentResults): FinalScore | null {
  const weights = SCORE_WEIGHTS;
  let weighted = 0;
  let weightUsed = 0;
  const subscores: Partial<SubScores> = {};
  const degraded: AgentName[] = [];

  (Object.keys(weights) as AgentName[]).forEach((key) => {
    const r = results[key];
    const w = weights[key];
    if (r.ok) {
      const s = clamp(r.data.score, 0, 100);
      subscores[key] = s;
      weighted += s * w;
      weightUsed += w;
    } else {
      subscores[key] = 0; // surfaced as 0 in UI but flagged via degraded_agents
      degraded.push(key);
    }
  });

  if (weightUsed === 0) return null;

  const overall = Math.round(weighted / weightUsed);
  const improvements = pickTop3Improvements(results, subscores as SubScores);
  const confidence: Confidence =
    degraded.length === 0 ? "high" : degraded.length <= 2 ? "medium" : "low";

  return {
    overall,
    grade: gradeFromScore(overall),
    subscores: subscores as SubScores,
    critique: composeCritique(results, subscores as SubScores),
    improvements,
    confidence,
    degraded_agents: degraded,
  };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * Compose a 2-3 sentence critique by pulling the lowest-scoring agent's
 * critique line plus a context sentence from the highest-scoring.
 */
function composeCritique(results: AllAgentResults, subscores: SubScores): string {
  const okEntries = (Object.keys(subscores) as AgentName[])
    .filter((k) => results[k].ok)
    .map((k) => ({ k, score: subscores[k], critique: extractCritique(results[k]) }))
    .sort((a, b) => a.score - b.score);

  if (okEntries.length === 0) return "We couldn't complete the audit — please retry.";

  const worst = okEntries[0];
  const best = okEntries[okEntries.length - 1];
  if (!worst || !best) return "We couldn't complete the audit - please retry.";

  if (worst.k === best.k) return worst.critique;
  return `${worst.critique} Bright spot: your ${best.k} score (${best.score}) is your strongest dimension.`;
}

function extractCritique(r: AgentResult<{ critique?: string; summary?: string; biggest_drag?: string }>): string {
  if (!r.ok) return "";
  return r.data.critique ?? r.data.summary ?? r.data.biggest_drag ?? "";
}

/** Per-category default effort. Tuned for typical fixes. */
const EFFORT_DEFAULTS: Record<AgentName, "low" | "medium" | "high"> = {
  hook: "low",
  form: "low",
  trust: "medium",
  speed: "medium",
  compliance: "low",
};

function liftFromImpact(impact: number): "high" | "medium" | "low" {
  if (impact >= 50) return "high";
  if (impact >= 25) return "medium";
  return "low";
}

function effortNum(e: "low" | "medium" | "high"): number {
  return e === "low" ? 1 : e === "medium" ? 2 : 3;
}

export function pickTop3Improvements(
  results: AllAgentResults,
  subscores: SubScores,
): Improvement[] {
  const candidates: Improvement[] = [];

  if (results.hook.ok) {
    const data = results.hook.data;
    const impact = 100 - subscores.hook;
    candidates.push({
      id: "hook.rewrite",
      category: "hook",
      title: "Rewrite your headline to name the audience and the outcome",
      detail: data.critique,
      before: data.headline_detected,
      after: data.rewrite_suggestion,
      estimated_lift: liftFromImpact(impact),
      effort: EFFORT_DEFAULTS.hook,
    });
  }

  if (results.form.ok) {
    const data = results.form.data;
    const impact = 100 - subscores.form;
    candidates.push({
      id: "form.cut_fields",
      category: "form",
      title: data.fix_suggestion || "Reduce form friction",
      detail: data.critique,
      estimated_lift: liftFromImpact(impact),
      effort: EFFORT_DEFAULTS.form,
    });
  }

  if (results.trust.ok) {
    const data = results.trust.data;
    const impact = 100 - subscores.trust;
    candidates.push({
      id: "trust.add_proof",
      category: "trust",
      title: data.top_fix || "Add specific trust signals",
      detail: data.critique,
      estimated_lift: liftFromImpact(impact),
      effort: EFFORT_DEFAULTS.trust,
    });
  }

  if (results.speed.ok) {
    const data = results.speed.data;
    const impact = 100 - subscores.speed;
    candidates.push({
      id: "speed.optimize",
      category: "speed",
      title: data.fix || "Improve page speed",
      detail: data.biggest_drag,
      estimated_lift: liftFromImpact(impact),
      effort: EFFORT_DEFAULTS.speed,
    });
  }

  if (results.compliance.ok) {
    const data = results.compliance.data;
    const impact = 100 - subscores.compliance;
    const highFlags = data.flags.filter((f) => f.severity === "high");
    if (highFlags.length > 0) {
      candidates.push({
        id: "compliance.fix_critical",
        category: "compliance",
        title: `Fix ${highFlags.length} critical compliance issue${highFlags.length > 1 ? "s" : ""}`,
        detail: highFlags.map((f) => f.summary).join(" "),
        estimated_lift: liftFromImpact(impact),
        effort: EFFORT_DEFAULTS.compliance,
      });
    }
  }

  // Sort by impact/effort ratio descending — best ROI first.
  candidates.sort((a, b) => {
    const ai = liftScore(a.estimated_lift) / effortNum(a.effort);
    const bi = liftScore(b.estimated_lift) / effortNum(b.effort);
    return bi - ai;
  });

  return candidates.slice(0, 3);
}

function liftScore(l: "high" | "medium" | "low"): number {
  return l === "high" ? 3 : l === "medium" ? 2 : 1;
}
