import { z } from "zod";

const fnl = z.string().min(1);

export const Schemas = {
  funnel_published: z.object({ funnel_id: fnl, workspace_id: z.string(), url: z.string().url() }),
  funnel_paused: z.object({ funnel_id: fnl, reason: z.string() }),
  funnel_archived: z.object({ funnel_id: fnl }),
  funnel_restored: z.object({ funnel_id: fnl }),
  ab_winner_promoted: z.object({ funnel_id: fnl, winner_variant: z.string(), loser_variant: z.string(), lift_pct: z.number() }),
  case_study_generated: z.object({ funnel_id: fnl, case_study_slug: z.string(), status: z.string() }),
  case_study_published: z.object({ case_study_slug: z.string(), published_by: z.string(), published_at: z.string() }),
  case_study_taken_down: z.object({ case_study_slug: z.string(), taken_down_by: z.string(), taken_down_at: z.string() }),
} as const;
