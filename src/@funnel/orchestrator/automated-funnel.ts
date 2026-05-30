import {
  MYFUNNELA_APP_URL,
  buildOfferIntelligence,
  type OfferIntelligenceProfile,
  type OfferIntelligenceResult,
  type UpsellLadderStep,
} from "./offer-intelligence.js";

export type FunnelAssetStatus = "ready" | "queued" | "fallback";
export type FunnelAssetProvider = "openai" | "replicate" | "stock" | "local-svg";

export interface FunnelStyleGuide {
  name: string;
  palette: {
    background: string;
    surface: string;
    ink: string;
    muted: string;
    primary: string;
    secondary: string;
    accent: string;
  };
  typography: {
    heading: string;
    body: string;
  };
  radius: string;
  shadow: string;
  visualMotif: string;
  button: {
    label: string;
    gradient: string;
  };
}

export interface FunnelAsset {
  id: string;
  role: "hero" | "lead_magnet" | "proof" | "ad" | "upsell";
  kind: "image";
  provider: FunnelAssetProvider;
  status: FunnelAssetStatus;
  url: string;
  alt: string;
  prompt: string;
  storageKey: string | null;
}

export interface FunnelFormField {
  id: string;
  label: string;
  type: "text" | "email" | "tel" | "number" | "select";
  required: boolean;
  placeholder?: string;
  options?: string[];
}

export interface FunnelCta {
  label: string;
  action: "submit_lead" | "book_call" | "buy" | "next_page";
  target?: string;
}

export interface AutomatedFunnelSection {
  id: string;
  type:
    | "hero"
    | "logo_proof"
    | "lead_magnet"
    | "problem_story"
    | "proof_stack"
    | "qualification_form"
    | "offer_stack"
    | "upsell_ladder"
    | "faq"
    | "final_cta"
    | "thank_you"
    | "upsell_offer";
  eyebrow?: string;
  title: string;
  body: string;
  bullets?: string[];
  assetId?: string;
  cta?: FunnelCta;
  fields?: FunnelFormField[];
  cards?: Array<{ title: string; body: string; meta?: string }>;
}

export interface AutomatedFunnelPage {
  id: "landing" | "thank_you" | "upsell";
  path: string;
  title: string;
  goal: string;
  sections: AutomatedFunnelSection[];
}

export interface FunnelAutomationPlan {
  status: "fully_automated";
  userWorkRequired: "none";
  steps: Array<{
    id: string;
    label: string;
    engine: "openai" | "anthropic" | "replicate" | "signalwire" | "stripe" | "paypal" | "resend" | "railway";
    state: "local_fallback_ready" | "credential_required" | "ready";
  }>;
}

export interface ProviderReadiness {
  googleAuth: boolean;
  openai: boolean;
  anthropic: boolean;
  replicate: boolean;
  railwayStorage: boolean;
  resend: boolean;
  stripe: boolean;
  paypal: boolean;
  signalwire: boolean;
}

export interface AutomatedFunnel {
  id: string;
  workspace_id: string;
  schema_version: "gofunnelai.automated-funnel.v1";
  slug: string;
  public_url: string;
  status: "published";
  industry: string;
  audience: string;
  prompt: string;
  offer_intelligence: OfferIntelligenceResult;
  styleGuide: FunnelStyleGuide;
  assets: FunnelAsset[];
  pages: AutomatedFunnelPage[];
  automation: FunnelAutomationPlan;
  provider_readiness: ProviderReadiness;
  quality_score: number;
  generated_at: string;
}

export interface BuildAutomatedFunnelArgs {
  generationId: string;
  workspaceId: string;
  industry: string;
  audience: string;
  offer: string;
  geography?: string;
  businessName?: string;
  brandUrl?: string | null;
  appUrl?: string;
  providerReadiness?: Partial<ProviderReadiness>;
}

const DEFAULT_READINESS: ProviderReadiness = {
  googleAuth: false,
  openai: false,
  anthropic: false,
  replicate: false,
  railwayStorage: false,
  resend: false,
  stripe: false,
  paypal: false,
  signalwire: false,
};

export function buildAutomatedFunnel(args: BuildAutomatedFunnelArgs): AutomatedFunnel {
  const profile: OfferIntelligenceProfile = {
    workspace_id: args.workspaceId,
    industry: args.industry,
    geography: args.geography ?? "US",
    offer: `${args.offer} Audience: ${args.audience}. Geography: ${args.geography ?? "US"}.`,
    target_customer: args.audience,
    businessName: args.businessName,
  };
  const offerIntel = buildOfferIntelligence(profile);
  const slug = slugify(`${args.industry}-${args.generationId}`);
  const appUrl = (args.appUrl ?? MYFUNNELA_APP_URL).replace(/\/$/, "");
  const publicUrl = `${appUrl}/f/${slug}`;
  const styleGuide = buildStyleGuide(offerIntel, args.businessName);
  const assets = buildAssets(args.generationId, offerIntel, styleGuide);
  const pages = buildPages({ slug, offerIntel, styleGuide, assets });
  const provider_readiness = { ...DEFAULT_READINESS, ...(args.providerReadiness ?? {}) };

  return {
    id: args.generationId,
    workspace_id: args.workspaceId,
    schema_version: "gofunnelai.automated-funnel.v1",
    slug,
    public_url: publicUrl,
    status: "published",
    industry: args.industry,
    audience: args.audience,
    prompt: args.offer,
    offer_intelligence: offerIntel,
    styleGuide,
    assets,
    pages,
    automation: buildAutomation(provider_readiness),
    provider_readiness,
    quality_score: offerIntel.estimatedQualityScore,
    generated_at: new Date().toISOString(),
  };
}

function buildStyleGuide(offerIntel: OfferIntelligenceResult, businessName?: string): FunnelStyleGuide {
  const palette = paletteForIndustry(offerIntel.industryKey);
  return {
    name: businessName ? `${businessName} conversion system` : `${offerIntel.industryLabel} conversion system`,
    palette,
    typography: {
      heading: "Inter Tight, Inter, system-ui, sans-serif",
      body: "Inter, system-ui, sans-serif",
    },
    radius: "8px",
    shadow: "0 24px 80px rgba(15, 23, 42, 0.16)",
    visualMotif: `${offerIntel.industryLabel} page with energetic contrast, real-world proof, and high-trust lead capture.`,
    button: {
      label: offerIntel.offerStack.mainCta,
      gradient: `linear-gradient(135deg, ${palette.primary} 0%, ${palette.secondary} 48%, ${palette.accent} 100%)`,
    },
  };
}

function paletteForIndustry(industryKey: OfferIntelligenceResult["industryKey"]): FunnelStyleGuide["palette"] {
  if (industryKey === "med_spa") {
    return {
      background: "#fbf7f3",
      surface: "#ffffff",
      ink: "#16151f",
      muted: "#675f73",
      primary: "#7c3aed",
      secondary: "#db2777",
      accent: "#14b8a6",
    };
  }
  if (industryKey === "dental") {
    return {
      background: "#f4fbff",
      surface: "#ffffff",
      ink: "#0f172a",
      muted: "#475569",
      primary: "#0ea5e9",
      secondary: "#2563eb",
      accent: "#10b981",
    };
  }
  if (industryKey === "saas") {
    return {
      background: "#f8fafc",
      surface: "#ffffff",
      ink: "#0f172a",
      muted: "#475569",
      primary: "#4f46e5",
      secondary: "#0f766e",
      accent: "#f97316",
    };
  }
  if (industryKey === "insurance" || industryKey === "real_estate") {
    return {
      background: "#f7f7fb",
      surface: "#ffffff",
      ink: "#111827",
      muted: "#4b5563",
      primary: "#1d4ed8",
      secondary: "#7c3aed",
      accent: "#f59e0b",
    };
  }
  return {
    background: "#f8fafc",
    surface: "#ffffff",
    ink: "#0f172a",
    muted: "#475569",
    primary: "#6817d2",
    secondary: "#d91a8f",
    accent: "#ff7a00",
  };
}

function buildAssets(
  generationId: string,
  offerIntel: OfferIntelligenceResult,
  styleGuide: FunnelStyleGuide,
): FunnelAsset[] {
  const manifest = offerIntel.creativeAssets.slice(0, 4);
  const baseAssets = manifest.map((asset, index): FunnelAsset => {
    const role: FunnelAsset["role"] = asset.slotId.includes("proof")
      ? "proof"
      : asset.slotId.includes("ad")
        ? "ad"
        : "hero";

    return {
      id: asset.slotId,
      role,
      kind: "image",
      provider: "local-svg",
      status: "fallback",
      url: svgDataUrl({
        id: `${generationId}-${asset.slotId}`,
        title: asset.description,
        palette: styleGuide.palette,
        index,
      }),
      alt: asset.description,
      prompt: asset.prompt,
      storageKey: `generated/${generationId}/${asset.slotId}.webp`,
    };
  });

  return [
    {
      id: "hero",
      role: "hero",
      kind: "image",
      provider: "local-svg",
      status: "fallback",
      url: svgDataUrl({
        id: `${generationId}-hero`,
        title: offerIntel.offerStack.corePromise,
        palette: styleGuide.palette,
        index: 0,
      }),
      alt: `${offerIntel.industryLabel} hero visual`,
      prompt: `Premium landing page hero image for ${offerIntel.industryLabel}. ${offerIntel.offerStack.corePromise}. No text in image. ${styleGuide.visualMotif}`,
      storageKey: `generated/${generationId}/hero.webp`,
    },
    {
      id: "lead-magnet-cover",
      role: "lead_magnet",
      kind: "image",
      provider: "local-svg",
      status: "fallback",
      url: svgDataUrl({
        id: `${generationId}-lead-magnet`,
        title: offerIntel.leadMagnet.title,
        palette: styleGuide.palette,
        index: 2,
      }),
      alt: `${offerIntel.leadMagnet.title} cover visual`,
      prompt: `High-converting lead magnet cover for ${offerIntel.leadMagnet.title}. Premium SaaS-style design, no unreadable text, brand palette.`,
      storageKey: `generated/${generationId}/lead-magnet-cover.webp`,
    },
    ...baseAssets,
  ];
}

function buildPages(args: {
  slug: string;
  offerIntel: OfferIntelligenceResult;
  styleGuide: FunnelStyleGuide;
  assets: FunnelAsset[];
}): AutomatedFunnelPage[] {
  const fields = buildQualificationFields(args.offerIntel);
  const upsell = strongestUpsell(args.offerIntel.upsellLadder);
  return [
    {
      id: "landing",
      path: `/f/${args.slug}`,
      title: args.offerIntel.offerStack.corePromise,
      goal: "Capture a qualified lead after delivering useful free value.",
      sections: [
        {
          id: "hero",
          type: "hero",
          eyebrow: "Free value first",
          title: args.offerIntel.offerStack.corePromise,
          body: args.offerIntel.leadMagnet.promise,
          bullets: [
            args.offerIntel.leadMagnet.title,
            args.offerIntel.offerStack.riskReversal,
            "Instantly routes qualified leads into follow-up.",
          ],
          assetId: "hero",
          cta: { label: args.offerIntel.offerStack.mainCta, action: "submit_lead" },
        },
        {
          id: "proof-strip",
          type: "logo_proof",
          title: "Built around proof, not hype.",
          body: "Every page ships with proof requirements, compliance notes, and source-backed claims before launch.",
          bullets: args.offerIntel.offerStack.proofAssets,
        },
        {
          id: "lead-magnet",
          type: "lead_magnet",
          eyebrow: "Your free asset",
          title: args.offerIntel.leadMagnet.title,
          body: args.offerIntel.leadMagnet.optinPagePromise,
          bullets: args.offerIntel.leadMagnet.modules,
          assetId: "lead-magnet-cover",
        },
        {
          id: "story",
          type: "problem_story",
          eyebrow: "Why visitors stall",
          title: "The page answers the objection before asking for the sale.",
          body: args.offerIntel.offerStack.objectionHandlers.join(" "),
        },
        {
          id: "proof",
          type: "proof_stack",
          eyebrow: "Trust stack",
          title: "Proof required before this funnel goes live.",
          body: "GoFunnelAI packages the proof the buyer needs and flags anything that still needs a human source.",
          cards: args.offerIntel.offerStack.proofAssets.map((asset) => ({
            title: asset,
            body: "Included in the page, follow-up, or sales handoff.",
          })),
        },
        {
          id: "capture",
          type: "qualification_form",
          eyebrow: "Instant qualification",
          title: "Get the free asset and see the next best step.",
          body: args.offerIntel.leadMagnet.delivery,
          fields,
          cta: { label: args.offerIntel.offerStack.mainCta, action: "submit_lead" },
        },
        {
          id: "upsells",
          type: "upsell_ladder",
          eyebrow: "Automated next offers",
          title: "The follow-up ladder is staged behind the opt-in.",
          body: "The landing page stays clean. Upsells appear only after intent is shown.",
          cards: args.offerIntel.upsellLadder.map((step) => ({
            title: step.title,
            body: step.copy,
            meta: `${labelStage(step.stage)} - ${step.displayPrice}`,
          })),
        },
        {
          id: "faq",
          type: "faq",
          title: "Questions before you continue",
          body: "Short answers that reduce friction without burying the CTA.",
          cards: [
            {
              title: "What happens after I submit?",
              body: args.offerIntel.leadMagnet.delivery,
            },
            {
              title: "Is this a hard sell?",
              body: args.offerIntel.offerStack.riskReversal,
            },
            {
              title: "How is this specific to me?",
              body: `${args.offerIntel.industryLabel} uses ${args.offerIntel.kbVersion} and qualification fields matched to the offer.`,
            },
          ],
        },
        {
          id: "final-cta",
          type: "final_cta",
          title: args.offerIntel.offerStack.mainCta,
          body: args.offerIntel.leadMagnet.optinPagePromise,
          cta: { label: args.offerIntel.offerStack.mainCta, action: "submit_lead" },
        },
      ],
    },
    {
      id: "thank_you",
      path: `/f/${args.slug}/thank-you`,
      title: `Your ${args.offerIntel.leadMagnet.title} is ready`,
      goal: "Confirm delivery and move qualified leads to the next best offer.",
      sections: [
        {
          id: "thank-you",
          type: "thank_you",
          eyebrow: "Lead captured",
          title: `Your ${args.offerIntel.leadMagnet.title} is ready.`,
          body: "Check your inbox and review the free asset first. If the fit is clear, the next step is ready below.",
          cta: { label: upsell ? `See ${upsell.title}` : args.offerIntel.offerStack.mainCta, action: "next_page", target: `/f/${args.slug}/upsell` },
        },
      ],
    },
    {
      id: "upsell",
      path: `/f/${args.slug}/upsell`,
      title: upsell?.title ?? args.offerIntel.offerStack.mainCta,
      goal: "Present the highest-intent next offer after value is delivered.",
      sections: [
        {
          id: "upsell-offer",
          type: "upsell_offer",
          eyebrow: "Optional next step",
          title: upsell?.title ?? args.offerIntel.offerStack.mainCta,
          body: upsell?.copy ?? args.offerIntel.offerStack.riskReversal,
          bullets: [
            upsell?.trigger ?? "Shown only after the lead requests the free asset.",
            "Payment and booking adapters connect when provider keys are added.",
            "SignalWire follow-up can call or text qualified leads automatically.",
          ],
          cta: { label: upsell?.displayPrice ? `Continue - ${upsell.displayPrice}` : args.offerIntel.offerStack.mainCta, action: "book_call" },
        },
      ],
    },
  ];
}

function buildQualificationFields(offerIntel: OfferIntelligenceResult): FunnelFormField[] {
  const mapped = offerIntel.leadMagnet.qualificationFields.slice(0, 3).map((field): FunnelFormField => {
    const label = toTitle(field);
    if (field.includes("bill") || field.includes("budget") || field.includes("spend")) {
      return { id: field, label, type: "number", required: true, placeholder: "175" };
    }
    if (field.includes("phone") || field.includes("callback")) {
      return { id: field, label, type: "tel", required: false, placeholder: "(555) 555-0123" };
    }
    if (field.includes("status") || field.includes("type")) {
      return { id: field, label, type: "select", required: true, options: ["Yes", "No", "Not sure"] };
    }
    return { id: field, label, type: "text", required: true, placeholder: label };
  });

  return [
    { id: "name", label: "Name", type: "text", required: true, placeholder: "Your name" },
    { id: "email", label: "Email", type: "email", required: true, placeholder: "you@business.com" },
    ...mapped,
  ];
}

function buildAutomation(readiness: ProviderReadiness): FunnelAutomationPlan {
  return {
    status: "fully_automated",
    userWorkRequired: "none",
    steps: [
      { id: "strategy", label: "Offer, hook, lead magnet, and upsell strategy", engine: "anthropic", state: readiness.anthropic ? "ready" : "local_fallback_ready" },
      { id: "copy", label: "Landing, thank-you, upsell, ad, email, and SMS copy", engine: "openai", state: readiness.openai ? "ready" : "local_fallback_ready" },
      { id: "images", label: "Hero, lead magnet, proof, and ad graphics", engine: "replicate", state: readiness.replicate || readiness.openai ? "ready" : "local_fallback_ready" },
      { id: "storage", label: "Persist assets to Railway/R2 object storage", engine: "railway", state: readiness.railwayStorage ? "ready" : "credential_required" },
      { id: "payments", label: "Wire tripwire, order bump, and upsell checkout", engine: readiness.stripe ? "stripe" : "paypal", state: readiness.stripe || readiness.paypal ? "ready" : "credential_required" },
      { id: "voice", label: "Call and text qualified leads", engine: "signalwire", state: readiness.signalwire ? "ready" : "credential_required" },
      { id: "email", label: "Deliver the lead magnet and nurture sequence", engine: "resend", state: readiness.resend ? "ready" : "credential_required" },
    ],
  };
}

function strongestUpsell(upsells: UpsellLadderStep[]): UpsellLadderStep | null {
  return upsells.find((step) => step.stage === "order_bump")
    ?? upsells.find((step) => step.stage === "tripwire")
    ?? upsells[0]
    ?? null;
}

function labelStage(stage: UpsellLadderStep["stage"]): string {
  return stage.replace(/_/g, " ");
}

function toTitle(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return slug.length > 0 ? slug : "generated-funnel";
}

function svgDataUrl(args: {
  id: string;
  title: string;
  palette: FunnelStyleGuide["palette"];
  index: number;
}): string {
  const angle = 20 + args.index * 18;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 820" role="img" aria-label="${escapeXml(args.title)}">
  <defs>
    <linearGradient id="g-${escapeXml(args.id)}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${args.palette.primary}"/>
      <stop offset="0.52" stop-color="${args.palette.secondary}"/>
      <stop offset="1" stop-color="${args.palette.accent}"/>
    </linearGradient>
    <radialGradient id="r-${escapeXml(args.id)}" cx="70%" cy="25%" r="70%">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.72"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <filter id="blur-${escapeXml(args.id)}"><feGaussianBlur stdDeviation="42"/></filter>
  </defs>
  <rect width="1200" height="820" rx="48" fill="${args.palette.ink}"/>
  <path d="M-80 ${520 - angle} C220 ${210 + angle}, 390 ${680 - angle}, 660 ${330 + angle} S980 ${120 + angle}, 1280 ${380 - angle} L1280 900 L-80 900 Z" fill="url(#g-${escapeXml(args.id)})"/>
  <circle cx="${260 + angle}" cy="${210 + angle}" r="180" fill="${args.palette.accent}" opacity="0.55" filter="url(#blur-${escapeXml(args.id)})"/>
  <circle cx="${900 - angle}" cy="${560 - angle}" r="260" fill="${args.palette.primary}" opacity="0.45" filter="url(#blur-${escapeXml(args.id)})"/>
  <rect x="110" y="116" width="420" height="96" rx="24" fill="#fff" opacity="0.18"/>
  <rect x="110" y="244" width="640" height="36" rx="18" fill="#fff" opacity="0.35"/>
  <rect x="110" y="304" width="520" height="28" rx="14" fill="#fff" opacity="0.24"/>
  <rect x="110" y="590" width="260" height="76" rx="38" fill="#fff" opacity="0.92"/>
  <rect x="780" y="144" width="270" height="420" rx="38" fill="#fff" opacity="0.18"/>
  <rect x="822" y="194" width="186" height="24" rx="12" fill="#fff" opacity="0.5"/>
  <rect x="822" y="246" width="142" height="24" rx="12" fill="#fff" opacity="0.34"/>
  <rect x="822" y="420" width="164" height="56" rx="28" fill="#fff" opacity="0.8"/>
  <rect width="1200" height="820" fill="url(#r-${escapeXml(args.id)})"/>
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
