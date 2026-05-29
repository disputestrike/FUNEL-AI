/**
 * @funnel/agents — Canonical types for the 16-agent fleet.
 *
 * These types are referenced by:
 *   - The agents themselves (input/output contracts)
 *   - The orchestrator (DAG scheduling, event mapping, cost accounting)
 *   - Downstream consumers (web app, admin, API)
 *
 * Keep this surface tight; every type here is a load-bearing contract.
 * Spec source: docs/19-orchestrator-code-spec.md Part B.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Industry / persona / archetype identifiers
// ---------------------------------------------------------------------------

/** All industries we ship KB packs for at Day 90 launch. */
export type Industry =
  | "solar"
  | "hvac"
  | "real_estate"
  | "coaching"
  | "fitness"
  | "med_spa"
  | "cosmetic_surgery"
  | "dental"
  | "chiropractic"
  | "insurance"
  | "mortgage"
  | "financial_advisor"
  | "legal"
  | "saas"
  | "ecommerce"
  | "agency"
  | "education"
  | "home_services"
  | "supplements"
  | "info_products"
  | "other";

/** Voice persona library (doc 20). Auto-routed by industry; user-overridable. */
export type VoicePersona = "funnel" | "maven" | "coach" | "rebel" | "maestro";

/** Funnel archetypes the Planner can choose between. */
export type ArchetypeId =
  | "lead_magnet_optin"
  | "free_consult_booking"
  | "tripwire"
  | "webinar_evergreen"
  | "application_funnel"
  | "product_launch";

/** Subscription tiers — gate model access + budget ceilings. */
export type Tier = "free" | "starter" | "growth" | "scale" | "agency";

// ---------------------------------------------------------------------------
// Model identifiers + fallback chains
// ---------------------------------------------------------------------------

export type ModelId =
  | "claude-opus-4-7"
  | "claude-sonnet-4-6"
  | "claude-haiku-4-5"
  | "gpt-4o"
  | "gpt-4o-mini"
  | "flux-1.1-pro"
  | "ideogram-v2"
  | "sdxl"
  | "unsplash-stock"
  | "pexels-stock"
  | "runway-gen-3"
  | "veo-3"
  | "stock-broll"
  | "eleven-multilingual-v3"
  | "cartesia-sonic";

/** Concrete Anthropic API ids. Mapped from ModelId at the client boundary. */
export const ANTHROPIC_MODEL_IDS: Partial<Record<ModelId, string>> = {
  "claude-opus-4-7": "claude-opus-4-7-20260301",
  "claude-sonnet-4-6": "claude-sonnet-4-6-20251215",
  "claude-haiku-4-5": "claude-haiku-4-5-20251020",
};

/** Concrete OpenAI API ids. */
export const OPENAI_MODEL_IDS: Partial<Record<ModelId, string>> = {
  "gpt-4o": "gpt-4o-2024-11-20",
  "gpt-4o-mini": "gpt-4o-mini-2024-07-18",
};

// ---------------------------------------------------------------------------
// Agent names (the 16-agent fleet)
// ---------------------------------------------------------------------------

export type AgentName =
  | "planner"
  | "hook"
  | "page"
  | "lead_magnet"
  | "image"
  | "video"
  | "ad_copy"
  | "audience"
  | "email"
  | "sms"
  | "voice_script"
  | "upsell"
  | "fact_check"
  | "compliance"
  | "qa"
  | "brand_guardian";

export const ALL_AGENT_NAMES: AgentName[] = [
  "planner",
  "hook",
  "page",
  "lead_magnet",
  "image",
  "video",
  "ad_copy",
  "audience",
  "email",
  "sms",
  "voice_script",
  "upsell",
  "fact_check",
  "compliance",
  "qa",
  "brand_guardian",
];

// ---------------------------------------------------------------------------
// Business Profile (Onboarding output → Orchestrator input)
// ---------------------------------------------------------------------------

export const BusinessProfileSchema = z.object({
  workspaceId: z.string().min(1),
  businessName: z.string().min(1).max(200),
  industry: z.string().min(1),
  subIndustry: z.string().optional(),
  geography: z.object({
    country: z.string().length(2),
    region: z.string().optional(),
    timezone: z.string().optional(),
  }),
  language: z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/),
  offer: z.object({
    description: z.string().min(10).max(2000),
    priceCents: z.number().int().nonnegative().optional(),
    deliverable: z.string().optional(),
    uniqueClaim: z.string().optional(),
  }),
  targetCustomer: z.object({
    description: z.string().min(10),
    painPoints: z.array(z.string()).default([]),
    transformation: z.string().optional(),
  }),
  proof: z
    .object({
      testimonials: z
        .array(
          z.object({
            quote: z.string(),
            attribution: z.string().optional(),
            verifiable: z.boolean().default(false),
          }),
        )
        .default([]),
      caseStudies: z.array(z.string()).default([]),
      statistics: z
        .array(
          z.object({
            claim: z.string(),
            source: z.string(),
          }),
        )
        .default([]),
      certifications: z.array(z.string()).default([]),
    })
    .default({ testimonials: [], caseStudies: [], statistics: [], certifications: [] }),
  brand: z
    .object({
      logoUrl: z.string().url().optional(),
      primaryColor: z.string().optional(),
      secondaryColor: z.string().optional(),
      fonts: z.array(z.string()).default([]),
      voiceSamples: z.array(z.string()).default([]),
      brandValues: z.array(z.string()).default([]),
    })
    .default({ fonts: [], voiceSamples: [], brandValues: [] }),
  contact: z
    .object({
      website: z.string().url().optional(),
      phone: z.string().optional(),
      email: z.string().email().optional(),
    })
    .default({}),
  regulated: z.boolean().default(false),
  notes: z.string().optional(),
});

export type BusinessProfile = z.infer<typeof BusinessProfileSchema>;

// ---------------------------------------------------------------------------
// Cost accounting + budget enforcement
// ---------------------------------------------------------------------------

export type CostCategory =
  | "llm"
  | "image"
  | "video"
  | "voice_tts"
  | "voice_asr"
  | "voice_telephony"
  | "sms"
  | "email"
  | "storage"
  | "scraping"
  | "search";

export interface ModelCallRecord {
  model: ModelId;
  category: CostCategory;
  unitCount: number;
  unitRateCents: number;
  inputTokens?: number;
  outputTokens?: number;
  cachedInputTokens?: number;
  metadata?: Record<string, string | number>;
}

export interface CostRecord {
  totalCents: number;
  calls: ModelCallRecord[];
}

export interface CacheHitRecord {
  cachedInputTokens: number;
  freshInputTokens: number;
  ratio: number;
}

export interface CostRecommendation {
  status: "ok" | "near_limit_80" | "exhausted" | "overrun";
  recommendation:
    | "continue"
    | "downgrade_next"
    | "cache_if_possible"
    | "skip_optional"
    | "halt";
  remainingCents: number;
  spentCents: number;
  capCents: number;
}

// ---------------------------------------------------------------------------
// Agent error taxonomy
// ---------------------------------------------------------------------------

export type AgentError =
  | { kind: "transient"; httpStatus: 429 | 500 | 502 | 503 | 504; provider: string; message: string }
  | { kind: "rate_limit"; provider: string; retryAfterMs?: number; message: string }
  | { kind: "content_policy"; provider: string; reason: string }
  | { kind: "auth"; provider: string; message: string }
  | { kind: "schema_invalid"; errors: z.ZodIssue[]; raw?: string }
  | { kind: "safety_block"; classifier: string; reason: string }
  | { kind: "timeout"; phase: "connect" | "first_byte" | "overall"; ms: number }
  | { kind: "budget"; remainingCents: number; message: string }
  | { kind: "cancelled"; reason?: string }
  | { kind: "unknown"; message: string; raw?: unknown };

// ---------------------------------------------------------------------------
// Agent event stream (per-agent SSE chunks)
// ---------------------------------------------------------------------------

export type AgentEvent<T> =
  | { type: "started"; ts: string; modelUsed: ModelId; agent: AgentName }
  | { type: "chunk"; ts: string; agent: AgentName; slot: string; delta: string; cumulative?: string }
  | { type: "progress"; ts: string; agent: AgentName; pct: number; note?: string }
  | {
      type: "final";
      ts: string;
      agent: AgentName;
      output: T;
      cost: CostRecord;
      cacheHits: CacheHitRecord;
      durationMs: number;
      modelUsed: ModelId;
    }
  | { type: "error"; ts: string; agent: AgentName; error: AgentError; willRetry: boolean };

// ---------------------------------------------------------------------------
// Logger interface (injected, not imported)
// ---------------------------------------------------------------------------

export interface Logger {
  debug: (msg: string, meta?: Record<string, unknown>) => void;
  info: (msg: string, meta?: Record<string, unknown>) => void;
  warn: (msg: string, meta?: Record<string, unknown>) => void;
  error: (msg: string, meta?: Record<string, unknown>) => void;
}

export interface Clock {
  now: () => Date;
}

// ---------------------------------------------------------------------------
// KB client interface (stub — real impl lives in @funnel/kb)
// ---------------------------------------------------------------------------

export interface KbDoc {
  id: string;
  source: string;
  chunk: string;
  score: number;
  metadata?: Record<string, unknown>;
}

export interface KbClient {
  retrieve(query: {
    namespace: string;
    industry?: Industry | string;
    geography?: string;
    archetype?: ArchetypeId;
    topK?: number;
    extraFilters?: Record<string, unknown>;
  }): Promise<KbDoc[]>;
}

// ---------------------------------------------------------------------------
// Prompt cache client (Anthropic prompt cache adapter)
// ---------------------------------------------------------------------------

export interface PromptCacheClient {
  /** Returns a deterministic cache key for the given (namespace, version, dims). */
  key(namespace: string, version: number | string, dims: Record<string, string>): string;
  /** Hint to the runtime to mark this block ephemerally cached. */
  markEphemeral(content: string, key: string): { content: string; cache_control: { type: "ephemeral" } };
}

// ---------------------------------------------------------------------------
// Agent context — injected into every agent.run()
// ---------------------------------------------------------------------------

export interface AgentContext<TPlan = unknown, TBrand = unknown> {
  generationId: string;
  workspaceId: string;
  userId: string;
  language: string;
  geography: string;
  tier: Tier;
  industry: Industry | string;
  voicePersona: VoicePersona;
  businessProfile: BusinessProfile;

  /** Planner output (null only when running the Planner itself). */
  plan: TPlan | null;
  /** Brand tokens (null until Brand Guardian completes). */
  brandTokens: TBrand | null;

  kb: KbClient;
  cache: PromptCacheClient;
  logger: Logger;
  clock: Clock;
  abortSignal: AbortSignal;
  seed?: number;

  /** Records cost AND enforces budget. Returns recommendation. */
  recordCost(agentName: AgentName, modelCalls: ModelCallRecord[]): Promise<CostRecommendation>;

  /** Convenience emitter for orchestrator interop (non-fatal — agents may emit directly). */
  emit?: (event: AgentEvent<unknown>) => void;

  /** Optional model override (set by retry middleware when downgrading). */
  modelOverride?: ModelId;

  /** Optional KB pack version (for cache key invalidation). */
  kbPackVersion?: string;
}

// ---------------------------------------------------------------------------
// Agent interface (the contract every agent implements)
// ---------------------------------------------------------------------------

export interface Agent<TInput, TOutput> {
  readonly name: AgentName;
  readonly primaryModel: ModelId;
  readonly fallbackChain: ModelId[];
  /** Estimated cost in cents for a typical call (sizing only — not enforced here). */
  readonly estCostCents: number;
  /** Cache namespace for prompt caching. */
  readonly cacheNamespace: string;
  /** Whether this agent is allowed to be skipped under budget pressure. */
  readonly optional: boolean;

  run(input: TInput, ctx: AgentContext): AsyncIterable<AgentEvent<TOutput>>;
}

// ---------------------------------------------------------------------------
// Planner output — feeds the rest of the DAG
// ---------------------------------------------------------------------------

export const ArchetypeIdSchema = z.enum([
  "lead_magnet_optin",
  "free_consult_booking",
  "tripwire",
  "webinar_evergreen",
  "application_funnel",
  "product_launch",
]);

export const AgentDispatchSchema = z.object({
  brief: z.string().min(50).max(900),
  priority: z.enum(["must", "should", "optional"]),
  cacheKeys: z.array(z.string()).optional(),
});

export const PlannerOutputSchema = z.object({
  archetype: ArchetypeIdSchema,
  rationale: z.string().min(20).max(400),
  audienceHypothesis: z.string().min(20).max(300),
  primaryPromise: z.string().min(10).max(200),
  angles: z.array(z.string().min(10).max(160)).min(3).max(5),
  dispatch: z.record(z.string(), AgentDispatchSchema),
  estimatedCostCents: z.number().int().nonnegative(),
  estimatedDurationMs: z.number().int().nonnegative(),
});
export type PlannerOutput = z.infer<typeof PlannerOutputSchema>;

// ---------------------------------------------------------------------------
// Hook output
// ---------------------------------------------------------------------------

export const HookVariantSchema = z.object({
  headline: z.string().min(3).max(70),
  subhead: z.string().min(3).max(160),
  cta: z.string().min(2).max(40),
  angleId: z.string().min(1).max(60).optional(),
});

export const HookOutputSchema = z.object({
  primary: HookVariantSchema,
  variants: z.array(HookVariantSchema).min(4).max(6),
  rationale: z.string().min(10).max(400),
});
export type HookOutput = z.infer<typeof HookOutputSchema>;

// ---------------------------------------------------------------------------
// Page output (Funnel sections — feeds doc 18 schema)
// ---------------------------------------------------------------------------

export const PageSectionSchema = z.object({
  type: z.enum([
    "hero",
    "problem",
    "agitation",
    "solution",
    "proof",
    "features",
    "offer",
    "guarantee",
    "faq",
    "cta_final",
  ]),
  heading: z.string().max(200).optional(),
  body: z.string().min(10),
  blocks: z.array(z.record(z.unknown())).optional(),
});

export const PageOutputSchema = z.object({
  sections: z.array(PageSectionSchema).min(3).max(20),
  metaTitle: z.string().min(5).max(70),
  metaDescription: z.string().min(20).max(160),
  schemaOrg: z.record(z.unknown()),
});
export type PageOutput = z.infer<typeof PageOutputSchema>;

// ---------------------------------------------------------------------------
// Lead magnet output
// ---------------------------------------------------------------------------

export const LeadMagnetOutputSchema = z.object({
  title: z.string().min(3).max(120),
  subtitle: z.string().min(3).max(200),
  format: z.enum(["pdf_guide", "checklist", "template", "mini_course", "quiz", "calculator"]),
  deliverableSpec: z.object({
    sections: z
      .array(
        z.object({
          heading: z.string().min(3).max(200),
          body: z.string().min(20),
        }),
      )
      .min(2)
      .max(20),
  }),
  optinPagePromise: z.string().min(10).max(400),
  thankYouCopy: z.string().min(10).max(800),
});
export type LeadMagnetOutput = z.infer<typeof LeadMagnetOutputSchema>;

// ---------------------------------------------------------------------------
// Image output
// ---------------------------------------------------------------------------

export const SafetyCheckSchema = z.object({
  passed: z.boolean(),
  classifier: z.string(),
  flags: z.array(z.string()).default([]),
  nsfwScore: z.number().min(0).max(1).optional(),
});

export const ImageSlotSchema = z.object({
  slotId: z.string().min(1),
  url: z.string().url(),
  thumbUrl: z.string().url().optional(),
  altText: z.string().min(3).max(300),
  modelUsed: z.string(),
  promptUsed: z.string().min(5),
  safetyChecks: SafetyCheckSchema,
  licenseType: z.enum(["generated", "stock_unsplash", "stock_pexels", "customer_owned"]).default("generated"),
});

export const ImageOutputSchema = z.object({
  images: z.array(ImageSlotSchema).min(1),
});
export type ImageOutput = z.infer<typeof ImageOutputSchema>;

// ---------------------------------------------------------------------------
// Video output
// ---------------------------------------------------------------------------

export const VideoOutputSchema = z.object({
  heroVideo: z.object({
    url: z.string().url(),
    durationS: z.number().min(1).max(120),
    modelUsed: z.string(),
    thumbUrl: z.string().url().optional(),
  }),
  bRoll: z
    .array(
      z.object({
        url: z.string().url(),
        durationS: z.number(),
      }),
    )
    .optional(),
  captions: z.object({
    srt: z.string(),
  }),
  safetyChecks: SafetyCheckSchema,
});
export type VideoOutput = z.infer<typeof VideoOutputSchema>;

// ---------------------------------------------------------------------------
// Ad copy output (multi-platform)
// ---------------------------------------------------------------------------

export const AdPlatformSchema = z.enum(["meta", "tiktok", "google_search", "youtube", "linkedin"]);

export const AdVariantSchema = z.object({
  primaryText: z.string().optional(),
  headline: z.string().min(2).max(120),
  description: z.string().max(300).optional(),
  cta: z.string().min(2).max(40),
  characterCounts: z.record(z.string(), z.number()),
  complianceFlags: z.array(z.string()).default([]),
});

export const AdCopyOutputSchema = z.object({
  platforms: z
    .array(
      z.object({
        platform: AdPlatformSchema,
        variants: z.array(AdVariantSchema).min(8).max(10),
      }),
    )
    .min(1),
});
export type AdCopyOutput = z.infer<typeof AdCopyOutputSchema>;

// ---------------------------------------------------------------------------
// Audience output
// ---------------------------------------------------------------------------

export const PersonaSpecSchema = z.object({
  name: z.string(),
  role: z.string(),
  jobToBeDone: z.string(),
  demographics: z
    .object({
      ageRange: z.tuple([z.number(), z.number()]).optional(),
      incomeUsd: z.tuple([z.number(), z.number()]).optional(),
      geo: z.array(z.string()).optional(),
    })
    .optional(),
  psychographics: z.array(z.string()).default([]),
});

export const AudienceOutputSchema = z.object({
  primaryPersona: PersonaSpecSchema,
  secondaryPersonas: z.array(PersonaSpecSchema).max(3),
  platformTargeting: z.object({
    meta: z
      .object({
        interests: z.array(z.string()),
        behaviors: z.array(z.string()),
        demographics: z.record(z.unknown()),
        excludes: z.array(z.string()),
      })
      .optional(),
    google: z
      .object({
        keywords: z.array(z.string()),
        negKeywords: z.array(z.string()),
        demographics: z.record(z.unknown()),
      })
      .optional(),
    tiktok: z
      .object({
        interests: z.array(z.string()),
        demographics: z.record(z.unknown()),
      })
      .optional(),
    linkedin: z
      .object({
        jobTitles: z.array(z.string()),
        industries: z.array(z.string()),
        seniorities: z.array(z.string()),
      })
      .optional(),
  }),
  lookalikeSeedSpec: z.object({
    source: z.enum(["customer_list", "pixel_event", "crm"]),
    eventName: z.string().optional(),
  }),
});
export type AudienceOutput = z.infer<typeof AudienceOutputSchema>;

// ---------------------------------------------------------------------------
// Email output (7-touch nurture)
// ---------------------------------------------------------------------------

export const EmailItemSchema = z.object({
  dayOffsetH: z.number().int().nonnegative(),
  subject: z.string().min(3).max(120),
  preheader: z.string().min(3).max(160),
  body: z.string().min(50),
  type: z.enum(["welcome", "value", "proof", "offer", "urgency", "win_back"]),
});

export const EmailOutputSchema = z.object({
  sequence: z.array(EmailItemSchema).min(5).max(9),
});
export type EmailOutput = z.infer<typeof EmailOutputSchema>;

// ---------------------------------------------------------------------------
// SMS output
// ---------------------------------------------------------------------------

export const SmsItemSchema = z.object({
  dayOffsetH: z.number().int().nonnegative(),
  body: z.string().min(5).max(320),
  type: z.enum(["reminder", "value", "urgency", "reactivation"]),
});

export const SmsOutputSchema = z.object({
  sequence: z.array(SmsItemSchema).min(3).max(7),
  optInLanguage: z.string().min(20),
  stopKeywords: z.array(z.string()).min(1),
});
export type SmsOutput = z.infer<typeof SmsOutputSchema>;

// ---------------------------------------------------------------------------
// Voice script output (RevTry outbound)
// ---------------------------------------------------------------------------

export const VoiceScriptOutputSchema = z.object({
  openings: z
    .array(
      z.object({
        text: z.string().min(10).max(600),
        tone: z.enum(["friendly", "professional", "urgent"]),
      }),
    )
    .length(3),
  discoveryQuestions: z.array(z.string().min(5).max(200)).min(6).max(10),
  objectionHandlers: z
    .array(
      z.object({
        objection: z.string().min(3).max(140),
        response: z.string().min(20).max(600),
      }),
    )
    .min(5)
    .max(8),
  bookingClose: z.object({
    text: z.string().min(20).max(800),
    ifBooked: z.string().min(10),
    ifNot: z.string().min(10),
  }),
  voicemailDrop: z.string().min(20).max(600),
  tcpaDisclosure: z.string().min(20),
  ttsHints: z.object({
    pace: z.enum(["slow", "normal", "fast"]),
    emphasisTokens: z.array(z.string()),
  }),
});
export type VoiceScriptOutput = z.infer<typeof VoiceScriptOutputSchema>;

// ---------------------------------------------------------------------------
// Upsell output
// ---------------------------------------------------------------------------

const OfferSpecSchema = z.object({
  title: z.string().min(3).max(120),
  copy: z.string().min(20).max(800),
  priceCents: z.number().int().nonnegative(),
});

export const UpsellOutputSchema = z.object({
  bumpOffer: OfferSpecSchema.optional(),
  oto1: OfferSpecSchema.extend({
    downsell: OfferSpecSchema.optional(),
  }).optional(),
  oto2: OfferSpecSchema.optional(),
  thankYouUpsellEnabled: z.boolean(),
});
export type UpsellOutput = z.infer<typeof UpsellOutputSchema>;

// ---------------------------------------------------------------------------
// Fact-Check output
// ---------------------------------------------------------------------------

export const FactCheckFindingSchema = z.object({
  severity: z.enum(["block", "fix", "note"]),
  location: z.object({
    agent: z.string(),
    path: z.string(),
    excerpt: z.string(),
  }),
  claim: z.string(),
  verdict: z.enum(["unverifiable", "contradicted_by_profile", "fabricated_stat", "ok"]),
  suggestion: z.string().optional(),
});

export const FactCheckOutputSchema = z.object({
  findings: z.array(FactCheckFindingSchema),
  pass: z.boolean(),
});
export type FactCheckOutput = z.infer<typeof FactCheckOutputSchema>;

// ---------------------------------------------------------------------------
// Compliance output
// ---------------------------------------------------------------------------

export const ComplianceFindingSchema = z.object({
  severity: z.enum(["block", "fix", "note"]),
  ruleId: z.string(),
  location: z.object({
    agent: z.string(),
    path: z.string(),
    excerpt: z.string(),
  }),
  rationale: z.string(),
  suggestedFix: z.string().optional(),
});

export const ComplianceOutputSchema = z.object({
  findings: z.array(ComplianceFindingSchema),
  geographyApplied: z.array(z.string()),
  pass: z.boolean(),
});
export type ComplianceOutput = z.infer<typeof ComplianceOutputSchema>;

// ---------------------------------------------------------------------------
// QA output
// ---------------------------------------------------------------------------

export const QADimensionsSchema = z.object({
  promiseConsistency: z.number().min(0).max(100),
  voiceConsistency: z.number().min(0).max(100),
  offerCoherence: z.number().min(0).max(100),
  audienceAlignment: z.number().min(0).max(100),
  ctaProgression: z.number().min(0).max(100),
  designContentAlignment: z.number().min(0).max(100),
  factualSoundness: z.number().min(0).max(100),
  complianceSoundness: z.number().min(0).max(100),
  conversionReadiness: z.number().min(0).max(100),
});

const AgentNameSchema = z.enum([
  "planner",
  "hook",
  "page",
  "lead_magnet",
  "image",
  "video",
  "ad_copy",
  "audience",
  "email",
  "sms",
  "voice_script",
  "upsell",
  "fact_check",
  "compliance",
  "qa",
  "brand_guardian",
]);

export const QAOutputSchema = z.object({
  overall: z.number().min(0).max(100),
  dimensions: QADimensionsSchema,
  failingDimensions: z.array(
    z.object({
      name: z.string(),
      reason: z.string(),
      suggestedAgentsToRerun: z.array(AgentNameSchema),
    }),
  ),
  notes: z.string(),
});
export type QAOutput = z.infer<typeof QAOutputSchema>;

// ---------------------------------------------------------------------------
// Brand Guardian output
// ---------------------------------------------------------------------------

export const BrandTokensSchema = z.object({
  palette: z.object({
    primary: z.string(),
    secondary: z.string(),
    accent: z.string(),
    bg: z.string(),
    fg: z.string(),
  }),
  typography: z.object({
    headingFont: z.string(),
    bodyFont: z.string(),
    scale: z.array(z.number()),
  }),
  voice: z.object({
    register: z.enum(["formal", "casual", "authoritative", "playful"]),
    bannedWords: z.array(z.string()),
    signaturePhrases: z.array(z.string()),
  }),
  imagery: z.object({
    mood: z.string(),
    lighting: z.string(),
    subjectGuidance: z.string(),
  }),
  logoUsage: z
    .object({
      url: z.string().url(),
      clearspace: z.string(),
      minWidthPx: z.number().int().positive(),
    })
    .optional(),
});
export type BrandTokensOutput = z.infer<typeof BrandTokensSchema>;

// ---------------------------------------------------------------------------
// Assembled draft (what the orchestrator passes to Phase 3)
// ---------------------------------------------------------------------------

export interface AssembledDraft {
  generationId: string;
  archetype: ArchetypeId;
  planner: PlannerOutput;
  hook?: HookOutput;
  page?: PageOutput;
  leadMagnet?: LeadMagnetOutput;
  image?: ImageOutput;
  video?: VideoOutput;
  adCopy?: AdCopyOutput;
  audience?: AudienceOutput;
  email?: EmailOutput;
  sms?: SmsOutput;
  voiceScript?: VoiceScriptOutput;
  upsell?: UpsellOutput;
  brandTokens?: BrandTokensOutput;
  /** Holdouts of agents that failed even after retry — orchestrator decides whether to publish partial. */
  failed: AgentName[];
}

// ---------------------------------------------------------------------------
// Per-agent input shapes (what the orchestrator dispatches to each agent)
// ---------------------------------------------------------------------------

export interface PlannerInput {
  archetypeHint?: ArchetypeId;
  kbIndustryDocs?: KbDoc[];
  kbArchetypeDocs?: KbDoc[];
}

export interface HookInput {
  brief: string;
  kbHooks?: KbDoc[];
}

export interface PageInput {
  brief: string;
  archetype: ArchetypeId;
  hook?: HookOutput;
  kbPagePatterns?: KbDoc[];
}

export interface LeadMagnetInput {
  brief: string;
  archetype: ArchetypeId;
  kbLeadMagnets?: KbDoc[];
}

export interface ImageInput {
  page: PageOutput;
  brandTokens: BrandTokensOutput;
  slots: { slotId: string; sceneDescription: string }[];
}

export interface VideoInput {
  hook: HookOutput;
  brandTokens: BrandTokensOutput;
  heroImageUrl?: string;
}

export interface AdCopyInput {
  brief: string;
  hook?: HookOutput;
  platforms: ("meta" | "tiktok" | "google_search" | "youtube" | "linkedin")[];
  kbAdPolicy?: KbDoc[];
  kbWinningAds?: KbDoc[];
}

export interface AudienceInput {
  brief: string;
  kbTargetingLibraries?: KbDoc[];
}

export interface EmailInput {
  brief: string;
  hook?: HookOutput;
  leadMagnet?: LeadMagnetOutput;
  kbEmailSequences?: KbDoc[];
  kbSubjectLines?: KbDoc[];
}

export interface SmsInput {
  brief: string;
  kbSmsCompliance?: KbDoc[];
}

export interface VoiceScriptInput {
  brief: string;
  hook?: HookOutput;
}

export interface UpsellInput {
  brief: string;
  archetype: ArchetypeId;
}

export interface FactCheckInput {
  draft: AssembledDraft;
  kbFactualGrounding?: KbDoc[];
}

export interface ComplianceInput {
  draft: AssembledDraft;
  kbComplianceRules?: KbDoc[];
}

export interface QAInput {
  draft: AssembledDraft;
  factCheck?: FactCheckOutput;
  compliance?: ComplianceOutput;
}

export interface BrandGuardianInput {
  /** No additional input beyond ctx.businessProfile. */
  _placeholder?: never;
}

// ---------------------------------------------------------------------------
// Industry → persona auto-route (doc 20 §0)
// ---------------------------------------------------------------------------

export function defaultPersonaForIndustry(industry: string): VoicePersona {
  const norm = industry.toLowerCase().replace(/[\s_-]+/g, "_");
  if (
    ["insurance", "financial_advisor", "mortgage", "saas", "recruiting", "accounting", "legal"].includes(
      norm,
    )
  )
    return "maven";
  if (
    ["fitness", "coaching", "hvac", "home_services", "chiropractic", "med_spa_basic", "dental"].includes(
      norm,
    )
  )
    return "coach";
  if (["ecommerce", "supplements", "info_products", "agency", "education"].includes(norm)) return "rebel";
  if (
    [
      "med_spa",
      "cosmetic_surgery",
      "luxury_real_estate",
      "hair_restoration",
      "private_aviation",
      "concierge",
    ].includes(norm)
  )
    return "maestro";
  return "funnel";
}
