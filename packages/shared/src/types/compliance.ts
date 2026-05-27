/**
 * Compliance domain types.
 *
 * Per doc 21: regulated verticals carry mandatory fact-check gates and
 * vertical-specific rule packs. The `ComplianceFlag` model captures one
 * finding from a rule pack against a Funnel or asset.
 */

import type { FunnelId, SectionId } from "./funnel.js";
import type { WorkspaceId } from "./workspace.js";

export enum RegulatedVertical {
  None = "none",
  Healthcare = "healthcare",
  Dental = "dental",
  MedSpa = "med_spa",
  Glp1 = "glp1_weight_loss",
  CosmeticSurgery = "cosmetic_surgery",
  HairRestoration = "hair_restoration",
  PersonalInjuryLaw = "personal_injury_law",
  FamilyLaw = "family_law",
  DuiDefense = "dui_defense",
  Bankruptcy = "bankruptcy_law",
  Insurance = "insurance",
  Mortgage = "mortgage",
  FinancialAdvisors = "financial_advisors",
  TaxRelief = "tax_relief",
  RealEstate = "real_estate",
  Supplements = "supplements",
  Crypto = "crypto",
  Gambling = "gambling",
  Mlm = "mlm",
}

export type ComplianceSeverity = "info" | "soft_flag" | "warning" | "blocker" | "review";

/** Source rule pack — typically `<vertical>.<rule_id>` (e.g. "healthcare.B1-03"). */
export type ComplianceRuleId = string;

export interface ComplianceFlag {
  id: string; // cfl_…
  workspace_id: WorkspaceId;
  funnel_id?: FunnelId;
  section_id?: SectionId;
  severity: ComplianceSeverity;
  rule_id: ComplianceRuleId;
  rule_pack_version: string;
  message: string;
  /** Optional remediation hint surfaced to the user. */
  remediation?: string;
  /** Free-form evidence pointers (URLs, asset IDs, claim text hashes). */
  evidence: Array<{ kind: string; pointer: string }>;
  /** True if the flag blocks publish until resolved. */
  blocks_publish: boolean;
  raised_at: string;
  resolved_at?: string | null;
  resolved_by?: string | null;
  /** "auto" if the system auto-resolved; "human" if a reviewer closed it. */
  resolution_actor?: "auto" | "human" | null;
}

export interface FactCheckClaim {
  claim_text: string;
  claim_text_hash: string;
  claim_type: "statistic" | "endorsement" | "guarantee" | "comparison" | "medical" | "financial" | "legal" | "other";
  section_id?: SectionId;
}

export interface FactCheckReport {
  id: string; // fcr_…
  workspace_id: WorkspaceId;
  funnel_id: FunnelId;
  funnel_version_id?: string;
  vertical: RegulatedVertical;
  /** Overall verdict at the report level. */
  verdict: "pass" | "fail" | "needs_review";
  claims: Array<
    FactCheckClaim & {
      status: "verified" | "needs_source" | "unverifiable" | "false";
      confidence: number; // 0..1
      evidence_refs: Array<{ url?: string; kb_doc_id?: string; note?: string }>;
      auto_remediation_taken?: string;
      human_review_required: boolean;
    }
  >;
  rubric_version: string;
  generated_at: string;
  completed_at?: string;
  /** Human reviewer if any. */
  reviewer_user_id?: string;
  reviewed_at?: string;
}

/**
 * Per-vertical disclosure copy. Used by Compliance Agent to inject required
 * boilerplate, and by the renderer's locale bundle.
 */
export interface DisclosureRequirement {
  vertical: RegulatedVertical;
  /** ISO 3166-1 alpha-2 country codes this applies in; "*" for global. */
  applies_in: string[];
  text_template: string;
  required_when: "always" | "if_consumer_facing" | "if_collecting_pii";
}
