/**
 * GoFunnelAI — Retargeting plan agent.
 *
 * Builds the 6-trigger retargeting plan for a campaign, with the creative
 * payload bundled inline (2 image ads + 2 video scripts + 2 emails + 2 SMS
 * per trigger). The 6 triggers are the canonical "drop-off moments" we
 * built the Launch Center around — they map onto `RetargetingTrigger` from
 * `@funnel/shared/launch` but use cockpit-friendly aliases:
 *
 *   page_viewed_no_engage   →  Platform.PageView (no scroll/CTA)
 *   calculator_abandoned    →  AddToCart   (calculator step = "added intent")
 *   chat_no_book            →  CustomEvent (chatbot exit, no booking)
 *   video_no_convert        →  VideoView75 (watched ≥75% but no lead)
 *   lead_no_schedule        →  LeadCaptured (lead in, no booking)
 *   missed_appointment      →  LeadCaptured (showed up flow broken)
 *
 * Returns a list of `RetargetingRule` plus a parallel array of `RetargetingPlan`
 * entries that carry the rich creative payload (which doesn't fit on the
 * skinny `RetargetingRule` row).
 */

import { createHash } from "node:crypto";

import {
  RetargetingTrigger,
  type Campaign,
  type RetargetingRule,
} from "@funnel/shared/launch";

import { emitLaunch } from "./events.js";

// ---------------------------------------------------------------------------
// Trigger aliases
// ---------------------------------------------------------------------------

export const LAUNCH_TRIGGERS = [
  "page_viewed_no_engage",
  "calculator_abandoned",
  "chat_no_book",
  "video_no_convert",
  "lead_no_schedule",
  "missed_appointment",
] as const;

export type LaunchTriggerKey = (typeof LAUNCH_TRIGGERS)[number];

const TRIGGER_MAP: Record<LaunchTriggerKey, RetargetingTrigger> = {
  page_viewed_no_engage: RetargetingTrigger.PageView,
  calculator_abandoned: RetargetingTrigger.AddToCart,
  chat_no_book: RetargetingTrigger.CustomEvent,
  video_no_convert: RetargetingTrigger.VideoView75,
  lead_no_schedule: RetargetingTrigger.LeadCaptured,
  missed_appointment: RetargetingTrigger.LeadCaptured,
} as const;

const TRIGGER_WINDOW_DAYS: Record<LaunchTriggerKey, number> = {
  page_viewed_no_engage: 7,
  calculator_abandoned: 14,
  chat_no_book: 7,
  video_no_convert: 14,
  lead_no_schedule: 7,
  missed_appointment: 3,
};

const TRIGGER_BID_MULTIPLIER: Record<LaunchTriggerKey, number> = {
  page_viewed_no_engage: 1.1,
  calculator_abandoned: 1.6,
  chat_no_book: 1.4,
  video_no_convert: 1.5,
  lead_no_schedule: 1.75,
  missed_appointment: 2.0,
};

// ---------------------------------------------------------------------------
// Creative payload
// ---------------------------------------------------------------------------

export interface RetargetImageAd {
  id: string;
  variantLabel: string;
  visualConcept: string;
  headline: string;
  primaryText: string;
  cta: string;
}

export interface RetargetVideoScript {
  id: string;
  variantLabel: string;
  durationSec: number;
  hook: string;
  beats: string[];
  cta: string;
}

export interface RetargetEmail {
  id: string;
  variantLabel: string;
  subject: string;
  preheader: string;
  body: string;
  cta: string;
}

export interface RetargetSms {
  id: string;
  variantLabel: string;
  body: string;
  legalSuffix: string;
}

export interface RetargetingPlanEntry {
  trigger: LaunchTriggerKey;
  triggerLabel: string;
  rule: RetargetingRule;
  imageAds: [RetargetImageAd, RetargetImageAd];
  videoScripts: [RetargetVideoScript, RetargetVideoScript];
  emails: [RetargetEmail, RetargetEmail];
  smsMessages: [RetargetSms, RetargetSms];
}

export interface BuildRetargetingPlanArgs {
  campaign: Pick<
    Campaign,
    "id" | "workspaceId" | "name" | "primaryAngle" | "audienceProfileIds"
  >;
  /** Industry slug (e.g. "solar"); steers copy. */
  industry?: string;
  /** Optional persona description used in templates. */
  audiencePersona?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stableId(prefix: string, parts: string[]): string {
  const h = createHash("sha256").update(parts.join("|"), "utf8").digest("hex").slice(0, 16);
  return `${prefix}_${h}`;
}

const TRIGGER_LABELS: Record<LaunchTriggerKey, string> = {
  page_viewed_no_engage: "Visited landing page, did not engage",
  calculator_abandoned: "Started calculator, did not finish",
  chat_no_book: "Chatted with assistant, did not book",
  video_no_convert: "Watched 75% of video, did not convert",
  lead_no_schedule: "Captured as lead, did not schedule",
  missed_appointment: "Booked but missed appointment",
};

interface CopyContext {
  product: string;
  persona: string;
}

function ctx(args: BuildRetargetingPlanArgs): CopyContext {
  const industry = args.industry?.replace(/[_-]+/g, " ") || "your offer";
  const persona = args.audiencePersona?.trim() || `${industry} prospects`;
  return { product: industry, persona };
}

function imageAdsFor(trigger: LaunchTriggerKey, c: CopyContext, base: string): [RetargetImageAd, RetargetImageAd] {
  const map: Record<LaunchTriggerKey, [RetargetImageAd, RetargetImageAd]> = {
    page_viewed_no_engage: [
      {
        id: stableId("rti", [base, trigger, "img", "a"]),
        variantLabel: "Static — Reminder",
        visualConcept: `Split-screen: ${c.persona} on left looking thoughtful, the GoFunnelAI ${c.product} dashboard on the right.`,
        headline: `Take another look at ${c.product}`,
        primaryText: `You stopped by earlier. Here's the 60-second walkthrough that shows ${c.persona} exactly what changes.`,
        cta: "See how",
      },
      {
        id: stableId("rti", [base, trigger, "img", "b"]),
        variantLabel: "Static — Curiosity gap",
        visualConcept: `Bold question over a soft hero image of ${c.product}. Brand pill in lower-right.`,
        headline: `Still thinking about ${c.product}?`,
        primaryText: `One question changes whether ${c.product} is worth your time. Click to find out.`,
        cta: "Find out",
      },
    ],
    calculator_abandoned: [
      {
        id: stableId("rti", [base, trigger, "img", "a"]),
        variantLabel: "Static — Show the number",
        visualConcept: `Mockup of the GoFunnelAI savings calculator with a blurred number and 'Your Estimate' label.`,
        headline: `You're 30 seconds from your number`,
        primaryText: `Finish your ${c.product} estimate — we'll show the result and the assumptions behind it.`,
        cta: "Finish estimate",
      },
      {
        id: stableId("rti", [base, trigger, "img", "b"]),
        variantLabel: "Static — Social proof + number",
        visualConcept: `Customer photo + quote: 'I almost closed the tab. The calculator changed my mind.'`,
        headline: `2,841 ${c.persona} ran their numbers last month`,
        primaryText: `Come back, finish the calculator, and see why most people don't close the tab a second time.`,
        cta: "Resume",
      },
    ],
    chat_no_book: [
      {
        id: stableId("rti", [base, trigger, "img", "a"]),
        variantLabel: "Static — Direct ask",
        visualConcept: `Chat bubble UI with a 'Book a call' CTA glow.`,
        headline: `Pick up where you left off`,
        primaryText: `You asked great questions. The next step is a 10-minute call with a ${c.product} specialist — no pressure.`,
        cta: "Book the call",
      },
      {
        id: stableId("rti", [base, trigger, "img", "b"]),
        variantLabel: "Static — Lower friction",
        visualConcept: `Calendar UI with one slot highlighted in brand color.`,
        headline: `One open slot tomorrow`,
        primaryText: `If you'd rather a real human than a chat window, grab a 10-minute spot. We'll bring answers to your saved questions.`,
        cta: "Grab a slot",
      },
    ],
    video_no_convert: [
      {
        id: stableId("rti", [base, trigger, "img", "a"]),
        variantLabel: "Static — Pay-off",
        visualConcept: `Freeze-frame of the video's pay-off moment, with a 'Watch the last 30 seconds' overlay.`,
        headline: `Stick around for the pay-off`,
        primaryText: `You watched most of it — the next 30 seconds are the part everyone screenshots.`,
        cta: "Watch the rest",
      },
      {
        id: stableId("rti", [base, trigger, "img", "b"]),
        variantLabel: "Static — Direct CTA",
        visualConcept: `Static product hero image with a glowing 'Start free' button.`,
        headline: `${c.product}, no sales call required`,
        primaryText: `Same story as the video — but as a 90-second hands-on trial. ${c.persona} usually pick this route.`,
        cta: "Start free",
      },
    ],
    lead_no_schedule: [
      {
        id: stableId("rti", [base, trigger, "img", "a"]),
        variantLabel: "Static — Calendar nudge",
        visualConcept: `Calendar UI with the next 3 days highlighted, 'Hold your time' banner.`,
        headline: `Your spot is still open`,
        primaryText: `We saved a window for you. Hold it before we release it to the next ${c.persona}.`,
        cta: "Hold my spot",
      },
      {
        id: stableId("rti", [base, trigger, "img", "b"]),
        variantLabel: "Static — Outcome teaser",
        visualConcept: `Screenshot of a result chart with a personalized caption.`,
        headline: `Here's what we'd cover`,
        primaryText: `On the call we'd show you a working ${c.product} plan for your situation. 10 minutes, you keep the plan either way.`,
        cta: "See the plan",
      },
    ],
    missed_appointment: [
      {
        id: stableId("rti", [base, trigger, "img", "a"]),
        variantLabel: "Static — Soft reschedule",
        visualConcept: `Friendly tone, brand secondary color. 'Things came up — let's pick a better time.'`,
        headline: `Got busy? Let's pick a better time.`,
        primaryText: `Life happens. Grab any open slot — we'll be ready with your ${c.product} plan.`,
        cta: "Reschedule",
      },
      {
        id: stableId("rti", [base, trigger, "img", "b"]),
        variantLabel: "Static — Final nudge",
        visualConcept: `Stark layout, single sentence, large CTA.`,
        headline: `Last open invitation`,
        primaryText: `Last chance to keep your ${c.product} plan on the table this month. After this we close the queue.`,
        cta: "Reopen plan",
      },
    ],
  };
  return map[trigger];
}

function videoScriptsFor(trigger: LaunchTriggerKey, c: CopyContext, base: string): [RetargetVideoScript, RetargetVideoScript] {
  const map: Record<LaunchTriggerKey, [RetargetVideoScript, RetargetVideoScript]> = {
    page_viewed_no_engage: [
      {
        id: stableId("rtv", [base, trigger, "vid", "a"]),
        variantLabel: "15s — Pattern interrupt",
        durationSec: 15,
        hook: `If you closed our page in under 10 seconds, this is for you.`,
        beats: [
          `0–3s: pattern interrupt visual (cursor closing a tab), text overlay 'Wait —'.`,
          `3–8s: name the prospect's likely objection (price, time, trust).`,
          `8–13s: counter with the one fact that resolves it.`,
          `13–15s: brand pill + CTA.`,
        ],
        cta: "Come back, 10 seconds",
      },
      {
        id: stableId("rtv", [base, trigger, "vid", "b"]),
        variantLabel: "30s — Walk-through",
        durationSec: 30,
        hook: `Here's what you would have seen if you'd scrolled past the hero.`,
        beats: [
          `0–5s: scroll animation of the funnel below the fold.`,
          `5–18s: highlight the 3 proof points ${c.persona} care about.`,
          `18–27s: zoom into the offer card.`,
          `27–30s: 'Open in your browser' CTA.`,
        ],
        cta: "Open in browser",
      },
    ],
    calculator_abandoned: [
      {
        id: stableId("rtv", [base, trigger, "vid", "a"]),
        variantLabel: "20s — Number teaser",
        durationSec: 20,
        hook: `You were one input away from your ${c.product} number.`,
        beats: [
          `0–3s: blurred number reveal.`,
          `3–12s: show the inputs you already entered, plus the one missing.`,
          `12–18s: hint at the savings range without revealing it.`,
          `18–20s: 'Resume calculator' CTA.`,
        ],
        cta: "Resume calculator",
      },
      {
        id: stableId("rtv", [base, trigger, "vid", "b"]),
        variantLabel: "30s — Walk-through",
        durationSec: 30,
        hook: `A 30-second walkthrough of the GoFunnelAI ${c.product} calculator.`,
        beats: [
          `0–6s: introduce the calculator and its data sources.`,
          `6–18s: show the input flow, one step per second.`,
          `18–26s: reveal an example result with assumptions.`,
          `26–30s: 'Run your own' CTA.`,
        ],
        cta: "Run my own",
      },
    ],
    chat_no_book: [
      {
        id: stableId("rtv", [base, trigger, "vid", "a"]),
        variantLabel: "15s — Specialist intro",
        durationSec: 15,
        hook: `Hi — I'm the ${c.product} specialist you'd talk to.`,
        beats: [
          `0–4s: specialist on camera, smiling, brand backdrop.`,
          `4–10s: 'You asked about X in chat — here's what I'd answer.'`,
          `10–13s: 10-minute call promise.`,
          `13–15s: CTA + calendar UI.`,
        ],
        cta: "Book the 10",
      },
      {
        id: stableId("rtv", [base, trigger, "vid", "b"]),
        variantLabel: "30s — FAQ from chat",
        durationSec: 30,
        hook: `Three questions ${c.persona} ask in chat — answered.`,
        beats: [
          `0–8s: question 1 with on-screen answer in a card.`,
          `8–18s: question 2 with quick demo clip.`,
          `18–26s: question 3 with proof point.`,
          `26–30s: book CTA.`,
        ],
        cta: "Book a call",
      },
    ],
    video_no_convert: [
      {
        id: stableId("rtv", [base, trigger, "vid", "a"]),
        variantLabel: "10s — Tease pay-off",
        durationSec: 10,
        hook: `You watched 75% — the last 30 seconds are the part everyone screenshots.`,
        beats: [
          `0–3s: rewind animation back to the climax.`,
          `3–7s: blurred pay-off, 'spoiler-free' overlay.`,
          `7–10s: 'Watch the rest' CTA.`,
        ],
        cta: "Watch the rest",
      },
      {
        id: stableId("rtv", [base, trigger, "vid", "b"]),
        variantLabel: "30s — Direct demo",
        durationSec: 30,
        hook: `Same story as the long video — in 30 seconds.`,
        beats: [
          `0–6s: condensed intro.`,
          `6–22s: live screen of the ${c.product} workflow.`,
          `22–28s: outcome card with named customer logo.`,
          `28–30s: 'Start free' CTA.`,
        ],
        cta: "Start free",
      },
    ],
    lead_no_schedule: [
      {
        id: stableId("rtv", [base, trigger, "vid", "a"]),
        variantLabel: "20s — Hold the slot",
        durationSec: 20,
        hook: `Your slot is still open — but not for long.`,
        beats: [
          `0–4s: calendar UI animation, one slot highlighted.`,
          `4–14s: walk through what the call covers.`,
          `14–18s: 'No pressure, you keep the plan either way'.`,
          `18–20s: book CTA.`,
        ],
        cta: "Hold my spot",
      },
      {
        id: stableId("rtv", [base, trigger, "vid", "b"]),
        variantLabel: "30s — Outcome story",
        durationSec: 30,
        hook: `Here's what last week's call sounded like.`,
        beats: [
          `0–6s: testimonial soundbite from a recent ${c.persona}.`,
          `6–20s: cut-down of the actual call advice.`,
          `20–28s: result they got afterward.`,
          `28–30s: 'Take your slot' CTA.`,
        ],
        cta: "Take my slot",
      },
    ],
    missed_appointment: [
      {
        id: stableId("rtv", [base, trigger, "vid", "a"]),
        variantLabel: "15s — Reschedule",
        durationSec: 15,
        hook: `No drama — let's reschedule.`,
        beats: [
          `0–5s: friendly specialist on camera.`,
          `5–10s: 'we held your ${c.product} plan'.`,
          `10–13s: pick any open slot.`,
          `13–15s: CTA.`,
        ],
        cta: "Reschedule",
      },
      {
        id: stableId("rtv", [base, trigger, "vid", "b"]),
        variantLabel: "30s — Outcome reminder",
        durationSec: 30,
        hook: `Here's what we were going to cover.`,
        beats: [
          `0–8s: screen-share of the prepared ${c.product} plan.`,
          `8–22s: walk through the 3 key recommendations.`,
          `22–28s: 'Want this for your situation?'.`,
          `28–30s: reschedule CTA.`,
        ],
        cta: "Reopen plan",
      },
    ],
  };
  return map[trigger];
}

function emailsFor(trigger: LaunchTriggerKey, c: CopyContext, base: string): [RetargetEmail, RetargetEmail] {
  const subjectBase = c.product;
  const map: Record<LaunchTriggerKey, [RetargetEmail, RetargetEmail]> = {
    page_viewed_no_engage: [
      {
        id: stableId("rte", [base, trigger, "em", "a"]),
        variantLabel: "Email A — Quick reminder",
        subject: `Quick follow-up on ${subjectBase}`,
        preheader: "Saw you stopped by earlier — here's what you might have missed.",
        body: `Hi there,\n\nYou stopped by the ${subjectBase} page earlier. Most ${c.persona} who don't scroll past the hero are wondering one of three things: is it really that fast, is it really that affordable, and what happens after the demo.\n\nThis quick page answers all three: <link>. Five minutes, no form, no follow-up unless you ask for one.\n\n— GoFunnelAI`,
        cta: "See the answers",
      },
      {
        id: stableId("rte", [base, trigger, "em", "b"]),
        variantLabel: "Email B — Curiosity gap",
        subject: `One question changes whether ${subjectBase} fits`,
        preheader: "Answer it in 30 seconds.",
        body: `Hi,\n\nQuick test — do you want a working ${subjectBase} plan you can copy this week, or are you exploring for later?\n\nIf it's this week, this 10-minute walkthrough is the fastest path: <link>. If it's later, that's the same link — bookmark it.\n\n— GoFunnelAI`,
        cta: "Take the test",
      },
    ],
    calculator_abandoned: [
      {
        id: stableId("rte", [base, trigger, "em", "a"]),
        variantLabel: "Email A — Finish the math",
        subject: `Your ${subjectBase} estimate is one input away`,
        preheader: "We saved your inputs. Pick up where you left off.",
        body: `Hi,\n\nYour ${subjectBase} estimate is one input away from a number you can actually use. We saved your progress: <link>.\n\nThe usual range for ${c.persona} surprises people both ways. Finish, see your number, and decide from there.\n\n— GoFunnelAI`,
        cta: "Finish my estimate",
      },
      {
        id: stableId("rte", [base, trigger, "em", "b"]),
        variantLabel: "Email B — Show the assumptions",
        subject: `Where ${subjectBase} estimates usually go wrong`,
        preheader: "Spoiler: the assumptions, not the math.",
        body: `Hi,\n\nMost ${subjectBase} estimates online lie because they use national averages. Ours uses the inputs you started with — finish the calculator and see the difference: <link>.\n\nWe also show every assumption so you can challenge it.\n\n— GoFunnelAI`,
        cta: "See the assumptions",
      },
    ],
    chat_no_book: [
      {
        id: stableId("rte", [base, trigger, "em", "a"]),
        variantLabel: "Email A — Specialist intro",
        subject: `The specialist who'd answer your ${subjectBase} questions`,
        preheader: "10 minutes, no pressure.",
        body: `Hi,\n\nYou asked great questions in chat. The specialist who'd usually handle them is ${"available this week"} — pick a 10-minute slot here: <link>.\n\nIf you'd rather keep it in chat, just reply and we'll switch back.\n\n— GoFunnelAI`,
        cta: "Pick a slot",
      },
      {
        id: stableId("rte", [base, trigger, "em", "b"]),
        variantLabel: "Email B — FAQ from chat",
        subject: `3 ${subjectBase} answers we'd give on the call`,
        preheader: "Read them now or hear them live.",
        body: `Hi,\n\nThe 3 questions ${c.persona} ask in chat the most:\n\n1. How much does ${subjectBase} cost?\n2. How long does it take to launch?\n3. What happens after the call?\n\nQuick answers + live walkthrough: <link>.\n\n— GoFunnelAI`,
        cta: "Read the answers",
      },
    ],
    video_no_convert: [
      {
        id: stableId("rte", [base, trigger, "em", "a"]),
        variantLabel: "Email A — The pay-off",
        subject: `You watched 75% of the ${subjectBase} video`,
        preheader: "Here's the last 30 seconds.",
        body: `Hi,\n\nYou watched 75% of the ${subjectBase} video — the last 30 seconds are the part everyone screenshots. Jump to it here: <link>.\n\nIf you'd rather read it, the same idea in 60 seconds is right under the video.\n\n— GoFunnelAI`,
        cta: "Watch the pay-off",
      },
      {
        id: stableId("rte", [base, trigger, "em", "b"]),
        variantLabel: "Email B — Direct CTA",
        subject: `Skip the video, try ${subjectBase}`,
        preheader: "Same idea, hands-on.",
        body: `Hi,\n\nIf the video's been open in a tab for a while, you might prefer the hands-on version: <link>. Same story, no narrator.\n\nThe trial runs in your browser. No credit card.\n\n— GoFunnelAI`,
        cta: "Try it now",
      },
    ],
    lead_no_schedule: [
      {
        id: stableId("rte", [base, trigger, "em", "a"]),
        variantLabel: "Email A — Hold the slot",
        subject: `Your ${subjectBase} slot is still open`,
        preheader: "Hold it before we release it.",
        body: `Hi,\n\nWe saved a window for you: <link>. After 48 hours we release it to the next ${c.persona}.\n\nOn the call we'd show you a working ${subjectBase} plan for your situation — you keep the plan either way.\n\n— GoFunnelAI`,
        cta: "Hold my spot",
      },
      {
        id: stableId("rte", [base, trigger, "em", "b"]),
        variantLabel: "Email B — Outcome teaser",
        subject: `Here's what we'd cover on the ${subjectBase} call`,
        preheader: "10-minute agenda, attached.",
        body: `Hi,\n\nAgenda for your ${subjectBase} call:\n\n• Minute 0–2: confirm your situation.\n• Minute 2–7: walk through your plan.\n• Minute 7–10: pick the smallest next step.\n\nPick a time: <link>.\n\n— GoFunnelAI`,
        cta: "Pick a time",
      },
    ],
    missed_appointment: [
      {
        id: stableId("rte", [base, trigger, "em", "a"]),
        variantLabel: "Email A — Reschedule",
        subject: `No drama — let's reschedule your ${subjectBase} call`,
        preheader: "Pick any open slot.",
        body: `Hi,\n\nNo drama — let's reschedule your ${subjectBase} call. We held your plan: <link>.\n\nAny open slot works. We'll bring the plan to the call.\n\n— GoFunnelAI`,
        cta: "Reschedule",
      },
      {
        id: stableId("rte", [base, trigger, "em", "b"]),
        variantLabel: "Email B — Last invitation",
        subject: `Last open ${subjectBase} invitation this month`,
        preheader: "After this we close the queue.",
        body: `Hi,\n\nLast invitation to keep your ${subjectBase} plan on the table this month: <link>. After this we close the queue and reopen next cycle.\n\nIf the timing's wrong, just reply with a month that works.\n\n— GoFunnelAI`,
        cta: "Reopen plan",
      },
    ],
  };
  return map[trigger];
}

function smsFor(trigger: LaunchTriggerKey, c: CopyContext, base: string): [RetargetSms, RetargetSms] {
  const legal = "Reply STOP to opt out.";
  const map: Record<LaunchTriggerKey, [RetargetSms, RetargetSms]> = {
    page_viewed_no_engage: [
      {
        id: stableId("rts", [base, trigger, "sms", "a"]),
        variantLabel: "SMS A",
        body: `${c.product} update — your page is still saved. Open it here: <link>`,
        legalSuffix: legal,
      },
      {
        id: stableId("rts", [base, trigger, "sms", "b"]),
        variantLabel: "SMS B",
        body: `Quick — 60-second walkthrough of ${c.product} for ${c.persona}: <link>`,
        legalSuffix: legal,
      },
    ],
    calculator_abandoned: [
      {
        id: stableId("rts", [base, trigger, "sms", "a"]),
        variantLabel: "SMS A",
        body: `Your ${c.product} estimate is 1 input away. Finish it: <link>`,
        legalSuffix: legal,
      },
      {
        id: stableId("rts", [base, trigger, "sms", "b"]),
        variantLabel: "SMS B",
        body: `Pick up the ${c.product} calculator where you left off: <link>`,
        legalSuffix: legal,
      },
    ],
    chat_no_book: [
      {
        id: stableId("rts", [base, trigger, "sms", "a"]),
        variantLabel: "SMS A",
        body: `Hey — the ${c.product} specialist saved a 10-min slot for you: <link>`,
        legalSuffix: legal,
      },
      {
        id: stableId("rts", [base, trigger, "sms", "b"]),
        variantLabel: "SMS B",
        body: `Want answers to the questions you asked in chat? Pick a time: <link>`,
        legalSuffix: legal,
      },
    ],
    video_no_convert: [
      {
        id: stableId("rts", [base, trigger, "sms", "a"]),
        variantLabel: "SMS A",
        body: `You're 30s from the ${c.product} pay-off in that video: <link>`,
        legalSuffix: legal,
      },
      {
        id: stableId("rts", [base, trigger, "sms", "b"]),
        variantLabel: "SMS B",
        body: `Skip the video — try ${c.product} hands-on: <link>`,
        legalSuffix: legal,
      },
    ],
    lead_no_schedule: [
      {
        id: stableId("rts", [base, trigger, "sms", "a"]),
        variantLabel: "SMS A",
        body: `Your ${c.product} slot is still open. Hold it: <link>`,
        legalSuffix: legal,
      },
      {
        id: stableId("rts", [base, trigger, "sms", "b"]),
        variantLabel: "SMS B",
        body: `10-min ${c.product} plan for your situation — pick a time: <link>`,
        legalSuffix: legal,
      },
    ],
    missed_appointment: [
      {
        id: stableId("rts", [base, trigger, "sms", "a"]),
        variantLabel: "SMS A",
        body: `No drama — let's reschedule your ${c.product} call: <link>`,
        legalSuffix: legal,
      },
      {
        id: stableId("rts", [base, trigger, "sms", "b"]),
        variantLabel: "SMS B",
        body: `Last open ${c.product} invitation this month. Pick a slot: <link>`,
        legalSuffix: legal,
      },
    ],
  };
  return map[trigger];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface BuiltRetargetingPlan {
  rules: RetargetingRule[];
  entries: RetargetingPlanEntry[];
}

/** Build the full 6-trigger retargeting plan with creative payload. */
export function buildRetargetingPlan(args: BuildRetargetingPlanArgs): BuiltRetargetingPlan {
  const copy = ctx(args);
  const now = new Date();
  const entries: RetargetingPlanEntry[] = [];

  for (const trigger of LAUNCH_TRIGGERS) {
    const base = `${args.campaign.id}:${trigger}`;
    const ruleId = stableId("rtr", [args.campaign.workspaceId, args.campaign.id, trigger]);
    const rule: RetargetingRule = {
      id: ruleId,
      workspaceId: args.campaign.workspaceId,
      campaignId: args.campaign.id,
      name: `${args.campaign.name} — ${TRIGGER_LABELS[trigger]}`,
      trigger: TRIGGER_MAP[trigger],
      withinDays: TRIGGER_WINDOW_DAYS[trigger],
      excludeIfConverted: true,
      targetAudienceProfileId: args.campaign.audienceProfileIds[0] ?? null,
      creativeVariantIds: [],
      bidMultiplier: TRIGGER_BID_MULTIPLIER[trigger],
      enabled: true,
      createdAt: now,
      updatedAt: now,
    };
    entries.push({
      trigger,
      triggerLabel: TRIGGER_LABELS[trigger],
      rule,
      imageAds: imageAdsFor(trigger, copy, base),
      videoScripts: videoScriptsFor(trigger, copy, base),
      emails: emailsFor(trigger, copy, base),
      smsMessages: smsFor(trigger, copy, base),
    });
  }

  void emitLaunch(
    "launch_retargeting_plan_built",
    {
      campaign_id: args.campaign.id,
      industry: args.industry ?? null,
      rule_count: entries.length,
      creative_count: entries.length * 8, // 2 image + 2 video + 2 email + 2 sms
    },
    { campaignId: args.campaign.id, workspaceId: args.campaign.workspaceId },
  );

  return { rules: entries.map((e) => e.rule), entries };
}

export const __internal = {
  TRIGGER_MAP,
  TRIGGER_LABELS,
  TRIGGER_WINDOW_DAYS,
  TRIGGER_BID_MULTIPLIER,
};
