/**
 * Bundled stub agent registry.
 *
 * The orchestrator ships with a minimal in-process agent registry whose
 * implementations produce *schema-valid* outputs deterministically (no
 * provider calls). Production replaces these via `OrchestratorDeps.agentRegistry`
 * with the concrete agents that call Anthropic/OpenAI/Flux/Runway/etc.
 *
 * The stubs exist so:
 *   - tests have a deterministic graph end-to-end without needing 16 mocks
 *   - the package compiles and runs in a dev sandbox without API keys
 *   - the DAG/cost-meter/quality-gate paths can be exercised independently
 *
 * Every stub still calls `ctx.recordCost(...)` with a representative
 * `ModelCallRecord` so the cost meter is exercised in tests.
 */

import type {
  Agent,
  AgentContext,
  AgentEvent,
  AgentName,
  ModelCallRecord,
  ModelId,
  PlannerOutput,
  BrandTokensOutput,
  ArchetypeId,
} from "./types.js";
import {
  MYFUNNELA_ASSETS_URL,
  buildOfferIntelligence,
} from "./offer-intelligence.js";

type StubArgs = unknown;

function makeAgent<T>(args: {
  name: AgentName;
  primaryModel: ModelId;
  fallbackChain: ModelId[];
  buildOutput: (ctx: AgentContext) => T;
  estCalls?: (ctx: AgentContext) => ModelCallRecord[];
  cacheHitRatio?: number;
}): Agent<StubArgs, T> {
  return {
    name: args.name,
    primaryModel: args.primaryModel,
    fallbackChain: args.fallbackChain,
    async *run(_input, ctx) {
      yield { type: "started", ts: ctx.clock.iso() };
      const output = args.buildOutput(ctx);
      yield {
        type: "chunk",
        delta: output as Partial<T>,
        raw: JSON.stringify(output).slice(0, 64),
        slot: "stream",
      };
      const calls = args.estCalls
        ? args.estCalls(ctx)
        : [defaultLlmCall(ctx._modelOverride ?? args.primaryModel)];
      const totalCents = calls.reduce(
        (acc, c) => acc + c.unitCount * c.unitRateCents,
        0,
      );
      yield {
        type: "final",
        output,
        cost: { totalCents, calls },
        cacheHits: {
          cachedInputTokens: 14_000,
          freshInputTokens: 2_000,
          ratio: args.cacheHitRatio ?? 0.875,
        },
      };
    },
  };
}

function defaultLlmCall(model: ModelId): ModelCallRecord {
  // Rough list rates @ time of writing — Doc 19 Â§B caveat applies.
  const rate =
    model === "claude-opus-4-7"
      ? 0.0015
      : model === "claude-sonnet-4-6"
        ? 0.0003
        : model === "claude-haiku-4-5"
          ? 0.00008
          : 0.0005;
  return {
    model,
    category: "llm",
    unitCount: 2000,
    unitRateCents: rate,
    inputTokens: 16_000,
    outputTokens: 1_500,
    cachedInputTokens: 14_000,
  };
}

/* ---------------------------------------------------------------------------
 * Planner — Doc 19 Â§B.2.1
 * ------------------------------------------------------------------------ */

export const plannerAgent: Agent<StubArgs, PlannerOutput> = makeAgent<PlannerOutput>({
  name: "planner",
  primaryModel: "claude-opus-4-7",
  fallbackChain: ["claude-sonnet-4-6", "gpt-4o"],
  buildOutput: (ctx) => {
    const hint = (ctx.businessProfile as { archetype?: ArchetypeId }).archetype;
    const offerIntel = buildOfferIntelligence(ctx.businessProfile);
    const archetype: ArchetypeId = hint ?? offerIntel.archetype ?? pickArchetype(ctx);
    const ladderSummary = offerIntel.upsellLadder
      .map((step) => `${step.stage}: ${step.title}`)
      .join("; ");
    return {
      archetype,
      rationale: `Selected ${archetype} from the ${offerIntel.industryLabel} offer matrix (${offerIntel.kbVersion}) and ${ctx.businessProfile.awareness ?? "cold"} traffic awareness.`,
      audienceHypothesis: `${offerIntel.audience} who need useful proof before they trust the ${ctx.businessProfile.industry} offer.`,
      primaryPromise: offerIntel.offerStack.corePromise,
      angles: [
        `Free value first: ${offerIntel.leadMagnet.title}`,
        `Proof stack: ${offerIntel.offerStack.proofAssets.slice(0, 2).join(" + ")}`,
        `Industry ladder: ${offerIntel.upsellLadder[0]?.title ?? "Core offer"} to ${offerIntel.upsellLadder.at(-1)?.title ?? "continuity"}`,
      ],
      dispatch: {
        hook: { brief: `Write a primary hook for ${offerIntel.industryLabel} using the promise "${offerIntel.offerStack.corePromise}".`, priority: "must" },
        page: { brief: `Write the long-form page sections for ${archetype}; give ${offerIntel.leadMagnet.title} before asking for ${offerIntel.offerStack.mainCta}.`, priority: "must" },
        lead_magnet: { brief: `Package ${offerIntel.leadMagnet.title} as a ${offerIntel.leadMagnet.format} for ${offerIntel.audience}. Include qualification fields: ${offerIntel.leadMagnet.qualificationFields.join(", ")}.`, priority: "must" },
        ad_copy: { brief: `Write ads around ${offerIntel.leadMagnet.title}, ${offerIntel.offerStack.mainCta}, and the proof stack.`, priority: "must" },
        audience: { brief: `Define primary persona and targeting for ${offerIntel.audience}.`, priority: "must" },
        email: { brief: `Write a 7-email sequence that delivers ${offerIntel.leadMagnet.title}, handles objections, and leads to ${offerIntel.offerStack.mainCta}.`, priority: "must" },
        sms: { brief: `Write a 3-message follow-up SMS sequence with TCPA opt-out.`, priority: "should" },
        voice_script: { brief: `Write the RevTry outbound call script with TCPA disclosures.`, priority: "should" },
        upsell: { brief: `Stage this industry ladder without forcing it onto the landing page: ${ladderSummary}.`, priority: "should" },
        brand_guardian: { brief: `Derive brand tokens from the supplied logo + voice samples (or defaults).`, priority: "must" },
        image: { brief: `Generate channel assets from the manifest: ${offerIntel.creativeAssets.map((asset) => `${asset.channel}/${asset.slotId}`).join(", ")}.`, priority: "must" },
        video: { brief: `Generate a 12s hero video using the hero image as the seed frame.`, priority: "should" },
        fact_check: { brief: `Verify every quantitative claim against BusinessProfile.proof.`, priority: "must" },
        compliance: { brief: `Apply ${ctx.geography} ad rules + GDPR/CASL/TCPA where relevant.`, priority: "must" },
        qa: { brief: `Score the 9-dimension QA rubric and identify failing dimensions.`, priority: "must" },
      },
      estimatedCostCents: 85,
      estimatedDurationMs: 60_000,
    };
  },
});

function pickArchetype(ctx: AgentContext): ArchetypeId {
  const industry = ctx.businessProfile.industry.toLowerCase();
  const price = ctx.businessProfile.price_point_cents ?? 0;
  if (industry.includes("solar") || industry.includes("real_estate")) return "free_consult_booking";
  if (industry.includes("coaching") || industry.includes("course")) return "webinar_evergreen";
  if (industry.includes("ecommerce") && price <= 5_000) return "tripwire";
  if (price >= 500_000) return "application_funnel";
  return "lead_magnet_optin";
}

/* ---------------------------------------------------------------------------
 * Content agents — all return placeholder-but-schema-valid output
 * ------------------------------------------------------------------------ */

export const hookAgent = makeAgent({
  name: "hook" as const,
  primaryModel: "claude-sonnet-4-6" as ModelId,
  fallbackChain: ["claude-haiku-4-5", "gpt-4o"] as ModelId[],
  buildOutput: (ctx) => ({
    primary: {
      headline: `What ${ctx.businessProfile.target_customer} usually miss about ${ctx.businessProfile.industry}.`,
      subhead: `60 seconds. Two scheduling options. Booked or not — you'll know.`,
      cta: "Book my slot",
    },
    variants: [
      { headline: "The 4-minute test most folks skip.", subhead: "It's worth it.", cta: "Try it free", angleId: "speed" },
      { headline: "We did the math. You shouldn't have to.", subhead: "See the number.", cta: "See my number", angleId: "math" },
      { headline: "Guaranteed or your time back.", subhead: "Yes, really.", cta: "Start now", angleId: "guarantee" },
      { headline: "If you're here you're closer than you think.", subhead: "Let's finish it.", cta: "Show me how", angleId: "closeness" },
    ],
    rationale: "Anchored on speed + risk reversal, two strongest angles for this profile.",
  }),
});

export const pageAgent = makeAgent({
  name: "page" as const,
  primaryModel: "claude-sonnet-4-6" as ModelId,
  fallbackChain: ["claude-haiku-4-5", "gpt-4o"] as ModelId[],
  buildOutput: () => ({
    sections: [
      { type: "hero", heading: "[Heading from Hook]", body: "## Hero copy stitched at assembly." },
      { type: "problem", heading: "What's actually going wrong", body: "Most people in this position lose 30% of qualified attention within 48h." },
      { type: "solution", heading: "Here's the fix", body: "Three steps. Five minutes." },
      { type: "proof", heading: "Numbers from real customers", body: "Pulled from BusinessProfile.proof.testimonials by assembly." },
      { type: "offer", heading: "The offer", body: "Detail block." },
      { type: "guarantee", heading: "Risk reversal", body: "Plain guarantee." },
      { type: "faq", heading: "FAQ", body: "Q. A. Q. A." },
      { type: "cta_final", heading: "Ready?", body: "Pick a slot." },
    ],
    metaTitle: "Find out in 4 minutes",
    metaDescription: "Free, no-strings 4-minute review.",
    schemaOrg: { "@context": "https://schema.org", "@type": "Service" },
  }),
});

export const leadMagnetAgent = makeAgent({
  name: "lead_magnet" as const,
  primaryModel: "claude-sonnet-4-6" as ModelId,
  fallbackChain: ["claude-haiku-4-5", "gpt-4o"] as ModelId[],
  buildOutput: () => ({
    title: "The 7-Question Pre-Qualification Checklist",
    subtitle: "Print, fill, save 30 minutes on your next call.",
    format: "checklist",
    deliverableSpec: {
      sections: [
        { heading: "1. What's your timeline?", body: "Anchor expectations." },
        { heading: "2. Who else is involved?", body: "Identify decision-makers." },
      ],
    },
    optinPagePromise: "Get the checklist — sent to your inbox in 60s.",
    thankYouCopy: "Check your inbox. If it's not there in 2 minutes, check spam.",
  }),
});

export const imageAgent = makeAgent({
  name: "image" as const,
  primaryModel: "flux-1.1-pro" as ModelId,
  fallbackChain: ["ideogram-v2", "unsplash-stock"] as ModelId[],
  buildOutput: (ctx) => ({
    images: [
      {
        slotId: "hero",
        url: `https://assets.gofunnelai.com/${ctx.generationId}/hero.webp`,
        thumbUrl: `https://assets.gofunnelai.com/${ctx.generationId}/hero_thumb.webp`,
        altText: `Hero image for ${ctx.businessProfile.industry}`,
        modelUsed: "flux-1.1-pro" as ModelId,
        promptUsed: "scene, brand palette, brand mood, no text, no faces",
        safetyChecks: { ok: true },
      },
    ],
  }),
  estCalls: (ctx) => [
    {
      model: ctx._modelOverride ?? "flux-1.1-pro",
      category: "image",
      unitCount: 4,
      unitRateCents: 4,
    },
  ],
});

export const videoAgent = makeAgent({
  name: "video" as const,
  primaryModel: "runway-gen-3" as ModelId,
  fallbackChain: ["veo-3", "stock-broll"] as ModelId[],
  buildOutput: (ctx) => ({
    heroVideo: {
      url: `https://assets.gofunnelai.com/${ctx.generationId}/hero.mp4`,
      durationS: 12,
      modelUsed: "runway-gen-3" as ModelId,
      thumbUrl: `https://assets.gofunnelai.com/${ctx.generationId}/hero_video_thumb.webp`,
    },
    bRoll: [],
    captions: { srt: "1\n00:00:00,000 --> 00:00:12,000\nHero copy" },
    safetyChecks: { ok: true },
  }),
  estCalls: (ctx) => [
    {
      model: ctx._modelOverride ?? "runway-gen-3",
      category: "video",
      unitCount: 1,
      unitRateCents: 40,
    },
  ],
});

export const adCopyAgent = makeAgent({
  name: "ad_copy" as const,
  primaryModel: "claude-sonnet-4-6" as ModelId,
  fallbackChain: ["claude-haiku-4-5", "gpt-4o-mini"] as ModelId[],
  buildOutput: () => ({
    platforms: [
      {
        platform: "meta",
        variants: [
          {
            primaryText: "Meta primary ad text.",
            headline: "Meta headline.",
            description: "Short description.",
            cta: "Learn more",
            characterCounts: { primaryText: 21, headline: 14 },
            complianceFlags: [],
          },
        ],
      },
      {
        platform: "google_search",
        variants: [
          {
            headline: "G Search h1",
            description: "G Search desc",
            cta: "Visit",
            characterCounts: { headline: 11 },
            complianceFlags: [],
          },
        ],
      },
    ],
  }),
});

export const audienceAgent = makeAgent({
  name: "audience" as const,
  primaryModel: "claude-sonnet-4-6" as ModelId,
  fallbackChain: ["claude-haiku-4-5", "gpt-4o-mini"] as ModelId[],
  buildOutput: () => ({
    primaryPersona: { role: "Primary buyer", jobToBeDone: "Save 30 minutes per intake" },
    secondaryPersonas: [{ role: "Influencer", jobToBeDone: "Validate the choice" }],
    platformTargeting: {
      meta: { interests: ["category interests"], behaviors: [], demographics: { age: [25, 64] }, excludes: [] },
      google: { keywords: ["primary keyword"], negKeywords: ["free"], demographics: { age: [25, 64] } },
    },
    lookalikeSeedSpec: { source: "customer_list" },
  }),
});

export const emailAgent = makeAgent({
  name: "email" as const,
  primaryModel: "claude-sonnet-4-6" as ModelId,
  fallbackChain: ["claude-haiku-4-5", "gpt-4o-mini"] as ModelId[],
  buildOutput: () => ({
    sequence: [
      { dayOffsetH: 0, subject: "Welcome", preheader: "Thanks for opting in", body: "Welcome.", type: "welcome" },
      { dayOffsetH: 24, subject: "Quick win", preheader: "5 min read", body: "Value.", type: "value" },
      { dayOffsetH: 72, subject: "Proof", preheader: "What customers say", body: "Proof.", type: "proof" },
      { dayOffsetH: 168, subject: "Offer", preheader: "Specific path", body: "Offer.", type: "offer" },
      { dayOffsetH: 240, subject: "Last call", preheader: "Honest nudge", body: "Urgency.", type: "urgency" },
    ],
  }),
});

export const smsAgent = makeAgent({
  name: "sms" as const,
  primaryModel: "claude-haiku-4-5" as ModelId,
  fallbackChain: ["gpt-4o-mini"] as ModelId[],
  buildOutput: (ctx) => ({
    sequence: [
      { dayOffsetH: 0, body: `Hi — thanks for opting in. Reply STOP to opt out.`, type: "reminder" },
      { dayOffsetH: 24, body: `Still curious about ${ctx.businessProfile.industry}? Reply Y for two slots.`, type: "reminder" },
    ],
    optInLanguage: "By providing your number you agree to receive automated SMS. Msg+data rates may apply. Reply STOP to opt out.",
    stopKeywords: ["STOP", "UNSUB", "UNSUBSCRIBE"],
  }),
});

export const voiceScriptAgent = makeAgent({
  name: "voice_script" as const,
  primaryModel: "claude-sonnet-4-6" as ModelId,
  fallbackChain: ["claude-haiku-4-5"] as ModelId[],
  buildOutput: () => ({
    openings: [
      { text: "Hi, this is your AI assistant calling on behalf of {{business_name}}. Got a quick minute?", tone: "friendly" },
    ],
    discoveryQuestions: ["What made you check this out?", "How soon would you want this handled?"],
    objectionHandlers: [{ objection: "price", response: "Totally fair — here's the math." }],
    bookingClose: { text: "Tuesday at 2 or Thursday at 11?", ifBooked: "Locked in.", ifNot: "All good — I'll send the info." },
    voicemailDrop: "Hey {{first_name}} — this is {{agent_name}} from {{business_name}}, just following up. No rush.",
    ttsHints: { pace: "normal", emphasisTokens: ["{{first_name}}"] },
  }),
});

export const upsellAgent = makeAgent({
  name: "upsell" as const,
  primaryModel: "claude-sonnet-4-6" as ModelId,
  fallbackChain: ["claude-haiku-4-5"] as ModelId[],
  buildOutput: () => ({
    bumpOffer: { title: "Add a 1:1 call", copy: "Skip the back-and-forth.", priceCents: 4_900 },
    oto1: undefined,
    oto2: undefined,
    thankYouUpsellEnabled: false,
  }),
});

const offerHookAgent = makeAgent({
  name: "hook" as const,
  primaryModel: "claude-sonnet-4-6" as ModelId,
  fallbackChain: ["claude-haiku-4-5", "gpt-4o"] as ModelId[],
  buildOutput: (ctx) => {
    const offerIntel = buildOfferIntelligence(ctx.businessProfile);
    return {
      primary: {
        headline: offerIntel.offerStack.corePromise,
        subhead: offerIntel.leadMagnet.promise,
        cta: offerIntel.offerStack.mainCta,
      },
      variants: [
        {
          headline: `Get ${offerIntel.leadMagnet.title} before you decide.`,
          subhead: offerIntel.leadMagnet.optinPagePromise,
          cta: "Get the free plan",
          angleId: "free-value",
        },
        {
          headline: "Know the numbers before the sales call.",
          subhead: offerIntel.offerStack.riskReversal,
          cta: offerIntel.offerStack.mainCta,
          angleId: "proof-first",
        },
        {
          headline: `The ${offerIntel.industryLabel} shortcut that still shows its work.`,
          subhead: offerIntel.offerStack.proofAssets.slice(0, 2).join(" + "),
          cta: "Show me",
          angleId: "proof-stack",
        },
        {
          headline: "Start free. Move only when the fit is clear.",
          subhead: offerIntel.offerStack.objectionHandlers[0] ?? "No-pressure next step.",
          cta: offerIntel.offerStack.mainCta,
          angleId: "risk-reversal",
        },
      ],
      rationale: `Anchored on the ${offerIntel.industryLabel} offer matrix: useful free value, proof, and staged follow-up.`,
    };
  },
});

const offerPageAgent = makeAgent({
  name: "page" as const,
  primaryModel: "claude-sonnet-4-6" as ModelId,
  fallbackChain: ["claude-haiku-4-5", "gpt-4o"] as ModelId[],
  buildOutput: (ctx) => {
    const offerIntel = buildOfferIntelligence(ctx.businessProfile);
    return {
      sections: [
        { type: "hero", heading: offerIntel.offerStack.corePromise, body: offerIntel.leadMagnet.promise },
        { type: "lead_magnet", heading: offerIntel.leadMagnet.title, body: offerIntel.leadMagnet.modules.join("\n") },
        { type: "problem", heading: "What usually blocks the decision", body: offerIntel.offerStack.objectionHandlers.join("\n") },
        { type: "proof", heading: "Proof required before publish", body: offerIntel.offerStack.proofAssets.join("\n") },
        { type: "offer", heading: "No-pressure next step", body: offerIntel.offerStack.riskReversal },
        { type: "upsell_path", heading: "Follow-up ladder", body: offerIntel.upsellLadder.map((step) => `${step.title}: ${step.copy}`).join("\n") },
        { type: "faq", heading: "FAQ", body: `How is the free asset delivered?\n${offerIntel.leadMagnet.delivery}` },
        { type: "cta_final", heading: offerIntel.offerStack.mainCta, body: offerIntel.leadMagnet.optinPagePromise },
      ],
      metaTitle: `${offerIntel.leadMagnet.title} | ${offerIntel.industryLabel}`,
      metaDescription: offerIntel.leadMagnet.promise,
      schemaOrg: { "@context": "https://schema.org", "@type": "Service" },
    };
  },
});

const offerLeadMagnetAgent = makeAgent({
  name: "lead_magnet" as const,
  primaryModel: "claude-sonnet-4-6" as ModelId,
  fallbackChain: ["claude-haiku-4-5", "gpt-4o"] as ModelId[],
  buildOutput: (ctx) => {
    const offerIntel = buildOfferIntelligence(ctx.businessProfile);
    return {
      title: offerIntel.leadMagnet.title,
      subtitle: offerIntel.leadMagnet.promise,
      format: offerIntel.leadMagnet.format,
      deliverableSpec: {
        sections: offerIntel.leadMagnet.modules.map((module, index) => ({
          heading: `${index + 1}. ${module}`,
          body: `Build this section around ${offerIntel.leadMagnet.qualificationFields[index] ?? "buyer context"} and keep every claim source-backed.`,
        })),
        qualificationFields: offerIntel.leadMagnet.qualificationFields,
        creationPlan: offerIntel.leadMagnet.creationPlan,
      },
      optinPagePromise: offerIntel.leadMagnet.optinPagePromise,
      thankYouCopy: `Your ${offerIntel.leadMagnet.title} is on the way. Review it first, then use the next step only if the fit is clear: ${offerIntel.offerStack.mainCta}.`,
    };
  },
});

const offerImageAgent = makeAgent({
  name: "image" as const,
  primaryModel: "flux-1.1-pro" as ModelId,
  fallbackChain: ["ideogram-v2", "unsplash-stock"] as ModelId[],
  buildOutput: (ctx) => {
    const offerIntel = buildOfferIntelligence(ctx.businessProfile);
    return {
      images: offerIntel.creativeAssets.map((asset) => ({
        slotId: asset.slotId,
        url: `${MYFUNNELA_ASSETS_URL}/${ctx.generationId}/${asset.slotId}.webp`,
        thumbUrl: `${MYFUNNELA_ASSETS_URL}/${ctx.generationId}/${asset.slotId}_thumb.webp`,
        altText: `${asset.channel} asset for ${offerIntel.industryLabel}: ${asset.description}`,
        modelUsed: "flux-1.1-pro" as ModelId,
        promptUsed: asset.prompt,
        safetyChecks: { ok: asset.status !== "blocked", license: asset.license, reviewStatus: asset.status },
      })),
      manifest: offerIntel.creativeAssets,
    };
  },
  estCalls: (ctx) => [
    {
      model: ctx._modelOverride ?? "flux-1.1-pro",
      category: "image",
      unitCount: Math.max(1, buildOfferIntelligence(ctx.businessProfile).creativeAssets.length),
      unitRateCents: 4,
    },
  ],
});

const offerVideoAgent = makeAgent({
  name: "video" as const,
  primaryModel: "runway-gen-3" as ModelId,
  fallbackChain: ["veo-3", "stock-broll"] as ModelId[],
  buildOutput: (ctx) => {
    const offerIntel = buildOfferIntelligence(ctx.businessProfile);
    return {
      heroVideo: {
        url: `${MYFUNNELA_ASSETS_URL}/${ctx.generationId}/hero.mp4`,
        durationS: 12,
        modelUsed: "runway-gen-3" as ModelId,
        thumbUrl: `${MYFUNNELA_ASSETS_URL}/${ctx.generationId}/hero_video_thumb.webp`,
      },
      bRoll: offerIntel.creativeAssets.map((asset) => ({
        slotId: asset.slotId,
        prompt: `${asset.prompt} Short motion variant for ${asset.channel}.`,
      })),
      captions: { srt: `1\n00:00:00,000 --> 00:00:12,000\n${offerIntel.offerStack.corePromise}` },
      safetyChecks: { ok: true, compliance: offerIntel.evidence.find((item) => item.area === "Crisis response")?.proof },
    };
  },
  estCalls: (ctx) => [
    {
      model: ctx._modelOverride ?? "runway-gen-3",
      category: "video",
      unitCount: 1,
      unitRateCents: 40,
    },
  ],
});

const offerUpsellAgent = makeAgent({
  name: "upsell" as const,
  primaryModel: "claude-sonnet-4-6" as ModelId,
  fallbackChain: ["claude-haiku-4-5"] as ModelId[],
  buildOutput: (ctx) => {
    const offerIntel = buildOfferIntelligence(ctx.businessProfile);
    const bump = offerIntel.upsellLadder.find((step) => step.stage === "order_bump");
    const tripwire = offerIntel.upsellLadder.find((step) => step.stage === "tripwire");
    const oto = offerIntel.upsellLadder.find(
      (step) => step.stage === "one_click_upsell" || step.stage === "continuity",
    );
    return {
      bumpOffer: bump
        ? { title: bump.title, copy: bump.copy, priceCents: bump.priceCents ?? 0, trigger: bump.trigger }
        : undefined,
      oto1: oto ? { title: oto.title, copy: oto.copy, priceCents: oto.priceCents ?? 0, trigger: oto.trigger } : undefined,
      oto2: tripwire
        ? { title: tripwire.title, copy: tripwire.copy, priceCents: tripwire.priceCents ?? 0, trigger: tripwire.trigger }
        : undefined,
      thankYouUpsellEnabled: offerIntel.upsellLadder.length > 0,
      ladder: offerIntel.upsellLadder,
      evidence: offerIntel.evidence.filter((item) => item.area.includes("Upsell") || item.area.includes("Unit economics")),
    };
  },
});

/* ---------------------------------------------------------------------------
 * Brand Guardian
 * ------------------------------------------------------------------------ */

export const brandGuardianAgent: Agent<StubArgs, BrandTokensOutput> = makeAgent<BrandTokensOutput>({
  name: "brand_guardian",
  primaryModel: "claude-sonnet-4-6",
  fallbackChain: ["claude-haiku-4-5"],
  buildOutput: (ctx) => ({
    palette: {
      primary: ctx.businessProfile.brand?.primary_color ?? "#0F172A",
      secondary: "#3B82F6",
      accent: "#F59E0B",
      bg: "#FFFFFF",
      fg: "#0F172A",
    },
    typography: { headingFont: "Inter", bodyFont: "Inter", scale: [14, 16, 18, 24, 32, 48] },
    voice: { register: "casual", bannedWords: [], signaturePhrases: [] },
    imagery: {
      mood: "clean modern",
      lighting: "natural daylight",
      subjectGuidance: "no faces of specific identifiable people",
    },
    logoUsage: ctx.businessProfile.brand?.logo_url
      ? { url: ctx.businessProfile.brand.logo_url, clearspace: "1x logo height", minWidthPx: 120 }
      : undefined,
  }),
});

/* ---------------------------------------------------------------------------
 * Fact-Check, Compliance, QA
 * ------------------------------------------------------------------------ */

export const factCheckAgent = makeAgent({
  name: "fact_check" as const,
  primaryModel: "claude-opus-4-7" as ModelId,
  fallbackChain: ["claude-sonnet-4-6"] as ModelId[],
  buildOutput: () => ({ findings: [], pass: true }),
});

export const complianceAgent = makeAgent({
  name: "compliance" as const,
  primaryModel: "claude-opus-4-7" as ModelId,
  fallbackChain: ["claude-sonnet-4-6"] as ModelId[],
  buildOutput: (ctx) => ({
    findings: [],
    geographyApplied: complianceRulesetsFor(ctx.geography),
    pass: true,
  }),
});

function complianceRulesetsFor(geography: string): string[] {
  switch (geography.toUpperCase()) {
    case "US":
      return ["US-FTC", "US-TCPA", "US-CAN-SPAM"];
    case "CA":
      return ["CA-CASL", "CA-CRTC"];
    case "GB":
      return ["UK-CAP", "UK-PECR"];
    case "DE":
    case "FR":
    case "NL":
      return ["EU-UCPD", "EU-GDPR", `${geography.toUpperCase()}-LOCAL`];
    default:
      return ["EU-GDPR"];
  }
}

export const qaAgent = makeAgent({
  name: "qa" as const,
  primaryModel: "claude-opus-4-7" as ModelId,
  fallbackChain: ["claude-sonnet-4-6"] as ModelId[],
  buildOutput: () => ({
    overall: 87,
    dimensions: {
      promiseConsistency: 88,
      voiceConsistency: 86,
      offerCoherence: 88,
      audienceAlignment: 90,
      ctaProgression: 86,
      designContentAlignment: 84,
      factualSoundness: 92,
      complianceSoundness: 91,
      conversionReadiness: 85,
    },
    failingDimensions: [],
    notes: "Launchable.",
  }),
});

/* ---------------------------------------------------------------------------
 * Registry
 * ------------------------------------------------------------------------ */

export function defaultAgentRegistry(): Map<AgentName, Agent<unknown, unknown>> {
  const m = new Map<AgentName, Agent<unknown, unknown>>();
  m.set("planner", plannerAgent as Agent<unknown, unknown>);
  m.set("hook", offerHookAgent as Agent<unknown, unknown>);
  m.set("page", offerPageAgent as Agent<unknown, unknown>);
  m.set("lead_magnet", offerLeadMagnetAgent as Agent<unknown, unknown>);
  m.set("image", offerImageAgent as Agent<unknown, unknown>);
  m.set("video", offerVideoAgent as Agent<unknown, unknown>);
  m.set("ad_copy", adCopyAgent as Agent<unknown, unknown>);
  m.set("audience", audienceAgent as Agent<unknown, unknown>);
  m.set("email", emailAgent as Agent<unknown, unknown>);
  m.set("sms", smsAgent as Agent<unknown, unknown>);
  m.set("voice_script", voiceScriptAgent as Agent<unknown, unknown>);
  m.set("upsell", offerUpsellAgent as Agent<unknown, unknown>);
  m.set("brand_guardian", brandGuardianAgent as Agent<unknown, unknown>);
  m.set("fact_check", factCheckAgent as Agent<unknown, unknown>);
  m.set("compliance", complianceAgent as Agent<unknown, unknown>);
  m.set("qa", qaAgent as Agent<unknown, unknown>);
  return m;
}
