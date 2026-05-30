import type { AutomatedFunnel, FunnelAutomationPlan } from "./automated-funnel.js";

export type WorkflowStepStatus = "queued" | "running" | "succeeded" | "failed" | "skipped";
export type WorkflowRunStatus = "queued" | "running" | "succeeded" | "failed" | "blocked";

export interface WorkflowStepRun {
  id: string;
  label: string;
  engine: FunnelAutomationPlan["steps"][number]["engine"];
  status: WorkflowStepStatus;
  attempts: number;
  maxAttempts: number;
  dependsOn: string[];
  startedAt: string | null;
  completedAt: string | null;
  lastError: string | null;
}

export interface WorkflowRun {
  id: string;
  funnelId: string;
  workspaceId: string;
  status: WorkflowRunStatus;
  steps: WorkflowStepRun[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowSummary {
  status: WorkflowRunStatus;
  total: number;
  queued: number;
  running: number;
  succeeded: number;
  failed: number;
  skipped: number;
  nextRunnableStepIds: string[];
}

const STEP_DEPENDENCIES: Record<string, string[]> = {
  strategy: [],
  copy: ["strategy"],
  images: ["copy"],
  storage: ["images"],
  payments: ["strategy"],
  voice: ["strategy"],
  email: ["copy"],
};

export function createWorkflowRun(funnel: AutomatedFunnel, now = new Date()): WorkflowRun {
  const timestamp = now.toISOString();
  return {
    id: `wf_${funnel.id}`,
    funnelId: funnel.id,
    workspaceId: funnel.workspace_id,
    status: "queued",
    createdAt: timestamp,
    updatedAt: timestamp,
    steps: funnel.automation.steps.map((step): WorkflowStepRun => ({
      id: step.id,
      label: step.label,
      engine: step.engine,
      status: step.state === "credential_required" ? "skipped" : "queued",
      attempts: 0,
      maxAttempts: step.state === "local_fallback_ready" ? 1 : 3,
      dependsOn: STEP_DEPENDENCIES[step.id] ?? [],
      startedAt: null,
      completedAt: step.state === "credential_required" ? timestamp : null,
      lastError: step.state === "credential_required" ? "Credential required before this adapter can run." : null,
    })),
  };
}

export function startWorkflowStep(run: WorkflowRun, stepId: string, now = new Date()): WorkflowRun {
  const step = getStep(run, stepId);
  if (step.status !== "queued") return run;
  if (!dependenciesSucceeded(run, step)) return { ...run, status: "blocked", updatedAt: now.toISOString() };

  return updateStep(run, stepId, {
    status: "running",
    attempts: step.attempts + 1,
    startedAt: now.toISOString(),
    lastError: null,
  }, now);
}

export function completeWorkflowStep(run: WorkflowRun, stepId: string, now = new Date()): WorkflowRun {
  return updateStep(run, stepId, {
    status: "succeeded",
    completedAt: now.toISOString(),
    lastError: null,
  }, now);
}

export function failWorkflowStep(run: WorkflowRun, stepId: string, error: string, now = new Date()): WorkflowRun {
  const step = getStep(run, stepId);
  const canRetry = step.attempts < step.maxAttempts;
  return updateStep(run, stepId, {
    status: canRetry ? "queued" : "failed",
    completedAt: canRetry ? null : now.toISOString(),
    lastError: error,
  }, now);
}

export function summarizeWorkflow(run: WorkflowRun): WorkflowSummary {
  const counts = countStatuses(run.steps);
  const nextRunnableStepIds = nextRunnableSteps(run).map((step) => step.id);
  return {
    status: deriveRunStatus(run),
    total: run.steps.length,
    queued: counts.queued,
    running: counts.running,
    succeeded: counts.succeeded,
    failed: counts.failed,
    skipped: counts.skipped,
    nextRunnableStepIds,
  };
}

export function nextRunnableSteps(run: WorkflowRun): WorkflowStepRun[] {
  return run.steps.filter((step) => step.status === "queued" && dependenciesSucceeded(run, step));
}

function updateStep(
  run: WorkflowRun,
  stepId: string,
  patch: Partial<WorkflowStepRun>,
  now: Date,
): WorkflowRun {
  const steps = run.steps.map((step) => (step.id === stepId ? { ...step, ...patch } : step));
  const nextRun = { ...run, steps, updatedAt: now.toISOString() };
  return { ...nextRun, status: deriveRunStatus(nextRun) };
}

function getStep(run: WorkflowRun, stepId: string): WorkflowStepRun {
  const step = run.steps.find((candidate) => candidate.id === stepId);
  if (!step) throw new Error(`Workflow step not found: ${stepId}`);
  return step;
}

function dependenciesSucceeded(run: WorkflowRun, step: WorkflowStepRun): boolean {
  return step.dependsOn.every((id) => {
    const dependency = run.steps.find((candidate) => candidate.id === id);
    return !dependency || dependency.status === "succeeded" || dependency.status === "skipped";
  });
}

function deriveRunStatus(run: WorkflowRun): WorkflowRunStatus {
  if (run.steps.some((step) => step.status === "failed")) return "failed";
  if (run.steps.some((step) => step.status === "running")) return "running";
  if (nextRunnableSteps(run).length > 0) return "running";
  if (run.steps.every((step) => step.status === "succeeded" || step.status === "skipped")) return "succeeded";
  return "blocked";
}

function countStatuses(steps: WorkflowStepRun[]) {
  return steps.reduce(
    (acc, step) => {
      acc[step.status] += 1;
      return acc;
    },
    { queued: 0, running: 0, succeeded: 0, failed: 0, skipped: 0 },
  );
}
