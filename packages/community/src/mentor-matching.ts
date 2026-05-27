/**
 * Mentor matching (Doc 16 §5.6).
 *
 *   - L7+ users opt in via the dashboard.
 *   - New users wait 7 days post-signup (early churners aren't worth matching).
 *   - On day 7, score each available mentor and DM the top match.
 *   - 48h response window; if declined, advance to next.
 *   - Mentor XP fires when mentee hits `first_lead`.
 */

import type { CommunityStore } from "./store.js";
import type { Match, Mentor } from "./types.js";

export interface MentorMatchDeps {
  store: CommunityStore;
  newId: (entity: "request") => string;
  clock?: { iso(): string };
  emit?: (
    name: "mentor_matched" | "mentor_relationship_ended" | "mentee_first_lead",
    payload: Record<string, unknown>,
  ) => Promise<void>;
}

const defaultClock = { iso: () => new Date().toISOString() };

export interface MenteeProfile {
  user_id: string;
  industry: string | null;
  country_iso2: string | null;
  stage_level: string | null;     // "< $10K MRR", etc.
}

export interface ScoreBreakdown {
  industry_match: number;
  geo_match: number;
  stage_match: number;
  load_penalty: number;
  freshness_bonus: number;
  total: number;
}

const STAGE_ORDER = ["< $10K MRR", "$10K–$100K MRR", "$100K–$1M MRR", "$1M–$10M MRR", "$10M+ MRR"];

export function scoreMentor(mentor: Mentor, mentee: MenteeProfile, now: number): ScoreBreakdown {
  let industry_match = 0;
  let geo_match = 0;
  let stage_match = 0;
  let load_penalty = -10 * mentor.active_mentees;
  let freshness_bonus = 0;

  if (mentor.industry && mentor.industry === mentee.industry) industry_match = 50;
  if (mentor.country_iso2 && mentor.country_iso2 === mentee.country_iso2) geo_match = 20;
  if (mentor.stage_level && mentee.stage_level) {
    const m = STAGE_ORDER.indexOf(mentor.stage_level);
    const me = STAGE_ORDER.indexOf(mentee.stage_level);
    if (m > me) stage_match = 30; // mentor at least one stage above mentee
  }
  if (mentor.active_mentees === 0) {
    if (mentor.last_active_match_at) {
      const days = (now - new Date(mentor.last_active_match_at).valueOf()) / 86400_000;
      if (days < 30) freshness_bonus = Math.max(0, 20 - days);
      else freshness_bonus = 20;
    } else {
      freshness_bonus = 20;
    }
  }
  const total = industry_match + geo_match + stage_match + load_penalty + freshness_bonus;
  return { industry_match, geo_match, stage_match, load_penalty, freshness_bonus, total };
}

/**
 * Find the best mentor for a mentee. Returns null if no mentor scored above 0.
 */
export async function findBestMatch(
  mentee: MenteeProfile,
  deps: MentorMatchDeps,
): Promise<{ mentor: Mentor; score: ScoreBreakdown } | null> {
  const clock = deps.clock ?? defaultClock;
  const mentors = await deps.store.listAvailableMentors({
    industry: mentee.industry,
    country: mentee.country_iso2,
  });
  if (mentors.length === 0) return null;
  const now = Date.now();
  let best: { mentor: Mentor; score: ScoreBreakdown } | null = null;
  for (const m of mentors) {
    if (m.user_id === mentee.user_id) continue;
    const s = scoreMentor(m, mentee, now);
    if (s.total <= 0) continue;
    if (!best || s.total > best.score.total) best = { mentor: m, score: s };
  }
  return best;
}

/** Open a new match — sends the mentor a DM (caller wires the DM sink). */
export async function openMatch(
  args: { mentor: Mentor; mentee_user_id: string; score: ScoreBreakdown },
  deps: MentorMatchDeps,
): Promise<Match> {
  const clock = deps.clock ?? defaultClock;
  const match: Match = {
    id: deps.newId("request"),
    mentor_user_id: args.mentor.user_id,
    mentee_user_id: args.mentee_user_id,
    match_score: args.score.total,
    initiated_at: clock.iso(),
    accepted_at: null,
    ended_at: null,
    ended_by: null,
    mentee_first_lead_at: null,
  };
  const inserted = await deps.store.insertMatch(match);
  await deps.store.upsertMentor({
    ...args.mentor,
    active_mentees: args.mentor.active_mentees + 1,
    last_active_match_at: clock.iso(),
  });
  if (deps.emit) {
    await deps.emit("mentor_matched", {
      mentor_id: args.mentor.user_id,
      mentee_id: args.mentee_user_id,
      match_score: args.score.total,
    });
  }
  return inserted;
}

/** End a match — either by mentor/mentee, or auto by the system when no engagement. */
export async function endMatch(
  args: { match_id: string; ended_by: Match["ended_by"]; ended_at?: string },
  deps: MentorMatchDeps,
): Promise<Match> {
  const at = args.ended_at ?? (deps.clock ?? defaultClock).iso();
  const next = await deps.store.endMatch(args.match_id, args.ended_by, at);
  const m = await deps.store.getMentor(next.mentor_user_id);
  if (m) {
    await deps.store.upsertMentor({
      ...m,
      active_mentees: Math.max(0, m.active_mentees - 1),
      total_mentees_helped:
        m.total_mentees_helped + (next.mentee_first_lead_at ? 1 : 0),
    });
  }
  if (deps.emit) {
    await deps.emit("mentor_relationship_ended", {
      mentor_id: next.mentor_user_id,
      mentee_id: next.mentee_user_id,
      duration_days: Math.floor(
        (new Date(at).valueOf() - new Date(next.initiated_at).valueOf()) /
          (24 * 3600 * 1000),
      ),
      ended_by: args.ended_by,
    });
  }
  return next;
}

/**
 * Trigger Mentor XP when the mentee hits their first lead. Caller passes the
 * mentee_user_id; we look up the active match and emit.
 */
export async function recordMenteeFirstLead(
  args: { mentee_user_id: string },
  deps: MentorMatchDeps,
): Promise<Match | null> {
  const m = await deps.store.getActiveMatchForMentee(args.mentee_user_id);
  if (!m || m.mentee_first_lead_at) return m;
  const at = (deps.clock ?? defaultClock).iso();
  await deps.store.insertMatch({ ...m, mentee_first_lead_at: at });
  if (deps.emit) {
    await deps.emit("mentee_first_lead", {
      mentor_id: m.mentor_user_id,
      mentee_id: args.mentee_user_id,
    });
  }
  return m;
}
