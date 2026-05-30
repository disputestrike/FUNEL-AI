import { z } from "zod";

export const Schemas = {
  impersonation_started: z.object({ session_id: z.string(), admin_user_id: z.string(), target_user_id: z.string(), workspace_id: z.string(), justification: z.string().min(20), expires_at: z.string() }),
  impersonation_ended: z.object({ session_id: z.string(), admin_user_id: z.string(), ended_reason: z.string() }),
  admin_credit_applied: z.object({ workspace_id: z.string(), admin_user_id: z.string(), amount_cents: z.number().int(), justification_ticket_id: z.string() }),
  admin_refund_issued: z.object({ workspace_id: z.string(), payment_id: z.string(), admin_user_id: z.string(), amount_cents: z.number().int() }),
  admin_permission_denied: z.object({ admin_user_id: z.string(), attempted_action: z.string(), resource: z.string() }),
  internal_note_added: z.object({ workspace_id: z.string(), note_id: z.string(), author_user_id: z.string(), subject_type: z.string(), subject_id: z.string() }),
  pii_access_recorded: z.object({ admin_user_id: z.string(), workspace_id: z.string(), subject_type: z.string(), subject_id: z.string(), fields: z.array(z.string()) }),
} as const;
