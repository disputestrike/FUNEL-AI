/**
 * GoFunnelAI — Launch Center: Video Script + Storyboard agent (Level 2).
 *
 * Brand: GoFunnelAI. Domain: gofunnelai.com.
 *
 * Responsibilities
 * ----------------
 * Given a campaign brief, a duration, and a video-type intent, produce a
 * deterministic, schema-stable draft `VideoAsset` containing:
 *
 *   - scriptText            : the spoken/written narrative (continuous prose)
 *   - storyboard            : 4-6 scenes with sceneNumber, durationSec,
 *                             visualDescription, captionOverlay, voiceoverLine
 *   - scenePromptsForGen    : per-scene prompts ready to feed a generative
 *                             video provider (Runway / Luma / Kling / Pika)
 *   - voiceoverScript       : a clean speakable script (no scene markers)
 *                             ready for ElevenLabs TTS
 *   - captionsSrt           : SRT subtitle file generated from scene timing
 *                             + voiceoverLine breaks
 *
 * Industry-aware
 * --------------
 *   - saas      : dashboard mockups, real product UI on a laptop
 *   - ecommerce : product shots, unboxing, in-use lifestyle
 *   - services  : before/after operational shots, tradesperson at work
 *
 * The output is purely textual and side-effect free; rendering (Remotion,
 * FFmpeg, generative video providers, ElevenLabs TTS) lives in
 * `video-render.ts`. This split lets us cache the strategy layer cheaply and
 * regenerate only the assembly when brand tokens or formats change.
 */

import { emitLaunch } from "./events.js";
import type { Industry } from "./image-creative.js";

/* ---------------------------------------------------------------------------
 * Public types
 * ------------------------------------------------------------------------ */

export type VideoFormat =
  | "vertical_9_16"
  | "square_1_1"
  | "horizontal_16_9";

export type VideoType =
  | "short_form"
  | "explainer"
  | "problem_solution"
  | "retargeting"
  | "founder"
  | "saas_demo";

export interface VideoBrief {
  campaignId: string;
  workspaceId?: string;
  funnelId?: string;
  industry?: Industry | string;
  offer: string;
  audience: string;
  /** Three-act hook copy (hook / promise / proof) — typically from the Hook agent. */
  hook?: {
    headline?: string;
    promise?: string;
    proof?: string;
  };
  /** Up to 3 CTAs; the first is used in the close. */
  ctas?: string[];
  /** Optional founder name for `founder` videos. */
  founderName?: string;
  /** Optional brand voice register (drives tone of script). */
  voiceRegister?: "formal" | "casual" | "authoritative" | "playful";
  /** Optional explicit headline overlays per scene (else derived from script). */
  captionOverlays?: string[];
}

/** Default video lengths (seconds) the Launch Center ships at L2. */
export const DEFAULT_VIDEO_DURATIONS: Readonly<Record<VideoType, number>> = Object.freeze({
  short_form: 15, // TikTok hook
  explainer: 30, // Meta explainer
  problem_solution: 30,
  retargeting: 15,
  founder: 30,
  saas_demo: 45, // LinkedIn demo
});

/** Default format per type. The caller can override via `format` arg. */
export const DEFAULT_VIDEO_FORMATS: Readonly<Record<VideoType, VideoFormat>> = Object.freeze({
  short_form: "vertical_9_16",
  explainer: "square_1_1",
  problem_solution: "square_1_1",
  retargeting: "vertical_9_16",
  founder: "square_1_1",
  saas_demo: "horizontal_16_9",
});

export interface StoryboardScene {
  sceneNumber: number;
  /** Inclusive seconds budget; sum of these must equal the asset duration. */
  durationSec: number;
  /** What the camera shows. Cleaned-up, generative-friendly description. */
  visualDescription: string;
  /** Text overlay rendered on top of the scene (subtitle or kinetic title). */
  captionOverlay: string;
  /** Single voiceover line spoken during this scene. */
  voiceoverLine: string;
  /** Optional B-roll suggestion if the primary shot is too narrow. */
  bRollSuggestion?: string;
}

export interface ScenePromptForGen {
  sceneNumber: number;
  /** Full text prompt for an image-to-video / text-to-video provider. */
  prompt: string;
  durationSec: number;
  /** Suggested generative-video model. Routing is decided at render time. */
  preferredProvider: "runway" | "luma" | "kling" | "pika" | "stock_broll";
}

export interface VideoAsset {
  campaignId: string;
  workspaceId?: string;
  videoType: VideoType;
  durationSec: number;
  format: VideoFormat;
  industry?: string;
  /** The full narrative as continuous prose — the "script" the writer would hand a video editor. */
  scriptText: string;
  /** Flattened voiceover script ready for ElevenLabs (newline-separated). */
  voiceoverScript: string;
  storyboard: StoryboardScene[];
  scenePromptsForGen: ScenePromptForGen[];
  captionsSrt: string;
  /** Suggested ElevenLabs voice persona id (resolved at render). */
  voicePersona: "funnel" | "maven" | "coach" | "rebel" | "maestro";
  /** Optional metadata for the renderer (provider routing, etc.). */
  meta: {
    sceneCount: number;
    avgSceneDurationSec: number;
    industryAnchor: string;
    generatedAt: string;
  };
}

export interface RunVideoScriptOptions {
  /** Override the default duration for the chosen type. */
  durationSec?: number;
  /** Override the default format for the chosen type. */
  format?: VideoFormat;
  /** Inject a clock for deterministic tests. */
  now?: () => Date;
}

/* ---------------------------------------------------------------------------
 * Public entry point
 * ------------------------------------------------------------------------ */

export async function runVideoScript(
  brief: VideoBrief,
  videoType: VideoType,
  options: RunVideoScriptOptions = {},
): Promise<VideoAsset> {
  if (!brief.campaignId) throw new Error("runVideoScript: brief.campaignId required");
  if (!brief.offer) throw new Error("runVideoScript: brief.offer required");

  const durationSec = options.durationSec ?? DEFAULT_VIDEO_DURATIONS[videoType];
  const format = options.format ?? DEFAULT_VIDEO_FORMATS[videoType];
  const industryKey = String(brief.industry ?? "other").toLowerCase();
  const industryFamily = mapIndustryFamily(industryKey);
  const anchor = INDUSTRY_VISUAL_ANCHORS[industryFamily];
  const now = options.now ?? (() => new Date());

  await emitLaunch(
    "launch_strategy_started",
    {
      stage: "video_script",
      videoType,
      durationSec,
      format,
      industry: industryKey,
    },
    { campaignId: brief.campaignId, workspaceId: brief.workspaceId ?? null },
  );

  const storyboard = composeStoryboard({
    brief,
    videoType,
    durationSec,
    anchor,
  });

  const scriptText = composeScriptText({ brief, videoType, storyboard });
  const voiceoverScript = composeVoiceoverScript(storyboard);
  const scenePromptsForGen = composeScenePrompts({
    brief,
    storyboard,
    format,
    anchor,
    videoType,
  });
  const captionsSrt = composeSrt(storyboard);
  const voicePersona = pickVoicePersona(brief, videoType);

  const asset: VideoAsset = {
    campaignId: brief.campaignId,
    workspaceId: brief.workspaceId,
    videoType,
    durationSec,
    format,
    industry: industryKey,
    scriptText,
    voiceoverScript,
    storyboard,
    scenePromptsForGen,
    captionsSrt,
    voicePersona,
    meta: {
      sceneCount: storyboard.length,
      avgSceneDurationSec:
        Math.round(
          (storyboard.reduce((s, sc) => s + sc.durationSec, 0) / Math.max(1, storyboard.length)) *
            10,
        ) / 10,
      industryAnchor: industryFamily,
      generatedAt: now().toISOString(),
    },
  };

  await emitLaunch(
    "launch_strategy_completed",
    {
      stage: "video_script",
      sceneCount: asset.storyboard.length,
      durationSec: asset.durationSec,
      videoType,
    },
    { campaignId: brief.campaignId, workspaceId: brief.workspaceId ?? null },
  );

  return asset;
}

/* ---------------------------------------------------------------------------
 * Storyboard composition — scene plans per video type
 *
 * Every plan is hand-tuned to land within the duration budget. Scenes shorter
 * than 2s never read on the platform; scenes longer than 8s lose retention on
 * TikTok/Reels. The plans below stay between 2-8s per scene.
 * ------------------------------------------------------------------------ */

interface StoryboardPlan {
  beats: ScenePlanBeat[];
}

interface ScenePlanBeat {
  role: "hook" | "problem" | "promise" | "mechanism" | "proof" | "scarcity" | "cta" | "founder_intro" | "demo_step";
  weight: number; // relative share of the duration budget
}

const STORYBOARD_PLANS: Record<VideoType, StoryboardPlan> = {
  short_form: {
    beats: [
      { role: "hook", weight: 1 },
      { role: "promise", weight: 1 },
      { role: "proof", weight: 1 },
      { role: "cta", weight: 1 },
    ],
  },
  explainer: {
    beats: [
      { role: "hook", weight: 1 },
      { role: "problem", weight: 1.2 },
      { role: "mechanism", weight: 1.5 },
      { role: "proof", weight: 1.2 },
      { role: "cta", weight: 1 },
    ],
  },
  problem_solution: {
    beats: [
      { role: "hook", weight: 1 },
      { role: "problem", weight: 1.5 },
      { role: "promise", weight: 1.2 },
      { role: "proof", weight: 1.2 },
      { role: "cta", weight: 1 },
    ],
  },
  retargeting: {
    beats: [
      { role: "hook", weight: 1 },
      { role: "scarcity", weight: 1 },
      { role: "proof", weight: 1 },
      { role: "cta", weight: 1 },
    ],
  },
  founder: {
    beats: [
      { role: "founder_intro", weight: 1.5 },
      { role: "problem", weight: 1.2 },
      { role: "mechanism", weight: 1.5 },
      { role: "proof", weight: 1.2 },
      { role: "cta", weight: 1 },
    ],
  },
  saas_demo: {
    beats: [
      { role: "hook", weight: 1 },
      { role: "demo_step", weight: 1.5 },
      { role: "demo_step", weight: 1.5 },
      { role: "demo_step", weight: 1.5 },
      { role: "proof", weight: 1.2 },
      { role: "cta", weight: 1 },
    ],
  },
};

interface ComposeStoryboardArgs {
  brief: VideoBrief;
  videoType: VideoType;
  durationSec: number;
  anchor: IndustryAnchor;
}

function composeStoryboard(args: ComposeStoryboardArgs): StoryboardScene[] {
  const plan = STORYBOARD_PLANS[args.videoType];
  const totalWeight = plan.beats.reduce((s, b) => s + b.weight, 0);
  const durations = allocateDurations(
    args.durationSec,
    plan.beats.map((b) => b.weight / totalWeight),
  );

  return plan.beats.map((beat, i) => {
    const sceneNumber = i + 1;
    const durationSec = durations[i]!;
    const built = composeSceneBeat({
      brief: args.brief,
      anchor: args.anchor,
      role: beat.role,
      sceneNumber,
      durationSec,
      stepIndex: countPreviousRole(plan.beats, i, beat.role),
    });
    return built;
  });
}

interface ComposeBeatArgs {
  brief: VideoBrief;
  anchor: IndustryAnchor;
  role: ScenePlanBeat["role"];
  sceneNumber: number;
  durationSec: number;
  stepIndex: number; // used to vary repeated demo_step beats
}

function composeSceneBeat(args: ComposeBeatArgs): StoryboardScene {
  const { brief, anchor, role, sceneNumber, durationSec, stepIndex } = args;
  const overlay = brief.captionOverlays?.[sceneNumber - 1];
  const offer = brief.offer;
  const audience = brief.audience;
  const cta = brief.ctas?.[0] ?? "Start free";
  const hookLine = brief.hook?.headline ?? `Here's how ${audience} fix it.`;
  const promiseLine = brief.hook?.promise ?? `You can ${offer.toLowerCase()}.`;
  const proofLine = brief.hook?.proof ?? `Hundreds of ${audience} have already.`;

  switch (role) {
    case "hook":
      return {
        sceneNumber,
        durationSec,
        visualDescription: anchor.hook,
        captionOverlay: overlay ?? hookLine,
        voiceoverLine: hookLine,
        bRollSuggestion: anchor.bRoll,
      };
    case "problem":
      return {
        sceneNumber,
        durationSec,
        visualDescription: anchor.problem,
        captionOverlay: overlay ?? "The real problem most people miss",
        voiceoverLine: `Most ${audience} get stuck because the usual approach doesn't address the real issue.`,
      };
    case "promise":
      return {
        sceneNumber,
        durationSec,
        visualDescription: anchor.promise,
        captionOverlay: overlay ?? promiseLine,
        voiceoverLine: promiseLine,
      };
    case "mechanism":
      return {
        sceneNumber,
        durationSec,
        visualDescription: anchor.mechanism,
        captionOverlay: overlay ?? "How it works",
        voiceoverLine: `We ${offer.toLowerCase()} so ${audience} can move forward without the usual friction.`,
      };
    case "proof":
      return {
        sceneNumber,
        durationSec,
        visualDescription: anchor.proof,
        captionOverlay: overlay ?? proofLine,
        voiceoverLine: proofLine,
      };
    case "scarcity":
      return {
        sceneNumber,
        durationSec,
        visualDescription: anchor.scarcity,
        captionOverlay: overlay ?? "Limited spots this week",
        voiceoverLine: "We only take on a small number of clients each week — make sure you grab your spot.",
      };
    case "cta":
      return {
        sceneNumber,
        durationSec,
        visualDescription: anchor.cta,
        captionOverlay: overlay ?? cta,
        voiceoverLine: `${cta} — link in bio.`,
      };
    case "founder_intro": {
      const name = brief.founderName ?? "I";
      return {
        sceneNumber,
        durationSec,
        visualDescription: anchor.founder,
        captionOverlay: overlay ?? `${name} built this for ${audience}`,
        voiceoverLine: `${name} — and I built this for ${audience}.`,
      };
    }
    case "demo_step":
      return {
        sceneNumber,
        durationSec,
        visualDescription: `${anchor.demo} — step ${stepIndex + 1}`,
        captionOverlay: overlay ?? `Step ${stepIndex + 1}`,
        voiceoverLine: `In step ${stepIndex + 1}, you ${describeDemoStep(stepIndex)}.`,
      };
  }
}

function describeDemoStep(stepIndex: number): string {
  switch (stepIndex) {
    case 0:
      return "drop in your business details — it takes about thirty seconds";
    case 1:
      return "let GoFunnelAI generate your funnel, ads, and emails in one shot";
    case 2:
      return "review the draft and publish to your domain with one click";
    default:
      return "fine-tune the result with the inline editor";
  }
}

function countPreviousRole(beats: ScenePlanBeat[], upTo: number, role: ScenePlanBeat["role"]): number {
  let count = 0;
  for (let i = 0; i < upTo; i++) if (beats[i]!.role === role) count++;
  return count;
}

/**
 * Allocate `durationSec` across beats according to fractional weights, while
 * keeping each beat in the [2,8] second range and the total equal to the
 * input (loss-less rounding).
 */
function allocateDurations(totalSec: number, fractions: number[]): number[] {
  const raw = fractions.map((f) => f * totalSec);
  const floored = raw.map((d) => Math.max(2, Math.floor(d)));
  let used = floored.reduce((s, n) => s + n, 0);
  // Distribute remaining seconds to the largest fractional remainders.
  const remainders = raw.map((d, i) => ({ i, rem: d - Math.floor(d) }));
  remainders.sort((a, b) => b.rem - a.rem);
  let cursor = 0;
  while (used < totalSec) {
    const target = remainders[cursor % remainders.length]!;
    if (floored[target.i]! < 8) {
      floored[target.i]! += 1;
      used += 1;
    }
    cursor++;
    if (cursor > 1000) break;
  }
  // Trim if we overshot (cap at 8s per scene).
  let over = used - totalSec;
  let trimCursor = 0;
  while (over > 0) {
    const idx = trimCursor % floored.length;
    if (floored[idx]! > 2) {
      floored[idx]! -= 1;
      over -= 1;
    }
    trimCursor++;
    if (trimCursor > 1000) break;
  }
  return floored;
}

/* ---------------------------------------------------------------------------
 * Script + voiceover composition
 * ------------------------------------------------------------------------ */

interface ComposeScriptArgs {
  brief: VideoBrief;
  videoType: VideoType;
  storyboard: StoryboardScene[];
}

function composeScriptText(args: ComposeScriptArgs): string {
  const header = `# ${capitalize(args.videoType.replace(/_/g, " "))} — ${args.brief.offer}`;
  const lines: string[] = [header, ""];
  for (const scene of args.storyboard) {
    lines.push(`Scene ${scene.sceneNumber} (${scene.durationSec}s)`);
    lines.push(`  Visual : ${scene.visualDescription}`);
    lines.push(`  Caption: ${scene.captionOverlay}`);
    lines.push(`  VO     : ${scene.voiceoverLine}`);
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}

function composeVoiceoverScript(storyboard: StoryboardScene[]): string {
  return storyboard.map((s) => s.voiceoverLine.trim()).join("\n");
}

/* ---------------------------------------------------------------------------
 * Per-scene generative-video prompts
 * ------------------------------------------------------------------------ */

interface ComposeScenePromptsArgs {
  brief: VideoBrief;
  storyboard: StoryboardScene[];
  format: VideoFormat;
  anchor: IndustryAnchor;
  videoType: VideoType;
}

function composeScenePrompts(args: ComposeScenePromptsArgs): ScenePromptForGen[] {
  const aspectRatio = formatToAspect(args.format);
  return args.storyboard.map((scene) => {
    const parts = [
      scene.visualDescription,
      `aspect ratio ${aspectRatio}`,
      "cinematic real-world footage, natural lighting, candid",
      "no embedded text, no logos of real brands, no identifiable real public figures",
      `industry context: ${args.brief.industry ?? "general"}`,
      `audience: ${args.brief.audience}`,
      "shutter speed natural, slight handheld motion, 24fps",
    ];
    return {
      sceneNumber: scene.sceneNumber,
      durationSec: scene.durationSec,
      prompt: parts.join(". "),
      preferredProvider: pickProvider(args.videoType, scene.durationSec),
    };
  });
}

function pickProvider(
  videoType: VideoType,
  durationSec: number,
): ScenePromptForGen["preferredProvider"] {
  // Routing heuristic — final routing happens at render time when the user's
  // API keys are loaded. Documented in video-render.ts.
  if (durationSec <= 4) return "pika"; // cheap, fast, short clips
  if (videoType === "saas_demo") return "runway"; // screen-recording quality
  if (videoType === "founder") return "kling"; // best for talking-head
  if (videoType === "retargeting") return "luma"; // fastest turnaround for short_form
  return "runway";
}

/* ---------------------------------------------------------------------------
 * Caption / SRT generation
 * ------------------------------------------------------------------------ */

function composeSrt(storyboard: StoryboardScene[]): string {
  const parts: string[] = [];
  let cursorSec = 0;
  for (const scene of storyboard) {
    const start = cursorSec;
    const end = cursorSec + scene.durationSec;
    cursorSec = end;
    parts.push(
      `${scene.sceneNumber}`,
      `${secondsToTimestamp(start)} --> ${secondsToTimestamp(end)}`,
      scene.captionOverlay,
      "",
    );
  }
  return parts.join("\n").trimEnd() + "\n";
}

function secondsToTimestamp(totalSec: number): string {
  const ms = Math.max(0, Math.round(totalSec * 1000));
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const r = ms % 1000;
  return (
    String(h).padStart(2, "0") +
    ":" +
    String(m).padStart(2, "0") +
    ":" +
    String(s).padStart(2, "0") +
    "," +
    String(r).padStart(3, "0")
  );
}

/* ---------------------------------------------------------------------------
 * Industry anchors
 *
 * We collapse 20 industries into 3 families (SaaS / Ecom / Services) for the
 * visual anchors — each family's footage style is distinct enough that mixing
 * them would muddle the brief. Per-industry palette + nuance is layered in by
 * the higher-level brief.
 * ------------------------------------------------------------------------ */

type IndustryFamily = "saas" | "ecommerce" | "services";

interface IndustryAnchor {
  hook: string;
  problem: string;
  promise: string;
  mechanism: string;
  proof: string;
  scarcity: string;
  cta: string;
  founder: string;
  demo: string;
  bRoll: string;
}

const INDUSTRY_VISUAL_ANCHORS: Record<IndustryFamily, IndustryAnchor> = {
  saas: {
    hook: "Tight shot of a modern dashboard UI mockup on a laptop screen, real workspace, hands on keyboard",
    problem: "Frustrated operator scrolling through spreadsheets at 11pm, coffee mug visible, soft lamp light",
    promise: "Dashboard mockup with metrics trending up across the chart, depth of field on the screen",
    mechanism: "Screen recording of the GoFunnelAI builder generating a funnel in real time, cursor visible",
    proof: "Customer logo wall mockup on an office wall, behind a real workstation",
    scarcity: "Pricing screen with an 'early access seats' banner, hand hovering over a CTA button",
    cta: "Clean end-card with the product URL on a soft brand-color background, no busy motion",
    founder: "Documentary portrait of the founder at a home desk, headset visible, soft daylight",
    demo: "Annotated screen recording walkthrough of the product, callouts highlighting one click at a time",
    bRoll: "Slow pan across the dashboard while metrics animate",
  },
  ecommerce: {
    hook: "Studio product flatlay or in-use lifestyle shot with soft directional light, single hero SKU",
    problem: "Customer frustrated rummaging through a cluttered bathroom counter looking for the right product",
    promise: "Hero product unboxed on a clean kitchen counter, daylight from a side window",
    mechanism: "Hands using the product as part of a real morning routine, multiple short cuts",
    proof: "Wall of 5-star review screenshots layered next to the product on a clean shelf",
    scarcity: "Warehouse shelf with only a few boxes left, hand reaching for the last one",
    cta: "End-card with product packshot + price + free-shipping callout, brand background",
    founder: "Founder in their fulfillment area packing orders, candid documentary lighting",
    demo: "Step-by-step product-in-use sequence, each shot under 3 seconds",
    bRoll: "Macro shots of texture, surface, and material as cutaways",
  },
  services: {
    hook: "Tradesperson working at a residential home, real action shot, no posed smile, natural light",
    problem: "Frustrated homeowner staring at a broken appliance or untreated yard, mid-day light",
    promise: "Completed install or service with a satisfied homeowner walking past, golden hour",
    mechanism: "Sequence of operational shots showing the service being performed: arrive, assess, fix, finish",
    proof: "Before/after composite of a real customer site, captioned with the timeframe",
    scarcity: "Schedule on a clipboard showing one open day this week, sharpie circle around the date",
    cta: "End-card with phone number + 'book now' on a clean brand background",
    founder: "Owner-operator on a job site, documentary portrait, tools visible behind",
    demo: "Step-by-step service walkthrough, each shot showing one action with a callout",
    bRoll: "Detail shots of tools, hands at work, vehicle branding",
  },
};

function mapIndustryFamily(industry: string): IndustryFamily {
  const k = industry.toLowerCase();
  if (k === "saas") return "saas";
  if (k === "ecommerce" || k === "supplements" || k === "info_products") return "ecommerce";
  return "services";
}

function formatToAspect(format: VideoFormat): string {
  switch (format) {
    case "vertical_9_16":
      return "9:16";
    case "square_1_1":
      return "1:1";
    case "horizontal_16_9":
      return "16:9";
  }
}

function pickVoicePersona(
  brief: VideoBrief,
  videoType: VideoType,
): VideoAsset["voicePersona"] {
  if (videoType === "founder") return "funnel";
  if (videoType === "saas_demo") return "maestro";
  if (videoType === "short_form" || videoType === "retargeting") return "rebel";
  if (brief.voiceRegister === "authoritative") return "maven";
  if (brief.voiceRegister === "casual") return "coach";
  return "coach";
}

function capitalize(s: string): string {
  return s.length === 0 ? s : s[0]!.toUpperCase() + s.slice(1);
}
