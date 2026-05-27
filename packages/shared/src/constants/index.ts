/**
 * Barrel for `@funnel/shared/constants`.
 *
 * The first block of exports is the GoFunnelAI platform-wide catalog
 * (industries, languages, countries, plans, brand tokens, personas). The
 * second block preserves the legacy `brand.ts` plus the Funnel Grader
 * constants â€” kept here so the grader app continues to import unchanged.
 */

export * from "./industries.js";
export * from "./languages.js";
export * from "./countries.js";
export * from "./plans.js";
// `cloneBrandTokens` + `FUNNEL_BRAND_TOKENS` (funnel-schema-shaped brand tokens).
export * from "./brand-tokens.js";
export * from "./personas.js";

// ---- Legacy Funnel Grader constants -------------------------------------
//
// `brand.ts` exports its own `BRAND_TOKENS` (flat, grader-shaped). It's kept
// for backwards compatibility with the grader app. The funnel-schema-shaped
// equivalent is `FUNNEL_BRAND_TOKENS` from `./brand-tokens.js`.

export * from "./brand.js";

/** Models used by the Funnel Grader agent fleet. */
export const MODELS = {
  /** Sonnet 4.6 â€” primary scoring agent (hook, form, trust). Vision-capable. */
  SONNET: "claude-sonnet-4-5",
  /** Haiku 4.5 â€” fast / cheap deterministic agents (speed, compliance). */
  HAIKU: "claude-haiku-4-5",
  /** Opus reserved for full-product funnel generation (not used in Grader). */
  OPUS: "claude-opus-4-1",
} as const;

/** Per-agent weight contribution to the overall score (sums to 1.0). */
export const SCORE_WEIGHTS = {
  hook: 0.3,
  form: 0.2,
  trust: 0.2,
  speed: 0.15,
  compliance: 0.15,
} as const;

/** Layered rate limits. */
export const RATE_LIMITS = {
  /** Per-IP audits per hour. */
  PER_IP_HOURLY: 5,
  /** Per-target-domain audits per day. */
  PER_DOMAIN_DAILY: 50,
  /** Per-IP audits per 24h (hard daily limit). */
  PER_IP_DAILY: 20,
  /** Per-IP preview generations per 24h. */
  PER_IP_PREVIEW_DAILY: 3,
} as const;

/** Hard cost caps. */
export const COST_CAPS = {
  /** Max cents per audit before we fail gracefully. */
  AUDIT_MAX_CENTS: 10,
  /** Max cents per preview generation. */
  PREVIEW_MAX_CENTS: 40,
  /** Daily company-wide budget (USD cents). */
  DAILY_BUDGET_CENTS: 40_000,
  /** Hard daily cutoff (USD cents). */
  DAILY_HARD_CAP_CENTS: 100_000,
} as const;

/** Default viewport for screenshots. */
export const VIEWPORT = { w: 1440, h: 900 } as const;

/** Letter-grade thresholds. */
export const GRADE_THRESHOLDS = [
  { min: 95, grade: "A+" as const },
  { min: 90, grade: "A" as const },
  { min: 80, grade: "B" as const },
  { min: 70, grade: "C" as const },
  { min: 60, grade: "D" as const },
  { min: 0, grade: "F" as const },
];

/** Competitor slugs for programmatic SEO `/grade/vs/[competitor]` pages. */
export const COMPETITORS = [
  "clickfunnels",
  "leadpages",
  "unbounce",
  "instapage",
  "funnelytics",
  "landingi",
] as const;

export type CompetitorSlug = (typeof COMPETITORS)[number];

/** SSE channel name. */
export const SSE_AUDIT_CHANNEL = "audit-events";

/** Where audit screenshots/PDFs/previews live in R2. */
export const R2_PATHS = {
  screenshot: (auditId: string) => `screenshots/${auditId}.png`,
  pdf: (auditId: string) => `pdfs/${auditId}.pdf`,
  preview: (auditId: string) => `previews/${auditId}.html`,
  og: (auditId: string) => `og/${auditId}.png`,
} as const;
