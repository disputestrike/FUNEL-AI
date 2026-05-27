import { z } from "zod";

export const Schemas = {
  ad_campaign_published: z.object({ campaign_id: z.string(), platform: z.string(), workspace_id: z.string(), daily_budget_cents: z.number().int() }),
  ad_creative_rejected: z.object({ campaign_id: z.string(), platform: z.string(), reason: z.string() }),
  email_sent: z.object({ message_id: z.string(), template: z.string(), workspace_id: z.string().nullable() }),
  email_bounced: z.object({ message_id: z.string(), reason: z.string(), hard: z.boolean() }),
  email_complained: z.object({ message_id: z.string() }),
  sms_sent: z.object({ message_id: z.string(), workspace_id: z.string(), e164: z.string() }),
  sms_stopped: z.object({ e164: z.string(), reason: z.string() }),
  revtry_call_started: z.object({ call_id: z.string(), workspace_id: z.string(), lead_id: z.string().nullable() }),
  revtry_call_completed: z.object({ call_id: z.string(), workspace_id: z.string(), outcome: z.string(), duration_sec: z.number().int().nonnegative() }),
  revtry_call_blocked: z.object({ call_id: z.string(), reason: z.string() }),
  revtry_inbound_received: z.object({ call_id: z.string(), workspace_id: z.string(), from_e164: z.string() }),
} as const;
