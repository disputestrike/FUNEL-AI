import { z } from "zod";

// ---- GoFunnelAI platform Zod schemas -------------------------------------

export * from "./workspace.js";
export * from "./user.js";
export * from "./crm.js";
export * from "./billing.js";
export * from "./compliance.js";
export * from "./branding.js";
export * from "./generation.js";

// ---- Funnel Grader Zod schemas (legacy) ---------------------------------
//
// Validating the JSON each Claude agent returns in the Funnel Grader app.

export const HookAgentSchema = z.object({
  score: z.number().min(0).max(100),
  subscores: z.object({
    clarity: z.number().min(0).max(20),
    specificity: z.number().min(0).max(20),
    relevance: z.number().min(0).max(20),
    differentiation: z.number().min(0).max(20),
    urgency: z.number().min(0).max(20),
  }),
  headline_detected: z.string(),
  critique: z.string(),
  rewrite_suggestion: z.string(),
});

export const FormAgentSchema = z.object({
  score: z.number().min(0).max(100),
  primary_form_index: z.number().int().nullable(),
  field_count: z.number().int().min(0),
  friction_factors: z.array(z.string()),
  critique: z.string(),
  fix_suggestion: z.string(),
});

export const TrustAgentSchema = z.object({
  score: z.number().min(0).max(100),
  signals_found: z.array(
    z.object({
      type: z.string(),
      count: z.number().int().optional(),
      quality: z.enum(["high", "medium", "low"]).optional(),
      text: z.string().optional(),
      outlets: z.array(z.string()).optional(),
      logos: z.array(z.string()).optional(),
    })
  ),
  signals_missing: z.array(z.string()),
  critique: z.string(),
  top_fix: z.string(),
});

export const SpeedAgentSchema = z.object({
  score: z.number().min(0).max(100),
  core_web_vitals: z.object({
    lcp_ms: z.number(),
    fcp_ms: z.number(),
    cls: z.number(),
    tti_ms: z.number(),
  }),
  biggest_drag: z.string(),
  fix: z.string(),
});

export const ComplianceAgentSchema = z.object({
  score: z.number().min(0).max(100),
  flags: z.array(
    z.object({
      id: z.string(),
      severity: z.enum(["info", "warn", "high"]),
      summary: z.string(),
    })
  ),
  summary: z.string(),
});

/** Public URL validator â€” keep in sync with `validateAuditUrl`. */
export const PublicHttpUrl = z
  .string()
  .url()
  .refine((s) => /^https?:\/\//i.test(s), { message: "must be http(s)" });

export const AuditRequestSchema = z.object({
  url: PublicHttpUrl,
  turnstile_token: z.string().optional(),
  utm: z.record(z.string()).optional(),
});

export const EmailCaptureSchema = z.object({
  audit_id: z.string().min(1),
  email: z.string().email(),
  marketing_consent: z.boolean().default(false),
});

export const WaitlistSchema = z.object({
  email: z.string().email(),
  audit_id: z.string().optional(),
  referral_code: z.string().optional(),
});

export type HookAgentOutput = z.infer<typeof HookAgentSchema>;
export type FormAgentOutput = z.infer<typeof FormAgentSchema>;
export type TrustAgentOutput = z.infer<typeof TrustAgentSchema>;
export type SpeedAgentOutput = z.infer<typeof SpeedAgentSchema>;
export type ComplianceAgentOutput = z.infer<typeof ComplianceAgentSchema>;
export type AuditRequest = z.infer<typeof AuditRequestSchema>;
export type EmailCaptureRequest = z.infer<typeof EmailCaptureSchema>;
