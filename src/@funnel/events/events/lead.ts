import { z } from "zod";

export const Schemas = {
  lead_captured: z.object({ lead_id: z.string(), funnel_id: z.string(), workspace_id: z.string() }),
  lead_qualified: z.object({ lead_id: z.string(), score: z.number() }),
  lead_booked: z.object({ lead_id: z.string(), booked_at: z.string() }),
  lead_replied_sms: z.object({ lead_id: z.string(), body_snippet: z.string() }),
  first_lead_captured: z.object({ workspace_id: z.string(), funnel_id: z.string(), lead_id: z.string() }),
} as const;
