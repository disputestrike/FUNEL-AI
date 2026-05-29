/**
 * GoFunnelAI — Audience Targeting agent (Level 2 Launch Center).
 *
 * Translates a CampaignStrategy + an industry KB pack snapshot into a
 * platform-specific `AudienceProfile`. The shape varies per platform because
 * each ad manager exposes different targeting primitives:
 *
 *   - meta:     locations, age, interests, behaviors, lookalike, exclusions
 *   - google:   keywords, negative keywords, match types, ad groups, locations
 *   - linkedin: job titles, industries, company sizes, seniority, skills
 *   - tiktok:   interest clusters, behaviors, creator hints, content categories
 *
 * Other platforms (YouTube/X/Snapchat/Pinterest/Reddit) get a generic profile
 * with their best-available primitives.
 *
 * The agent emits `launch_audience_built` on every successful build.
 *
 * Brand: GoFunnelAI. Domain: gofunnelai.com.
 */

import { Platform } from "@funnel/shared/launch";

import { emitLaunch } from "./events.js";
import type { CampaignStrategy, FunnelContext } from "./strategy.js";

/* -------------------------------------------------------------------------
 * Platform-specific param shapes
 * ----------------------------------------------------------------------- */

export type MetaGender = "all" | "female" | "male";

export interface MetaAudienceParams {
  locations: string[]; // ISO country codes or country names
  age: { min: number; max: number };
  genders: MetaGender;
  interests: string[];
  behaviors: string[];
  lookalikeSource?: string;
  exclusions: string[];
}

export interface GoogleAdGroup {
  name: string;
  keywords: string[];
  matchType: "exact" | "phrase" | "broad";
}

export interface GoogleAudienceParams {
  keywords: string[];
  negativeKeywords: string[];
  matchTypes: Array<"exact" | "phrase" | "broad">;
  adGroups: GoogleAdGroup[];
  locations: string[];
}

export interface LinkedInAudienceParams {
  jobTitles: string[];
  industries: string[];
  companySize: string[]; // LinkedIn buckets: "1-10","11-50","51-200","201-500","501-1000","1001-5000","5001-10000","10000+"
  seniority: string[];
  skills: string[];
}

export interface TikTokAudienceParams {
  interestClusters: string[];
  behaviors: string[];
  creators?: string[];
  contentCategories: string[];
}

export interface GenericAudienceParams {
  interests: string[];
  behaviors: string[];
  locations: string[];
  notes: string;
}

export type PlatformAudienceParams =
  | { platform: Platform.Meta; params: MetaAudienceParams }
  | { platform: Platform.Google; params: GoogleAudienceParams }
  | { platform: Platform.LinkedIn; params: LinkedInAudienceParams }
  | { platform: Platform.TikTok; params: TikTokAudienceParams }
  | { platform: Exclude<Platform, Platform.Meta | Platform.Google | Platform.LinkedIn | Platform.TikTok>; params: GenericAudienceParams };

export interface AudienceProfile {
  /** Stable name surfaced in the cockpit + exported CSVs. */
  name: string;
  platform: Platform;
  /** Free-text persona description from the strategy. */
  personaDescription: string;
  /** Optional secondary persona — kept verbatim from the strategy. */
  secondaryPersonaDescription: string;
  /** Estimated TAM reach band for this profile. */
  estimatedReachBand: "narrow" | "moderate" | "broad";
  /** Source KB pack identifier (for audit + regeneration). */
  kbPackId: string;
  /** The platform-specific targeting parameters. */
  targeting: PlatformAudienceParams;
}

/* -------------------------------------------------------------------------
 * Industry KB → audience primitives
 *
 * Each industry contributes a set of interest, behavior, keyword, job-title,
 * and content-category seeds. The agent picks the appropriate subset per
 * platform.
 * ----------------------------------------------------------------------- */

interface IndustryAudienceKB {
  packId: string;
  interests: string[];
  behaviors: string[];
  /** Search-engine intent keywords; the Google branch uses these directly. */
  keywords: string[];
  /** Negative keywords to apply on Google. */
  negativeKeywords: string[];
  /** Best-match LinkedIn job titles. */
  jobTitles: string[];
  /** Best-match LinkedIn industries. */
  industries: string[];
  /** TikTok content categories that index high for this persona. */
  contentCategories: string[];
  /** TikTok creator archetypes the buyer follows. */
  creators: string[];
  /** Reach band defaults to "moderate" but heavy-B2B verticals narrow. */
  reachBand: "narrow" | "moderate" | "broad";
}

const INDUSTRY_KB: Record<string, IndustryAudienceKB> = {
  solar: {
    packId: "solar-us-en",
    interests: [
      "Home improvement",
      "Renewable energy",
      "Electric vehicles",
      "Smart home",
      "Energy efficiency",
      "Tesla",
      "Real estate ownership",
    ],
    behaviors: [
      "Likely homeowner",
      "Recently moved",
      "High utility bill mentioned",
      "Engaged with EV content",
      "Engaged with energy rebate content",
    ],
    keywords: [
      "solar panels cost",
      "best solar company near me",
      "solar tax credit 2026",
      "solar savings calculator",
      "residential solar installation",
      "solar battery backup",
      "net metering changes",
      "how much do solar panels cost",
    ],
    negativeKeywords: [
      "free solar",
      "solar jobs",
      "solar career",
      "solar stocks",
      "solar eclipse",
      "diy solar",
    ],
    jobTitles: ["Homeowner", "Facilities Director", "Sustainability Manager"],
    industries: ["Residential construction", "Utilities", "Renewables"],
    contentCategories: ["Home & Garden", "Lifestyle", "DIY", "Finance"],
    creators: ["Home reno creators", "EV reviewers", "Sustainability educators"],
    reachBand: "moderate",
  },
  med_spa: {
    packId: "med-spa-us-en",
    interests: [
      "Skincare",
      "Aesthetic medicine",
      "Anti-aging",
      "Botox",
      "Beauty wellness",
      "Wellness retreats",
    ],
    behaviors: [
      "Engaged with cosmetic content",
      "Beauty subscription buyer",
      "High disposable income signal",
    ],
    keywords: [
      "med spa near me",
      "botox cost",
      "best filler clinic",
      "skin tightening treatment",
      "laser hair removal",
      "lip filler consultation",
    ],
    negativeKeywords: ["jobs", "training", "school", "diy", "cheap"],
    jobTitles: ["Esthetician", "Medical Director", "Aesthetic Nurse"],
    industries: ["Health, Wellness & Fitness", "Cosmetics", "Hospital & Health Care"],
    contentCategories: ["Beauty", "Wellness", "Lifestyle", "Self-care"],
    creators: ["Beauty influencers", "Skincare educators", "Aesthetic providers"],
    reachBand: "moderate",
  },
  dental: {
    packId: "dental-us-en",
    interests: [
      "Family healthcare",
      "Dental hygiene",
      "Cosmetic dentistry",
      "Pediatric care",
      "Health insurance",
    ],
    behaviors: [
      "Active family-care decision-maker",
      "Recently searched for dentist",
      "Engaged with insurance content",
    ],
    keywords: [
      "dentist near me",
      "family dentist",
      "dental implants cost",
      "teeth whitening",
      "emergency dentist",
      "ppo dentist near me",
      "insurance accepted dentist",
    ],
    negativeKeywords: ["jobs", "salary", "school", "assistant training", "career"],
    jobTitles: ["Office Manager", "Patient Coordinator", "Dental Hygienist"],
    industries: ["Hospital & Health Care", "Medical Practice", "Insurance"],
    contentCategories: ["Family", "Health", "Lifestyle"],
    creators: ["Family vloggers", "Health educators", "Local community pages"],
    reachBand: "broad",
  },
  insurance: {
    packId: "insurance-us-en",
    interests: [
      "Personal finance",
      "Homeownership",
      "Family planning",
      "Retirement planning",
      "Risk management",
    ],
    behaviors: [
      "Renewal-window proximity",
      "Recently purchased home",
      "Recent life event (marriage, child)",
    ],
    keywords: [
      "insurance quote",
      "best home insurance",
      "auto insurance bundle",
      "term life insurance quote",
      "renters insurance",
      "switch insurance carrier",
    ],
    negativeKeywords: ["jobs", "license", "exam", "agent training"],
    jobTitles: ["Independent Agent", "Producer", "Account Manager"],
    industries: ["Insurance", "Financial Services"],
    contentCategories: ["Finance", "Family", "Home & Garden"],
    creators: ["Personal finance educators", "Family bloggers"],
    reachBand: "broad",
  },
  real_estate: {
    packId: "real-estate-us-en",
    interests: [
      "Real estate",
      "Home buying",
      "Home selling",
      "Mortgage",
      "Interior design",
      "Neighborhood news",
    ],
    behaviors: [
      "Recently searched home values",
      "Engaged with real-estate listings",
      "Likely homeowner — tenure 5+ years",
    ],
    keywords: [
      "home value near me",
      "sell my house",
      "realtor near me",
      "home market report",
      "cash offer my home",
    ],
    negativeKeywords: ["rentals", "rent to own", "for rent", "jobs"],
    jobTitles: ["Realtor", "Broker", "Listing Agent"],
    industries: ["Real Estate", "Construction"],
    contentCategories: ["Lifestyle", "Home & Garden", "Local"],
    creators: ["Local market vloggers", "Home tour creators"],
    reachBand: "moderate",
  },
  saas: {
    packId: "b2b-saas-us-en",
    interests: [
      "B2B software",
      "Workflow automation",
      "Marketing technology",
      "Productivity tools",
      "Cloud security",
    ],
    behaviors: [
      "Software evaluation in-market",
      "Visited competitor pages",
      "Engaged with case studies",
    ],
    keywords: [
      "alternative to competitor",
      "best software for team",
      "workflow automation",
      "ROI calculator",
      "category leader review",
    ],
    negativeKeywords: ["jobs", "salary", "open source", "free", "tutorial", "internship"],
    jobTitles: [
      "Head of Marketing",
      "VP of Sales",
      "Director of Revenue Operations",
      "Chief Operating Officer",
      "Growth Lead",
      "Demand Generation Manager",
    ],
    industries: [
      "Computer Software",
      "Internet",
      "Information Technology and Services",
      "Marketing and Advertising",
    ],
    contentCategories: ["Business", "Productivity", "Tech"],
    creators: ["Operator-influencers", "SaaS reviewers", "Startup educators"],
    reachBand: "narrow",
  },
  local_services: {
    packId: "local-services-us-en",
    interests: [
      "Home improvement",
      "Home repair",
      "Property maintenance",
      "DIY",
      "Neighborhood services",
    ],
    behaviors: [
      "Recently moved",
      "Likely homeowner",
      "Searched local service category",
    ],
    keywords: [
      "service near me",
      "emergency service",
      "best service company",
      "free service estimate",
      "same day service",
    ],
    negativeKeywords: ["jobs", "career", "salary", "diy how to", "training"],
    jobTitles: ["Operations Manager", "Service Manager"],
    industries: ["Construction", "Consumer Services", "Residential services"],
    contentCategories: ["Home & Garden", "Lifestyle", "Local"],
    creators: ["Home repair creators", "Local trade vloggers"],
    reachBand: "broad",
  },
};

const DEFAULT_KB = INDUSTRY_KB.local_services!;

function kbFor(strategy: CampaignStrategy): IndustryAudienceKB {
  return INDUSTRY_KB[strategy.offerSnapshot.industryKey] ?? DEFAULT_KB;
}

/* -------------------------------------------------------------------------
 * Public API
 * ----------------------------------------------------------------------- */

export interface BuildAudienceOptions {
  /** Restrict locations (defaults to ["US"]). */
  locations?: readonly string[];
  /** Override the age range (defaults are persona-driven). */
  ageRange?: { min: number; max: number };
  /** Lookalike source — typically a customer-list audience id. */
  lookalikeSource?: string;
  /** Optional funnel context for audit and event emission. */
  funnel?: Pick<FunnelContext, "funnelId" | "workspaceId">;
  /** Skip event emission. Default false. */
  silent?: boolean;
}

/**
 * Build a platform-specific audience profile from the campaign strategy.
 */
export async function buildAudience(
  strategy: CampaignStrategy,
  platform: Platform,
  options: BuildAudienceOptions = {},
): Promise<AudienceProfile> {
  const kb = kbFor(strategy);
  const locations = (options.locations && options.locations.length > 0 ? [...options.locations] : ["US"]);
  const personaAge = ageRangeFor(strategy);
  const ageRange = options.ageRange ?? personaAge;

  const targeting = buildTargetingFor({
    platform,
    strategy,
    kb,
    locations,
    ageRange,
    lookalikeSource: options.lookalikeSource,
  });

  const name = buildAudienceName(strategy, platform);
  const profile: AudienceProfile = {
    name,
    platform,
    personaDescription: strategy.primaryAudienceDesc,
    secondaryPersonaDescription: strategy.secondaryAudienceDesc,
    estimatedReachBand: estimateReachBand(kb, strategy, platform),
    kbPackId: kb.packId,
    targeting,
  };

  if (!options.silent) {
    await emitLaunch(
      "launch_audience_built",
      {
        funnelId: options.funnel?.funnelId ?? null,
        workspaceId: options.funnel?.workspaceId ?? strategy.offerSnapshot.industryLabel,
        platform,
        profileName: profile.name,
        kbPackId: profile.kbPackId,
        reachBand: profile.estimatedReachBand,
      },
      { workspaceId: options.funnel?.workspaceId ?? null },
    );
  }

  return profile;
}

/* -------------------------------------------------------------------------
 * Per-platform targeting builders
 * ----------------------------------------------------------------------- */

interface BuildContext {
  platform: Platform;
  strategy: CampaignStrategy;
  kb: IndustryAudienceKB;
  locations: string[];
  ageRange: { min: number; max: number };
  lookalikeSource?: string;
}

function buildTargetingFor(ctx: BuildContext): PlatformAudienceParams {
  switch (ctx.platform) {
    case Platform.Meta:
      return { platform: Platform.Meta, params: buildMeta(ctx) };
    case Platform.Google:
      return { platform: Platform.Google, params: buildGoogle(ctx) };
    case Platform.LinkedIn:
      return { platform: Platform.LinkedIn, params: buildLinkedIn(ctx) };
    case Platform.TikTok:
      return { platform: Platform.TikTok, params: buildTikTok(ctx) };
    default:
      return {
        platform: ctx.platform as Exclude<
          Platform,
          Platform.Meta | Platform.Google | Platform.LinkedIn | Platform.TikTok
        >,
        params: buildGeneric(ctx),
      };
  }
}

function buildMeta(ctx: BuildContext): MetaAudienceParams {
  const exclusions = buildExclusions(ctx);
  return {
    locations: ctx.locations,
    age: ctx.ageRange,
    genders: "all",
    interests: ctx.kb.interests,
    behaviors: ctx.kb.behaviors,
    lookalikeSource: ctx.lookalikeSource,
    exclusions,
  };
}

function buildGoogle(ctx: BuildContext): GoogleAudienceParams {
  const exact = ctx.kb.keywords.slice(0, Math.min(4, ctx.kb.keywords.length));
  const phrase = ctx.kb.keywords.slice(exact.length);
  const adGroups: GoogleAdGroup[] = [
    {
      name: `${ctx.strategy.offerSnapshot.industryLabel} — Brand + Category`,
      keywords: exact,
      matchType: "exact",
    },
    {
      name: `${ctx.strategy.offerSnapshot.industryLabel} — Intent`,
      keywords: phrase.length > 0 ? phrase : ctx.kb.keywords,
      matchType: "phrase",
    },
  ];
  return {
    keywords: ctx.kb.keywords,
    negativeKeywords: ctx.kb.negativeKeywords,
    matchTypes: ["exact", "phrase"],
    adGroups,
    locations: ctx.locations,
  };
}

function buildLinkedIn(ctx: BuildContext): LinkedInAudienceParams {
  // LinkedIn only makes sense for B2B verticals. For consumer verticals we
  // still return a profile but it will be narrow + low-signal — the platform
  // recommender will have already filtered LinkedIn out for those industries.
  const seniority = ctx.strategy.offerSnapshot.industryKey === "saas"
    ? ["Manager", "Director", "VP", "CXO"]
    : ["Owner", "Director"];
  return {
    jobTitles: ctx.kb.jobTitles,
    industries: ctx.kb.industries,
    companySize: companySizesFor(ctx.strategy),
    seniority,
    skills: skillsFor(ctx),
  };
}

function buildTikTok(ctx: BuildContext): TikTokAudienceParams {
  return {
    interestClusters: ctx.kb.interests.map((interest) =>
      interest.toLowerCase().replace(/\s+/g, "_"),
    ),
    behaviors: ctx.kb.behaviors,
    creators: ctx.kb.creators,
    contentCategories: ctx.kb.contentCategories,
  };
}

function buildGeneric(ctx: BuildContext): GenericAudienceParams {
  const friendly = ctx.platform.charAt(0).toUpperCase() + ctx.platform.slice(1);
  return {
    interests: ctx.kb.interests,
    behaviors: ctx.kb.behaviors,
    locations: ctx.locations,
    notes: `Generic profile for ${friendly}. Use platform-native targeting where available; this profile maps the KB pack interests to the platform's closest equivalents.`,
  };
}

/* -------------------------------------------------------------------------
 * Helpers
 * ----------------------------------------------------------------------- */

function buildAudienceName(strategy: CampaignStrategy, platform: Platform): string {
  return `${strategy.offerSnapshot.industryLabel} — ${platform} — Primary`;
}

function ageRangeFor(strategy: CampaignStrategy): { min: number; max: number } {
  switch (strategy.offerSnapshot.industryKey) {
    case "solar":
    case "insurance":
    case "real_estate":
      return { min: 35, max: 70 };
    case "med_spa":
      return { min: 28, max: 60 };
    case "dental":
      return { min: 25, max: 65 };
    case "saas":
      return { min: 28, max: 55 };
    case "local_services":
    default:
      return { min: 25, max: 65 };
  }
}

function estimateReachBand(
  kb: IndustryAudienceKB,
  strategy: CampaignStrategy,
  platform: Platform,
): "narrow" | "moderate" | "broad" {
  if (platform === Platform.LinkedIn) {
    return strategy.offerSnapshot.industryKey === "saas" ? "narrow" : "narrow";
  }
  if (platform === Platform.Google) {
    return "moderate";
  }
  return kb.reachBand;
}

function buildExclusions(ctx: BuildContext): string[] {
  // Persona-driven exclusions surface the most common false-positive segments.
  switch (ctx.strategy.offerSnapshot.industryKey) {
    case "solar":
      return ["Renters", "Solar industry employees", "Recently quoted solar"];
    case "insurance":
      return ["Recent quote requested", "Insurance agents"];
    case "med_spa":
      return ["Esthetician trainees", "Cosmetology students"];
    case "dental":
      return ["Dental school students", "Dental industry employees"];
    case "real_estate":
      return ["Renters", "Real estate agents"];
    case "saas":
      return ["Employees of advertiser", "Job seekers", "Students"];
    case "local_services":
    default:
      return ["Industry employees", "Trade students"];
  }
}

function companySizesFor(strategy: CampaignStrategy): string[] {
  if (strategy.offerSnapshot.industryKey === "saas") {
    return ["11-50", "51-200", "201-500", "501-1000"];
  }
  return ["1-10", "11-50", "51-200"];
}

function skillsFor(ctx: BuildContext): string[] {
  if (ctx.strategy.offerSnapshot.industryKey === "saas") {
    return [
      "Marketing Operations",
      "Revenue Operations",
      "Demand Generation",
      "Sales Enablement",
      "Lifecycle Marketing",
      "Growth Marketing",
    ];
  }
  return ["Operations", "Customer Acquisition", "Local Marketing"];
}
