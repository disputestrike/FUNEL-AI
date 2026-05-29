# 19 — Generation Orchestrator: Code-Level Spec

Owner: Head of Platform Engineering
Status: Day-90 launch baseline. Engineers should be able to start building from this on Monday.
Related: `12-prd-pack-v1.md` (Generation Engine PRD — the WHAT), `07c-cost-governor.md`, `07a-trust-and-safety-policy.md`, `07b-human-review-queue.md`, `02a-kb-pack-template.md`, `03-event-taxonomy-and-schemas.md`, `08-engineering-ops-spec.md`.
Review cadence: Weekly during build; monthly post-launch.

This document is the **HOW**. Doc 12 says "generate a funnel from a Business Profile in ~60s." This doc tells engineers which agents run, in what order, with what prompts, with what fallbacks, with what cost ceilings, and with what events emitted over SSE.

---

## Table of contents

- Part A — Orchestrator architecture
- Part B — Agent interface + 16 agent specs
- Part C — Parallelization + dependency graph
- Part D — Streaming pipeline (SSE)
- Part E — Cost accounting hooks
- Part F — Prompt caching strategy
- Part G — Error handling + retry logic
- Part H — Testing the orchestrator
- Appendix — Repo layout, env vars, deploy

---

## Part A — Orchestrator architecture

### A.1 Runtime + topology

The orchestrator is a stateless serverless TypeScript service. Two supported deploy targets — the same code compiles to both:

- **Primary (US/EU):** Cloudflare Workers + Durable Objects. Each `generate()` call owns one Durable Object instance (the "GenerationActor") that holds the in-flight DAG state and pumps the SSE response. We use Workers because: edge-close SSE, 30-minute CPU cap on Durable Objects covers our worst-case generation, and we already use R2 for asset storage.
- **Secondary (regulated regions, agency on-prem):** AWS Lambda (Node 22) + API Gateway WebSockets, with the GenerationActor backed by DynamoDB single-table state. Same TS source, different adapter.

The orchestrator is **stateless across requests** but **stateful within a request**: each in-flight generation lives in a single Actor that owns the DAG and the SSE stream. If the Actor dies mid-flight, the resumption protocol (Â§A.5) reads the audit log from Postgres and resumes from the last committed step.

```
Client â”€â”€HTTPS POST /v1/generationsâ”€â”€> Edge Router
                                            â”‚
                                            â–¼
                                  GenerationActor (DO/Lambda)
                                            â”‚
       â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
       â–¼                â–¼                   â–¼                â–¼                    â–¼
   Anthropic        OpenAI              Flux/Ideogram     Runway/Veo          ElevenLabs
   (LLM)            (LLM fallback)      (Image)           (Video)             (Voice)
                                            â”‚
                                            â–¼
                                  KB Service (pgvector)
                                            â”‚
                                            â–¼
                                  Cost Governor (cg-svc)
                                            â”‚
                                            â–¼
                                  Postgres (funnel, audit, ledger)
                                            â”‚
                                            â–¼
                                  Event bus (Kafka/EventBridge) â”€> downstream
```

### A.2 Responsibilities

The orchestrator:
1. Accepts a `GenerationInput` over HTTPS, validates, and authenticates.
2. Computes the generation budget ceiling from `cg-svc` (Doc 7c Â§3).
3. Dispatches the **Planner** agent â†’ archetype + sub-agent plan.
4. Runs Phase-2 sub-agents in parallel (subject to budget + dependency DAG).
5. Streams partial outputs back via SSE.
6. Runs **Fact-Check, Compliance, Brand Guard, QA** on outputs.
7. Triggers **Human Review Queue** (Doc 7b) if any blocker fires.
8. Assembles final Funnel JSON, writes to `funnel`, emits domain events (Doc 3).
9. Records cost ledger entry (Doc 7c) + audit log entry (Doc 8).

### A.3 Top-level interface

```ts
// orchestrator/src/orchestrator.ts

export class FunnelOrchestrator {
  constructor(private deps: OrchestratorDeps) {}

  async *generate(input: GenerationInput): AsyncIterable<GenerationEvent> {
    // see Â§A.4 for full lifecycle
  }

  /** Resume a generation that died mid-flight. */
  async *resume(generationId: string): AsyncIterable<GenerationEvent> { ... }

  /** Cancel an in-flight generation; flush partial state. */
  async cancel(generationId: string, reason: string): Promise<void> { ... }
}

export interface OrchestratorDeps {
  anthropic: AnthropicClient;
  openai: OpenAIClient;
  imageGen: ImageGenClient;       // multiplexes Flux / Ideogram / stock
  videoGen: VideoGenClient;       // multiplexes Runway / Veo / stock B-roll
  voiceGen: VoiceGenClient;       // ElevenLabs / Cartesia
  kb: KbClient;                   // pgvector retrieval
  cg: CostGovernorClient;         // cg-svc — Doc 7c
  hrq: HumanReviewQueueClient;    // Doc 7b
  db: DbClient;                   // funnel, audit, ledger writes
  events: EventBusClient;         // Doc 3
  cache: PromptCacheClient;       // Anthropic prompt cache adapter
  clock: Clock;                   // injectable for tests
  logger: Logger;
}

export type GenerationInput = {
  workspaceId: string;
  userId: string;
  businessProfile: BusinessProfile;   // from onboarding — see Doc 12 Â§4.2
  language: string;                   // BCP-47, e.g. "en-US", "fr-CA"
  geography: string;                  // ISO-3166-1 alpha-2, e.g. "US"
  options?: {
    tier?: 'starter' | 'growth' | 'scale' | 'agency';
    archetypeHint?: ArchetypeId;      // user override; planner still validates
    skipAgents?: AgentName[];         // ops override; logged
    forceHumanReview?: boolean;
    seed?: number;                    // for deterministic test runs
    budgetCapCents?: number;          // override; capped by tier max
    locale?: { tone?: 'formal' | 'casual'; currency?: string };
  };
  idempotencyKey: string;             // required; dedupes retries
};

export type GenerationEvent =
  | { type: 'generation_started'; data: GenerationStartedData }
  | { type: 'planner_started';    data: { generationId: string; ts: string } }
  | { type: 'planner_completed';  data: PlannerCompletedData }
  | { type: 'agent_started';      data: AgentStartedData }
  | { type: 'agent_chunk';        data: AgentChunkData }
  | { type: 'agent_completed';    data: AgentCompletedData }
  | { type: 'assembly_started';   data: { generationId: string; ts: string } }
  | { type: 'quality_scored';     data: QualityScoredData }
  | { type: 'compliance_flagged'; data: ComplianceFlagData }
  | { type: 'human_review_required'; data: HumanReviewData }
  | { type: 'regeneration_started'; data: RegenerationData }
  | { type: 'budget_warning';     data: BudgetWarningData }
  | { type: 'degradation_applied'; data: DegradationData }
  | { type: 'funnel_published';   data: { generationId: string; funnelId: string; url: string } }
  | { type: 'generation_completed'; data: GenerationCompletedData }
  | { type: 'generation_failed';  data: GenerationFailedData };
```

### A.4 Lifecycle (sequential pseudo-code)

```ts
async *generate(input: GenerationInput) {
  const ctx = await this.bootstrap(input);          // validate, auth, budget, idempotency
  yield ev('generation_started', { ... });

  // Phase 1 — Planner
  yield ev('planner_started', { ... });
  const plan = await this.runPlanner(ctx);
  yield ev('planner_completed', { archetype: plan.archetype, agents: plan.dispatch });

  // Phase 2 — parallel content + brand
  const phase2 = this.runPhase2(ctx, plan);          // returns AsyncIterable<AgentEvent>
  for await (const e of phase2) yield e;

  // Phase 3 — Fact-Check + Compliance on assembled draft
  yield ev('assembly_started', { ... });
  const draft = ctx.assemble();
  const phase3 = this.runPhase3(ctx, draft);
  for await (const e of phase3) yield e;

  // Phase 4 — QA coherence; conditional regen
  const qa = await this.runQA(ctx, draft);
  yield ev('quality_scored', qa);
  if (qa.overall < 80) {
    yield ev('regeneration_started', { failing: qa.failingDimensions });
    for await (const e of this.runPhase2Targeted(ctx, plan, qa.failingDimensions)) yield e;
  }

  // Phase 5 — Human review gating (Doc 7b)
  if (ctx.hrq.shouldQueue(draft, ctx.findings)) {
    yield ev('human_review_required', { ... });
    await ctx.hrq.enqueue(draft);                    // generation pauses; SSE stays open w/ heartbeats
    await ctx.hrq.awaitDecision();                   // resumes or rejects
  }

  // Phase 6 — Video last (longest tail)
  for await (const e of this.runPhase6(ctx, draft)) yield e;

  // Finalize
  const funnel = await this.publish(ctx, draft);
  yield ev('funnel_published', { funnelId: funnel.id, url: funnel.url });
  yield ev('generation_completed', { totalCostCents: ctx.cost.total, durationMs: ctx.elapsed() });
  await this.finalize(ctx);                           // audit log, ledger close, events
}
```

### A.5 Resumption + idempotency

- Every `agent_completed` event is paired with an `audit.agent_run` row written **before** the SSE chunk is flushed. On Actor death, `resume()` rebuilds in-memory state from these rows.
- `idempotencyKey` is `(workspaceId, userId, hash(businessProfile + options))` by default. Duplicate POSTs return the existing generation's SSE stream rather than starting a new run.
- A generation's terminal states are `completed | failed | rejected_by_review | cancelled`. Only terminal generations release the idempotency key.

### A.6 Timeouts + SLOs

| Phase | Target P50 | Hard timeout | If exceeded |
|---|---|---|---|
| Planner | 4s | 15s | Fail-fast, fallback model |
| Phase 2 (parallel) | 25s | 90s | Cancel stragglers, use cached substitutes |
| Phase 3 (FC + Compliance) | 8s | 30s | Force human review |
| Phase 4 (QA) | 5s | 20s | Skip regen, mark `quality_unknown` |
| Phase 6 (Video) | 90s | 240s | Emit `video_polishing_extended`; finish funnel without video, attach when ready |
| **Total** | ~60s | ~360s | n/a |

---

## Part B — Agent interface + 16 agent specs

### B.1 Agent interface

```ts
export interface Agent<TInput, TOutput> {
  readonly name: AgentName;
  readonly primaryModel: ModelId;
  readonly fallbackChain: ModelId[];

  /** Streamed run. Emits chunks during inference + a single 'final' at end. */
  run(input: TInput, ctx: AgentContext): AsyncIterable<AgentEvent<TOutput>>;
}

export type ModelId =
  | 'claude-opus-4-7'
  | 'claude-sonnet-4-6'
  | 'claude-haiku-4-5'
  | 'gpt-4o' | 'gpt-4o-mini'
  | 'flux-1.1-pro' | 'ideogram-v2' | 'unsplash-stock'
  | 'runway-gen-3' | 'veo-3' | 'stock-broll'
  | 'eleven-multilingual-v3' | 'cartesia-sonic';

export type AgentName =
  | 'planner' | 'hook' | 'page' | 'lead_magnet' | 'image' | 'video'
  | 'ad_copy' | 'audience' | 'email' | 'sms' | 'voice_script' | 'upsell'
  | 'fact_check' | 'compliance' | 'qa' | 'brand_guardian';

export type AgentEvent<T> =
  | { type: 'started'; ts: string }
  | { type: 'chunk';   delta: Partial<T>; raw?: string }
  | { type: 'progress'; pct: number; note?: string }
  | { type: 'final';   output: T; cost: CostRecord; cacheHits: CacheHitRecord }
  | { type: 'error';   error: AgentError; willRetry: boolean };

export interface AgentContext {
  generationId: string;
  workspaceId: string;
  language: string;
  geography: string;
  businessProfile: BusinessProfile;
  plan: PlannerOutput | null;        // null only for the Planner itself
  kb: KbClient;
  cache: PromptCacheClient;
  /** Records cost AND enforces budget. Returns recommendation (continue/downgrade/skip/halt). */
  recordCost: (
    agentName: AgentName,
    modelCalls: ModelCallRecord[],
  ) => Promise<CostRecommendation>;
  logger: Logger;
  abortSignal: AbortSignal;
  seed?: number;
}
```

### B.2 Agent catalog

Below each agent gets: input/output types, model, prompt, retrieval, est. tokens + cost, streaming behavior, retry policy, cache key.

> Cost rows below are **list rates** at time of writing (model prices change). The cost-governor (Doc 7c) reads live rates from `pricing.yaml`. Use these only for sizing the system.

---

#### B.2.1 Planner

**Purpose:** Picks the funnel archetype, decides which sub-agents to dispatch, and writes per-agent briefs.

- **Input:** `BusinessProfile`, `language`, `geography`, optional `archetypeHint`, KB top-K (industry pack).
- **Output:**
  ```ts
  type PlannerOutput = {
    archetype: 'lead_magnet_optin' | 'free_consult_booking' | 'tripwire'
             | 'webinar_evergreen' | 'application_funnel' | 'product_launch';
    rationale: string;                // 1-3 sentences, shown to user
    audienceHypothesis: string;
    primaryPromise: string;
    angles: string[];                 // 3-5 angles to test
    dispatch: {
      [k in Exclude<AgentName, 'planner'>]?: {
        brief: string;                // 60-150 word brief to that agent
        priority: 'must' | 'should' | 'optional';
        cacheKeys?: string[];
      }
    };
    estimatedCostCents: number;
    estimatedDurationMs: number;
  };
  ```
- **Model:** Opus 4.7 (high-stakes, sets the whole run). Fallback: Sonnet 4.6 â†’ GPT-4o.
- **KB retrieval:** `industry_pack(industry, geography)` top-8 + `archetype_examples(industry)` top-5.
- **System prompt (cacheable head):**
  ```
  You are the Planner agent of GoFunnelAI's autonomous generation engine.
  Your job is to decide the optimal funnel ARCHETYPE for a specific business
  and to brief the downstream agents. You do NOT write copy or design pages.

  You will be given:
  - A Business Profile (industry, offer, target customer, geography, tier).
  - An industry knowledge pack (proven funnels in this vertical).
  - Three to five archetype templates with conversion-rate ranges by industry.

  Choose the archetype that maximizes expected lead value given:
  (a) the offer's price point and sales cycle length,
  (b) the customer's awareness level (cold / warm / hot),
  (c) regulatory constraints in this geography (e.g., financial-services
      compliance pre-empts tripwire pricing patterns).

  Produce a JSON object that matches the PlannerOutput schema EXACTLY.
  Briefs must be 60-150 words, specific, and actionable. Do NOT invent
  facts about the business — if a fact is missing, instruct the relevant
  downstream agent to leave a placeholder and flag it to Fact-Check.

  Constraints:
  - Never recommend the 'tripwire' archetype for regulated verticals
    (legal, financial advisory, medical) without an explicit human-review flag.
  - For geographies with strict ad rules (DE, FR, CA-QC), require the
    Compliance agent in `dispatch` with priority 'must'.
  - If the BusinessProfile lacks a clear primary offer, the only
    archetype allowed is 'lead_magnet_optin'.
  ```
- **User prompt template:**
  ```
  Business Profile:
  {{businessProfile_json}}

  Industry KB excerpt:
  {{kb_industry_top8}}

  Archetype templates:
  {{kb_archetype_top5}}

  Language: {{language}}
  Geography: {{geography}}
  Tier: {{tier}}

  Respond with JSON only.
  ```
- **Output schema (Zod):**
  ```ts
  const PlannerOutputSchema = z.object({
    archetype: z.enum([...]),
    rationale: z.string().min(20).max(400),
    audienceHypothesis: z.string().min(20).max(300),
    primaryPromise: z.string().min(10).max(200),
    angles: z.array(z.string().min(10).max(160)).min(3).max(5),
    dispatch: z.record(z.string(), z.object({
      brief: z.string().min(50).max(900),
      priority: z.enum(['must','should','optional']),
      cacheKeys: z.array(z.string()).optional(),
    })),
    estimatedCostCents: z.number().int().nonnegative(),
    estimatedDurationMs: z.number().int().nonnegative(),
  });
  ```
- **Est. tokens / cost:** ~14K cached + 3K fresh input, 1.5K output â†’ ~$0.08 with cache, ~$0.32 cold. Sonnet fallback ~$0.04.
- **Streaming:** emit `chunk` deltas as the rationale, then dispatch briefs stream in; emit `final` only after schema-valid parse.
- **Retry policy:** 3 retries on 429/503; on schema-invalid JSON, single re-prompt with `"Your prior reply did not parse. Errors: …. Fix and resend."`; on second fail, downgrade to Sonnet and retry once.
- **Cache key:** `planner:v3:{industry}:{geography}:{tier}` — caches the head + KB excerpts (industry & archetype templates rarely change).

---

#### B.2.2 Hook

- **Input:** `PlannerOutput.dispatch.hook.brief`, `BusinessProfile`, KB hooks library.
- **Output:**
  ```ts
  type HookOutput = {
    primary: { headline: string; subhead: string; cta: string };
    variants: { headline: string; subhead: string; cta: string; angleId: string }[];   // 4-6 variants
    rationale: string;
  };
  ```
- **Model:** Sonnet 4.6. Fallback: Haiku 4.5 â†’ GPT-4o.
- **KB retrieval:** `hooks_library(industry, angle)` top-12.
- **System prompt:** "You are the Hook agent. You write headlines, subheads, and CTAs for funnels. You optimize for cold-traffic stop-power without overpromising. You always produce: one primary hook + 4-6 variants across distinct angles. You never use claims that require proof unless the brief includes verifiable proof points. You write in {{language}} with {{locale.tone}} register. You never use exclamation marks in any geography flagged 'restrained' (DE, JP, NL). Output JSON matching the HookOutput schema. Keep headlines under 70 chars; subheads under 160; CTAs 2-5 words and active-voice. If the brief is ambiguous, prefer specificity over cleverness." (~350 words including geo/locale notes.)
- **Output schema (Zod):** mirrors above with length constraints + `variants.length` between 4 and 6.
- **Est. cost:** ~$0.015 per call.
- **Streaming:** stream the `primary` first (so the user sees the hero text appearing word-by-word), then variants, then rationale.
- **Retry:** 2 retries on transient; re-prompt on length-violation.
- **Cache key:** `hook:v2:{industry}:{angle}:{language}` — caches the hooks-library few-shots.

---

#### B.2.3 Page

- **Input:** Planner brief, Hook output (if available; otherwise placeholder), KB long-form patterns.
- **Output:**
  ```ts
  type PageOutput = {
    sections: {
      type: 'hero' | 'problem' | 'agitation' | 'solution' | 'proof'
          | 'features' | 'offer' | 'guarantee' | 'faq' | 'cta_final';
      heading?: string;
      body: string;          // markdown
      blocks?: BlockSpec[];  // structured blocks for the page renderer
    }[];
    metaTitle: string;
    metaDescription: string;
    schemaOrg: Record<string, unknown>;   // JSON-LD
  };
  ```
- **Model:** Sonnet 4.6. Fallback: Sonnet 4.5 â†’ GPT-4o.
- **KB retrieval:** `page_patterns(archetype, industry)` top-8 + `competitor_pages(industry)` top-3 (de-identified excerpts).
- **System prompt:** ~600 words. Spells out: long-form copy laws (one idea per section, scannable subheads, second-person), the section order required per archetype, prohibition on fabricated stats, requirement that all proof blocks pull from the BusinessProfile testimonials/case-studies (never invented), JSON-LD requirements, and accessibility (alt-text placeholders for images the Image agent will fill).
- **Output schema:** Zod with section enums + min/max counts per archetype.
- **Est. cost:** ~$0.05 per call.
- **Streaming:** section-by-section.
- **Retry:** 2 retries; on JSON parse fail, re-prompt with parser error.
- **Cache key:** `page:v3:{archetype}:{industry}:{language}`.

---

#### B.2.4 Lead Magnet

- **Input:** Planner brief, BusinessProfile, KB lead-magnet patterns.
- **Output:**
  ```ts
  type LeadMagnetOutput = {
    title: string;
    subtitle: string;
    format: 'pdf_guide' | 'checklist' | 'template' | 'mini_course' | 'quiz' | 'calculator';
    deliverableSpec: { sections: { heading: string; body: string }[] };  // ~800-2500 words
    optinPagePromise: string;
    thankYouCopy: string;
  };
  ```
- **Model:** Sonnet 4.6. Fallback: Haiku 4.5 for `checklist`/`template`; otherwise GPT-4o.
- **KB retrieval:** `lead_magnets(industry, format)` top-5.
- **System prompt:** Specifies the criterion of "perceived value > 5 minutes of customer time investment," forbids generic content, requires deliverable to be self-contained (no upsell baked in), requires factual accuracy (Fact-Check will validate).
- **Est. cost:** ~$0.04 per call.
- **Streaming:** title/subtitle first, then deliverable sections.
- **Cache key:** `leadmagnet:v2:{industry}:{format}:{language}`.

---

#### B.2.5 Image

- **Input:** Planner brief + Page output (extracts placeholder slots) + **Brand Guardian tokens** (palette, type, mood).
- **Output:**
  ```ts
  type ImageOutput = {
    images: {
      slotId: string;             // e.g. "hero", "section.proof.0"
      url: string;
      thumbUrl: string;
      altText: string;
      modelUsed: ModelId;
      promptUsed: string;         // for reproducibility + audit
      safetyChecks: SafetyCheckResult;
    }[];
  };
  ```
- **Model:** Flux 1.1 Pro. Fallback: Ideogram v2 â†’ Unsplash stock.
- **KB retrieval:** none (style tokens come from Brand Guardian).
- **System prompt:** N/A — Flux/Ideogram take text prompts, not chat. The orchestrator constructs prompts deterministically: `"<scene>, <brand.palette>, <brand.mood>, <style modifiers>, photographic, no text, no faces of specific identifiable people"` + negative prompt block.
- **Safety:** every image goes through `safety_classifier.run()` (Doc 7a). Fails â†’ regenerate with stricter prompt; second fail â†’ fall back to stock.
- **Est. cost:** ~$0.04 / image Ã— ~4 images = ~$0.16.
- **Streaming:** progress events at 0/25/50/75/100% per slot.
- **Retry:** on safety fail, swap to Ideogram; on second fail, stock.
- **Cache key:** N/A (images are not LLM-cacheable; we cache the **prompt construction** template only).

---

#### B.2.6 Video

- **Input:** Planner brief + Hook + Image hero asset + Brand tokens.
- **Output:**
  ```ts
  type VideoOutput = {
    heroVideo: { url: string; durationS: number; modelUsed: ModelId; thumbUrl: string };
    bRoll?: { url: string; durationS: number }[];
    captions: { srt: string };
    safetyChecks: SafetyCheckResult;
  };
  ```
- **Model:** Runway Gen-3. Fallback: Veo 3 â†’ curated stock B-roll.
- **Est. cost:** ~$0.40 / clip; this is the single most expensive agent.
- **Streaming:** progress events; emits `video_polishing` after 30s so the UI can keep the user calm.
- **Retry:** 1 retry only; fall back fast.
- **Runs LAST** in Phase 6 — the funnel can publish without video and attach it asynchronously.

---

#### B.2.7 Ad Copy

- **Input:** Planner brief, Hook output, BusinessProfile.
- **Output:**
  ```ts
  type AdCopyOutput = {
    platforms: {
      platform: 'meta' | 'tiktok' | 'google_search' | 'youtube' | 'linkedin';
      variants: {
        primaryText?: string;
        headline: string;
        description?: string;
        cta: string;
        characterCounts: Record<string, number>;
        complianceFlags: string[];   // pre-flight, e.g. "uses superlative — needs proof"
      }[];
    }[];
  };
  ```
- **Model:** Sonnet 4.6. Fallback: Haiku â†’ GPT-4o-mini.
- **KB retrieval:** `ad_policy(platform, industry, geography)` top-5 + `winning_ads(industry)` top-8 (de-identified).
- **System prompt:** ~500 words. Spells out per-platform character limits, banned superlatives by geo (e.g. "best" disallowed in DE health), required disclosure phrasing, prohibition on first-person customer claims unless verified.
- **Est. cost:** ~$0.03 per call (multi-platform output).
- **Streaming:** per-platform.
- **Cache key:** `adcopy:v2:{platform}:{industry}:{geography}`.

---

#### B.2.8 Audience

- **Input:** Planner brief + BusinessProfile.
- **Output:**
  ```ts
  type AudienceOutput = {
    primaryPersona: PersonaSpec;
    secondaryPersonas: PersonaSpec[];   // 2-3
    platformTargeting: {
      meta?: { interests: string[]; behaviors: string[]; demographics: DemoSpec; excludes: string[] };
      google?: { keywords: string[]; negKeywords: string[]; demographics: DemoSpec };
      tiktok?: { interests: string[]; demographics: DemoSpec };
      linkedin?: { jobTitles: string[]; industries: string[]; seniorities: string[] };
    };
    lookalikeSeedSpec: { source: 'customer_list' | 'pixel_event' | 'crm'; eventName?: string };
  };
  ```
- **Model:** Sonnet 4.6.
- **KB retrieval:** `targeting_libraries(platform, industry)` top-5.
- **System prompt:** ~400 words. Spells out per-platform allowed targeting attributes (e.g. no "health condition" on Meta), bans for protected categories, requirement that personas include both a job/role and a job-to-be-done.
- **Est. cost:** ~$0.02 per call.
- **Cache key:** `audience:v2:{industry}:{geography}`.

---

#### B.2.9 Email

- **Input:** Planner brief, Hook, LeadMagnet, BusinessProfile.
- **Output:**
  ```ts
  type EmailOutput = {
    sequence: { dayOffsetH: number; subject: string; preheader: string; body: string; type: 'welcome' | 'value' | 'proof' | 'offer' | 'urgency' | 'win_back' }[];
    // 5-9 emails over 14 days for opt-in archetype
  };
  ```
- **Model:** Sonnet 4.6.
- **KB retrieval:** `email_sequences(archetype, industry)` top-5 + `subject_line_winners(industry)` top-12.
- **System prompt:** ~450 words. Includes CAN-SPAM/CASL/GDPR rules per geography, mandatory unsubscribe block, prohibition on deceptive subject lines, recommendation to alternate value/proof/offer emails.
- **Est. cost:** ~$0.05 per call.
- **Streaming:** email-by-email.
- **Cache key:** `email:v2:{archetype}:{industry}:{language}:{geography}`.

---

#### B.2.10 SMS

- **Input:** Planner brief, BusinessProfile, geography.
- **Output:**
  ```ts
  type SmsOutput = {
    sequence: { dayOffsetH: number; body: string; type: 'reminder' | 'value' | 'urgency' | 'reactivation' }[];
    optInLanguage: string;   // shown on opt-in form; legally required text per geo
    stopKeywords: string[];  // STOP, UNSUB, etc. for the geography
  };
  ```
- **Model:** Haiku 4.5 (short copy, low stakes per message; volume is the cost driver).
- **KB retrieval:** `sms_compliance(geography)` (e.g., TCPA US, PECR UK, LSPC Canada).
- **System prompt:** ~250 words. Hard limits: â‰¤160 chars per segment for cost; mandatory `STOP` instructions where required; prohibition on emojis in transactional messages in DE/JP.
- **Est. cost:** ~$0.005 per call.
- **Cache key:** `sms:v1:{geography}:{language}`.

---

#### B.2.11 Voice Script

- **Input:** Planner brief, Hook, BusinessProfile.
- **Output:**
  ```ts
  type VoiceScriptOutput = {
    openings: { text: string; tone: 'friendly' | 'professional' | 'urgent' }[];   // 3
    discoveryQuestions: string[];           // 6-10
    objectionHandlers: { objection: string; response: string }[]; // 5-8
    bookingClose: { text: string; ifBooked: string; ifNot: string };
    voicemailDrop: string;
    ttsHints: { pace: 'slow'|'normal'|'fast'; emphasisTokens: string[] };
  };
  ```
- **Model:** Sonnet 4.6. (TTS synthesis is a separate ElevenLabs call, charged via voice category.)
- **System prompt:** ~400 words. Calls out TCPA, two-party consent states in the US, the disclosure-of-AI requirement in CA + NY + FR, and a hard prohibition on impersonating humans.
- **Est. cost (script only):** ~$0.02. TTS at call-time is separate.
- **Cache key:** `voice:v1:{industry}:{geography}:{language}`.

---

#### B.2.12 Upsell

- **Input:** Planner brief, BusinessProfile.
- **Output:**
  ```ts
  type UpsellOutput = {
    bumpOffer?: { title: string; copy: string; priceCents: number };
    oto1?:      { title: string; copy: string; priceCents: number; downsell?: { title: string; copy: string; priceCents: number } };
    oto2?:      { title: string; copy: string; priceCents: number };
    thankYouUpsellEnabled: boolean;
  };
  ```
- **Model:** Sonnet 4.6. Skipped entirely for archetypes that don't support paid upsells (`lead_magnet_optin`, `free_consult_booking`).
- **System prompt:** ~300 words. Forbids manipulative scarcity ("only 3 spots left" without proof), requires the upsell to be a true logical extension, requires explicit price disclosure, must comply with FTC negative-option rules.
- **Est. cost:** ~$0.02 per call.
- **Cache key:** `upsell:v2:{archetype}:{industry}`.

---

#### B.2.13 Fact-Check

- **Input:** The assembled draft (all Phase-2 outputs).
- **Output:**
  ```ts
  type FactCheckOutput = {
    findings: {
      severity: 'block' | 'fix' | 'note';
      location: { agent: AgentName; path: string; excerpt: string };
      claim: string;
      verdict: 'unverifiable' | 'contradicted_by_profile' | 'fabricated_stat' | 'ok';
      suggestion?: string;
    }[];
    pass: boolean;        // true iff zero 'block'
  };
  ```
- **Model:** Opus 4.7 (high-stakes; this is the agent that catches hallucinations). Fallback: Sonnet 4.6 + extra retrieval depth.
- **KB retrieval:** `factual_grounding({businessProfile.id})` — pulls every claim source the user has provided.
- **System prompt:** ~700 words. Defines the four verdict classes, requires citing the BusinessProfile field that contradicts each problematic claim, instructs that any quantitative claim without a source in the BusinessProfile is `fabricated_stat`, allows generic best-practice statements only when no specific number is given.
- **Est. cost:** ~$0.18 per call (assembled draft is the largest input).
- **Streaming:** finding-by-finding.
- **Retry:** 3 retries on transient; never downgrades (this agent must be high-quality).
- **Cache key:** prompt-head only; assembled draft is unique per generation.

---

#### B.2.14 Compliance

- **Input:** Assembled draft + Planner archetype + geography.
- **Output:**
  ```ts
  type ComplianceOutput = {
    findings: {
      severity: 'block' | 'fix' | 'note';
      ruleId: string;            // references Doc 7a Â§X.Y
      location: { agent: AgentName; path: string; excerpt: string };
      rationale: string;
      suggestedFix?: string;
    }[];
    geographyApplied: string[];   // e.g., ['US-FTC', 'CA-CASL', 'EU-UCPD']
    pass: boolean;
  };
  ```
- **Model:** Opus 4.7. Fallback: Sonnet 4.6 + larger ruleset retrieval.
- **KB retrieval:** `compliance_rules({geography, industry, archetype})` top-30 (the largest single KB call in the system — this is why we cache it).
- **System prompt:** ~750 words. Spells out the rule taxonomy (FTC, GDPR/UCPD, CASL, TCPA, vertical-specific like HIPAA-adjacent for health/wellness, FINRA-adjacent for financial). Requires citing a `ruleId` for every finding. Forbids generic "consult a lawyer" outputs — must be specific.
- **Est. cost:** ~$0.20 per call.
- **Cache key:** `compliance:v4:{geography}:{industry}:{archetype}` — the rules pack is the high-value cache hit.

---

#### B.2.15 QA

- **Input:** Assembled draft + Fact-Check + Compliance findings.
- **Output:**
  ```ts
  type QAOutput = {
    overall: number;             // 0-100
    dimensions: {
      promiseConsistency: number;
      voiceConsistency: number;
      offerCoherence: number;
      audienceAlignment: number;
      ctaProgression: number;
      designContentAlignment: number;
      factualSoundness: number;       // mirrors FC
      complianceSoundness: number;    // mirrors Compliance
      conversionReadiness: number;
    };
    failingDimensions: { name: string; reason: string; suggestedAgentsToRerun: AgentName[] }[];
    notes: string;
  };
  ```
- **Model:** Opus 4.7. Fallback: Sonnet 4.6.
- **System prompt:** ~500 words. Defines the 9 dimensions, scoring rubrics (90-100 launchable, 80-89 launchable-with-notes, <80 regen required), and the mapping from a failing dimension to which agents to re-run.
- **Est. cost:** ~$0.10 per call.
- **Cache key:** prompt-head only.

---

#### B.2.16 Brand Guardian

- **Input:** BusinessProfile (which may include logo URL, brand colors, voice samples).
- **Output:**
  ```ts
  type BrandTokensOutput = {
    palette: { primary: string; secondary: string; accent: string; bg: string; fg: string };
    typography: { headingFont: string; bodyFont: string; scale: number[] };
    voice: { register: 'formal' | 'casual' | 'authoritative' | 'playful'; bannedWords: string[]; signaturePhrases: string[] };
    imagery: { mood: string; lighting: string; subjectGuidance: string };
    logoUsage?: { url: string; clearspace: string; minWidthPx: number };
  };
  ```
- **Model:** Sonnet 4.6. Fallback: Haiku 4.5.
- **System prompt:** ~350 words. If the BusinessProfile has explicit brand assets, use them verbatim; if it doesn't, derive defaults from industry and a 6-question heuristic. Output is consumed by Image, Video, and Page agents — must be deterministic given the same input.
- **Est. cost:** ~$0.015 per call.
- **Cache key:** `brand:v2:{workspaceId}` — same workspace usually has the same brand.

---

## Part C — Parallelization + dependency graph

### C.1 The DAG

```
                     â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
                     â”‚  Planner    â”‚   Phase 1 (sequential)
                     â”‚  (Opus)     â”‚
                     â””â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”˜
                            â”‚ outputs archetype + dispatch + briefs
                            â–¼
   â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
   â–¼          â–¼          â–¼          â–¼          â–¼          â–¼          â–¼          â–¼          â–¼          â–¼
 Hook      Page    LeadMagnet  AdCopy   Audience   Email     SMS    VoiceScr   Upsell  BrandGuard      Phase 2
                                                                                          â”‚             (parallel)
                                                                                          â”‚ outputs brand tokens
                                                                                          â–¼
                                                                                  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
                                                                                  â”‚ Image (Flux)  â”‚  starts ONLY
                                                                                  â””â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”˜  after BrandGuard
                                                                                          â”‚
                            (Phase 2 join — all of the above must finish)                 â”‚
                            â–¼                                                             â”‚
                     â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”                                              â”‚
                     â”‚ Assemble draft      â”‚                                              â”‚
                     â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜                                              â”‚
                               â–¼                                                          â”‚
                â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”                                        â”‚
                â–¼               â–¼                                                         â”‚
          â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”    â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”                                  Phase 3 (parallel)
          â”‚FactCheck â”‚    â”‚ Compliance â”‚                                  on assembled draft
          â”‚ (Opus)   â”‚    â”‚  (Opus)    â”‚
          â””â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”˜    â””â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”˜
                â””â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”˜
                        â–¼
                 â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
                 â”‚     QA     â”‚   Phase 4 (sequential)
                 â”‚   (Opus)   â”‚   may trigger targeted Phase-2 re-runs
                 â””â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”˜
                       â–¼
        â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
        â”‚ Human Review Queue (Doc 7b)   â”‚   Phase 5 (conditional)
        â”‚ fires if any block / QA<80 /  â”‚
        â”‚ forceHumanReview flag         â”‚
        â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                       â–¼
                â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
                â”‚  Video      â”‚   Phase 6 (sequential, LAST)
                â”‚ (Runway)    â”‚   emits 'polishing' to user;
                â””â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”˜   funnel can publish without it
                       â–¼
                â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
                â”‚   Publish   â”‚
                â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### C.2 Rules

- **Brand Guardian must finish before Image.** Image consumes brand tokens. Implementation: in Phase 2 the scheduler treats `image` as having `dependsOn: ['brand_guardian']`. All other Phase 2 agents are independent.
- **Page benefits from Hook but does not require it.** If Hook is mid-flight when Page starts, Page uses the Planner brief alone and stitches in Hook output during assembly. This avoids a long serial chain.
- **Phase 3 starts the instant Phase 2 joins.** No need to wait for Phase 6 (Video) — Fact-Check and Compliance operate on text + image alt-text, not video.
- **QA can re-trigger Phase 2 agents.** When QA emits `failingDimensions[].suggestedAgentsToRerun`, the orchestrator re-runs only those agents, then re-runs QA on the patched draft. Max one re-run cycle to bound cost.
- **Video never blocks publish.** If Video fails or runs long, the funnel publishes without it and the video attaches asynchronously via a `funnel.video_attached` event (Doc 3).

### C.3 Scheduler

```ts
// orchestrator/src/scheduler.ts
export class Phase2Scheduler {
  constructor(private agents: Map<AgentName, Agent<any, any>>) {}

  async *run(ctx: AgentContext, plan: PlannerOutput): AsyncIterable<GenerationEvent> {
    const queue: AgentName[] = (Object.keys(plan.dispatch) as AgentName[])
      .filter(name => name !== 'image');           // image waits for brand
    const inflight = new Map<AgentName, AsyncIterator<AgentEvent<any>>>();

    // launch all but image
    for (const name of queue) inflight.set(name, this.launch(ctx, name));

    let brandTokens: BrandTokensOutput | null = null;
    let imageStarted = false;

    // merge events
    while (inflight.size > 0) {
      const { name, event } = await raceNext(inflight);
      yield mapToGenerationEvent(name, event);
      if (event.type === 'final' && name === 'brand_guardian') {
        brandTokens = event.output;
        if (!imageStarted) {
          inflight.set('image', this.launch({ ...ctx, brandTokens }, 'image'));
          imageStarted = true;
        }
      }
      if (event.type === 'final' || event.type === 'error') inflight.delete(name);
    }
  }
}
```

---

## Part D — Streaming pipeline (SSE)

### D.1 Wire format

The HTTPS response is `Content-Type: text/event-stream; charset=utf-8`, `Cache-Control: no-store`, `X-Accel-Buffering: no`. Heartbeats every 15s as `: ping\n\n` comments. Each event is:

```
event: agent_chunk
id: 01HRZJ6T7XQK4MVN0P2A8XF8C7
data: {"type":"agent_chunk","data":{"agent":"hook","slot":"primary.headline","delta":"Stop wasting","cumulative":"Stop wasting"}}

```

(blank line terminator). The `id` is monotonic per generation, so a reconnecting client sends `Last-Event-ID` and we replay from the audit log.

### D.2 Event TypeScript

```ts
export type GenerationStartedData = {
  generationId: string;
  workspaceId: string;
  estimatedDurationMs: number;
  estimatedCostCents: number;
  budgetCapCents: number;
  archetypeHint?: ArchetypeId;
  ts: string;                       // ISO 8601
};

export type PlannerCompletedData = {
  generationId: string;
  archetype: ArchetypeId;
  rationale: string;
  agentsDispatched: AgentName[];
  ts: string;
};

export type AgentStartedData = {
  generationId: string;
  agent: AgentName;
  modelUsed: ModelId;
  estimatedDurationMs: number;
  ts: string;
};

export type AgentChunkData = {
  generationId: string;
  agent: AgentName;
  slot: string;                     // e.g. "primary.headline", "section.hero.body"
  delta: string;
  cumulative?: string;              // optional convenience for clients
  ts: string;
};

export type AgentCompletedData = {
  generationId: string;
  agent: AgentName;
  output: unknown;                  // typed per agent on the client
  costCents: number;
  durationMs: number;
  cacheHitRatio: number;            // 0..1
  ts: string;
};

export type QualityScoredData = {
  generationId: string;
  overall: number;
  dimensions: Record<string, number>;
  failingDimensions: { name: string; reason: string }[];
  ts: string;
};

export type ComplianceFlagData = {
  generationId: string;
  severity: 'block' | 'fix' | 'note';
  ruleId: string;
  excerpt: string;
  agent: AgentName;
  ts: string;
};

export type HumanReviewData = {
  generationId: string;
  queueId: string;
  reason: 'compliance_block' | 'factcheck_block' | 'quality_low' | 'force_flag';
  estimatedWaitMs: number;
  ts: string;
};

export type RegenerationData = {
  generationId: string;
  failing: string[];
  agentsToRerun: AgentName[];
  ts: string;
};

export type BudgetWarningData = {
  generationId: string;
  spentCents: number;
  capCents: number;
  pctUsed: number;            // 0.80 or 1.00
  ts: string;
};

export type DegradationData = {
  generationId: string;
  trigger: 'budget_100' | 'budget_150' | 'rate_limit' | 'provider_outage';
  actions: ('downgrade_model' | 'skip_optional' | 'use_cache' | 'truncate')[];
  ts: string;
};

export type GenerationCompletedData = {
  generationId: string;
  funnelId: string;
  url: string;
  totalCostCents: number;
  durationMs: number;
  ts: string;
};

export type GenerationFailedData = {
  generationId: string;
  reason: string;
  code: 'budget_overrun' | 'compliance_block' | 'provider_outage' | 'user_cancelled' | 'internal';
  partialFunnelId?: string;
  ts: string;
};
```

### D.3 React hook

```tsx
// client/src/hooks/useGeneration.ts
import { useEffect, useReducer, useRef } from 'react';

type State = {
  status: 'idle' | 'streaming' | 'completed' | 'failed' | 'awaiting_review';
  events: GenerationEvent[];
  byAgent: Partial<Record<AgentName, AgentRollup>>;
  quality?: QualityScoredData;
  cost: { spentCents: number; capCents: number };
  funnel?: { id: string; url: string };
  error?: { code: string; message: string };
};

export function useGeneration(input: GenerationInput) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const lastEventId = useRef<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    const url = `/v1/generations?idempotencyKey=${input.idempotencyKey}`;

    fetch(url, {
      method: 'POST',
      body: JSON.stringify(input),
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        ...(lastEventId.current ? { 'Last-Event-ID': lastEventId.current } : {}),
      },
      signal: ac.signal,
    }).then(async (res) => {
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf('\n\n')) >= 0) {
          const raw = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          const ev = parseSseFrame(raw);
          if (!ev) continue;
          if (ev.id) lastEventId.current = ev.id;
          dispatch({ type: 'event', event: ev.data as GenerationEvent });
        }
      }
    });

    return () => ac.abort();
  }, [input.idempotencyKey]);

  return state;
}
```

### D.4 Backpressure + reconnection

- The orchestrator writes events through an in-process queue with a 1MB high-watermark. When a slow client backs up, the orchestrator buffers up to 1MB then drops `agent_chunk` events (which are recoverable from `agent_completed.output`) — never drops state-changing events.
- On client disconnect, the GenerationActor keeps running until terminal. The client can reconnect via `GET /v1/generations/{id}/stream` with `Last-Event-ID`; we replay from the audit log.

---

## Part E — Cost accounting hooks

### E.1 Recording cost

Every agent must call `ctx.recordCost(name, modelCalls)` before returning a `final` event. `modelCalls` is an array because some agents make multiple calls (Image makes one per slot; QA may make one main + one verification).

```ts
export type ModelCallRecord = {
  model: ModelId;
  category: 'llm' | 'image' | 'video' | 'voice_tts' | 'voice_asr' | 'voice_telephony'
          | 'sms' | 'email' | 'storage' | 'scraping' | 'search';
  unitCount: number;          // tokens / images / seconds / characters / etc.
  unitRateCents: number;      // list rate at call time
  inputTokens?: number;
  outputTokens?: number;
  cachedInputTokens?: number;
  metadata?: Record<string, string | number>;
};

export type CostRecord = {
  totalCents: number;
  calls: ModelCallRecord[];
};

export type CostRecommendation = {
  status: 'ok' | 'near_limit_80' | 'exhausted' | 'overrun';
  recommendation: 'continue' | 'downgrade_next' | 'cache_if_possible' | 'skip_optional' | 'halt';
  remainingCents: number;
};
```

Under the hood `recordCost` calls `cg-svc.charge` per Doc 7c Â§2.3 and returns the governor's recommendation.

### E.2 Budget enforcement middleware

```ts
// orchestrator/src/middleware/budget.ts
export function withBudget<TIn, TOut>(agent: Agent<TIn, TOut>): Agent<TIn, TOut> {
  return {
    ...agent,
    async *run(input, ctx) {
      const status = await ctx.cg.peek(ctx.generationId);
      if (status.status === 'overrun') {
        yield { type: 'error', error: budgetExceededError(), willRetry: false };
        return;
      }
      if (status.status === 'exhausted') {
        // graceful degradation per Doc 7c Â§5
        ctx = applyDegradation(ctx, agent);
      }
      for await (const ev of agent.run(input, ctx)) {
        yield ev;
        if (ev.type === 'final') {
          const rec = await ctx.recordCost(agent.name, ev.cost.calls);
          if (rec.status === 'overrun') {
            // emit budget_overrun to parent stream
            ctx.logger.warn('budget_overrun', { agent: agent.name, ...rec });
          }
        }
      }
    },
  };
}
```

### E.3 Degradation logic

| Trigger | Actions (applied in order until under cap) |
|---|---|
| 80% spent (`near_limit_80`) | Emit `budget_warning`. Switch next not-yet-started LLM agent to Sonnet if it was Opus. Switch Image to Ideogram (cheaper) for any remaining slots. |
| 100% spent (`exhausted`) | Emit `degradation_applied`. Skip `Upsell`, `SMS`, and `Voice Script` if priority â‰  'must'. Downgrade remaining LLM agents one tier. Prefer cache hits over fresh calls. |
| 150% spent (`overrun`) | Emit `degradation_applied` with `truncate`. Skip Phase 6 (Video). Skip targeted Phase 2 re-runs. Run Phase 3 + 4 on the partial draft. Publish with a `partial: true` flag. |

The hard cap is 150% to give one breath of buffer for in-flight calls we've already paid for; the orchestrator never **starts** a new call after `overrun`.

### E.4 Ledger entry

On terminal state the orchestrator writes one row to `cost_ledger`:

```sql
INSERT INTO cost_ledger (
  generation_id, workspace_id, terminal_state,
  total_cents, budget_cents, llm_cents, image_cents, video_cents,
  voice_cents, other_cents, calls_json, started_at, ended_at
) VALUES (...);
```

…and emits `generation.cost.recorded` (Doc 3) for downstream margin reporting.

---

## Part F — Prompt caching strategy

### F.1 What we cache

Anthropic prompt caching has a 5-minute TTL (extendable to 1h on Sonnet/Opus 4.x). We use `cache_control: { type: 'ephemeral' }` markers in the system + user messages.

| Cacheable block | Approx tokens | Where it appears | Cache key |
|---|---|---|---|
| Industry KB pack | ~10K | Planner, Page, Email, AdCopy | `industry:{industry}:{geography}:v{n}` |
| Compliance rules library | ~5K | Compliance | `compliance:{geography}:{industry}:v{n}` |
| Archetype templates | ~3K | Planner | `archetypes:v{n}` |
| Hooks library | ~3K | Hook | `hooks:{industry}:v{n}` |
| Brand Guardian style guide (per workspace) | ~2K | Image, Video, Page | `brand:{workspaceId}:v{n}` |
| Few-shot examples per agent | ~3K each | All content agents | `fewshot:{agent}:{industry}:v{n}` |
| Agent system prompts (long ones) | 0.5K-1K | All | `sys:{agent}:v{n}` |

### F.2 Prompt structure for max cache hit

Order matters — Anthropic caches a prefix, so everything stable goes first:

```
system:
  [cacheable, ephemeral] Agent role + permanent constraints   <- sys:{agent}
  [cacheable, ephemeral] Few-shot examples                    <- fewshot:{agent}:{industry}
  [cacheable, ephemeral] Compliance/format rules

user:
  [cacheable, ephemeral] Industry KB excerpts                 <- industry:{industry}:{geo}
  [cacheable, ephemeral] Archetype templates (Planner only)   <- archetypes
  [cacheable, ephemeral] Brand tokens (when relevant)         <- brand:{workspaceId}
  [NOT cached] Business Profile + brief + per-call variables
```

The fresh tail is typically <2K tokens. Cache hit savings are ~90% on the cached portion â†’ on a Planner call, ~14K cached + 2K fresh costs ~$0.08 instead of ~$0.32.

### F.3 Cache warming

- Per industry per geography, we **prewarm** the top 20 industries Ã— top 8 geographies after every KB pack push, by running a no-op Planner call. This guarantees first-request latency in those slices is sub-5s.
- Brand Guardian outputs are cached at the application layer (Postgres) keyed by `(workspaceId, brandHash)` — Anthropic's TTL is too short to be useful for brand-token reuse across generations.

### F.4 Cache hit observability

Every `AgentEvent.final` carries `cacheHits: { cachedInputTokens, freshInputTokens, ratio }`. The cost ledger aggregates this per generation. We alert if `mean(cacheHitRatio)` across all generations drops below 0.55 over a 1-hour window — that's our signal that the KB packs are versioning faster than expected.

---

## Part G — Error handling + retry logic

### G.1 Error taxonomy

```ts
export type AgentError =
  | { kind: 'transient'; httpStatus: 429 | 500 | 502 | 503 | 504; provider: string }
  | { kind: 'rate_limit'; provider: string; retryAfterMs?: number }
  | { kind: 'content_policy'; provider: string; reason: string }
  | { kind: 'auth'; provider: string }
  | { kind: 'schema_invalid'; errors: z.ZodIssue[] }
  | { kind: 'safety_block'; classifier: string; reason: string }
  | { kind: 'timeout'; phase: 'connect' | 'first_byte' | 'overall' }
  | { kind: 'budget'; remainingCents: number }
  | { kind: 'cancelled' }
  | { kind: 'unknown'; raw: unknown };
```

### G.2 Retry wrapper

```ts
// orchestrator/src/middleware/retry.ts
export function withRetry<TIn, TOut>(agent: Agent<TIn, TOut>): Agent<TIn, TOut> {
  return {
    ...agent,
    async *run(input, ctx) {
      let attempt = 0;
      let model: ModelId = agent.primaryModel;
      const fallbacks = [...agent.fallbackChain];

      while (true) {
        try {
          for await (const ev of agent.run({ ...input, _modelOverride: model }, ctx)) {
            if (ev.type === 'error') throw ev.error;
            yield ev;
            if (ev.type === 'final') return;
          }
          return;
        } catch (err) {
          const e = normalize(err);
          attempt++;

          if (e.kind === 'transient' && attempt <= 3) {
            const delay = jitter(2 ** attempt * 500);   // 1s, 2s, 4s + jitter
            await sleep(delay, ctx.abortSignal);
            continue;
          }
          if (e.kind === 'rate_limit') {
            if (fallbacks.length > 0) {
              model = fallbacks.shift()!;
              ctx.logger.warn('rate_limit_downgrade', { from: agent.primaryModel, to: model });
              continue;
            }
            if (attempt <= 3) { await sleep(e.retryAfterMs ?? 5000, ctx.abortSignal); continue; }
          }
          if (e.kind === 'schema_invalid' && attempt <= 1) {
            // single re-prompt with the parser error
            (input as any)._priorErrors = e.errors;
            continue;
          }
          if (e.kind === 'content_policy') {
            ctx.logger.warn('content_policy_skip', { agent: agent.name, reason: e.reason });
            yield { type: 'error', error: e, willRetry: false };
            return;
          }
          if (e.kind === 'auth') {
            ctx.logger.error('auth_failure_alert_ops', { provider: e.provider });
            // PagerDuty alert via logger sink
            yield { type: 'error', error: e, willRetry: false };
            return;
          }

          if (fallbacks.length > 0 && attempt <= 4) {
            model = fallbacks.shift()!;
            continue;
          }

          yield { type: 'error', error: e, willRetry: false };
          return;
        }
      }
    },
  };
}
```

### G.3 Fallback chains

| Primary | Fallback 1 | Fallback 2 |
|---|---|---|
| Claude Opus 4.7 | Claude Sonnet 4.6 | GPT-4o |
| Claude Sonnet 4.6 | Claude Haiku 4.5 | GPT-4o-mini |
| Claude Haiku 4.5 | GPT-4o-mini | — |
| Flux 1.1 Pro | Ideogram v2 | Unsplash stock |
| Runway Gen-3 | Veo 3 | Curated stock B-roll |
| ElevenLabs Multilingual v3 | Cartesia Sonic | (text-only fallback; voice agent emits `voice_unavailable`) |

### G.4 Alert thresholds

| Signal | Threshold | Action |
|---|---|---|
| Auth failures | 1+ per minute, any provider | PagerDuty page on-call platform engineer |
| Rate limits | >5% of requests over 5min | Slack #ops-alerts; auto-downgrade enabled |
| Content-policy blocks | >2% of generations over 1h | Page Trust & Safety lead (Doc 7a) |
| Schema-invalid (post-retry) | >0.5% of agent calls over 1h | Page engineer; prompt regression |
| Budget overruns | >1% of generations over 1h | Page Finance + Platform; halt new generations from biggest spenders |
| Cache hit ratio mean | <0.55 over 1h | Slack #ops-alerts; KB version may have broken cache |
| Generation P50 | >90s over 15min | Slack #ops-alerts; investigate provider latency |
| Generation P99 | >240s over 15min | Page on-call |

---

## Part H — Testing the orchestrator

### H.1 Fixture corpus

`tests/fixtures/business_profiles/` — 100 known-good profiles **per industry** (target 20 industries Day 90 â†’ 2,000 fixtures total). Each fixture is:

```json
{
  "id": "solar_us_residential_001",
  "industry": "solar",
  "geography": "US",
  "profile": { ... full BusinessProfile ... },
  "expected": {
    "archetype": "free_consult_booking",
    "minQuality": 85,
    "mustHaveSections": ["problem", "proof", "guarantee"],
    "complianceMustPass": true,
    "factCheckMustPass": true,
    "costBandCents": [80, 180]
  }
}
```

### H.2 Snapshot tests

- **Shape snapshots:** every agent's output snapshot-tested for **schema shape**, not exact text. Stored under `tests/__snapshots__/agents/`.
- **Determinism snapshots:** with `seed` set + cache forced on, the **archetype choice** and **section structure** must be deterministic. Text inside may vary; structure may not.
- **Diff threshold:** when an output drifts, the test reports the structural diff; engineers must rebless and write a note explaining the prompt or KB change.

### H.3 Compliance + Fact-Check regression suite

`tests/regression/compliance/` and `tests/regression/factcheck/` each hold:
- 100 **known-good** inputs (expected `pass: true`).
- 100 **known-bad** inputs (expected `pass: false` with specific `ruleId`s).

CI fails if either pass-rate drops below 97% on the good set or 95% on the bad set. The bad set is curated weekly by the Trust & Safety lead (Doc 7a) — adding new exemplars as new failure modes are observed in production.

### H.4 Cost regression tests

Nightly job runs the full fixture corpus through the orchestrator in `dry_run_no_publish` mode and asserts:
- Mean cost per generation â‰¤ `$0.85` (Day-90 target).
- P95 cost per generation â‰¤ `$1.50`.
- No single fixture exceeds its `costBandCents[1]`.

A 5% regression on the mean **fails CI** and blocks deploy.

### H.5 Load tests

`tests/load/` uses k6:
- **Steady state:** 500 parallel generations sustained for 10 minutes. Asserts P50 < 60s, P99 < 240s, zero `internal` failures.
- **Spike:** 0 â†’ 2000 generations over 30s. Asserts the queue drains within 5 minutes and no client gets dropped without a final terminal event.
- **Provider-outage drill:** chaos-monkey style — kill Anthropic for 60s, verify all in-flight generations succeed via fallback (GPT-4o) within the SLA.

### H.6 Local dev harness

```bash
pnpm orchestrator:dev              # runs the worker locally w/ wrangler
pnpm orchestrator:gen --fixture solar_us_residential_001 --tail   # streams SSE to stdout
pnpm orchestrator:replay <generationId>                            # replays from audit log
pnpm orchestrator:bench --industries solar,coaching,ecommerce      # cost+latency bench across fixtures
```

---

## Appendix — Repo layout, env vars, deploy

### Repo layout

```
funnel-orchestrator/
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ orchestrator.ts                # FunnelOrchestrator class
â”‚   â”œâ”€â”€ scheduler.ts                   # Phase2Scheduler
â”‚   â”œâ”€â”€ sse.ts                         # SSE writer + Last-Event-ID replay
â”‚   â”œâ”€â”€ agents/
â”‚   â”‚   â”œâ”€â”€ planner.ts
â”‚   â”‚   â”œâ”€â”€ hook.ts
â”‚   â”‚   â”œâ”€â”€ page.ts
â”‚   â”‚   â”œâ”€â”€ lead_magnet.ts
â”‚   â”‚   â”œâ”€â”€ image.ts
â”‚   â”‚   â”œâ”€â”€ video.ts
â”‚   â”‚   â”œâ”€â”€ ad_copy.ts
â”‚   â”‚   â”œâ”€â”€ audience.ts
â”‚   â”‚   â”œâ”€â”€ email.ts
â”‚   â”‚   â”œâ”€â”€ sms.ts
â”‚   â”‚   â”œâ”€â”€ voice_script.ts
â”‚   â”‚   â”œâ”€â”€ upsell.ts
â”‚   â”‚   â”œâ”€â”€ fact_check.ts
â”‚   â”‚   â”œâ”€â”€ compliance.ts
â”‚   â”‚   â”œâ”€â”€ qa.ts
â”‚   â”‚   â””â”€â”€ brand_guardian.ts
â”‚   â”œâ”€â”€ middleware/
â”‚   â”‚   â”œâ”€â”€ retry.ts
â”‚   â”‚   â”œâ”€â”€ budget.ts
â”‚   â”‚   â”œâ”€â”€ cache.ts
â”‚   â”‚   â””â”€â”€ audit.ts
â”‚   â”œâ”€â”€ clients/                       # Anthropic, OpenAI, Flux, Runway, KB, cg-svc, HRQ
â”‚   â”œâ”€â”€ schemas/                       # Zod schemas per agent
â”‚   â”œâ”€â”€ prompts/                       # system prompts as .md, imported at build
â”‚   â””â”€â”€ types.ts
â”œâ”€â”€ tests/
â”‚   â”œâ”€â”€ fixtures/business_profiles/
â”‚   â”œâ”€â”€ regression/{compliance,factcheck}/
â”‚   â”œâ”€â”€ load/
â”‚   â””â”€â”€ __snapshots__/agents/
â”œâ”€â”€ scripts/
â”‚   â”œâ”€â”€ prewarm_cache.ts
â”‚   â””â”€â”€ bench.ts
â”œâ”€â”€ wrangler.toml                      # Cloudflare deploy
â”œâ”€â”€ serverless.yml                     # AWS deploy (secondary)
â””â”€â”€ package.json
```

### Required env vars

```
ANTHROPIC_API_KEY
OPENAI_API_KEY
FLUX_API_KEY
IDEOGRAM_API_KEY
RUNWAY_API_KEY
VEO_API_KEY
ELEVENLABS_API_KEY
KB_PG_URL                         # pgvector connection
CG_SVC_URL + CG_SVC_TOKEN         # cost governor
HRQ_SVC_URL + HRQ_SVC_TOKEN       # human review queue
EVENT_BUS_URL + EVENT_BUS_TOKEN
LOG_SINK_URL                      # OTEL / Datadog
PROMPT_CACHE_PROVIDER             # 'anthropic' (default) | 'redis-shim' (local dev)
```

### Deploy

- **Cloudflare:** `wrangler deploy --env production`. Durable Object class `GenerationActor` exported from `src/orchestrator.ts`. KV namespace `PROMPT_CACHE` (local-dev fallback only). R2 bucket `funnel-assets` for image/video output.
- **AWS:** `serverless deploy --stage production`. Lambda `funnel-orchestrator-generate`; DynamoDB table `funnel-generation-state` for Actor state.
- **Both:** require pgvector reachable from the worker (KB + audit reads). Audit writes go through `cg-svc` to keep the orchestrator stateless.

### Day-1 build order (for the team starting Monday)

1. **Day 1:** scaffold repo, types, Zod schemas, Anthropic client + prompt cache adapter, Planner agent end-to-end (system + user prompts, retry, cost recording). Wire a single SSE endpoint that runs Planner only.
2. **Day 2:** Hook, Page, Brand Guardian; assemble draft; basic SSE chunk streaming.
3. **Day 3:** LeadMagnet, AdCopy, Audience, Email, SMS, Voice Script, Upsell. Phase 2 scheduler.
4. **Day 4:** Image (Flux + Ideogram + Unsplash fallback chain), Brand Guardian â†’ Image dependency.
5. **Day 5:** Fact-Check, Compliance, QA. Phase 3 + 4. Quality-driven regen loop.
6. **Day 6:** Video (Runway + Veo + stock fallback). Phase 6 async-publish path.
7. **Day 7:** Cost governor integration end-to-end. Degradation paths. Budget warnings/halts.
8. **Day 8:** Human Review Queue integration; resumption protocol; cancel.
9. **Day 9:** React hook + SSE replay; React reducer; fixtures.
10. **Day 10:** Snapshot tests, regression suites, cost regression, load tests, prewarm script.

By end of Sprint 1 (10 working days) the orchestrator should generate end-to-end for the first 3 industries (solar, coaching, e-commerce) with full cost + quality gates.
