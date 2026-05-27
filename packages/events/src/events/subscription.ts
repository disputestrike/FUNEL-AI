import { z } from "zod";

export const Schemas = {
  trial_started: z.object({ workspace_id: z.string(), trial_ends_at: z.string() }),
  trial_ending_t3: z.object({ workspace_id: z.string() }),
  trial_ending_t1: z.object({ workspace_id: z.string() }),
  card_expiring_t30: z.object({ workspace_id: z.string(), card_last4: z.string() }),
  card_expiring_t7: z.object({ workspace_id: z.string(), card_last4: z.string() }),
  account_past_due: z.object({ workspace_id: z.string(), amount_owed_cents: z.number().int() }),
  account_suspended: z.object({ workspace_id: z.string(), admin_user_id: z.string(), reason: z.string() }),
  account_restored: z.object({ workspace_id: z.string(), admin_user_id: z.string() }),
} as const;
