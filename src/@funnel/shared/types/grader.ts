/**
 * Types specific to the Funnel Grader (Trojan Horse public tool at /grade).
 *
 * Source of truth: docs/01-funnel-grader-build-spec.md §3.1 & §4.
 */

export type AuditStatus =
  | "queued"
  | "rendering"
  | "scoring"
  | "done"
  | "failed";

export type Confidence = "high" | "medium" | "low";

export type AgentName = "hook" | "form" | "trust" | "speed" | "compliance";

export type LetterGrade = "A+" | "A" | "B" | "C" | "D" | "F";

export type Effort = "low" | "medium" | "high";
export type Lift = "low" | "medium" | "high";

export interface Improvement {
  id: string;
  category: AgentName;
  title: string;
  detail: string;
  before?: string;
  after?: string;
  estimated_lift: Lift;
  effort: Effort;
}

export interface AgentRunMeta {
  model: string;
  tokens?: number;
  input_tokens?: number;
  output_tokens?: number;
  cache_read_tokens?: number;
  ms: number;
  ok: boolean;
  error?: string | null;
}

export interface SubScores {
  hook: number;
  form: number;
  trust: number;
  speed: number;
  compliance: number;
}

export interface FinalScore {
  overall: number;
  grade: LetterGrade;
  subscores: SubScores;
  critique: string;
  improvements: Improvement[];
  confidence: Confidence;
  degraded_agents: AgentName[];
}

export interface AuditResultPayload {
  audit_id: string;
  url: string;
  fetched_at: string;
  status: AuditStatus;
  screenshot_url?: string | null;
  share_code: string;
  pdf_url?: string | null;
  preview_funnel_id?: string | null;
  cached?: boolean;
  score: FinalScore | null;
  agent_runs: Partial<Record<AgentName, AgentRunMeta>>;
}

export type AuditStreamEvent =
  | { type: "queued"; audit_id: string }
  | { type: "rendering"; audit_id: string }
  | { type: "rendered"; audit_id: string; screenshot_url: string }
  | { type: "scoring"; audit_id: string }
  | { type: "agent_completed"; audit_id: string; agent: AgentName; subscore: number; ms: number; ok: boolean }
  | { type: "done"; audit_id: string; payload: AuditResultPayload }
  | { type: "failed"; audit_id: string; reason: string }
  | { type: "heartbeat"; ts: number };

export interface AgentInput {
  audit_id: string;
  url: string;
  fetched_at: string;
  html: string;
  text_content: string;
  screenshot_url: string;
  viewport: { w: number; h: number };
  lighthouse: {
    performance: number;
    accessibility: number;
    seo: number;
    fcp_ms: number;
    lcp_ms: number;
    cls: number;
    tti_ms: number;
  };
  forms: Array<{
    field_count: number;
    field_types: string[];
    submit_label: string | null;
    has_phone: boolean;
    has_credit_card: boolean;
  }>;
  meta: {
    title: string | null;
    description: string | null;
    og_image: string | null;
  };
}
