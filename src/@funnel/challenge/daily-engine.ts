/**
 * Daily delivery engine.
 *
 *   - Timezone-aware send (07:00 local for email, 10:00 local for SMS).
 *   - Community drop is auto-posted from a single bot account.
 *   - One scheduled task per (cohort, day) — we keep idempotency by setting an
 *     idempotency key on the email/SMS sender.
 *   - SMS uses SignalWire (NOT Twilio).
 */

import { CURRICULUM, curriculumFor } from "./curriculum.js";
import type { ChallengeStore } from "./store.js";
import type { Cohort, Participant } from "./types.js";

export interface EmailSink {
  send(args: {
    to: string;
    subject: string;
    template: string;
    data: Record<string, unknown>;
    idempotency_key?: string;
  }): Promise<{ message_id: string }>;
}

export interface SmsSink {
  send(args: {
    to_e164: string;
    body: string;
    idempotency_key?: string;
  }): Promise<{ message_id: string }>;
}

export interface CommunityBotSink {
  postThread(args: {
    cohort_id: string;
    day: number;
    title: string;
    body: string;
  }): Promise<{ thread_url: string }>;
}

export interface DailyEngineDeps {
  store: ChallengeStore;
  email: EmailSink;
  sms: SmsSink;
  community: CommunityBotSink;
  clock?: { now(): number; iso(): string };
  baseAppUrl?: string;
  baseSiteUrl?: string;
  emit?: (
    name: "challenge_daily_completed" | "challenge_funnel_shipped" | "challenge_first_lead" | "challenge_completed",
    payload: Record<string, unknown>,
  ) => Promise<void>;
}

const defaultClock = { now: () => Date.now(), iso: () => new Date().toISOString() };

/**
 * Send the daily comms drop to every participant in the cohort. Skips
 * participants who already received this day's email by idempotency key.
 */
export async function sendDailyDrop(
  args: { cohort: Cohort; day: 1 | 2 | 3 | 4 | 5 | 6 | 7 },
  deps: DailyEngineDeps,
): Promise<{ emails_sent: number; sms_sent: number; thread_url: string | null }> {
  const day = curriculumFor(args.day);
  if (!day) throw new Error(`day ${args.day} not in curriculum`);
  const appUrl = deps.baseAppUrl ?? "https://app.gofunnelai.com";
  const siteUrl = deps.baseSiteUrl ?? "https://gofunnelai.com";

  // 1. Community thread first so we have a URL to inject into email/SMS.
  let thread_url: string | null = null;
  try {
    const t = await deps.community.postThread({
      cohort_id: args.cohort.id,
      day: args.day,
      title: day.community_thread_topic,
      body: day.task_full,
    });
    thread_url = t.thread_url;
  } catch {
    // Community can lag; don't block the email send.
  }

  const participants = await deps.store.listCohortParticipants(args.cohort.id);
  let emails_sent = 0;
  let sms_sent = 0;
  for (const p of participants) {
    const idem = `cohort_${args.cohort.id}_${args.day}_${p.id}`;
    try {
      await deps.email.send({
        to: p.email,
        subject: day.email_subject,
        template: `challenge-day${args.day}`,
        data: {
          first_name: p.email.split("@")[0],
          cohort_id: args.cohort.id,
          day: args.day,
          theme: day.theme,
          task: day.task_full,
          video_url: `${appUrl}${day.video_url_placeholder.replace(/{{cohort_id}}/g, args.cohort.id)}`,
          thread_url,
          app_url: appUrl,
          site_url: siteUrl,
        },
        idempotency_key: idem,
      });
      emails_sent++;
    } catch {
      // continue with next participant
    }
    if (p.sms_opt_in && p.phone_e164) {
      try {
        await deps.sms.send({
          to_e164: p.phone_e164,
          body: day.sms_body
            .replace(/{{video_url}}/g, `${appUrl}${day.video_url_placeholder.replace(/{{cohort_id}}/g, args.cohort.id)}`)
            .replace(/{{cohort_id}}/g, args.cohort.id)
            .replace(/{{app_url}}/g, appUrl)
            .replace(/{{cert_url}}/g, `${siteUrl}/challenge/${args.cohort.id}/cert/${p.id}`),
          idempotency_key: idem,
        });
        sms_sent++;
      } catch {
        // continue
      }
    }
  }
  return { emails_sent, sms_sent, thread_url };
}

/**
 * Mark a participant as having completed a specific day's task. Idempotent —
 * re-marking is a no-op.
 */
export async function markDayCompleted(
  args: { participant_id: string; day: 1 | 2 | 3 | 4 | 5 | 6 | 7 },
  deps: DailyEngineDeps,
): Promise<Participant> {
  const p = await deps.store.getParticipantById(args.participant_id);
  if (!p) throw new Error("participant not found");
  if (p.days_completed.includes(args.day)) return p;

  const next = await deps.store.updateParticipant(p.id, {
    days_completed: [...p.days_completed, args.day],
  });

  if (deps.emit) {
    await deps.emit("challenge_daily_completed", {
      user_id: next.user_id,
      cohort_id: next.cohort_id,
      day: args.day,
    });
    if (args.day === 7 && next.days_completed.length === 7) {
      await deps.emit("challenge_completed", {
        user_id: next.user_id,
        cohort_id: next.cohort_id,
        days_completed: 7,
        funnels_shipped: next.funnel_id ? 1 : 0,
      });
    }
  }
  return next;
}

/** Side-effect helper: record that the participant's funnel went live. */
export async function recordFunnelShipped(
  args: { participant_id: string; funnel_id: string },
  deps: DailyEngineDeps,
): Promise<void> {
  const p = await deps.store.getParticipantById(args.participant_id);
  if (!p) return;
  if (p.funnel_id === args.funnel_id) return;
  await deps.store.updateParticipant(p.id, { funnel_id: args.funnel_id });
  await deps.store.incrementCohortCounter(p.cohort_id, "funnels_shipped_count", 1);
  if (deps.emit) {
    await deps.emit("challenge_funnel_shipped", {
      user_id: p.user_id,
      cohort_id: p.cohort_id,
      funnel_id: args.funnel_id,
      day: p.days_completed.length + 1,
    });
  }
}

/** Side-effect: first lead landed on the participant's funnel. */
export async function recordFirstLead(
  args: { participant_id: string; funnel_id: string },
  deps: DailyEngineDeps,
): Promise<void> {
  const clock = deps.clock ?? defaultClock;
  const p = await deps.store.getParticipantById(args.participant_id);
  if (!p || p.first_lead_at) return;
  await deps.store.updateParticipant(p.id, { first_lead_at: clock.iso() });
  await deps.store.incrementCohortCounter(p.cohort_id, "leads_generated_count", 1);
  if (deps.emit) {
    await deps.emit("challenge_first_lead", {
      user_id: p.user_id,
      cohort_id: p.cohort_id,
      funnel_id: args.funnel_id,
      day: p.days_completed.length || 1,
    });
  }
}
