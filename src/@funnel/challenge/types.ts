/**
 * 7-Day Funnel Challenge domain types (Doc 16 §LOOP 7).
 *
 * Cohorts are monthly. Each cohort runs Day 1 → Day 7 with daily curriculum.
 * Anyone can enroll, no account required (account auto-created on Day 2).
 */

import { z } from "zod";

/* ---------------------------------------------------------------- */
/* Challenge (the program, not a cohort)                            */
/* ---------------------------------------------------------------- */

export const ChallengeSchema = z.object({
  id: z.string().min(1),
  name: z.string(),               // "7-Day Funnel Challenge"
  variant: z.string().default("classic"),   // future: "webinar", "revtry", "ecom"
  enabled: z.boolean().default(true),
  created_at: z.string().datetime(),
});
export type Challenge = z.infer<typeof ChallengeSchema>;

/* ---------------------------------------------------------------- */
/* Cohort (monthly batch)                                           */
/* ---------------------------------------------------------------- */

export const CohortStatusEnum = z.enum([
  "scheduled",      // future cohort, enrollment open
  "running",        // day 1 through day 7
  "completed",      // wraps after Day 7 final stream
  "archived",
]);
export type CohortStatus = z.infer<typeof CohortStatusEnum>;

export const CohortSchema = z.object({
  id: z.string().min(1),
  challenge_id: z.string().min(1),
  cohort_number: z.number().int().positive(),    // C001, C002, … incrementing
  name: z.string(),                              // "May 2026 cohort"
  enrollment_opens_at: z.string().datetime(),
  enrollment_closes_at: z.string().datetime(),
  day1_at: z.string().datetime(),               // 00:00 UTC the day kickoff lands
  day7_at: z.string().datetime(),
  final_stream_at: z.string().datetime(),       // Day 7 ~9pm local broadcast
  status: CohortStatusEnum,
  enrolled_count: z.number().int().nonnegative().default(0),
  funnels_shipped_count: z.number().int().nonnegative().default(0),
  leads_generated_count: z.number().int().nonnegative().default(0),
  paid_conversion_count: z.number().int().nonnegative().default(0),
  created_at: z.string().datetime(),
});
export type Cohort = z.infer<typeof CohortSchema>;

/* ---------------------------------------------------------------- */
/* Participant                                                      */
/* ---------------------------------------------------------------- */

export const ParticipantSchema = z.object({
  id: z.string().min(1),
  cohort_id: z.string().min(1),
  user_id: z.string().min(1).nullable(),
  email: z.string().email(),
  phone_e164: z.string().nullable(),
  sms_opt_in: z.boolean().default(false),
  industry: z.string().nullable(),
  timezone: z.string().nullable(),    // IANA, e.g. "America/Phoenix"
  enrolled_at: z.string().datetime(),
  enrollment_source: z.string().nullable(),
  /** Day numbers (1-7) completed. */
  days_completed: z.array(z.number().int().min(1).max(7)).default([]),
  funnel_id: z.string().nullable(),       // set when Day 2 funnel generated
  first_lead_at: z.string().datetime().nullable(),
  certificate_url: z.string().url().nullable(),
  paid_at: z.string().datetime().nullable(),
  plan_at_conversion: z.string().nullable(),
});
export type Participant = z.infer<typeof ParticipantSchema>;

/* ---------------------------------------------------------------- */
/* Submission (the daily task artifact)                             */
/* ---------------------------------------------------------------- */

export const SubmissionTypeEnum = z.enum([
  "offer_statement",        // Day 1
  "funnel_published",       // Day 2
  "ads_pixel_connected",    // Day 3
  "revtry_configured",      // Day 4
  "funnel_live",            // Day 5
  "ab_test_running",        // Day 6
  "scale_or_share",         // Day 7
]);
export type SubmissionType = z.infer<typeof SubmissionTypeEnum>;

export const SubmissionSchema = z.object({
  id: z.string().min(1),
  participant_id: z.string().min(1),
  day: z.number().int().min(1).max(7),
  type: SubmissionTypeEnum,
  payload: z.record(z.unknown()),         // free-form per day's task
  community_thread_url: z.string().url().nullable(),
  submitted_at: z.string().datetime(),
});
export type Submission = z.infer<typeof SubmissionSchema>;

/* ---------------------------------------------------------------- */
/* Day progress (denormalized for cohort dashboards)                */
/* ---------------------------------------------------------------- */

export const DayProgressSchema = z.object({
  cohort_id: z.string().min(1),
  day: z.number().int().min(1).max(7),
  /** participants who completed this day's task. */
  completed_count: z.number().int().nonnegative(),
  /** as a percentage of cohort enrollment. */
  completion_pct: z.number().min(0).max(100),
  /** task-specific aggregate, e.g. funnels shipped on day 2. */
  cohort_aggregate: z.record(z.number()),
});
export type DayProgress = z.infer<typeof DayProgressSchema>;
