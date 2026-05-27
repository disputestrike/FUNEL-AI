/**
 * Shared types used across the @funnel/compliance package.
 */

import { z } from "zod";

export const GenerationIdSchema = z.string().min(1);
export const WorkspaceIdSchema = z.string().min(1);
export const UserIdSchema = z.string().min(1);
export const FunnelIdSchema = z.string().min(1);

export type GenerationId = z.infer<typeof GenerationIdSchema>;
export type WorkspaceId = z.infer<typeof WorkspaceIdSchema>;
export type UserId = z.infer<typeof UserIdSchema>;
export type FunnelId = z.infer<typeof FunnelIdSchema>;

export const ContentArtifactSchema = z.object({
  /** Stable id for this artifact (page, ad, email, sms, voice_script). */
  artifactId: z.string().min(1),
  type: z.enum(["page", "ad_copy", "email", "sms", "voice_script", "lead_magnet", "image_alt"]),
  /** Raw text content. Images flagged elsewhere. */
  text: z.string(),
  /** Page or component identifier this belongs to. */
  parent: z.string().optional(),
});
export type ContentArtifact = z.infer<typeof ContentArtifactSchema>;

export const ComplianceDecisionSchema = z.enum(["pass", "human_review", "block"]);
export type ComplianceDecision = z.infer<typeof ComplianceDecisionSchema>;

export interface FactCheckClaim {
  claim: string;
  verifiable: boolean;
  evidence?: string[];
  confidence: number; // 0..1
}

export interface FactCheckReport {
  claims: FactCheckClaim[];
  unverifiedCount: number;
  riskyClaimsCount: number;
}

export interface ComplianceReport {
  decision: ComplianceDecision;
  vertical: string | null;
  jurisdictions: string[];
  hits: Array<{
    ruleId: string;
    severity: "block" | "human_review" | "warn";
    description: string;
    matched: string;
    authority: string;
    artifactId?: string;
  }>;
  missingDisclosures: Array<{ id: string; surface: string; text: string }>;
  /** Summary from LLM compliance agent (Sonnet/Opus). */
  llmRationale?: string;
}
