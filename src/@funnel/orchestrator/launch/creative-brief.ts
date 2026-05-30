/**
 * GoFunnelAI — Launch Center: Creative Brief agent.
 *
 * Brand: GoFunnelAI (gofunnelai.com).
 *
 * `buildCreativeBrief(strategy, platform, angle)` produces a single
 * `CreativeBrief` object that the Image and Video agents (separate modules
 * in this workflow) consume verbatim. The brief is intentionally narrative,
 * second-person, and *opinionated*: the Image/Video agents are graded on
 * how literally they execute it.
 *
 * Deterministic. Pure. No I/O.
 */

import {
  AD_ANGLES,
  AdAngle,
  Platform,
  PLATFORM_META,
} from "@funnel/shared/launch";

import type { LaunchStrategy } from "./copy.js";

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

export interface BrandStyle {
  /** Primary brand color hex, e.g. "#4F46E5". */
  primaryColor: string;
  /** Accent color hex. */
  accentColor: string;
  /** Voice register — short adjective list. */
  voice: string[];
  /** Typography family family suggestion. */
  typography: string;
  /** Approved logo positioning rule. */
  logoUsage: string;
}

export type AssetKind =
  | "hero_image"
  | "lifestyle_image"
  | "product_shot"
  | "text_overlay_card"
  | "logo_lockup"
  | "before_after_split"
  | "ugc_video"
  | "talking_head_video"
  | "screen_record_video"
  | "animated_explainer";

export interface RequiredAsset {
  kind: AssetKind;
  aspectRatio: "9:16" | "1:1" | "16:9" | "4:5";
  durationSec: number | null; // null for static
  description: string;
  /** Copy that must appear on the asset (text overlay). */
  textOverlay: string | null;
  /** Optional: count when more than one of the same kind is needed. */
  count: number;
}

export interface CreativeBrief {
  /** Audience descriptor pulled (and tightened) from strategy. */
  audience: string;
  platform: Platform;
  angle: AdAngle;
  painPoint: string;
  /** A vivid, prose visual concept for the image/video agents. */
  visualConcept: string;
  /** Lead headline the visual should support. */
  headline: string;
  cta: string;
  brandStyle: BrandStyle;
  requiredAssets: RequiredAsset[];
  /** Notes flagged for the downstream compliance agent. */
  complianceNotes: string[];
  /** Render targets the export step will emit (matched to platform formats). */
  outputFormats: Array<{
    aspectRatio: RequiredAsset["aspectRatio"];
    widthPx: number;
    heightPx: number;
    maxFileSizeMb: number;
    formats: string[]; // e.g. ["png","jpg","mp4"]
  }>;
  /** Stable hash of the inputs. */
  fingerprint: string;
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export function buildCreativeBrief(
  strategy: LaunchStrategy,
  platform: Platform,
  angle: AdAngle,
): CreativeBrief {
  const meta = PLATFORM_META[platform];
  if (!meta) throw new Error(`Unknown platform: ${String(platform)}`);
  const angleMeta = AD_ANGLES[angle];
  if (!angleMeta) throw new Error(`Unknown angle: ${String(angle)}`);

  const audience = sharpenAudience(strategy.audience, strategy.industry);
  const visualConcept = visualConceptFor(strategy, platform, angle);
  const headline = headlineFor(strategy, angle);
  const cta = ctaFor(strategy, angle);
  const brandStyle = brandStyleFor(strategy);
  const requiredAssets = requiredAssetsFor(platform, angle, strategy);
  const complianceNotes = complianceNotesFor(strategy.industry, angle);
  const outputFormats = outputFormatsFor(platform);

  return {
    audience,
    platform,
    angle,
    painPoint: strategy.painPoint,
    visualConcept,
    headline,
    cta,
    brandStyle,
    requiredAssets,
    complianceNotes,
    outputFormats,
    fingerprint: fingerprintInputs(strategy, platform, angle),
  };
}

// ---------------------------------------------------------------------------
// Composition helpers
// ---------------------------------------------------------------------------

function sharpenAudience(audience: string, industry: string): string {
  if (audience.length > 80) return audience.slice(0, 80).trim();
  return audience.length > 0 ? audience : `${industry} buyers actively comparing options`;
}

function visualConceptFor(
  s: LaunchStrategy,
  platform: Platform,
  angle: AdAngle,
): string {
  const register = AD_ANGLES[angle]?.register ?? "rational_value";
  const ind = s.industry;

  // Format-aware framing — vertical for short-form, horizontal for YouTube.
  const meta = PLATFORM_META[platform];
  const aspect = meta?.requiresVideoFormat ? "9:16 vertical" : "1:1 square";

  const sceneByAngle: Record<AdAngle, string> = {
    [AdAngle.Pain]: `A real ${ind} customer mid-frustration — sighing at a bill, a slow website, a missed appointment. Natural lighting. Text overlay names the pain in plain language. Cut to relief: same person, calm, after using ${s.brand}.`,
    [AdAngle.Roi]: `Side-by-side cost comparison rendered as a clean spreadsheet overlay. Numbers animate up. Avoid stock-photo cliches. Use ${s.brand} brand colors only on the winning column.`,
    [AdAngle.Speed]: `Single continuous shot. A user starts a timer at 00:00 and finishes the entire ${ind} task in ${s.timeToValue}. No cuts. The timer is the proof.`,
    [AdAngle.Proof]: `Real customer talking head (or a credible avatar). On-screen lower third: their first name + city. They name the specific outcome (${s.payoff}). No exaggerated music, no swooshes.`,
    [AdAngle.Comparison]: `Clean split-screen: legacy ${ind} workflow on the left, ${s.brand} on the right. Same task. The right side finishes first. Use neutral grays for the left.`,
    [AdAngle.Fear]: `Quiet but tense. A countdown clock, a closing window, a regulatory document. Then: a person hits the CTA and the tension resolves. Avoid red alerts and shrieking music.`,
    [AdAngle.Convenience]: `One pair of hands, one phone screen, three taps. The whole story is the absence of forms, calls, and friction. ASMR-quiet sound design.`,
    [AdAngle.Trust]: `Studio-lit product shot or dashboard render. SOC 2 / certifications visible. Warm, slow camera move. No urgency, no exclamation marks.`,
  };

  const scene = sceneByAngle[angle] ?? sceneByAngle[AdAngle.Trust];

  return `${aspect}. Register: ${register.replace(/_/g, " ")}. ${scene}`;
}

function headlineFor(s: LaunchStrategy, angle: AdAngle): string {
  // Mirrors the copy agent's `headlineDirect` so the visual is reinforced.
  switch (angle) {
    case AdAngle.Pain:
      return `Stop ${s.painPoint.toLowerCase()} for good`;
    case AdAngle.Roi:
      return `${s.payoff} with ${s.brand}`;
    case AdAngle.Speed:
      return `Live in ${s.timeToValue}`;
    case AdAngle.Proof:
      return `${s.proofPoint} trust ${s.brand}`;
    case AdAngle.Comparison:
      return `${s.brand} vs the rest`;
    case AdAngle.Fear:
      return `Don't wait on ${s.painPoint.toLowerCase()}`;
    case AdAngle.Convenience:
      return `${s.industry} the easy way`;
    case AdAngle.Trust:
    default:
      return `${s.brand}: the safe choice`;
  }
}

function ctaFor(s: LaunchStrategy, _angle: AdAngle): string {
  return s.ctaPrimary || "Learn more";
}

function brandStyleFor(s: LaunchStrategy): BrandStyle {
  // GoFunnelAI house brand defaults. Real brand-kit lookup happens at L2.
  if (s.brand.toLowerCase().includes("gofunnelai")) {
    return {
      primaryColor: "#4F46E5",
      accentColor: "#10B981",
      voice: ["confident", "calm", "specific", "second-person"],
      typography: "Inter (UI) + Söhne (display)",
      logoUsage: "Bottom-right with 16px safe-area padding; never over busy backgrounds.",
    };
  }
  return {
    primaryColor: "#111111",
    accentColor: "#3B82F6",
    voice: ["clear", "honest", "second-person"],
    typography: "System sans (Inter / SF Pro)",
    logoUsage: "Visible but not dominant; safe-area padded.",
  };
}

function requiredAssetsFor(
  platform: Platform,
  angle: AdAngle,
  s: LaunchStrategy,
): RequiredAsset[] {
  const meta = PLATFORM_META[platform];
  const isVideo = meta?.requiresVideoFormat ?? false;

  const baseHero: RequiredAsset = {
    kind: "hero_image",
    aspectRatio: isVideo ? "9:16" : "1:1",
    durationSec: null,
    description: `Hero shot supporting headline "${headlineFor(s, angle)}".`,
    textOverlay: headlineFor(s, angle),
    count: 1,
  };

  const baseLogo: RequiredAsset = {
    kind: "logo_lockup",
    aspectRatio: "1:1",
    durationSec: null,
    description: `${s.brand} logo lockup with safe-area padding for end-frame or corner placement.`,
    textOverlay: null,
    count: 1,
  };

  const angleSpecific: RequiredAsset[] = [];

  if (angle === AdAngle.Pain || angle === AdAngle.Comparison) {
    angleSpecific.push({
      kind: "before_after_split",
      aspectRatio: isVideo ? "9:16" : "1:1",
      durationSec: isVideo ? 6 : null,
      description: `Before/after split. Left: the pain ("${s.painPoint}"). Right: the result ("${s.payoff}"). Honest, non-medical-claim if relevant.`,
      textOverlay: "Before  /  After",
      count: 1,
    });
  }

  if (angle === AdAngle.Proof) {
    angleSpecific.push({
      kind: isVideo ? "talking_head_video" : "lifestyle_image",
      aspectRatio: isVideo ? "9:16" : "4:5",
      durationSec: isVideo ? 20 : null,
      description: `Real customer testimonial. Attribution: first name + city. No paid actors. Plain language.`,
      textOverlay: null,
      count: 1,
    });
  }

  if (angle === AdAngle.Speed || angle === AdAngle.Convenience) {
    angleSpecific.push({
      kind: "screen_record_video",
      aspectRatio: "9:16",
      durationSec: 15,
      description: `Screen recording showing the actual flow from cold start to "${s.payoff}" in ${s.timeToValue}. No cuts.`,
      textOverlay: s.timeToValue,
      count: 1,
    });
  }

  if (angle === AdAngle.Trust) {
    angleSpecific.push({
      kind: "text_overlay_card",
      aspectRatio: "1:1",
      durationSec: null,
      description: `Static card listing certifications + guarantees (SOC 2, GDPR, money-back) in calm typography.`,
      textOverlay: "SOC 2 · GDPR · Money-back guarantee",
      count: 1,
    });
  }

  // Video platforms always need a UGC variant for testing.
  if (isVideo) {
    angleSpecific.push({
      kind: "ugc_video",
      aspectRatio: "9:16",
      durationSec: 20,
      description: `Hand-held, creator-style. Hook in first 3 seconds. Captions burned in.`,
      textOverlay: null,
      count: 1,
    });
  }

  return [baseHero, ...angleSpecific, baseLogo];
}

function complianceNotesFor(industry: string, angle: AdAngle): string[] {
  const notes: string[] = [];
  const ind = industry.toLowerCase();

  // Industry-aware notes that the compliance agent will revalidate.
  if (ind.includes("supplement") || ind.includes("med-spa") || ind.includes("cosmetic")) {
    notes.push("No disease/cure claims. No FDA-implied endorsement.");
    notes.push("Before/after only with documented, typical-results disclaimer.");
  }
  if (ind.includes("solar") || ind.includes("hvac") || ind.includes("roofing")) {
    notes.push("Quantified savings must cite a representative system + assumptions.");
    notes.push("No guaranteed-payback language without a written guarantee on file.");
  }
  if (ind.includes("dental") || ind.includes("chiropractic") || ind.includes("hair-restoration")) {
    notes.push("Patient imagery requires release. No outcome guarantees.");
  }
  if (ind.includes("financial") || ind.includes("insurance") || ind.includes("mortgage")) {
    notes.push("APR / fee disclosures required where rates are shown.");
    notes.push("No 'guaranteed approval' or 'risk-free returns' language.");
  }
  if (ind.includes("law") || ind.includes("legal") || ind.includes("bankruptcy") || ind.includes("dui")) {
    notes.push("Attorney advertising rules apply (state bar). No outcome guarantees. Add 'Attorney Advertising' badge.");
  }

  // Angle-specific.
  if (angle === AdAngle.Fear) {
    notes.push("Fear angle: tension must be real and within prospect's window of agency. No fabricated deadlines.");
  }
  if (angle === AdAngle.Proof) {
    notes.push("Testimonials require attribution + opt-in. No composite testimonials.");
  }
  if (angle === AdAngle.Comparison) {
    notes.push("Named-competitor comparisons must be substantiated and current.");
  }

  return notes;
}

function outputFormatsFor(platform: Platform): CreativeBrief["outputFormats"] {
  switch (platform) {
    case Platform.Meta:
      return [
        { aspectRatio: "1:1", widthPx: 1080, heightPx: 1080, maxFileSizeMb: 30, formats: ["jpg", "png", "mp4"] },
        { aspectRatio: "4:5", widthPx: 1080, heightPx: 1350, maxFileSizeMb: 30, formats: ["jpg", "png", "mp4"] },
        { aspectRatio: "9:16", widthPx: 1080, heightPx: 1920, maxFileSizeMb: 250, formats: ["mp4"] },
      ];
    case Platform.Google:
      return [
        { aspectRatio: "1:1", widthPx: 1200, heightPx: 1200, maxFileSizeMb: 5, formats: ["jpg", "png"] },
        { aspectRatio: "16:9", widthPx: 1200, heightPx: 628, maxFileSizeMb: 5, formats: ["jpg", "png"] },
      ];
    case Platform.LinkedIn:
      return [
        { aspectRatio: "1:1", widthPx: 1200, heightPx: 1200, maxFileSizeMb: 5, formats: ["jpg", "png"] },
        { aspectRatio: "16:9", widthPx: 1200, heightPx: 627, maxFileSizeMb: 5, formats: ["jpg", "png", "mp4"] },
      ];
    case Platform.TikTok:
      return [{ aspectRatio: "9:16", widthPx: 1080, heightPx: 1920, maxFileSizeMb: 500, formats: ["mp4"] }];
    case Platform.YouTube:
      return [{ aspectRatio: "16:9", widthPx: 1920, heightPx: 1080, maxFileSizeMb: 1000, formats: ["mp4"] }];
    case Platform.Snapchat:
      return [{ aspectRatio: "9:16", widthPx: 1080, heightPx: 1920, maxFileSizeMb: 32, formats: ["mp4"] }];
    case Platform.Pinterest:
      return [{ aspectRatio: "4:5", widthPx: 1000, heightPx: 1500, maxFileSizeMb: 20, formats: ["jpg", "png", "mp4"] }];
    case Platform.X:
      return [{ aspectRatio: "16:9", widthPx: 1200, heightPx: 675, maxFileSizeMb: 15, formats: ["jpg", "png", "mp4"] }];
    case Platform.Reddit:
      return [{ aspectRatio: "1:1", widthPx: 1080, heightPx: 1080, maxFileSizeMb: 20, formats: ["jpg", "png", "mp4"] }];
    default:
      return [{ aspectRatio: "1:1", widthPx: 1080, heightPx: 1080, maxFileSizeMb: 10, formats: ["jpg", "png"] }];
  }
}

function fingerprintInputs(s: LaunchStrategy, platform: Platform, angle: AdAngle): string {
  const blob = JSON.stringify({
    b: s.brand,
    i: s.industry,
    a: s.audience,
    pp: s.painPoint,
    py: s.payoff,
    pr: s.proofPoint,
    t: s.timeToValue,
    c: s.ctaPrimary,
    pl: platform,
    an: angle,
  });
  return fnv1a(blob);
}

function fnv1a(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}
