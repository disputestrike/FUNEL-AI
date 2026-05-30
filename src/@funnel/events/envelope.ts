/**
 * Canonical event envelope (Doc 03 §0).
 *
 * Every emitted event lands in this shape regardless of the underlying
 * domain schema:
 *
 *   { event_id, event_name, occurred_at, ingested_at,
 *     tenancy: { workspace_id, account_tier },
 *     actor:  { type, user_id?, impersonator_user_id?, api_key_id? },
 *     subject: { type, id },
 *     context: { trace_id, request_id?, ip_hash?, user_agent_class?, geography? },
 *     consent: { marketing_opt_in?, sms_opt_in?, gdpr_lawful_basis? },
 *     properties: <domain-specific>,
 *     pii_class: 'none' | 'minimal' | 'pii' | 'sensitive'
 *   }
 */

import { z } from "zod";

export const ActorTypeEnum = z.enum(["user", "admin", "system", "api_key", "anonymous"]);
export type ActorType = z.infer<typeof ActorTypeEnum>;

export const PiiClassEnum = z.enum(["none", "minimal", "pii", "sensitive"]);
export type PiiClass = z.infer<typeof PiiClassEnum>;

export const EnvelopeSchema = z.object({
  event_id: z.string().min(1),
  event_name: z.string().min(1),
  schema_version: z.number().int().min(1).default(1),
  occurred_at: z.string().datetime(),
  ingested_at: z.string().datetime(),
  tenancy: z.object({
    workspace_id: z.string().nullable(),
    account_tier: z.string().nullable(),
  }),
  actor: z.object({
    type: ActorTypeEnum,
    user_id: z.string().nullable().optional(),
    impersonator_user_id: z.string().nullable().optional(),
    api_key_id: z.string().nullable().optional(),
    admin_session_id: z.string().nullable().optional(),
  }),
  subject: z.object({
    type: z.string(),
    id: z.string().nullable(),
  }),
  context: z.object({
    trace_id: z.string().min(1),
    request_id: z.string().nullable().optional(),
    ip_hash: z.string().nullable().optional(),
    user_agent_class: z.string().nullable().optional(),
    geography: z.string().nullable().optional(),
  }),
  consent: z
    .object({
      marketing_opt_in: z.boolean().nullable().optional(),
      sms_opt_in: z.boolean().nullable().optional(),
      gdpr_lawful_basis: z.string().nullable().optional(),
    })
    .optional(),
  properties: z.record(z.unknown()),
  pii_class: PiiClassEnum,
});

export type Envelope = z.infer<typeof EnvelopeSchema>;
