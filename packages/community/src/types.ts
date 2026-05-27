/**
 * Community domain types (Doc 16 §LOOP 5).
 *
 * Phase 1 surface is hosted on Skool (Months 1–6); this package owns the
 * canonical data model used by both the Skool bridge AND the eventual native
 * forum (Months 6–18), so the migration is a swap, not a redesign.
 */

import { z } from "zod";

/* ---------------------------------------------------------------- */
/* Hub                                                              */
/* ---------------------------------------------------------------- */

export const HubKindEnum = z.enum(["industry", "stage", "topic"]);
export type HubKind = z.infer<typeof HubKindEnum>;

export const HubSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),                                       // "solar", "fitness", …
  name: z.string(),
  kind: HubKindEnum,
  description: z.string(),
  members: z.number().int().nonnegative().default(0),
  stage_min_mrr_cents: z.number().int().nullable(),
  stage_max_mrr_cents: z.number().int().nullable(),
  is_locked: z.boolean().default(false),                        // gated by verified revenue
  bot_thread_schedule: z
    .array(
      z.object({
        weekday: z.number().int().min(0).max(6),
        hour_local: z.number().int().min(0).max(23),
        thread_type: z.string(),
      }),
    )
    .default([]),
  created_at: z.string().datetime(),
});
export type Hub = z.infer<typeof HubSchema>;

/* ---------------------------------------------------------------- */
/* Post / Comment / Reaction                                        */
/* ---------------------------------------------------------------- */

export const PostThreadTypeEnum = z.enum([
  "general",
  "win_wed",
  "fail_fri",
  "question_mon",
  "ama_tue",
  "tactic_thu",
  "show_off_sat",
  "sunday_setup",
  "wins",
  "showcase",
]);
export type PostThreadType = z.infer<typeof PostThreadTypeEnum>;

export const PostSchema = z.object({
  id: z.string().min(1),
  hub_id: z.string().min(1),
  author_user_id: z.string().min(1),
  title: z.string().min(3).max(200),
  body: z.string(),
  thread_type: PostThreadTypeEnum.default("general"),
  reactions: z.number().int().nonnegative().default(0),
  comments: z.number().int().nonnegative().default(0),
  pinned_until: z.string().datetime().nullable(),
  is_themed: z.boolean().default(false),
  flagged: z.boolean().default(false),
  created_at: z.string().datetime(),
});
export type Post = z.infer<typeof PostSchema>;

export const CommentSchema = z.object({
  id: z.string().min(1),
  post_id: z.string().min(1),
  parent_comment_id: z.string().nullable(),
  author_user_id: z.string().min(1),
  body: z.string(),
  upvotes: z.number().int().nonnegative().default(0),
  marked_helpful: z.boolean().default(false),
  flagged: z.boolean().default(false),
  created_at: z.string().datetime(),
});
export type Comment = z.infer<typeof CommentSchema>;

export const ReactionKindEnum = z.enum(["like", "fire", "celebrate", "insightful", "wow"]);
export type ReactionKind = z.infer<typeof ReactionKindEnum>;

export const ReactionSchema = z.object({
  id: z.string().min(1),
  user_id: z.string().min(1),
  post_id: z.string().nullable(),
  comment_id: z.string().nullable(),
  kind: ReactionKindEnum,
  created_at: z.string().datetime(),
});
export type Reaction = z.infer<typeof ReactionSchema>;

/* ---------------------------------------------------------------- */
/* XP + Levels                                                      */
/* ---------------------------------------------------------------- */

export const XpSourceEnum = z.enum([
  "funnel_shipped",
  "first_lead",
  "first_1k_revenue",
  "upvoted_answer",
  "mentor_mentee_first_lead",
  "win_challenge",
  "featured",
  "post_themed_thread",
  "post_general",
  "reaction_given",
  "comment_helpful",
]);
export type XpSource = z.infer<typeof XpSourceEnum>;

export const XpRecordSchema = z.object({
  id: z.string().min(1),
  user_id: z.string().min(1),
  amount: z.number().int(),         // negative allowed (XP claw)
  source: XpSourceEnum,
  source_id: z.string().nullable(), // post_id / funnel_id / etc.
  created_at: z.string().datetime(),
});
export type XpRecord = z.infer<typeof XpRecordSchema>;

export const LevelSchema = z.object({
  level: z.number().int().min(1).max(10),
  xp_threshold: z.number().int().min(0),
  unlocks: z.array(z.string()),
});
export type Level = z.infer<typeof LevelSchema>;

/* ---------------------------------------------------------------- */
/* Mentor / Match                                                   */
/* ---------------------------------------------------------------- */

export const MentorStatusEnum = z.enum(["active", "paused", "off"]);
export type MentorStatus = z.infer<typeof MentorStatusEnum>;

export const MentorSchema = z.object({
  user_id: z.string().min(1),
  status: MentorStatusEnum,
  industry: z.string().nullable(),
  country_iso2: z.string().length(2).nullable(),
  stage_level: z.string().nullable(),     // "$10K–$100K", etc.
  active_mentees: z.number().int().nonnegative().default(0),
  total_mentees_helped: z.number().int().nonnegative().default(0),
  joined_at: z.string().datetime(),
  last_active_match_at: z.string().datetime().nullable(),
});
export type Mentor = z.infer<typeof MentorSchema>;

export const MatchSchema = z.object({
  id: z.string().min(1),
  mentor_user_id: z.string().min(1),
  mentee_user_id: z.string().min(1),
  match_score: z.number(),
  initiated_at: z.string().datetime(),
  accepted_at: z.string().datetime().nullable(),
  ended_at: z.string().datetime().nullable(),
  ended_by: z.enum(["mentor", "mentee", "system"]).nullable(),
  mentee_first_lead_at: z.string().datetime().nullable(),
});
export type Match = z.infer<typeof MatchSchema>;

/* ---------------------------------------------------------------- */
/* Monthly Funnel Games                                             */
/* ---------------------------------------------------------------- */

export const GameSchema = z.object({
  id: z.string().min(1),
  month_yyyy_mm: z.string().regex(/^\d{4}-\d{2}$/),
  name: z.string(),
  theme: z.string(),
  rules: z.string(),
  prize_pool_cents: z.number().int().nonnegative(),
  prize_breakdown: z.array(z.object({ rank: z.number().int().positive(), amount_cents: z.number().int().positive() })),
  min_level_required: z.number().int().min(1).max(10).default(4),
  opens_at: z.string().datetime(),
  closes_at: z.string().datetime(),
  winners_announced_at: z.string().datetime(),
  status: z.enum(["scheduled", "open", "judging", "completed"]),
});
export type Game = z.infer<typeof GameSchema>;

export const GameEntrySchema = z.object({
  id: z.string().min(1),
  game_id: z.string().min(1),
  user_id: z.string().min(1),
  funnel_id: z.string().min(1),
  /** Metric the entry is judged on — depends on the theme. */
  metric_value: z.number().nonnegative(),
  rank: z.number().int().positive().nullable(),
  prize_amount_cents: z.number().int().nonnegative().default(0),
  created_at: z.string().datetime(),
});
export type GameEntry = z.infer<typeof GameEntrySchema>;
