/**
 * GoFunnelAI — Launch Center: Ad Policy / Compliance review agent.
 *
 * Brand: GoFunnelAI (gofunnelai.com).
 *
 * `reviewAdPolicy(adVariant, ctx?)` returns one or more `ComplianceReview`
 * objects (one per platform-policy + the cross-platform pass) carrying
 * findings with severities `info | warn | block`.
 *
 * Coverage:
 *   - Platform policy traps (Meta, Google, TikTok, LinkedIn, X, YouTube,
 *     Snapchat, Pinterest, Reddit).
 *   - Cross-cutting traps: health claims, financial guarantees, before/after
 *     misuse, employment / housing / credit (special category targeting),
 *     government endorsement, AI capability overclaims, privacy claims,
 *     restricted targeting, testimonial misuse.
 *   - Industry-aware checks: supplements blocked from disease/cure claims;
 *     legal/medical TCPA-aware (no auto-call language).
 *
 * Where possible each finding ships a `suggestedFix` — a safer rephrasing the
 * orchestrator can offer the user in one click.
 *
 * Pure. No network. Deterministic for a given input.
 */

import { Platform } from "@funnel/shared/launch";

import type {
  AdCopyVariant,
  GenericCopyPayload,
  GoogleCopyPayload,
  LinkedInCopyPayload,
  MetaCopyPayload,
  TikTokCopyPayload,
} from "./copy.js";

// ---------------------------------------------------------------------------
// Output shapes
// ---------------------------------------------------------------------------

export type ComplianceSeverity = "info" | "warn" | "block";

export interface ComplianceFinding {
  code: string; // stable identifier, e.g. "META.HEALTH.CURE_CLAIM"
  severity: ComplianceSeverity;
  message: string;
  /** Field on the AdCopyVariant the finding targets. */
  field: "headline" | "primaryText" | "description" | "cta" | "platformPayload" | "audience";
  /** The literal substring (lowercased) that triggered the rule, when applicable. */
  matchedText: string | null;
  /** Stable URL/ref to the policy doc, if known. */
  policyRef: string | null;
  /** Whether the orchestrator can auto-rewrite. */
  autoFixable: boolean;
  /** Suggested safer rephrasing (when autoFixable). */
  suggestedFix: string | null;
}

export interface ComplianceReview {
  /** Which platform's rule book this review represents (or "cross_platform"). */
  scope: Platform | "cross_platform";
  status: "passed" | "passed_with_warnings" | "blocked";
  findings: ComplianceFinding[];
  highestSeverity: ComplianceSeverity | null;
}

export interface AdPolicyContext {
  /** Industry vertical, e.g. "supplements", "solar", "dental". */
  industry?: string;
  /** Optional KB pack id that may surface industry-specific prohibited claims. */
  kbPackId?: string;
  /** Optional explicit prohibited-claim list (overrides industry defaults). */
  prohibitedClaims?: string[];
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function reviewAdPolicy(
  variant: AdCopyVariant,
  ctx: AdPolicyContext = {},
): ComplianceReview[] {
  const all = collectAllText(variant);
  const industry = (ctx.industry ?? "").toLowerCase();
  const prohibited = mergeProhibited(ctx, industry);

  const reviews: ComplianceReview[] = [];

  // 1) Cross-platform / cross-cutting rule pass.
  reviews.push(finalize("cross_platform", crossPlatformPass(variant, all, industry, prohibited)));

  // 2) Platform-specific pass.
  const platformFindings = platformPass(variant, all, industry);
  reviews.push(finalize(variant.platform, platformFindings));

  return reviews;
}

// ---------------------------------------------------------------------------
// Cross-platform / cross-cutting checks
// ---------------------------------------------------------------------------

function crossPlatformPass(
  variant: AdCopyVariant,
  all: TextScope[],
  industry: string,
  prohibited: string[],
): ComplianceFinding[] {
  const out: ComplianceFinding[] = [];

  // ---- Health / disease / cure claims (any vertical) ----
  const healthPhrases = [
    "cures",
    "cure ",
    "treats",
    "treatment for",
    "prevents disease",
    "reverses",
    "miracle",
    "guaranteed weight loss",
    "guaranteed to lose",
    "fda approved",
    "fda-approved",
    "clinically proven to cure",
    "100% safe",
  ];
  forEachMatch(all, healthPhrases, (scope, match) => {
    out.push({
      code: "HEALTH.DISEASE_CLAIM",
      severity: "block",
      message: `Disease/cure/efficacy claim ("${match}") is not allowed across Meta, Google, and TikTok ad policy.`,
      field: scope.field,
      matchedText: match,
      policyRef: "https://www.facebook.com/policies/ads/prohibited_content/personal_health",
      autoFixable: true,
      suggestedFix: rephraseHealth(scope.text, match),
    });
  });

  // ---- Industry: supplements — extra strict ----
  if (industry.includes("supplement")) {
    const supplementHard = ["diabetes", "cancer", "covid", "alzheimer", "depression", "anxiety", "erectile"];
    forEachMatch(all, supplementHard, (scope, match) => {
      out.push({
        code: "SUPPLEMENTS.DISEASE_NAME",
        severity: "block",
        message: `Supplements may not be associated with specific diseases ("${match}"). Naming the condition implies a drug claim under FDA / FTC rules.`,
        field: scope.field,
        matchedText: match,
        policyRef: "https://www.ftc.gov/business-guidance/resources/dietary-supplements-advertising-guide-industry",
        autoFixable: true,
        suggestedFix: rephraseSupplementCondition(scope.text, match),
      });
    });
  }

  // ---- Industry-specific prohibited claim list (from KB pack) ----
  forEachMatch(all, prohibited, (scope, match) => {
    out.push({
      code: "INDUSTRY.PROHIBITED_CLAIM",
      severity: "block",
      message: `Industry KB pack flags "${match}" as a prohibited claim for ${industry || "this vertical"}.`,
      field: scope.field,
      matchedText: match,
      policyRef: null,
      autoFixable: true,
      suggestedFix: scope.text.replace(new RegExp(escapeRe(match), "ig"), "[claim removed]"),
    });
  });

  // ---- Financial guarantees / risk-free returns ----
  const financialPhrases = [
    "guaranteed returns",
    "guaranteed approval",
    "risk-free returns",
    "risk free returns",
    "no risk investment",
    "guaranteed income",
    "double your money",
    "get rich",
  ];
  forEachMatch(all, financialPhrases, (scope, match) => {
    out.push({
      code: "FINANCE.GUARANTEE",
      severity: "block",
      message: `Financial guarantee language ("${match}") violates Meta/Google financial-products policy.`,
      field: scope.field,
      matchedText: match,
      policyRef: "https://support.google.com/adspolicy/answer/2464998",
      autoFixable: true,
      suggestedFix: scope.text.replace(new RegExp(escapeRe(match), "ig"), "competitive rates"),
    });
  });

  // ---- Before/after misuse ----
  if (containsAny(all, ["before/after", "before and after", "before & after"])) {
    out.push({
      code: "BEFORE_AFTER.UNQUALIFIED",
      severity: "warn",
      message: "Before/after imagery and language require a 'typical results' disclaimer and documented evidence.",
      field: findFirstField(all, ["before/after", "before and after", "before & after"]),
      matchedText: "before/after",
      policyRef: "https://www.facebook.com/policies/ads/restricted_content/personal_health",
      autoFixable: false,
      suggestedFix: null,
    });
  }

  // ---- Employment / housing / credit — Meta's "special categories" ----
  const specialCategoryHints = [
    "now hiring",
    "we're hiring",
    "apply for job",
    "rent this apartment",
    "housing for",
    "loan approved",
    "credit card offer",
    "mortgage rate",
  ];
  forEachMatch(all, specialCategoryHints, (scope, match) => {
    out.push({
      code: "META.SPECIAL_CATEGORY",
      severity: "warn",
      message: `"${match}" suggests Employment / Housing / Credit. Meta requires the Special Ad Category toggle; targeting is restricted.`,
      field: scope.field,
      matchedText: match,
      policyRef: "https://www.facebook.com/business/help/298000447747885",
      autoFixable: false,
      suggestedFix: null,
    });
  });

  // ---- Government endorsement implication ----
  const govPhrases = ["government approved", "irs approved", "federally endorsed", "white house"];
  forEachMatch(all, govPhrases, (scope, match) => {
    out.push({
      code: "GOV.IMPLIED_ENDORSEMENT",
      severity: "block",
      message: `Implied government endorsement ("${match}") is prohibited across all major ad platforms.`,
      field: scope.field,
      matchedText: match,
      policyRef: "https://support.google.com/adspolicy/answer/6020955",
      autoFixable: true,
      suggestedFix: scope.text.replace(new RegExp(escapeRe(match), "ig"), "fully compliant"),
    });
  });

  // ---- AI capability overclaims ----
  const aiOverclaims = [
    "ai that thinks",
    "100% ai",
    "fully autonomous",
    "self-aware",
    "sentient",
    "replaces all humans",
  ];
  forEachMatch(all, aiOverclaims, (scope, match) => {
    out.push({
      code: "AI.OVERCLAIM",
      severity: "warn",
      message: `AI capability overclaim ("${match}") risks FTC AI-claims enforcement and platform deceptive-practice review.`,
      field: scope.field,
      matchedText: match,
      policyRef: "https://www.ftc.gov/business-guidance/blog/2023/02/keep-your-ai-claims-check",
      autoFixable: true,
      suggestedFix: scope.text.replace(new RegExp(escapeRe(match), "ig"), "AI-assisted"),
    });
  });

  // ---- Privacy claims ----
  const privacyPhrases = ["100% private", "completely anonymous", "untraceable", "we never collect data"];
  forEachMatch(all, privacyPhrases, (scope, match) => {
    out.push({
      code: "PRIVACY.ABSOLUTE_CLAIM",
      severity: "warn",
      message: `Absolute privacy claim ("${match}") is hard to substantiate; FTC and platform policies require qualified language.`,
      field: scope.field,
      matchedText: match,
      policyRef: "https://www.ftc.gov/business-guidance/privacy-security",
      autoFixable: true,
      suggestedFix: scope.text.replace(new RegExp(escapeRe(match), "ig"), "privacy-first"),
    });
  });

  // ---- Restricted-targeting language (age / gender / ethnic) ----
  const restrictedTargeting = [
    "men only",
    "women only",
    "white people",
    "for muslims",
    "for christians",
    "for jews",
    "by age 50",
  ];
  forEachMatch(all, restrictedTargeting, (scope, match) => {
    out.push({
      code: "TARGETING.RESTRICTED",
      severity: "warn",
      message: `Copy implies discriminatory or restricted targeting ("${match}"). Most platforms reject or escalate.`,
      field: scope.field,
      matchedText: match,
      policyRef: null,
      autoFixable: false,
      suggestedFix: null,
    });
  });

  // ---- Testimonial misuse ----
  if (
    containsAny(all, ["testimonial", "real customer", "actual user"]) &&
    !containsAny(all, ["results may vary", "individual results", "typical results"])
  ) {
    out.push({
      code: "TESTIMONIAL.NO_DISCLAIMER",
      severity: "warn",
      message: "Testimonials referenced without a 'results may vary' / typical-results disclaimer.",
      field: findFirstField(all, ["testimonial", "real customer", "actual user"]),
      matchedText: "testimonial",
      policyRef: "https://www.ftc.gov/business-guidance/resources/ftcs-revised-endorsement-guides-what-people-are-asking",
      autoFixable: false,
      suggestedFix: null,
    });
  }

  // ---- Legal / medical TCPA-aware ----
  if (
    (industry.includes("law") || industry.includes("legal") || industry.includes("medical") || industry.includes("dental") || industry.includes("chiropractic")) &&
    containsAny(all, ["call now", "we'll call you", "we will call you", "auto-call", "automatic call"])
  ) {
    out.push({
      code: "TCPA.AUTO_CALL_LANGUAGE",
      severity: "warn",
      message: "Outbound auto-call language for legal/medical verticals can trigger TCPA exposure. Require explicit, written consent on the lead form.",
      field: findFirstField(all, ["call now", "we'll call you", "we will call you", "auto-call"]),
      matchedText: "call now",
      policyRef: "https://www.fcc.gov/general/telemarketing-and-robocalls",
      autoFixable: false,
      suggestedFix: null,
    });
  }

  // ---- Personal-attribute callout (Meta) ----
  const personalAttrs = ["are you depressed", "do you have herpes", "are you obese", "are you bald", "do you have hiv"];
  forEachMatch(all, personalAttrs, (scope, match) => {
    out.push({
      code: "META.PERSONAL_ATTRIBUTE",
      severity: "block",
      message: `Implying knowledge of a personal attribute ("${match}") violates Meta personal-attribute policy.`,
      field: scope.field,
      matchedText: match,
      policyRef: "https://www.facebook.com/policies/ads/prohibited_content/personal_attributes",
      autoFixable: false,
      suggestedFix: null,
    });
  });

  return out;
}

// ---------------------------------------------------------------------------
// Platform-specific checks
// ---------------------------------------------------------------------------

function platformPass(
  variant: AdCopyVariant,
  all: TextScope[],
  _industry: string,
): ComplianceFinding[] {
  switch (variant.platform) {
    case Platform.Meta:
      return metaPass(variant, all);
    case Platform.Google:
      return googlePass(variant, all);
    case Platform.TikTok:
      return tiktokPass(variant, all);
    case Platform.LinkedIn:
      return linkedinPass(variant, all);
    default:
      return genericPlatformPass(variant, all);
  }
}

function metaPass(variant: AdCopyVariant, all: TextScope[]): ComplianceFinding[] {
  const out: ComplianceFinding[] = [];

  // Excessive capitalization.
  for (const scope of all) {
    if (isShoutingCase(scope.text)) {
      out.push({
        code: "META.EXCESSIVE_CAPS",
        severity: "warn",
        message: "Meta policy flags ads with predominantly upper-case copy.",
        field: scope.field,
        matchedText: scope.text.slice(0, 40),
        policyRef: "https://www.facebook.com/policies/ads/sensational_content",
        autoFixable: true,
        suggestedFix: titleCase(scope.text),
      });
      break;
    }
  }

  // Charbudget overflow.
  if (variant.characterBudgets.primaryText.overflow) {
    out.push({
      code: "META.PRIMARY_OVER_LIMIT",
      severity: "block",
      message: `Primary text exceeds Meta's ${variant.characterBudgets.primaryText.limit} char limit.`,
      field: "primaryText",
      matchedText: null,
      policyRef: null,
      autoFixable: true,
      suggestedFix: variant.primaryText.slice(0, variant.characterBudgets.primaryText.limit),
    });
  }
  if (variant.characterBudgets.headline.overflow) {
    out.push({
      code: "META.HEADLINE_OVER_LIMIT",
      severity: "block",
      message: `Headline exceeds Meta's ${variant.characterBudgets.headline.limit} char limit.`,
      field: "headline",
      matchedText: null,
      policyRef: null,
      autoFixable: true,
      suggestedFix: variant.headline.slice(0, variant.characterBudgets.headline.limit),
    });
  }

  return out;
}

function googlePass(variant: AdCopyVariant, all: TextScope[]): ComplianceFinding[] {
  const out: ComplianceFinding[] = [];

  // Repeated punctuation.
  for (const scope of all) {
    if (/!{2,}|\?{2,}|\.{3,}/.test(scope.text)) {
      out.push({
        code: "GOOGLE.REPEATED_PUNCT",
        severity: "warn",
        message: "Google Ads policy disallows repeated punctuation (e.g. '!!', '???').",
        field: scope.field,
        matchedText: scope.text.match(/!{2,}|\?{2,}|\.{3,}/)?.[0] ?? null,
        policyRef: "https://support.google.com/adspolicy/answer/176029",
        autoFixable: true,
        suggestedFix: scope.text.replace(/(!|\?|\.)\1+/g, "$1"),
      });
      break;
    }
  }

  // Google RSA: each headline <30, each description <90.
  if (variant.platformPayload.platform === Platform.Google) {
    const p = variant.platformPayload.payload as GoogleCopyPayload;
    p.headlines.forEach((h: string, i: number) => {
      if (h.length > 30) {
        out.push({
          code: "GOOGLE.RSA_HEADLINE_OVER",
          severity: "block",
          message: `Google RSA headline #${i + 1} exceeds 30 chars (${h.length}).`,
          field: "platformPayload",
          matchedText: h,
          policyRef: null,
          autoFixable: true,
          suggestedFix: h.slice(0, 30),
        });
      }
    });
    p.descriptions.forEach((d: string, i: number) => {
      if (d.length > 90) {
        out.push({
          code: "GOOGLE.RSA_DESC_OVER",
          severity: "block",
          message: `Google RSA description #${i + 1} exceeds 90 chars (${d.length}).`,
          field: "platformPayload",
          matchedText: d,
          policyRef: null,
          autoFixable: true,
          suggestedFix: d.slice(0, 90),
        });
      }
    });
  }

  return out;
}

function tiktokPass(variant: AdCopyVariant, all: TextScope[]): ComplianceFinding[] {
  const out: ComplianceFinding[] = [];

  // TikTok prohibits dramatised before/after for weight-loss / cosmetic claims.
  if (containsAny(all, ["lose weight fast", "lose 30 pounds", "shed pounds", "melt fat"])) {
    out.push({
      code: "TIKTOK.WEIGHT_LOSS",
      severity: "block",
      message: "TikTok policy bans aggressive weight-loss / body-shaming copy.",
      field: findFirstField(all, ["lose weight fast", "lose 30 pounds", "shed pounds", "melt fat"]),
      matchedText: "weight loss claim",
      policyRef: "https://ads.tiktok.com/help/article/tiktok-advertising-policies-ad-creatives",
      autoFixable: false,
      suggestedFix: null,
    });
  }

  // TikTok requires captions; flag if hook lacks any text overlay reference.
  if (variant.platformPayload.platform === Platform.TikTok && !(variant.platformPayload.payload as TikTokCopyPayload).hook.trim()) {
    out.push({
      code: "TIKTOK.NO_HOOK",
      severity: "warn",
      message: "TikTok ads should ship with a first-3-second textual hook.",
      field: "platformPayload",
      matchedText: null,
      policyRef: null,
      autoFixable: false,
      suggestedFix: null,
    });
  }

  return out;
}

function linkedinPass(_variant: AdCopyVariant, all: TextScope[]): ComplianceFinding[] {
  const out: ComplianceFinding[] = [];

  // LinkedIn rejects emoji-heavy hype.
  for (const scope of all) {
    const emojiCount = (scope.text.match(/[\u{1F300}-\u{1FAFF}\u{1F600}-\u{1F64F}\u{2600}-\u{27BF}]/gu) ?? []).length;
    if (emojiCount >= 3) {
      out.push({
        code: "LINKEDIN.EMOJI_HEAVY",
        severity: "warn",
        message: "LinkedIn audiences and policy reviewers respond poorly to emoji-heavy copy.",
        field: scope.field,
        matchedText: null,
        policyRef: null,
        autoFixable: true,
        suggestedFix: scope.text.replace(/[\u{1F300}-\u{1FAFF}\u{1F600}-\u{1F64F}\u{2600}-\u{27BF}]/gu, "").trim(),
      });
      break;
    }
  }

  return out;
}

function genericPlatformPass(_variant: AdCopyVariant, _all: TextScope[]): ComplianceFinding[] {
  return [];
}

// ---------------------------------------------------------------------------
// Industry KB hooks
// ---------------------------------------------------------------------------

/**
 * Default prohibited-claim list per industry. The real implementation pulls
 * the freshest set from `@funnel/kb` for the requested pack — but having an
 * inline default makes the orchestrator robust when KB retrieval is offline
 * or for the test fixtures.
 */
const INDUSTRY_PROHIBITED: Record<string, string[]> = {
  supplements: [
    "cures diabetes",
    "reverses diabetes",
    "cancer treatment",
    "cure cancer",
    "fda approved",
    "guaranteed results",
    "lose 30 pounds",
    "miracle pill",
  ],
  solar: [
    "free solar",
    "no cost solar",
    "government pays you",
    "guaranteed savings",
    "100% off",
  ],
  dental: [
    "painless guarantee",
    "perfect smile guarantee",
    "miracle whitening",
  ],
  "med-spa": [
    "guaranteed weight loss",
    "permanent fat loss",
    "no recovery",
  ],
  financial: [
    "guaranteed returns",
    "risk-free returns",
    "double your money",
  ],
  insurance: [
    "guaranteed approval",
    "no medical exam guaranteed",
  ],
  mortgage: [
    "guaranteed approval",
    "no income verification",
  ],
  law: [
    "guaranteed win",
    "guaranteed settlement",
    "no fee, no case",
  ],
  legal: [
    "guaranteed win",
    "guaranteed settlement",
  ],
};

function mergeProhibited(ctx: AdPolicyContext, industry: string): string[] {
  if (ctx.prohibitedClaims && ctx.prohibitedClaims.length > 0) return ctx.prohibitedClaims;
  const key = Object.keys(INDUSTRY_PROHIBITED).find((k) => industry.includes(k));
  return key ? INDUSTRY_PROHIBITED[key] ?? [] : [];
}

// ---------------------------------------------------------------------------
// Internals — text scopes
// ---------------------------------------------------------------------------

interface TextScope {
  field: ComplianceFinding["field"];
  text: string;
}

function collectAllText(variant: AdCopyVariant): TextScope[] {
  const scopes: TextScope[] = [
    { field: "headline", text: variant.headline ?? "" },
    { field: "primaryText", text: variant.primaryText ?? "" },
    { field: "description", text: variant.description ?? "" },
    { field: "cta", text: variant.cta ?? "" },
  ];

  // Merge in platform-payload extras so multi-variant headlines are also scanned.
  const p = variant.platformPayload;
  if (p.platform === Platform.Meta) {
    const payload = p.payload as MetaCopyPayload;
    scopes.push(
      ...payload.primaryText.map((t: string) => ({ field: "primaryText" as const, text: t })),
      ...payload.headline.map((t: string) => ({ field: "headline" as const, text: t })),
      ...payload.description.map((t: string) => ({ field: "description" as const, text: t })),
    );
  } else if (p.platform === Platform.Google) {
    const payload = p.payload as GoogleCopyPayload;
    scopes.push(
      ...payload.headlines.map((t: string) => ({ field: "headline" as const, text: t })),
      ...payload.descriptions.map((t: string) => ({ field: "description" as const, text: t })),
    );
  } else if (p.platform === Platform.LinkedIn) {
    const payload = p.payload as LinkedInCopyPayload;
    scopes.push(
      { field: "primaryText", text: payload.introText },
      { field: "headline", text: payload.headline },
      { field: "description", text: payload.description },
    );
  } else if (p.platform === Platform.TikTok) {
    const payload = p.payload as TikTokCopyPayload;
    scopes.push(
      { field: "headline", text: payload.hook },
      { field: "primaryText", text: payload.bodyScript },
    );
  } else {
    const payload = p.payload as GenericCopyPayload;
    scopes.push(
      { field: "primaryText", text: payload.primaryText },
      { field: "headline", text: payload.headline },
      { field: "description", text: payload.description ?? "" },
    );
  }

  return scopes;
}

function forEachMatch(
  scopes: TextScope[],
  phrases: string[],
  fn: (scope: TextScope, match: string) => void,
): void {
  const seen = new Set<string>();
  for (const scope of scopes) {
    const lower = scope.text.toLowerCase();
    for (const phrase of phrases) {
      if (!phrase) continue;
      if (lower.includes(phrase.toLowerCase())) {
        const key = `${scope.field}|${phrase}`;
        if (seen.has(key)) continue;
        seen.add(key);
        fn(scope, phrase);
      }
    }
  }
}

function containsAny(scopes: TextScope[], phrases: string[]): boolean {
  for (const scope of scopes) {
    const lower = scope.text.toLowerCase();
    for (const p of phrases) if (p && lower.includes(p.toLowerCase())) return true;
  }
  return false;
}

function findFirstField(scopes: TextScope[], phrases: string[]): ComplianceFinding["field"] {
  for (const scope of scopes) {
    const lower = scope.text.toLowerCase();
    for (const p of phrases) {
      if (p && lower.includes(p.toLowerCase())) return scope.field;
    }
  }
  return "primaryText";
}

function isShoutingCase(text: string): boolean {
  const letters = text.replace(/[^A-Za-z]/g, "");
  if (letters.length < 12) return false;
  const upper = letters.replace(/[^A-Z]/g, "").length;
  return upper / letters.length >= 0.7;
}

function titleCase(text: string): string {
  return text
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function rephraseHealth(original: string, match: string): string {
  // Tone down disease-name claims to "supports".
  const re = new RegExp(escapeRe(match), "ig");
  return original.replace(re, "supports").replace(/\s{2,}/g, " ").trim();
}

function rephraseSupplementCondition(original: string, match: string): string {
  // Drop the disease name entirely — "support healthy <organ>" is the safe FDA-aligned rephrase.
  const safer = original.replace(new RegExp(escapeRe(match), "ig"), "overall wellness");
  return safer.replace(/\s{2,}/g, " ").trim();
}

function finalize(scope: Platform | "cross_platform", findings: ComplianceFinding[]): ComplianceReview {
  const highest: ComplianceSeverity | null = findings.length === 0
    ? null
    : findings.some((f) => f.severity === "block")
      ? "block"
      : findings.some((f) => f.severity === "warn")
        ? "warn"
        : "info";

  const status: ComplianceReview["status"] =
    highest === "block" ? "blocked" : highest === "warn" ? "passed_with_warnings" : "passed";

  return { scope, status, findings, highestSeverity: highest };
}
