/**
 * Final-day livestream backend.
 *
 *   - Day 7, ~9pm local. Hosted on YouTube Live / Zoom Webinar, embedded
 *     in `gofunnelai.com/challenge/{cohort_id}/final`.
 *   - We capture join + drop-off events to drive next-cohort marketing.
 */

import type { ChallengeStore } from "./store.js";
import type { Cohort } from "./types.js";

export interface FinalStreamRecord {
  cohort_id: string;
  platform: "youtube_live" | "zoom_webinar" | "vimeo_live";
  live_url: string;
  replay_url: string | null;
  scheduled_for: string;
  starts_in_sec: number;
}

export interface StreamProviderAdapter {
  scheduleLive(args: {
    cohort_id: string;
    title: string;
    description: string;
    starts_at: string;
  }): Promise<{ live_url: string; platform: FinalStreamRecord["platform"] }>;
  finalize(args: { cohort_id: string; live_url: string }): Promise<{ replay_url: string }>;
}

export interface FinalStreamDeps {
  store: ChallengeStore;
  provider: StreamProviderAdapter;
  clock?: { now(): number; iso(): string };
  emit?: (
    name: "challenge_streamed_view" | "challenge_final_stream_scheduled" | "challenge_final_stream_ended",
    payload: Record<string, unknown>,
  ) => Promise<void>;
}

const defaultClock = { now: () => Date.now(), iso: () => new Date().toISOString() };

/**
 * Schedule the Day-7 stream once the cohort is in `running` and Day 6 has
 * landed. We persist the live URL on the cohort row so the dashboard can link
 * to it.
 */
export async function scheduleFinalStream(
  cohort_id: string,
  deps: FinalStreamDeps,
): Promise<FinalStreamRecord> {
  const c = await deps.store.getCohortById(cohort_id);
  if (!c) throw new Error("cohort not found");
  const sched = await deps.provider.scheduleLive({
    cohort_id: c.id,
    title: `Cohort ${c.cohort_number} — Final Day Livestream`,
    description: `7-Day Funnel Challenge — winners revealed, founder Q&A.`,
    starts_at: c.final_stream_at,
  });
  if (deps.emit) {
    await deps.emit("challenge_final_stream_scheduled", {
      cohort_id,
      live_url: sched.live_url,
      platform: sched.platform,
      starts_at: c.final_stream_at,
    });
  }
  const clock = deps.clock ?? defaultClock;
  return {
    cohort_id,
    platform: sched.platform,
    live_url: sched.live_url,
    replay_url: null,
    scheduled_for: c.final_stream_at,
    starts_in_sec: Math.max(0, Math.floor((new Date(c.final_stream_at).valueOf() - clock.now()) / 1000)),
  };
}

/** Capture a single viewer join — used for drop-off attribution. */
export async function recordViewerJoin(
  args: { cohort_id: string; viewer_session_id: string; duration_minutes: number },
  deps: FinalStreamDeps,
): Promise<void> {
  if (!deps.emit) return;
  await deps.emit("challenge_streamed_view", {
    cohort_id: args.cohort_id,
    viewer_session_id: args.viewer_session_id,
    duration_minutes: args.duration_minutes,
  });
}

/** Finalize after the stream ends — captures the VOD URL on the cohort. */
export async function finalizeStream(
  args: { cohort_id: string; live_url: string },
  deps: FinalStreamDeps,
): Promise<{ replay_url: string }> {
  const r = await deps.provider.finalize(args);
  if (deps.emit) {
    await deps.emit("challenge_final_stream_ended", {
      cohort_id: args.cohort_id,
      replay_url: r.replay_url,
    });
  }
  return r;
}
