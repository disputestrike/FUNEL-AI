/**
 * 7-day curriculum (Doc 16 §7.2).
 *
 * One founder-hosted video + one daily task + one community drop per day.
 * Email + SMS payloads are templated from this manifest so cohort variants
 * (Webinar, RevTry, Ecom) can swap in their own manifest without touching the
 * delivery code.
 */

import type { SubmissionType } from "./types.js";

export interface DayCurriculum {
  day: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  theme: string;
  task_summary: string;
  task_full: string;
  video_url_placeholder: string;     // resolved at runtime per cohort
  community_thread_topic: string;
  submission_type: SubmissionType;
  email_subject: string;
  email_preheader: string;
  sms_body: string;                   // ≤ 160 chars, must include "Reply STOP"
}

export const CURRICULUM: readonly DayCurriculum[] = [
  {
    day: 1,
    theme: "Define your offer",
    task_summary: "Write your offer in one sentence and drop it in the community thread.",
    task_full:
      "Day 1 — Define your offer. Open today's video (10 min). Then write your offer in one sentence: who it's for, what they get, and the result. Post it in today's community thread. We'll riff on it.",
    video_url_placeholder: "/challenge/{{cohort_id}}/day1",
    community_thread_topic: "Day 1 — drop your one-sentence offer 👇",
    submission_type: "offer_statement",
    email_subject: "Day 1 — your offer in one sentence",
    email_preheader: "10 min video + 1 sentence. That's the whole day.",
    sms_body:
      "Day 1: write your offer in one sentence + drop it in the thread. Video: {{video_url}}. Reply STOP to opt out.",
  },
  {
    day: 2,
    theme: "Generate your funnel",
    task_summary: "Use GoFunnelAI to generate your funnel and publish it to staging.",
    task_full:
      "Day 2 — Generate your funnel. Today's video walks through the Grader. Plug your offer in, generate, and publish to staging. Don't perfect it. Ship.",
    video_url_placeholder: "/challenge/{{cohort_id}}/day2",
    community_thread_topic: "Day 2 — drop your funnel link 👇",
    submission_type: "funnel_published",
    email_subject: "Day 2 — generate + ship your funnel",
    email_preheader: "Tap one button. Funnel goes live in 60 seconds.",
    sms_body:
      "Day 2: generate + ship your funnel. App: {{app_url}}. Reply STOP to opt out.",
  },
  {
    day: 3,
    theme: "Set up tracking + first ad",
    task_summary: "Connect Stripe/PayPal + Meta/Google pixel + launch a $10–$50/day ad.",
    task_full:
      "Day 3 — Connect tracking + launch your first ad. Stripe (or PayPal) + Meta or Google pixel. Then push $10–$50/day at your funnel. Real traffic, real signal.",
    video_url_placeholder: "/challenge/{{cohort_id}}/day3",
    community_thread_topic: "Day 3 — share your first ad creative 👇",
    submission_type: "ads_pixel_connected",
    email_subject: "Day 3 — pixel + first ad",
    email_preheader: "$10/day is enough. Today is signal, not scale.",
    sms_body:
      "Day 3: connect pixel + launch $10-$50/day. Reply STOP to opt out.",
  },
  {
    day: 4,
    theme: "Connect RevTry voice",
    task_summary: "Configure RevTry voice agent for inbound leads.",
    task_full:
      "Day 4 — RevTry. Configure your voice agent. Pick a persona, tune the qualification flow, do one test call. Tomorrow's leads will get dialed.",
    video_url_placeholder: "/challenge/{{cohort_id}}/day4",
    community_thread_topic: "Day 4 — share your RevTry persona 👇",
    submission_type: "revtry_configured",
    email_subject: "Day 4 — your AI sales rep, in 15 minutes",
    email_preheader: "Pick a voice. Pick a flow. Done.",
    sms_body:
      "Day 4: set up RevTry. Reply STOP to opt out.",
  },
  {
    day: 5,
    theme: "Launch",
    task_summary: "Push your funnel live. Start ad spend. Manual outreach if you want.",
    task_full:
      "Day 5 — Launch. Flip the funnel live. Bump your ad spend. Optional: manual outreach to your warm list.",
    video_url_placeholder: "/challenge/{{cohort_id}}/day5",
    community_thread_topic: "Day 5 — drop your live URL + first lead 👇",
    submission_type: "funnel_live",
    email_subject: "Day 5 — go live",
    email_preheader: "Today the funnel earns its keep.",
    sms_body: "Day 5: go live. Reply STOP to opt out.",
  },
  {
    day: 6,
    theme: "Optimize",
    task_summary: "Review the first numbers. A/B the weakest step.",
    task_full:
      "Day 6 — Optimize. Pull the first 24h numbers. Find the step with the biggest drop. A/B test the next-best variant. Promote the winner.",
    video_url_placeholder: "/challenge/{{cohort_id}}/day6",
    community_thread_topic: "Day 6 — share your A/B test setup 👇",
    submission_type: "ab_test_running",
    email_subject: "Day 6 — find the weak link",
    email_preheader: "A/B one step. Promote the winner. Done.",
    sms_body: "Day 6: optimize. Reply STOP to opt out.",
  },
  {
    day: 7,
    theme: "Scale + share your win",
    task_summary: "Scale ad spend if profitable. Share your win. Claim your certificate.",
    task_full:
      "Day 7 — Scale + share. If profitable, scale ads. Share your win in the community thread. Claim your completion certificate.",
    video_url_placeholder: "/challenge/{{cohort_id}}/day7",
    community_thread_topic: "Day 7 — share your win + claim your certificate 👇",
    submission_type: "scale_or_share",
    email_subject: "Day 7 — share your win + claim your certificate",
    email_preheader: "We made you a certificate. Built to share.",
    sms_body:
      "Day 7: share + claim your certificate. {{cert_url}}. Reply STOP to opt out.",
  },
] as const;

export function curriculumFor(day: number): DayCurriculum | undefined {
  return CURRICULUM.find((c) => c.day === day);
}
