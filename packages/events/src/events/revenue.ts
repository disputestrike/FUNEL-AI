import { z } from "zod";

const cents = z.number().int();

export const Schemas = {
  payment_captured: z.object({ payment_id: z.string(), workspace_id: z.string(), amount_cents: cents, currency: z.string().length(3) }),
  payment_failed: z.object({ payment_id: z.string(), workspace_id: z.string(), reason: z.string() }),
  refund_issued: z.object({ refund_id: z.string(), payment_id: z.string(), amount_cents: cents }),
  subscription_started: z.object({ subscription_id: z.string(), workspace_id: z.string(), plan: z.string() }),
  subscription_canceled: z.object({ subscription_id: z.string(), workspace_id: z.string() }),
  subscription_upgraded: z.object({ subscription_id: z.string(), from_plan: z.string(), to_plan: z.string() }),
  subscription_downgraded: z.object({ subscription_id: z.string(), from_plan: z.string(), to_plan: z.string() }),
  milestone_hit: z.object({ workspace_id: z.string(), funnel_id: z.string(), tier: z.string(), revenue_cumulative_usd: z.number(), time_to_milestone_days: z.number().int().nonnegative() }),
  award_shipped: z.object({ tier: z.string(), workspace_id: z.string(), tracking_number: z.string().nullable(), carrier: z.string().nullable() }),
  award_delivered: z.object({ tier: z.string(), workspace_id: z.string(), delivered_at: z.string() }),
} as const;
