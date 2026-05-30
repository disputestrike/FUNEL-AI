/**
 * Compliance agent pipeline runner.
 *
 * Orchestrates the Fact-Check and Compliance agents (provided by
 * @funnel/agents) in sequence against a set of content artifacts. Decision
 * logic combines:
 *
 *   1. deterministic rules pre-filter (rules-library.scanForViolations)
 *   2. fact-check agent (claims requiring substantiation)
 *   3. compliance agent (LLM judgment with vertical + KB pack context)
 *   4. required-disclosure check
 *
 * Outputs a structured ComplianceReport and a decision ∈
 * {pass, human_review, block}.
 */

import { scanForViolations, getRequiredDisclosures } from "./rules-library.js";
import {
  ContentArtifactSchema,
  type ContentArtifact,
  type ComplianceReport,
  type ComplianceDecision,
  type FactCheckReport,
} from "./types.js";
import type { Jurisdiction } from "./regulated-verticals.js";
import { isRegulatedVertical } from "./regulated-verticals.js";

/**
 * Shape we expect from the LLM-backed agents in @funnel/agents. We define the
 * interface here so the compliance package does not need to import the agent
 * implementations directly — the orchestrator passes them in. This makes the
 * package independently testable.
 */
export interface ComplianceAgent {
  run(input: {
    artifacts: ContentArtifact[];
    vertical: string | null;
    jurisdictions: readonly Jurisdiction[];
    rulesetSummary: string;
  }): Promise<{
    decision: ComplianceDecision;
    rationale: string;
    additionalHits: Array<{
      ruleId: string;
      severity: "block" | "human_review" | "warn";
      description: string;
      matched: string;
      authority: string;
      artifactId?: string;
    }>;
  }>;
}

export interface FactCheckAgent {
  run(input: { artifacts: ContentArtifact[]; vertical: string | null }): Promise<FactCheckReport>;
}

export interface AgentRunnerOptions {
  complianceAgent: ComplianceAgent;
  factCheckAgent: FactCheckAgent;
  /** Optional summary of the KB pack rules — improves LLM grounding. */
  rulesetSummary?: string;
}

export interface RunnerInput {
  generationId: string;
  workspaceId: string;
  vertical: string | null;
  jurisdictions?: readonly Jurisdiction[];
  artifacts: ContentArtifact[];
}

export interface RunnerOutput {
  generationId: string;
  workspaceId: string;
  decision: ComplianceDecision;
  report: ComplianceReport;
  factCheck: FactCheckReport;
  durationMs: number;
}

export class ComplianceRunner {
  constructor(private readonly opts: AgentRunnerOptions) {}

  async run(input: RunnerInput): Promise<RunnerOutput> {
    const t0 = Date.now();
    const jurisdictions = input.jurisdictions ?? ["US" as Jurisdiction];

    // Validate inputs (defensive — orchestrator might feed us garbage).
    const artifacts = input.artifacts.map((a) => ContentArtifactSchema.parse(a));

    // 1. Deterministic regex/keyword pre-filter ──────────────────────────
    const ruleHits: ComplianceReport["hits"] = [];
    for (const artifact of artifacts) {
      const hits = scanForViolations(artifact.text, input.vertical, jurisdictions);
      for (const h of hits) {
        ruleHits.push({ ...h, artifactId: artifact.artifactId });
      }
    }

    // 2. Fact-check agent ────────────────────────────────────────────────
    const factCheck = await this.opts.factCheckAgent.run({
      artifacts,
      vertical: input.vertical,
    });

    // 3. LLM compliance agent ─────────────────────────────────────────────
    const llm = await this.opts.complianceAgent.run({
      artifacts,
      vertical: input.vertical,
      jurisdictions,
      rulesetSummary: this.opts.rulesetSummary ?? "",
    });

    // 4. Required-disclosure verification ─────────────────────────────────
    const required = getRequiredDisclosures(input.vertical, jurisdictions);
    const combinedText = artifacts.map((a) => a.text).join("\n\n");
    const missingDisclosures = required
      .filter((d) => {
        // crude but deterministic — look for distinctive snippet from the
        // canonical text or its rule id.
        const sentinel = d.text.split(/[.!?]/)[0]?.slice(0, 40).trim();
        if (!sentinel) return false;
        return !combinedText.includes(sentinel);
      })
      .map((d) => ({ id: d.id, surface: d.surface, text: d.text }));

    // Combine hits ────────────────────────────────────────────────────────
    const allHits = [...ruleHits, ...llm.additionalHits];

    // 5. Decision logic ──────────────────────────────────────────────────
    let decision: ComplianceDecision = llm.decision;

    const hasBlocking = allHits.some((h) => h.severity === "block");
    const hasReview = allHits.some((h) => h.severity === "human_review");
    const hasMissing = missingDisclosures.length > 0;
    const hasUnverifiedClaims = factCheck.riskyClaimsCount > 0 || factCheck.unverifiedCount > 0;

    if (hasBlocking) decision = "block";
    else if (decision === "pass" && (hasReview || hasMissing || hasUnverifiedClaims)) decision = "human_review";

    // Regulated verticals always route to review on first publish (handled
    // in human-review-queue.ts via workspace's review-state machine), but we
    // also escalate here if vertical is regulated AND any non-trivial hit.
    if (isRegulatedVertical(input.vertical) && (allHits.length > 0 || hasMissing) && decision === "pass") {
      decision = "human_review";
    }

    const report: ComplianceReport = {
      decision,
      vertical: input.vertical,
      jurisdictions: [...jurisdictions],
      hits: allHits,
      missingDisclosures,
      llmRationale: llm.rationale,
    };

    return {
      generationId: input.generationId,
      workspaceId: input.workspaceId,
      decision,
      report,
      factCheck,
      durationMs: Date.now() - t0,
    };
  }
}
