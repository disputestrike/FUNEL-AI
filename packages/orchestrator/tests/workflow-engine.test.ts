import { describe, expect, it } from "vitest";

import {
  buildAutomatedFunnel,
  completeWorkflowStep,
  createWorkflowRun,
  failWorkflowStep,
  nextRunnableSteps,
  startWorkflowStep,
  summarizeWorkflow,
} from "../src/index.js";

describe("durable workflow engine", () => {
  const funnel = buildAutomatedFunnel({
    generationId: "gen_workflow_001",
    workspaceId: "ws_workflow",
    industry: "Solar",
    audience: "Homeowners with high bills",
    offer: "Generate a savings plan before booking.",
    providerReadiness: { openai: true, anthropic: true, replicate: true, resend: true },
  });

  it("creates resumable step state from the automated funnel plan", () => {
    const run = createWorkflowRun(funnel, new Date("2026-05-29T12:00:00.000Z"));
    const summary = summarizeWorkflow(run);

    expect(run.id).toBe("wf_gen_workflow_001");
    expect(run.steps.map((step) => step.id)).toEqual([
      "strategy",
      "copy",
      "images",
      "storage",
      "payments",
      "voice",
      "email",
    ]);
    expect(summary.nextRunnableStepIds).toEqual(["strategy"]);
    expect(summary.skipped).toBeGreaterThanOrEqual(1);
  });

  it("honors dependencies and moves work forward", () => {
    let run = createWorkflowRun(funnel);
    run = startWorkflowStep(run, "strategy");
    expect(run.steps.find((step) => step.id === "strategy")?.status).toBe("running");

    run = completeWorkflowStep(run, "strategy");
    expect(nextRunnableSteps(run).map((step) => step.id)).toEqual(["copy"]);
    expect(run.steps.filter((step) => step.status === "skipped").map((step) => step.id)).toEqual(
      expect.arrayContaining(["storage", "payments", "voice"]),
    );
  });

  it("retries local fallback work once and fails after max attempts", () => {
    const fallbackFunnel = buildAutomatedFunnel({
      generationId: "gen_workflow_002",
      workspaceId: "ws_workflow",
      industry: "Insurance",
      audience: "Policy holders",
      offer: "Generate a coverage gap check.",
    });
    let run = createWorkflowRun(fallbackFunnel);
    run = startWorkflowStep(run, "strategy");
    run = failWorkflowStep(run, "strategy", "model timeout");

    expect(run.steps.find((step) => step.id === "strategy")?.status).toBe("failed");
    expect(summarizeWorkflow(run).status).toBe("failed");
  });
});
