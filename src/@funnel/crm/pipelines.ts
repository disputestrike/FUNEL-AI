/**
 * Pipelines + Kanban stages.
 *
 * A workspace can have multiple pipelines; one is `is_default`. Each
 * pipeline carries an ordered list of stages. Two stages per pipeline are
 * terminal (won/lost) — moving a lead into a terminal stage updates
 * `lead.status` accordingly.
 *
 * Industry templates are picked per `industry` slug from the workspace
 * Business Profile (Doc 12 PRD 1).
 */

import { z } from "zod";
import {
  newPipelineId,
  newStageId,
  type PipelineId,
  type StageId,
} from "./ids.js";
import {
  type CrmStore,
  type PipelineRow,
  type StageRow,
  type LeadStatus,
  type WorkspaceId,
  getStore,
} from "./store.js";
import { ConflictError, NotFoundError, ValidationError } from "./errors.js";
import { recordActivity } from "./activity-timeline.js";

export const DEFAULT_STAGES = ["New Lead", "Contacted", "Qualified", "Proposal Sent", "Won", "Lost"] as const;

const INDUSTRY_STAGES: Record<string, string[]> = {
  solar: ["New Lead", "Survey Scheduled", "Site Surveyed", "Proposal Sent", "Contract Signed", "Installed", "Lost"],
  roofing: ["New Lead", "Inspected", "Quoted", "Approved", "Scheduled", "Completed", "Lost"],
  coaching: ["New Lead", "Discovery Call", "Proposal Sent", "Won", "Lost"],
  consulting: ["New Lead", "Discovery Call", "Proposal Sent", "Won", "Lost"],
  medspa: ["New Lead", "Consult Booked", "Consult Attended", "Treatment Booked", "Treated", "Lost"],
};

export const CreatePipelineInput = z.object({
  workspace_id: z.string(),
  name: z.string().min(1).max(120),
  industry: z.string().optional(),
  is_default: z.boolean().optional(),
  stages: z.array(z.string().min(1).max(80)).optional(),
});
export type CreatePipelineInput = z.infer<typeof CreatePipelineInput>;

export async function createPipeline(input: CreatePipelineInput, store: CrmStore = getStore()): Promise<{ pipeline: PipelineRow; stages: StageRow[] }> {
  const parsed = CreatePipelineInput.parse(input);
  const stageNames =
    parsed.stages ??
    INDUSTRY_STAGES[(parsed.industry ?? "").toLowerCase()] ??
    [...DEFAULT_STAGES];

  if (stageNames.length < 2) throw new ValidationError("a pipeline needs at least 2 stages");

  const pipelineId = newPipelineId();
  const stages: StageRow[] = stageNames.map((name, i) => ({
    id: newStageId(),
    pipeline_id: pipelineId,
    workspace_id: parsed.workspace_id,
    name,
    position: i,
    terminal_kind: /won|installed|completed|signed|treated/i.test(name)
      ? "won"
      : /lost/i.test(name)
      ? "lost"
      : null,
  }));

  const pipeline: PipelineRow = {
    id: pipelineId,
    workspace_id: parsed.workspace_id,
    name: parsed.name,
    industry: parsed.industry ?? null,
    is_default: parsed.is_default ?? false,
    created_at: new Date(),
  };
  await store.insertPipeline(pipeline, stages);
  return { pipeline, stages };
}

export async function getOrCreateDefaultPipeline(
  workspace_id: WorkspaceId,
  industry: string | undefined,
  store: CrmStore = getStore(),
) {
  const existing = await store.getDefaultPipeline(workspace_id);
  if (existing) return existing;
  return createPipeline({ workspace_id, name: "Default", industry, is_default: true }, store);
}

export async function moveLead(
  workspace_id: WorkspaceId,
  lead_id: string,
  from_stage_id: StageId,
  to_stage_id: StageId,
  actor_user_id: string | null = null,
  store: CrmStore = getStore(),
): Promise<{ status: LeadStatus; stage: StageRow }> {
  const lead = await store.getLead(workspace_id, lead_id as any);
  if (!lead) throw new NotFoundError("lead", lead_id);

  if (lead.stage_id && lead.stage_id !== from_stage_id) {
    throw new ConflictError(
      `lead ${lead_id} is in stage ${lead.stage_id}, not ${from_stage_id} — refresh and retry`,
    );
  }

  const toStage = await store.getStage(workspace_id, to_stage_id);
  if (!toStage) throw new NotFoundError("stage", to_stage_id);
  const fromStage = from_stage_id ? await store.getStage(workspace_id, from_stage_id) : null;
  if (fromStage && fromStage.pipeline_id !== toStage.pipeline_id) {
    throw new ValidationError("cannot move across pipelines — clone the lead instead");
  }

  const status: LeadStatus =
    toStage.terminal_kind === "won"
      ? "won"
      : toStage.terminal_kind === "lost"
      ? "lost"
      : /qualified/i.test(toStage.name)
      ? "qualified"
      : /contacted/i.test(toStage.name)
      ? "contacted"
      : /proposal/i.test(toStage.name)
      ? "proposal_sent"
      : "new";

  await store.updateLead(workspace_id, lead.id, {
    stage_id: toStage.id,
    pipeline_id: toStage.pipeline_id,
    status,
  });
  await recordActivity({
    workspace_id,
    contact_id: lead.crm_contact_id,
    lead_id: lead.id,
    kind: "stage_changed",
    actor_user_id,
    metadata: { from_stage_id, to_stage_id, status },
  });
  return { status, stage: toStage };
}

export async function listPipelines(workspace_id: WorkspaceId, store: CrmStore = getStore()): Promise<PipelineRow[]> {
  return store.listPipelines(workspace_id);
}

export async function getPipeline(workspace_id: WorkspaceId, id: PipelineId, store: CrmStore = getStore()) {
  return store.getPipeline(workspace_id, id);
}

export type { PipelineId, PipelineRow, StageId, StageRow };
