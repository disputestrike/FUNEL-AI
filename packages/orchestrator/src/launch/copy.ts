/**
 * GoFunnelAI — Launch Center: Ad Copy agent.
 *
 * Brand: GoFunnelAI (gofunnelai.com).
 *
 * `runAdCopy(strategy, platform, angle)` produces a platform-shaped
 * `AdVariant` plus a `platformPayload` block whose shape changes per platform:
 *
 *   - meta:     { primaryText[5], headline[5], description[3], cta }
 *   - google:   { headlines[15] (<30 chars), descriptions[4] (<90), pathFragments[2] }
 *   - linkedin: { introText, headline, description, cta }
 *   - tiktok:   { hook (first-3s), bodyScript, cta }
 *
 * Character limits come from `@funnel/shared/launch` `PLATFORM_META`.
 *
 * The function is deterministic for a given (strategy, platform, angle) so
 * tests can snapshot the output and so re-runs of the orchestrator dag don't
 * spuriously change copy. All randomness is seeded off a stable hash of the
 * three inputs.
 *
 * No network calls. No I/O. Pure function over typed inputs — the actual LLM
 * call sits behind this in the production orchestrator; this module is the
 * deterministic / fixture-able shell that the LLM either fills in or
 * approximates when offline.
 */

import {
  AD_ANGLES,
  AdAngle,
  Platform,
  PLATFORM_META,
  type PlatformMeta,
} from "@funnel/shared/launch";

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

/**
 * Minimal `LaunchStrategy` shape this agent needs. The Strategy agent owns the
 * full type — we only declare the subset we read so the two modules can ship
 * independently. Compatible with the structural type any Strategy agent emits.
 */
export interface LaunchStrategy {
  /** Brand the campaign is for (usually "GoFunnelAI" for our own house ads). */
  brand: string;
  /** Industry vertical, e.g. "solar" / "dental" / "supplements". */
  industry: string;
  /** Audience descriptor — short, second-person where possible. */
  audience: string;
  /** Top-line offer summary. */
  offer: string;
  /** The primary value prop / promise. */
  valueProp: string;
  /** Named pain point. Used heavily by `Pain`, `Fear`, `Speed`. */
  painPoint: string;
  /** Quantified payoff (e.g. "save $1,800/yr"). Used by `ROI`, `Comparison`. */
  payoff: string;
  /** Stamped social proof line (e.g. "12,000 homeowners"). Used by `Proof`. */
  proofPoint: string;
  /** Time-to-value claim (e.g. "in under 7 minutes"). */
  timeToValue: string;
  /** Primary CTA verb phrase, e.g. "Get my free savings quote". */
  ctaPrimary: string;
  /** Optional landing-URL path fragments for Google's display URL. */
  urlPath?: { segment1?: string; segment2?: string };
  /** Optional locale (BCP-47). Defaults to "en-US". */
  locale?: string;
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

export interface MetaCopyPayload {
  primaryText: string[]; // up to 5
  headline: string[]; // 5
  description: string[]; // 3
  cta: string;
}

export interface GoogleCopyPayload {
  headlines: string[]; // 15, each <30 chars
  descriptions: string[]; // 4, each <90 chars
  pathFragments: [string, string]; // path1, path2
}

export interface LinkedInCopyPayload {
  introText: string;
  headline: string;
  description: string;
  cta: string;
}

export interface TikTokCopyPayload {
  hook: string; // first 3 seconds
  bodyScript: string;
  cta: string;
}

export type PlatformCopyPayload =
  | { platform: Platform.Meta; payload: MetaCopyPayload }
  | { platform: Platform.Google; payload: GoogleCopyPayload }
  | { platform: Platform.LinkedIn; payload: LinkedInCopyPayload }
  | { platform: Platform.TikTok; payload: TikTokCopyPayload }
  | { platform: Exclude<Platform, Platform.Meta | Platform.Google | Platform.LinkedIn | Platform.TikTok>; payload: GenericCopyPayload };

export interface GenericCopyPayload {
  primaryText: string;
  headline: string;
  description: string | null;
  cta: string;
}

/**
 * The agent's primary return shape. Compatible with the `AdVariant` interface
 * from `@funnel/shared/launch` for the canonical fields, plus the per-platform
 * `platformPayload` so downstream exporters can serialise correctly.
 */
export interface AdCopyVariant {
  platform: Platform;
  angle: AdAngle;
  headline: string;
  primaryText: string;
  description: string | null;
  cta: string;
  language: string;
  /** Per-platform extended copy (multi-variant headlines/descriptions). */
  platformPayload: PlatformCopyPayload;
  /** Char-budget telemetry for the QA gate. */
  characterBudgets: {
    primaryText: { used: number; limit: number; overflow: boolean };
    headline: { used: number; limit: number; overflow: boolean };
    description: { used: number; limit: number | null; overflow: boolean };
  };
  /** Stable hash used for idempotency / cache keys downstream. */
  fingerprint: string;
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Build platform-specific ad copy for a single (strategy, platform, angle)
 * cell. Deterministic.
 */
export function runAdCopy(
  strategy: LaunchStrategy,
  platform: Platform,
  angle: AdAngle,
): AdCopyVariant {
  const meta = PLATFORM_META[platform];
  if (!meta) throw new Error(`Unknown platform: ${String(platform)}`);
  const angleMeta = AD_ANGLES[angle];
  if (!angleMeta) throw new Error(`Unknown angle: ${String(angle)}`);

  const language = strategy.locale ?? "en-US";

  const payload = buildPayloadForPlatform(strategy, platform, angle, meta);
  const canonical = extractCanonical(payload, meta);

  const budgets = {
    primaryText: budget(canonical.primaryText, meta.characterLimits.primaryText),
    headline: budget(canonical.headline, meta.characterLimits.headline),
    description:
      canonical.description != null && meta.characterLimits.description != null
        ? budget(canonical.description, meta.characterLimits.description)
        : { used: canonical.description?.length ?? 0, limit: meta.characterLimits.description, overflow: false },
  };

  return {
    platform,
    angle,
    headline: canonical.headline,
    primaryText: canonical.primaryText,
    description: canonical.description,
    cta: canonical.cta,
    language,
    platformPayload: payload,
    characterBudgets: budgets,
    fingerprint: fingerprintInputs(strategy, platform, angle),
  };
}

// ---------------------------------------------------------------------------
// Platform routers
// ---------------------------------------------------------------------------

function buildPayloadForPlatform(
  strategy: LaunchStrategy,
  platform: Platform,
  angle: AdAngle,
  meta: PlatformMeta,
): PlatformCopyPayload {
  switch (platform) {
    case Platform.Meta:
      return { platform: Platform.Meta, payload: buildMeta(strategy, angle, meta) };
    case Platform.Google:
      return { platform: Platform.Google, payload: buildGoogle(strategy, angle, meta) };
    case Platform.LinkedIn:
      return { platform: Platform.LinkedIn, payload: buildLinkedIn(strategy, angle, meta) };
    case Platform.TikTok:
      return { platform: Platform.TikTok, payload: buildTikTok(strategy, angle, meta) };
    default:
      return {
        platform: platform as Exclude<
          Platform,
          Platform.Meta | Platform.Google | Platform.LinkedIn | Platform.TikTok
        >,
        payload: buildGeneric(strategy, angle, meta),
      };
  }
}

function extractCanonical(p: PlatformCopyPayload, meta: PlatformMeta): {
  primaryText: string;
  headline: string;
  description: string | null;
  cta: string;
} {
  if (p.platform === Platform.Meta) {
    const payload = p.payload as MetaCopyPayload;
    return {
      primaryText: trunc(payload.primaryText[0] ?? "", meta.characterLimits.primaryText),
      headline: trunc(payload.headline[0] ?? "", meta.characterLimits.headline),
      description: trunc(payload.description[0] ?? "", meta.characterLimits.description ?? 0),
      cta: payload.cta,
    };
  }
  if (p.platform === Platform.Google) {
    const payload = p.payload as GoogleCopyPayload;
    return {
      primaryText: trunc(payload.descriptions[0] ?? "", meta.characterLimits.primaryText),
      headline: trunc(payload.headlines[0] ?? "", meta.characterLimits.headline),
      description: trunc(payload.descriptions[0] ?? "", meta.characterLimits.description ?? 0),
      cta: "Learn more",
    };
  }
  if (p.platform === Platform.LinkedIn) {
    const payload = p.payload as LinkedInCopyPayload;
    return {
      primaryText: trunc(payload.introText, meta.characterLimits.primaryText),
      headline: trunc(payload.headline, meta.characterLimits.headline),
      description: trunc(payload.description, meta.characterLimits.description ?? 0),
      cta: payload.cta,
    };
  }
  if (p.platform === Platform.TikTok) {
    const payload = p.payload as TikTokCopyPayload;
    return {
      primaryText: trunc(payload.bodyScript, meta.characterLimits.primaryText),
      headline: trunc(payload.hook, meta.characterLimits.headline),
      description: null,
      cta: payload.cta,
    };
  }
  const payload = p.payload as GenericCopyPayload;
  return {
    primaryText: trunc(payload.primaryText, meta.characterLimits.primaryText),
    headline: trunc(payload.headline, meta.characterLimits.headline),
    description: payload.description == null
      ? null
      : trunc(payload.description, meta.characterLimits.description ?? 0),
    cta: payload.cta,
  };
}

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

function buildMeta(strategy: LaunchStrategy, angle: AdAngle, meta: PlatformMeta): MetaCopyPayload {
  const lim = meta.characterLimits;
  const lines = angleLines(strategy, angle);

  const primaryText = [
    lines.painLead,
    lines.proofLead,
    lines.payoffLead,
    lines.speedLead,
    lines.softLead,
  ]
    .map((l) => trunc(l, lim.primaryText))
    .slice(0, 5);

  const headline = [
    lines.headlineDirect,
    lines.headlineQuestion,
    lines.headlineNumber,
    lines.headlineComparison,
    lines.headlineProof,
  ]
    .map((h) => trunc(h, lim.headline))
    .slice(0, 5);

  const description = [
    lines.descPayoff,
    lines.descRiskFree,
    lines.descLocal,
  ]
    .map((d) => trunc(d, lim.description ?? 30))
    .slice(0, 3);

  return {
    primaryText,
    headline,
    description,
    cta: ctaForAngle(angle, strategy),
  };
}

// ---------------------------------------------------------------------------
// Google Ads — RSA: 15 headlines <30, 4 descriptions <90
// ---------------------------------------------------------------------------

function buildGoogle(strategy: LaunchStrategy, angle: AdAngle, meta: PlatformMeta): GoogleCopyPayload {
  const HEADLINE_LIMIT = Math.min(30, meta.characterLimits.headline);
  const DESC_LIMIT = Math.min(90, meta.characterLimits.description ?? 90);
  const lines = angleLines(strategy, angle);

  const rawHeadlines = [
    lines.headlineDirect,
    lines.headlineNumber,
    lines.headlineProof,
    lines.headlineComparison,
    lines.headlineQuestion,
    `${strategy.brand}: ${strategy.valueProp}`,
    `${strategy.payoff}.`,
    `${strategy.timeToValue}.`,
    `${capitalize(angleMetaTitle(angle))} ${strategy.industry}`,
    `${strategy.ctaPrimary}`,
    `Free ${strategy.industry} quote`,
    `${strategy.industry} that works`,
    `${strategy.proofPoint}`,
    `Local ${strategy.industry} pros`,
    `New: ${strategy.valueProp}`,
  ];

  const headlines = rawHeadlines
    .map((h) => clipToWordBoundary(h, HEADLINE_LIMIT))
    .map((h) => h.trim())
    .map((h) => (h.length === 0 ? `${strategy.brand}` : h))
    .slice(0, 15);

  while (headlines.length < 15) {
    headlines.push(clipToWordBoundary(`${strategy.brand} ${strategy.industry}`, HEADLINE_LIMIT));
  }

  const rawDescriptions = [
    `${lines.painLead} ${strategy.ctaPrimary}.`,
    `${lines.payoffLead} ${strategy.timeToValue}.`,
    `${strategy.proofPoint}. ${strategy.ctaPrimary}.`,
    `${strategy.valueProp}. No long contracts.`,
  ];

  const descriptions = rawDescriptions
    .map((d) => clipToWordBoundary(d, DESC_LIMIT))
    .slice(0, 4);

  const segment1 = sanitizePath(strategy.urlPath?.segment1 ?? strategy.industry);
  const segment2 = sanitizePath(strategy.urlPath?.segment2 ?? angleMetaTitle(angle));

  return {
    headlines,
    descriptions,
    pathFragments: [segment1, segment2],
  };
}

// ---------------------------------------------------------------------------
// LinkedIn
// ---------------------------------------------------------------------------

function buildLinkedIn(strategy: LaunchStrategy, angle: AdAngle, meta: PlatformMeta): LinkedInCopyPayload {
  const lim = meta.characterLimits;
  const lines = angleLines(strategy, angle);

  // LinkedIn audience is more rational — lead with payoff + proof.
  const intro = `${lines.proofLead} ${strategy.valueProp}.`;
  const headline = lines.headlineProof;
  const description = `${strategy.payoff}. ${strategy.ctaPrimary}.`;

  return {
    introText: trunc(intro, lim.primaryText),
    headline: trunc(headline, lim.headline),
    description: trunc(description, lim.description ?? 100),
    cta: ctaForAngle(angle, strategy),
  };
}

// ---------------------------------------------------------------------------
// TikTok
// ---------------------------------------------------------------------------

function buildTikTok(strategy: LaunchStrategy, angle: AdAngle, meta: PlatformMeta): TikTokCopyPayload {
  const lim = meta.characterLimits;
  const lines = angleLines(strategy, angle);

  // First 3 seconds: short, jarring, second-person.
  const hook =
    angle === AdAngle.Pain
      ? `POV: ${strategy.painPoint}.`
      : angle === AdAngle.Speed
        ? `In ${strategy.timeToValue}? No way.`
        : angle === AdAngle.Proof
          ? `${strategy.proofPoint} can't all be wrong.`
          : `Wait — ${strategy.valueProp.toLowerCase()}?`;

  const body =
    `Here's the thing: ${strategy.painPoint.toLowerCase()}. ` +
    `${strategy.brand} fixes it ${strategy.timeToValue.toLowerCase()}. ` +
    `${strategy.payoff}. Link in bio.`;

  return {
    hook: trunc(hook, lim.headline),
    bodyScript: trunc(body, lim.primaryText),
    cta: ctaForAngle(angle, strategy),
  };
}

// ---------------------------------------------------------------------------
// Generic (YouTube / X / Snap / Pinterest / Reddit)
// ---------------------------------------------------------------------------

function buildGeneric(strategy: LaunchStrategy, angle: AdAngle, meta: PlatformMeta): GenericCopyPayload {
  const lim = meta.characterLimits;
  const lines = angleLines(strategy, angle);
  return {
    primaryText: trunc(lines.payoffLead, lim.primaryText),
    headline: trunc(lines.headlineDirect, lim.headline),
    description: lim.description == null ? null : trunc(lines.descPayoff, lim.description),
    cta: ctaForAngle(angle, strategy),
  };
}

// ---------------------------------------------------------------------------
// Angle line bank — every angle produces the same shape of building blocks.
// ---------------------------------------------------------------------------

interface AngleLines {
  painLead: string;
  proofLead: string;
  payoffLead: string;
  speedLead: string;
  softLead: string;
  headlineDirect: string;
  headlineQuestion: string;
  headlineNumber: string;
  headlineComparison: string;
  headlineProof: string;
  descPayoff: string;
  descRiskFree: string;
  descLocal: string;
}

function angleLines(s: LaunchStrategy, angle: AdAngle): AngleLines {
  const brand = s.brand;
  const ind = s.industry;
  const pain = s.painPoint;
  const payoff = s.payoff;
  const proof = s.proofPoint;
  const time = s.timeToValue;
  const value = s.valueProp;

  switch (angle) {
    case AdAngle.Pain:
      return {
        painLead: `Tired of ${pain.toLowerCase()}? You are not alone.`,
        proofLead: `${proof} stopped fighting ${pain.toLowerCase()} with ${brand}.`,
        payoffLead: `Stop ${pain.toLowerCase()}. Start ${payoff.toLowerCase()}.`,
        speedLead: `In ${time}, ${brand} replaces ${pain.toLowerCase()}.`,
        softLead: `If ${pain.toLowerCase()} sounds familiar, this is for you.`,
        headlineDirect: `Stop ${pain.toLowerCase()} for good`,
        headlineQuestion: `Still stuck with ${pain.toLowerCase()}?`,
        headlineNumber: `${payoff} — no more ${pain.toLowerCase()}`,
        headlineComparison: `${pain} vs. ${brand}`,
        headlineProof: `${proof} chose to stop ${pain.toLowerCase()}`,
        descPayoff: `${brand} fixes ${pain.toLowerCase()} fast.`,
        descRiskFree: `Try free. No contracts.`,
        descLocal: `Trusted by local ${ind} buyers.`,
      };

    case AdAngle.Roi:
      return {
        painLead: `Doing the math on ${ind}? Run our numbers first.`,
        proofLead: `${proof} ran the numbers. ${payoff}.`,
        payoffLead: `${payoff}. See the line items.`,
        speedLead: `${payoff} in ${time}.`,
        softLead: `Quiet math, loud savings: ${payoff}.`,
        headlineDirect: `${payoff} with ${brand}`,
        headlineQuestion: `Worth ${payoff}?`,
        headlineNumber: `${payoff} per year`,
        headlineComparison: `${brand} vs status quo: ${payoff}`,
        headlineProof: `${proof} hit ${payoff}`,
        descPayoff: `Quantified payoff: ${payoff}.`,
        descRiskFree: `Money-back if you don't see the math work.`,
        descLocal: `Local ${ind} pricing baked in.`,
      };

    case AdAngle.Speed:
      return {
        painLead: `Sick of waiting weeks for ${ind} quotes?`,
        proofLead: `${proof} got results in ${time}.`,
        payoffLead: `${value} — live in ${time}.`,
        speedLead: `${time}. Not ${time.toLowerCase().includes("min") ? "weeks" : "months"}.`,
        softLead: `Faster than you'd guess: ${time}.`,
        headlineDirect: `Live in ${time}`,
        headlineQuestion: `Why wait? ${time} is enough`,
        headlineNumber: `${time} to first result`,
        headlineComparison: `${time} vs the old way`,
        headlineProof: `${proof} did it in ${time}`,
        descPayoff: `${value}. ${time}.`,
        descRiskFree: `No setup, no contracts.`,
        descLocal: `Available in your area.`,
      };

    case AdAngle.Proof:
      return {
        painLead: `Wondering if ${brand} works for ${ind}? Look at the receipts.`,
        proofLead: `${proof} can't be wrong.`,
        payoffLead: `${proof} reached ${payoff} with ${brand}.`,
        speedLead: `Most hit results in ${time}.`,
        softLead: `Receipts > promises.`,
        headlineDirect: `${proof} trust ${brand}`,
        headlineQuestion: `${proof} can't all be wrong, right?`,
        headlineNumber: `${proof} and counting`,
        headlineComparison: `${brand} > alternatives, say ${proof}`,
        headlineProof: `${proof} verified results`,
        descPayoff: `${proof} hit ${payoff} on average.`,
        descRiskFree: `Real reviews. Real numbers.`,
        descLocal: `Local ${ind} customers represented.`,
      };

    case AdAngle.Comparison:
      return {
        painLead: `Comparing ${ind}? Here's what others miss.`,
        proofLead: `${proof} switched and saw ${payoff}.`,
        payoffLead: `Same ${ind}. Better ${payoff}.`,
        speedLead: `Faster than the legacy way — ${time}.`,
        softLead: `Side-by-side, ${brand} just wins.`,
        headlineDirect: `${brand} vs the rest`,
        headlineQuestion: `Why settle for less ${payoff}?`,
        headlineNumber: `${payoff} more than the legacy approach`,
        headlineComparison: `${brand} vs status quo`,
        headlineProof: `${proof} chose ${brand}`,
        descPayoff: `Apples-to-apples: ${payoff}.`,
        descRiskFree: `Switching is free. Keep what works.`,
        descLocal: `Local ${ind} comparison sheet inside.`,
      };

    case AdAngle.Fear:
      return {
        painLead: `${pain} is getting worse. Don't wait.`,
        proofLead: `${proof} already moved. Have you?`,
        payoffLead: `Lock in ${payoff} before the window closes.`,
        speedLead: `${time} window. Then it's gone.`,
        softLead: `A small move now. Big regret avoided.`,
        headlineDirect: `Don't wait on ${pain.toLowerCase()}`,
        headlineQuestion: `Still stuck with ${pain.toLowerCase()}?`,
        headlineNumber: `${time} left to lock ${payoff}`,
        headlineComparison: `${pain} vs ${brand}: pick now`,
        headlineProof: `${proof} already locked it in`,
        descPayoff: `Lock ${payoff} before ${pain.toLowerCase()} costs more.`,
        descRiskFree: `Cancel anytime — no penalty.`,
        descLocal: `Local availability shrinking.`,
      };

    case AdAngle.Convenience:
      return {
        painLead: `Skip the ${ind} runaround.`,
        proofLead: `${proof} liked how easy it was.`,
        payoffLead: `Click. Done. ${payoff}.`,
        speedLead: `${time}. Zero setup.`,
        softLead: `Quietly easy. That's the whole pitch.`,
        headlineDirect: `${ind} the easy way`,
        headlineQuestion: `What if ${ind} was simple?`,
        headlineNumber: `One click. ${payoff}.`,
        headlineComparison: `Easier than the legacy way`,
        headlineProof: `${proof} loved how easy it was`,
        descPayoff: `${value}. No forms, no calls.`,
        descRiskFree: `Try free. Cancel anytime.`,
        descLocal: `Local ${ind} options, instantly.`,
      };

    case AdAngle.Trust:
    default:
      return {
        painLead: `Putting your ${ind} budget on the line? Choose carefully.`,
        proofLead: `${proof} chose ${brand}. So can you.`,
        payoffLead: `${payoff}, backed by guarantee.`,
        speedLead: `${time} to confidence.`,
        softLead: `Calm, certified, and quietly excellent.`,
        headlineDirect: `${brand}: the safe choice`,
        headlineQuestion: `Need a ${ind} partner you can trust?`,
        headlineNumber: `${proof} trust ${brand}`,
        headlineComparison: `${brand} vs unverified alternatives`,
        headlineProof: `${proof} verified results`,
        descPayoff: `${payoff}, with a money-back guarantee.`,
        descRiskFree: `Money-back. Audit-ready.`,
        descLocal: `Locally licensed ${ind} providers.`,
      };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ctaForAngle(angle: AdAngle, s: LaunchStrategy): string {
  if (s.ctaPrimary && s.ctaPrimary.length <= 32) return s.ctaPrimary;
  switch (angle) {
    case AdAngle.Pain:
    case AdAngle.Fear:
      return "Get help now";
    case AdAngle.Roi:
    case AdAngle.Comparison:
      return "See the savings";
    case AdAngle.Speed:
    case AdAngle.Convenience:
      return "Get started";
    case AdAngle.Proof:
      return "See real results";
    case AdAngle.Trust:
    default:
      return "Learn more";
  }
}

function angleMetaTitle(angle: AdAngle): string {
  return AD_ANGLES[angle]?.title ?? String(angle);
}

function trunc(s: string, limit: number): string {
  if (s.length <= limit) return s;
  // Drop a trailing word so we don't cut mid-word.
  const sliced = s.slice(0, limit);
  const lastSpace = sliced.lastIndexOf(" ");
  return (lastSpace > Math.floor(limit * 0.6) ? sliced.slice(0, lastSpace) : sliced).trim();
}

function clipToWordBoundary(s: string, limit: number): string {
  if (s.length <= limit) return s;
  const sliced = s.slice(0, limit);
  const lastSpace = sliced.lastIndexOf(" ");
  return (lastSpace > 0 ? sliced.slice(0, lastSpace) : sliced).trim();
}

function budget(text: string, limit: number): { used: number; limit: number; overflow: boolean } {
  return { used: text.length, limit, overflow: text.length > limit };
}

function sanitizePath(seg: string): string {
  return seg
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 15);
}

function capitalize(s: string): string {
  return s.length === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1);
}

function fingerprintInputs(s: LaunchStrategy, platform: Platform, angle: AdAngle): string {
  const blob = JSON.stringify({
    b: s.brand,
    i: s.industry,
    a: s.audience,
    o: s.offer,
    v: s.valueProp,
    pp: s.painPoint,
    py: s.payoff,
    pr: s.proofPoint,
    t: s.timeToValue,
    c: s.ctaPrimary,
    pl: platform,
    an: angle,
    lo: s.locale ?? "en-US",
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
