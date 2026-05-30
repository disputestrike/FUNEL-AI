import { z } from "zod";

export const Schemas = {
  phishing_blocked: z.object({ workspace_id: z.string(), generation_id: z.string().nullable(), score: z.number(), signals: z.array(z.string()) }),
  kyb_required: z.object({ workspace_id: z.string(), score: z.number() }),
  kyb_passed: z.object({ workspace_id: z.string() }),
  kyb_failed: z.object({ workspace_id: z.string(), reason: z.string() }),
  offer_blocked: z.object({ workspace_id: z.string(), category: z.string(), tier_hit: z.number() }),
  affiliate_fraud_flagged: z.object({ affiliate_id: z.string(), rule_id: z.string(), severity: z.string(), auto_action: z.string() }),
  ad_policy_failed: z.object({ ad_id: z.string(), platform: z.string(), verdict: z.string(), categories: z.array(z.string()) }),
  payment_radar_flagged: z.object({ payment_id: z.string(), rules_fired: z.array(z.string()) }),
  domain_reputation_alert: z.object({ domain: z.string(), source: z.string() }),
  ts_appeal_filed: z.object({ workspace_id: z.string(), case_id: z.string() }),
  ts_appeal_resolved: z.object({ case_id: z.string(), decision: z.string() }),
  consent_recorded: z.object({ workspace_id: z.string(), e164: z.string(), source: z.string() }),
  dsar_received: z.object({ user_id: z.string(), type: z.string() }),
  dsar_completed: z.object({ user_id: z.string(), type: z.string() }),
} as const;
