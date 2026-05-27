/**
 * Zod schemas for the Compliance domain.
 */

import { z } from "zod";

export const RegulatedVerticalSchema = z.enum([
  "none",
  "healthcare",
  "dental",
  "med_spa",
  "glp1_weight_loss",
  "cosmetic_surgery",
  "hair_restoration",
  "personal_injury_law",
  "family_law",
  "dui_defense",
  "bankruptcy_law",
  "insurance",
  "mortgage",
  "financial_advisors",
  "tax_relief",
  "real_estate",
  "supplements",
  "crypto",
  "gambling",
  "mlm",
]);

export const ComplianceSeveritySchema = z.enum([
  "info",
  "soft_flag",
  "warning",
  "blocker",
  "review",
]);

export const ComplianceFlagSchema = z.object({
  id: z.string().min(1),
  workspace_id: z.string().min(1),
  funnel_id: z.string().optional(),
  section_id: z.string().optional(),
  severity: ComplianceSeveritySchema,
  rule_id: z.string(),
  rule_pack_version: z.string(),
  message: z.string(),
  remediation: z.string().optional(),
  evidence: z.array(z.object({ kind: z.string(), pointer: z.string() })),
  blocks_publish: z.boolean(),
  raised_at: z.string().datetime(),
  resolved_at: z.string().datetime().nullable().optional(),
  resolved_by: z.string().nullable().optional(),
  resolution_actor: z.enum(["auto", "human"]).nullable().optional(),
});

export const FactCheckClaimSchema = z.object({
  claim_text: z.string(),
  claim_text_hash: z.string(),
  claim_type: z.enum([
    "statistic",
    "endorsement",
    "guarantee",
    "comparison",
    "medical",
    "financial",
    "legal",
    "other",
  ]),
  section_id: z.string().optional(),
});

export const FactCheckReportSchema = z.object({
  id: z.string().min(1),
  workspace_id: z.string().min(1),
  funnel_id: z.string().min(1),
  funnel_version_id: z.string().optional(),
  vertical: RegulatedVerticalSchema,
  verdict: z.enum(["pass", "fail", "needs_review"]),
  claims: z.array(
    FactCheckClaimSchema.extend({
      status: z.enum(["verified", "needs_source", "unverifiable", "false"]),
      confidence: z.number().min(0).max(1),
      evidence_refs: z.array(
        z.object({
          url: z.string().url().optional(),
          kb_doc_id: z.string().optional(),
          note: z.string().optional(),
        })
      ),
      auto_remediation_taken: z.string().optional(),
      human_review_required: z.boolean(),
    })
  ),
  rubric_version: z.string(),
  generated_at: z.string().datetime(),
  completed_at: z.string().datetime().optional(),
  reviewer_user_id: z.string().optional(),
  reviewed_at: z.string().datetime().optional(),
});

export const DisclosureRequirementSchema = z.object({
  vertical: RegulatedVerticalSchema,
  applies_in: z.array(z.string()),
  text_template: z.string(),
  required_when: z.enum(["always", "if_consumer_facing", "if_collecting_pii"]),
});
