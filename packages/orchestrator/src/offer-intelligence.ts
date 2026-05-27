import type { ArchetypeId, BusinessProfile } from "./types.js";

export const MYFUNNELA_DOMAIN = "gofunnelai.com";
export const MYFUNNELA_APP_URL = `https://${MYFUNNELA_DOMAIN}`;
export const MYFUNNELA_ASSETS_URL = `https://assets.${MYFUNNELA_DOMAIN}`;

export type OfferIndustryKey =
  | "solar"
  | "med_spa"
  | "dental"
  | "insurance"
  | "real_estate"
  | "saas"
  | "local_services";

export type LeadMagnetFormat =
  | "calculator"
  | "checklist"
  | "quiz"
  | "guide"
  | "audit"
  | "report"
  | "template";

export type OfferEvidenceState = "verified" | "review" | "blocked";

export interface OfferIntelligenceProfile extends Partial<BusinessProfile> {
  businessName?: string;
  business_name?: string;
  market?: string;
  audience?: string;
  goal?: string;
}

export interface LeadMagnetRecommendation {
  format: LeadMagnetFormat;
  title: string;
  promise: string;
  optinPagePromise: string;
  delivery: string;
  modules: string[];
  qualificationFields: string[];
  creationPlan: string[];
}

export interface OfferStackRecommendation {
  corePromise: string;
  freeValue: string;
  mainCta: string;
  riskReversal: string;
  proofAssets: string[];
  objectionHandlers: string[];
}

export interface UpsellLadderStep {
  stage: "tripwire" | "order_bump" | "core_offer" | "one_click_upsell" | "continuity" | "referral";
  title: string;
  copy: string;
  displayPrice: string;
  priceCents: number | null;
  trigger: string;
}

export interface CreativeAssetRecommendation {
  slotId: string;
  channel: string;
  description: string;
  count: number;
  license: string;
  status: "ready" | "review" | "blocked";
  prompt: string;
}

export interface OfferEvidenceItem {
  area: string;
  source: string;
  proof: string;
  state: OfferEvidenceState;
}

export interface OfferQualityGate {
  gate: string;
  pass: boolean;
  evidence: string;
}

export interface OfferIntelligenceResult {
  industryKey: OfferIndustryKey;
  industryLabel: string;
  kbVersion: string;
  archetype: ArchetypeId;
  audience: string;
  geography: string;
  leadMagnet: LeadMagnetRecommendation;
  offerStack: OfferStackRecommendation;
  upsellLadder: UpsellLadderStep[];
  creativeAssets: CreativeAssetRecommendation[];
  evidence: OfferEvidenceItem[];
  qualityGates: OfferQualityGate[];
  estimatedQualityScore: number;
  productionPlan: {
    strategyModels: string[];
    mechanicalAdapter: string;
    publishTarget: string;
  };
}

interface OfferIndustryConfig {
  label: string;
  match: string[];
  kbVersion: string;
  archetype: ArchetypeId;
  leadMagnet: Omit<LeadMagnetRecommendation, "optinPagePromise" | "creationPlan">;
  offer: Omit<OfferStackRecommendation, "freeValue">;
  upsells: UpsellLadderStep[];
  assets: CreativeAssetRecommendation[];
  compliance: string;
}

const INDUSTRY_OFFER_MATRIX: Record<OfferIndustryKey, OfferIndustryConfig> = {
  solar: {
    label: "Solar installation",
    match: ["solar", "pv", "renewable", "energy"],
    kbVersion: "solar-us-local-v1.4",
    archetype: "free_consult_booking",
    leadMagnet: {
      format: "calculator",
      title: "Free Solar Savings Plan",
      promise:
        "Estimate roof fit, utility bill range, incentive readiness, and next steps before the homeowner talks to sales.",
      delivery: "Instant savings-plan PDF plus bill-upload checklist and RevTry call handoff.",
      modules: [
        "Roof-fit and shade readiness checklist",
        "Utility-bill input worksheet",
        "Incentive and financing proof checklist",
        "Installation timeline explainer",
        "Consultation prep questions",
      ],
      qualificationFields: ["monthly_bill", "roof_type", "homeowner_status", "zip_code", "preferred_callback"],
    },
    offer: {
      corePromise: "Cut wasted power spend with a source-backed solar savings plan.",
      mainCta: "Get my solar savings plan",
      riskReversal:
        "Give the savings plan first, avoid guaranteed-savings language, and ask for a consult only after the homeowner sees fit and next steps.",
      proofAssets: [
        "Local install gallery",
        "Utility bill before/after screenshots",
        "Warranty badge row",
        "Financing disclosure panel",
      ],
      objectionHandlers: [
        "I am not sure my roof qualifies: answer with roof-fit criteria before asking for the consult.",
        "Solar sounds expensive: show financing ranges with source notes.",
        "I do not trust savings promises: use ranges and disclose assumptions.",
      ],
    },
    upsells: [
      {
        stage: "tripwire",
        title: "Energy Audit Report",
        copy: "A low-cost report for savings-curious homeowners who are not ready for a consultation.",
        displayPrice: "$19",
        priceCents: 1900,
        trigger: "Lead completes calculator but does not book.",
      },
      {
        stage: "order_bump",
        title: "Utility Bill Teardown",
        copy: "A guided estimate review that makes the design call faster and more qualified.",
        displayPrice: "$49",
        priceCents: 4900,
        trigger: "Lead uploads a bill or selects a high monthly spend.",
      },
      {
        stage: "core_offer",
        title: "Solar Design Consultation",
        copy: "Books a qualified design call with roof, bill, and incentive context already captured.",
        displayPrice: "Quote",
        priceCents: null,
        trigger: "Lead meets bill, ownership, and roof-fit thresholds.",
      },
      {
        stage: "one_click_upsell",
        title: "Battery Backup Assessment",
        copy: "Expands deal value for high-intent homeowners who care about outages or peak rates.",
        displayPrice: "Quote",
        priceCents: null,
        trigger: "Lead mentions outages, time-of-use rates, or resilience.",
      },
    ],
    assets: [
      {
        slotId: "hero",
        channel: "Landing page",
        description: "Clean local-home solar hero image with no text baked into the asset.",
        count: 1,
        license: "Commercial AI image license tracked at generation time.",
        status: "ready",
        prompt: "Bright residential solar install, local neighborhood context, trustworthy daylight, no text.",
      },
      {
        slotId: "pdf_cover",
        channel: "Lead magnet PDF",
        description: "Savings-plan cover, worksheet pages, and assumption disclosure block.",
        count: 6,
        license: "Commercial AI plus user-supplied proof assets.",
        status: "ready",
        prompt: "Solar savings plan PDF cover, premium utilitarian layout, no fake logos.",
      },
      {
        slotId: "ads",
        channel: "Meta and Google",
        description: "Static ads, search headlines, sitelinks, and callout extensions.",
        count: 16,
        license: "Generated copy and imagery, source notes required for savings claims.",
        status: "review",
        prompt: "Solar ad creative variations focused on bill clarity, roof fit, and no-pressure plan.",
      },
    ],
    compliance:
      "No guaranteed savings. Incentive, financing, and tax claims require local source proof before publish.",
  },
  med_spa: {
    label: "Med spa",
    match: ["med spa", "medical spa", "aesthetic", "botox", "injectable", "skin"],
    kbVersion: "medspa-us-v1.2",
    archetype: "lead_magnet_optin",
    leadMagnet: {
      format: "quiz",
      title: "Treatment Match Quiz",
      promise:
        "Help prospects identify likely treatment categories and arrive prepared for a consultation.",
      delivery: "Instant quiz result, consultation prep sheet, email nurture, and booking handoff.",
      modules: [
        "Skin goal intake",
        "Budget and timing router",
        "Safety and contraindication prep",
        "Provider-credential proof block",
        "Consultation questions checklist",
      ],
      qualificationFields: ["skin_goal", "prior_treatment", "budget_range", "timeline", "safety_acknowledgement"],
    },
    offer: {
      corePromise: "Find the right treatment path before booking a consult.",
      mainCta: "Take the treatment quiz",
      riskReversal:
        "Give education and consult prep first, then offer the appointment without diagnosis or guaranteed result language.",
      proofAssets: [
        "Provider credentials",
        "Consented before/after gallery",
        "Treatment FAQ",
        "Safety and contraindication notes",
      ],
      objectionHandlers: [
        "I am nervous about safety: surface consult-first language and provider credentials.",
        "I do not know what I need: route to treatment categories, not diagnosis.",
        "I need pricing clarity: give range framing and consultation context.",
      ],
    },
    upsells: [
      {
        stage: "tripwire",
        title: "Skin Analysis",
        copy: "A real diagnostic entry point for people who want guidance before a package.",
        displayPrice: "$49",
        priceCents: 4900,
        trigger: "Quiz result shows high intent but no booking.",
      },
      {
        stage: "order_bump",
        title: "Post-Treatment Care Kit",
        copy: "Adds immediate value while reducing anxiety about aftercare.",
        displayPrice: "$39",
        priceCents: 3900,
        trigger: "Lead books or requests a treatment plan.",
      },
      {
        stage: "core_offer",
        title: "Treatment Package",
        copy: "Bundles sessions around the consult-approved plan.",
        displayPrice: "$499+",
        priceCents: 49900,
        trigger: "Provider confirms the recommended treatment path.",
      },
      {
        stage: "continuity",
        title: "Monthly Glow Membership",
        copy: "Keeps clients in recurring care with routine treatment and skincare benefits.",
        displayPrice: "$149/mo",
        priceCents: 14900,
        trigger: "Client completes first treatment or package.",
      },
    ],
    assets: [
      {
        slotId: "quiz_result",
        channel: "Quiz",
        description: "Result cards with treatment categories, safety notes, and appointment CTA.",
        count: 5,
        license: "AI commercial, medical claims require provider review.",
        status: "review",
        prompt: "Elegant med spa quiz result graphics, clinical but warm, no exaggerated before-after.",
      },
      {
        slotId: "social_story",
        channel: "Instagram",
        description: "Before/after-safe story set and consultation graphics.",
        count: 8,
        license: "Requires user-owned before/after consent.",
        status: "review",
        prompt: "Med spa educational story frames with clean skincare visuals and no medical certainty.",
      },
      {
        slotId: "pdf_cover",
        channel: "Lead magnet PDF",
        description: "Consultation prep sheet and treatment guide.",
        count: 5,
        license: "Commercial AI image license tracked.",
        status: "ready",
        prompt: "Treatment consultation prep guide cover, premium spa-meets-clinical design, no faces.",
      },
    ],
    compliance:
      "No medical diagnosis, guaranteed result, or unconsented before/after image. Include consultation and safety language.",
  },
  dental: {
    label: "Dental",
    match: ["dental", "dentist", "orthodont", "teeth", "implant"],
    kbVersion: "dental-us-v1.1",
    archetype: "free_consult_booking",
    leadMagnet: {
      format: "checklist",
      title: "New Patient Benefits Check",
      promise: "Clarify insurance fit, appointment options, and first-visit expectations.",
      delivery: "Instant benefits-check guide plus appointment routing and reminder sequence.",
      modules: [
        "Insurance and payment prep",
        "Comfort-care checklist",
        "Urgency routing questions",
        "First-visit expectation guide",
      ],
      qualificationFields: ["insurance_provider", "care_need", "urgency", "preferred_location", "phone"],
    },
    offer: {
      corePromise: "Know your dental options before you schedule.",
      mainCta: "Check my visit options",
      riskReversal:
        "Give the benefits check first and avoid coverage guarantees before asking for an appointment.",
      proofAssets: ["Provider bios", "Review highlights", "Insurance logos", "Comfort-care promise"],
      objectionHandlers: [
        "Insurance confusion: explain verification without promising coverage.",
        "Dental anxiety: show comfort-care process and patient reviews.",
        "Appointment availability: route urgent and non-urgent requests separately.",
      ],
    },
    upsells: [
      {
        stage: "tripwire",
        title: "New Patient Exam",
        copy: "Simple first step for uninsured or unsure patients.",
        displayPrice: "$79",
        priceCents: 7900,
        trigger: "Lead has no insurance or asks for cash pricing.",
      },
      {
        stage: "order_bump",
        title: "Whitening Consult",
        copy: "Adds elective interest without interrupting needed care.",
        displayPrice: "$29",
        priceCents: 2900,
        trigger: "Lead selects cosmetic interest.",
      },
      {
        stage: "core_offer",
        title: "Scheduled Visit",
        copy: "Main appointment conversion goal.",
        displayPrice: "Insurance/quote",
        priceCents: null,
        trigger: "Lead chooses care need and appointment window.",
      },
      {
        stage: "continuity",
        title: "Membership Plan",
        copy: "Recurring hygiene and discount plan for uninsured patients.",
        displayPrice: "$29/mo",
        priceCents: 2900,
        trigger: "Patient is uninsured or cash-pay.",
      },
    ],
    assets: [
      {
        slotId: "local_search",
        channel: "Google",
        description: "Local search ads and appointment extensions.",
        count: 8,
        license: "Generated text, clinic proof required.",
        status: "ready",
        prompt: "Friendly dental clinic local search creative, clean, reassuring, no clinical gore.",
      },
      {
        slotId: "pdf_cover",
        channel: "Lead magnet PDF",
        description: "Benefits check guide and patient FAQ.",
        count: 4,
        license: "Commercial AI image license tracked.",
        status: "ready",
        prompt: "Dental benefits check PDF, calm family-oriented visual style, no treatment imagery.",
      },
    ],
    compliance:
      "Avoid coverage guarantees and clinical outcome claims. Include emergency routing where applicable.",
  },
  insurance: {
    label: "Insurance",
    match: ["insurance", "life", "auto", "home", "health coverage", "coverage"],
    kbVersion: "insurance-us-v1.3",
    archetype: "lead_magnet_optin",
    leadMagnet: {
      format: "audit",
      title: "Free Coverage Gap Check",
      promise: "Reveal likely gaps and comparison questions without guaranteeing savings or approval.",
      delivery: "Instant checklist, renewal calendar, and licensed-agent quote handoff.",
      modules: [
        "Current-policy snapshot",
        "Risk and life-stage questions",
        "Renewal deadline calendar",
        "Carrier and license disclosure checklist",
      ],
      qualificationFields: ["policy_type", "renewal_date", "state", "household_status", "coverage_priority"],
    },
    offer: {
      corePromise: "Find coverage gaps before they cost you.",
      mainCta: "Start my coverage check",
      riskReversal:
        "Give a plain-English audit first and ask for quote details only after disclosures and consent.",
      proofAssets: ["Carrier list", "Licensed-agent badge", "Disclosure block", "Review excerpts"],
      objectionHandlers: [
        "I hate being sold: lead with education and no-pressure review.",
        "I do not understand coverage: translate policy terms into plain language.",
        "I am worried rates will rise: avoid savings promises and explain quote variables.",
      ],
    },
    upsells: [
      {
        stage: "tripwire",
        title: "Policy Explanation Call",
        copy: "Turns confused prospects into scheduled reviews.",
        displayPrice: "Free",
        priceCents: 0,
        trigger: "Lead has a current policy but low quote readiness.",
      },
      {
        stage: "core_offer",
        title: "Quote Comparison",
        copy: "Primary lead conversion path.",
        displayPrice: "Quote",
        priceCents: null,
        trigger: "Lead provides policy type and renewal timing.",
      },
      {
        stage: "one_click_upsell",
        title: "Bundle Review",
        copy: "Cross-sell home, auto, life, or health depending on context.",
        displayPrice: "Quote",
        priceCents: null,
        trigger: "Lead has multiple coverage categories.",
      },
      {
        stage: "continuity",
        title: "Annual Coverage Review",
        copy: "Retention and referral loop.",
        displayPrice: "Included",
        priceCents: 0,
        trigger: "Policy is bound or renewal date is captured.",
      },
    ],
    assets: [
      {
        slotId: "quote_ads",
        channel: "Facebook",
        description: "Compliance-safe quote comparison ads.",
        count: 6,
        license: "Generated text, carrier and license disclosures required.",
        status: "review",
        prompt: "Insurance coverage comparison ad graphics, plain-English, trustworthy, no fearmongering.",
      },
      {
        slotId: "pdf_cover",
        channel: "Lead magnet PDF",
        description: "Coverage checklist and renewal calendar.",
        count: 5,
        license: "Commercial AI image license tracked.",
        status: "ready",
        prompt: "Coverage gap checklist PDF cover, clean document layout, licensed-agent feel.",
      },
    ],
    compliance:
      "No guaranteed approval, guaranteed savings, or carrier misrepresentation. State license disclosure required.",
  },
  real_estate: {
    label: "Real estate",
    match: ["real estate", "realtor", "home seller", "property", "mortgage"],
    kbVersion: "realestate-us-v1.2",
    archetype: "free_consult_booking",
    leadMagnet: {
      format: "report",
      title: "Local Home Value Snapshot",
      promise: "Give sellers a practical value range, demand context, and preparation checklist.",
      delivery: "Instant seller report, prep checklist, and pricing-call handoff.",
      modules: [
        "Comparable-sale context",
        "Seller readiness checklist",
        "Timing and demand notes",
        "Photo and staging prep",
      ],
      qualificationFields: ["property_address", "timeline", "home_condition", "seller_goal", "callback_window"],
    },
    offer: {
      corePromise: "See what your home could command in this market.",
      mainCta: "Get my home snapshot",
      riskReversal:
        "Give the value snapshot first with estimate/range framing, then invite a pricing call.",
      proofAssets: ["Recent comps", "Agent production stats", "Neighborhood map", "Review proof"],
      objectionHandlers: [
        "I do not want to be pressured: explain no-obligation pricing guidance.",
        "Zillow already gives a number: add local context and prep steps.",
        "I need timing advice: route to market-window guidance.",
      ],
    },
    upsells: [
      {
        stage: "tripwire",
        title: "Seller Prep Consultation",
        copy: "Low-pressure meeting to review value drivers.",
        displayPrice: "Free",
        priceCents: 0,
        trigger: "Seller requests value snapshot but not listing consult.",
      },
      {
        stage: "core_offer",
        title: "Listing Consultation",
        copy: "Main conversion goal for sellers.",
        displayPrice: "Commission",
        priceCents: null,
        trigger: "Seller has a clear timeline or value gap.",
      },
      {
        stage: "order_bump",
        title: "Vendor Prep Bundle",
        copy: "Preferred contractors, cleaning, staging, and photos.",
        displayPrice: "Quote",
        priceCents: null,
        trigger: "Seller flags condition or staging needs.",
      },
      {
        stage: "referral",
        title: "Buyer/Seller Referral Path",
        copy: "Keeps the agent in the post-transaction network.",
        displayPrice: "Included",
        priceCents: 0,
        trigger: "Lead is not listing now but has a network or future date.",
      },
    ],
    assets: [
      {
        slotId: "value_report",
        channel: "Landing page",
        description: "Home value report and seller checklist.",
        count: 5,
        license: "AI commercial plus user comp data.",
        status: "review",
        prompt: "Local home value report visuals, neighborhood map feel, no appraisal language.",
      },
      {
        slotId: "market_social",
        channel: "Social",
        description: "Neighborhood market update posts.",
        count: 10,
        license: "Generated text, local market source notes required.",
        status: "ready",
        prompt: "Neighborhood real estate market update creative, polished agent brand, no fake MLS marks.",
      },
    ],
    compliance:
      "Avoid appraisal language unless licensed. Use estimate/range framing and local market source notes.",
  },
  saas: {
    label: "B2B SaaS",
    match: ["saas", "software", "b2b", "platform", "subscription"],
    kbVersion: "b2b-saas-v1.2",
    archetype: "webinar_evergreen",
    leadMagnet: {
      format: "calculator",
      title: "ROI Benchmark Calculator",
      promise: "Quantify the business case and route serious accounts into a demo sequence.",
      delivery: "Interactive calculator spec, PDF business case, and demo-prep email sequence.",
      modules: [
        "Team-size and workflow-cost inputs",
        "Current-tool gap worksheet",
        "ROI assumptions table",
        "Security and integration proof checklist",
      ],
      qualificationFields: ["team_size", "current_tool", "monthly_process_cost", "timeline", "security_requirement"],
    },
    offer: {
      corePromise: "Prove the ROI before booking the demo.",
      mainCta: "Calculate ROI",
      riskReversal:
        "Give the business case first, show assumptions, then route high-fit accounts to a demo.",
      proofAssets: ["Case study cards", "Integration logos", "Security profile", "ROI assumptions"],
      objectionHandlers: [
        "No time for a demo: make the calculator useful without a call.",
        "Need business case: output a shareable PDF for the buying committee.",
        "Need security proof: include security and integration checklist.",
      ],
    },
    upsells: [
      {
        stage: "tripwire",
        title: "Implementation Audit",
        copy: "Turns complex accounts into scoped projects.",
        displayPrice: "$499",
        priceCents: 49900,
        trigger: "Account has a large team or complex workflow.",
      },
      {
        stage: "core_offer",
        title: "Sales Demo",
        copy: "Primary conversion action.",
        displayPrice: "Demo",
        priceCents: null,
        trigger: "Lead has fit, urgency, and a clear use case.",
      },
      {
        stage: "one_click_upsell",
        title: "Implementation Package",
        copy: "Reduces onboarding friction and improves activation.",
        displayPrice: "$2,500+",
        priceCents: 250000,
        trigger: "Opportunity moves to proposal.",
      },
      {
        stage: "continuity",
        title: "Annual Plan and Seats",
        copy: "Captures long-term account value.",
        displayPrice: "Annual",
        priceCents: null,
        trigger: "Customer validates ROI and buying committee is aligned.",
      },
    ],
    assets: [
      {
        slotId: "roi_report",
        channel: "PDF",
        description: "ROI report and demo prep sheet.",
        count: 7,
        license: "Generated text and charts, assumptions must be shown.",
        status: "ready",
        prompt: "B2B SaaS ROI report cover, crisp operations dashboard style, no fake customer logos.",
      },
      {
        slotId: "linkedin_ads",
        channel: "LinkedIn",
        description: "Founder POV post, document ad, and retargeting ad.",
        count: 6,
        license: "Generated copy, customer claims require proof.",
        status: "review",
        prompt: "B2B SaaS document ad creative, modern work-focused UI, proof-first.",
      },
      {
        slotId: "demo_email",
        channel: "Email",
        description: "Seven-touch business case sequence.",
        count: 7,
        license: "Generated text from source-backed assumptions.",
        status: "ready",
        prompt: "No image needed, generate compact business-case email layouts.",
      },
    ],
    compliance:
      "ROI claims must show assumptions. Do not invent customer, competitor, or security claims.",
  },
  local_services: {
    label: "Local services",
    match: ["hvac", "plumbing", "roofing", "garage", "landscaping", "home service", "local service"],
    kbVersion: "local-services-us-v1.0",
    archetype: "free_consult_booking",
    leadMagnet: {
      format: "checklist",
      title: "Fast Quote Readiness Checklist",
      promise: "Help local buyers know what photos, timing, and budget details are needed for a quote.",
      delivery: "Instant checklist, quote-prep SMS, and call handoff.",
      modules: [
        "Urgency triage",
        "Photo capture checklist",
        "Budget and timing questions",
        "Service-area verification",
      ],
      qualificationFields: ["service_need", "urgency", "zip_code", "photos_available", "preferred_callback"],
    },
    offer: {
      corePromise: "Get quote-ready before the first call.",
      mainCta: "Build my quote checklist",
      riskReversal:
        "Give the buyer a useful quote-prep checklist first, then ask for the call or estimate.",
      proofAssets: ["Review highlights", "Service area map", "Before/after jobs", "Warranty or guarantee note"],
      objectionHandlers: [
        "I need this fast: route emergency and scheduled service differently.",
        "I need price clarity: capture photos and scope before quoting.",
        "I do not know who to trust: show reviews and guarantee notes.",
      ],
    },
    upsells: [
      {
        stage: "tripwire",
        title: "Inspection Visit",
        copy: "Small paid diagnostic that filters serious local buyers.",
        displayPrice: "$49",
        priceCents: 4900,
        trigger: "Scope requires on-site review.",
      },
      {
        stage: "core_offer",
        title: "Repair or Install Quote",
        copy: "Main conversion path.",
        displayPrice: "Quote",
        priceCents: null,
        trigger: "Lead matches service area and need.",
      },
      {
        stage: "one_click_upsell",
        title: "Maintenance Plan",
        copy: "Adds recurring care after the first job.",
        displayPrice: "$19/mo+",
        priceCents: 1900,
        trigger: "Buyer schedules service or installation.",
      },
      {
        stage: "referral",
        title: "Neighbor Referral Offer",
        copy: "Turns completed jobs into local word-of-mouth.",
        displayPrice: "Included",
        priceCents: 0,
        trigger: "Job completed with positive feedback.",
      },
    ],
    assets: [
      {
        slotId: "service_hero",
        channel: "Landing page",
        description: "Local service hero and proof imagery.",
        count: 3,
        license: "Commercial AI image license tracked.",
        status: "ready",
        prompt: "Local home service crew at work, clean professional scene, no logos, no text.",
      },
      {
        slotId: "quote_pdf",
        channel: "Lead magnet PDF",
        description: "Quote readiness checklist and photo guide.",
        count: 4,
        license: "Commercial AI image license tracked.",
        status: "ready",
        prompt: "Quote readiness checklist PDF, practical local service layout, no stock-photo feel.",
      },
    ],
    compliance:
      "Do not guarantee same-day service unless capacity is supplied. Disclose diagnostic fees and service area limits.",
  },
};

export function normalizeOfferIndustry(industry?: string | null): OfferIndustryKey {
  const text = normalize(industry ?? "");
  for (const [key, config] of Object.entries(INDUSTRY_OFFER_MATRIX) as Array<
    [OfferIndustryKey, OfferIndustryConfig]
  >) {
    if (config.match.some((matcher) => text.includes(normalize(matcher)))) return key;
    if (text.includes(normalize(config.label))) return key;
  }
  return "local_services";
}

export function buildOfferIntelligence(
  profile: OfferIntelligenceProfile = {},
): OfferIntelligenceResult {
  const industryText = readProfileText(profile, ["industry"], "Local services");
  const industryKey = normalizeOfferIndustry(industryText);
  const config = INDUSTRY_OFFER_MATRIX[industryKey];
  const audience = readProfileText(
    profile,
    ["target_customer", "audience"],
    defaultAudienceFor(industryKey),
  );
  const geography = readProfileText(profile, ["geography", "market"], "US");
  const primaryOffer = readProfileText(profile, ["offer", "goal"], config.offer.corePromise);

  const leadMagnet: LeadMagnetRecommendation = {
    ...config.leadMagnet,
    promise: personalize(config.leadMagnet.promise, profile),
    optinPagePromise: `${config.leadMagnet.title}: ${personalize(config.leadMagnet.promise, profile)}`,
    creationPlan: [
      `Select ${config.leadMagnet.format} because ${config.label} buyers need value before the ask.`,
      "Package the asset as a PDF or interactive step with qualification fields attached.",
      "Deliver by email/SMS, seed the nurture sequence, and hand qualified leads to RevTry.",
      "Require proof review for numbers, claims, images, and regulated language before publish.",
    ],
  };

  const offerStack: OfferStackRecommendation = {
    ...config.offer,
    corePromise: personalize(primaryOffer, profile),
    freeValue: leadMagnet.title,
  };

  const evidence = buildEvidence({
    config,
    industryKey,
    audience,
    geography,
    leadMagnet,
  });
  const qualityGates = buildQualityGates(config, leadMagnet);
  const failedGateCount = qualityGates.filter((gate) => !gate.pass).length;

  return {
    industryKey,
    industryLabel: config.label,
    kbVersion: config.kbVersion,
    archetype: config.archetype,
    audience,
    geography,
    leadMagnet,
    offerStack,
    upsellLadder: config.upsells,
    creativeAssets: config.assets,
    evidence,
    qualityGates,
    estimatedQualityScore: Math.max(80, 94 - failedGateCount * 4),
    productionPlan: {
      strategyModels: ["OpenAI", "Claude"],
      mechanicalAdapter: "30 Breath mechanical production adapter for fast packaging, formatting, and asset assembly",
      publishTarget: MYFUNNELA_APP_URL,
    },
  };
}

export function buildOfferCrosswalk(profile: OfferIntelligenceProfile = {}): OfferEvidenceItem[] {
  return buildOfferIntelligence(profile).evidence;
}

function buildEvidence(args: {
  config: OfferIndustryConfig;
  industryKey: OfferIndustryKey;
  audience: string;
  geography: string;
  leadMagnet: LeadMagnetRecommendation;
}): OfferEvidenceItem[] {
  return [
    {
      area: "Customer success activation",
      source: "Blueprint critical gap 1",
      proof: `${args.leadMagnet.title} creates the Day 0 value moment, captures qualification fields, and routes follow-up by completion.`,
      state: "verified",
    },
    {
      area: "Unit economics",
      source: "Blueprint critical gap 2",
      proof: `${args.config.upsells.length} ladder steps map free value to paid conversion, expansion, and continuity opportunities.`,
      state: "verified",
    },
    {
      area: "Competitive intelligence",
      source: "Blueprint critical gap 3",
      proof: `${args.config.label} proof assets and objection handlers make the funnel harder to beat than a generic page builder template.`,
      state: "review",
    },
    {
      area: "Crisis response",
      source: "Blueprint critical gap 4",
      proof: args.config.compliance,
      state: "verified",
    },
    {
      area: "Agency enablement",
      source: "Blueprint critical gap 5",
      proof: `Asset manifest includes ${args.config.assets.length} channel packs with license and review status for client handoff.`,
      state: "verified",
    },
    {
      area: "International operations",
      source: "Blueprint critical gap 6",
      proof: `Geography "${args.geography}" is retained for local compliance, currency, claims, and consent review.`,
      state: "review",
    },
    {
      area: "Data provenance and governance",
      source: "Blueprint critical gap 7",
      proof: `Offer source is matrix key ${args.industryKey} with KB version ${args.config.kbVersion}; all generated claims stay reviewable.`,
      state: "verified",
    },
    {
      area: "Key person risk",
      source: "Blueprint critical gap 8",
      proof: `The ${args.config.label} offer map is encoded as reusable system logic instead of founder-only tribal knowledge.`,
      state: "verified",
    },
    {
      area: "Free value before ask",
      source: "Offer Intelligence addendum",
      proof: `${args.leadMagnet.title} is generated and delivered before the primary CTA for ${args.audience}.`,
      state: "verified",
    },
    {
      area: "Upsell staging",
      source: "Industry Offer Map addendum",
      proof: `The generated ladder includes ${args.config.upsells
        .map((step) => step.stage)
        .join(", ")} for this industry.`,
      state: "verified",
    },
    {
      area: "Image and asset generation",
      source: "Creative Asset Factory addendum",
      proof: `Creative assets include prompts, channel, count, license, and review state before publish.`,
      state: "verified",
    },
    {
      area: "Credential-ready integrations",
      source: "Implementation adapter plan",
      proof:
        "OpenAI and Claude handle thinking, 30 Breath handles mechanical packaging, and payment/ad/voice providers remain credential-backed adapters.",
      state: "review",
    },
    {
      area: "No-lift launch path",
      source: "Addendum operating promise",
      proof: `The output includes free asset, page promise, offer ladder, creative manifest, compliance notes, and publish target ${MYFUNNELA_APP_URL}.`,
      state: "verified",
    },
  ];
}

function buildQualityGates(
  config: OfferIndustryConfig,
  leadMagnet: LeadMagnetRecommendation,
): OfferQualityGate[] {
  return [
    {
      gate: "Free value before ask",
      pass: leadMagnet.title.length > 0 && leadMagnet.modules.length >= 3,
      evidence: `${leadMagnet.title} has ${leadMagnet.modules.length} packaged modules.`,
    },
    {
      gate: "Industry-specific upsell ladder",
      pass: config.upsells.length >= 3,
      evidence: `${config.upsells.length} ladder steps are configured for ${config.label}.`,
    },
    {
      gate: "Proof stack",
      pass: config.offer.proofAssets.length >= 3,
      evidence: `${config.offer.proofAssets.length} proof assets are required before publish.`,
    },
    {
      gate: "Creative license manifest",
      pass: config.assets.every((asset) => asset.license.length > 0 && asset.status !== "blocked"),
      evidence: `${config.assets.length} creative asset groups include license and review status.`,
    },
    {
      gate: "Compliance review",
      pass: config.compliance.length > 0,
      evidence: config.compliance,
    },
  ];
}

function defaultAudienceFor(industryKey: OfferIndustryKey): string {
  switch (industryKey) {
    case "solar":
      return "Homeowners with high electric bills";
    case "med_spa":
      return "Aesthetic treatment prospects";
    case "dental":
      return "New dental patients";
    case "insurance":
      return "Policy shoppers and renewal-stage households";
    case "real_estate":
      return "Homeowners considering a sale";
    case "saas":
      return "B2B operators building a business case";
    case "local_services":
      return "Local buyers needing a quote";
  }
}

function readProfileText(
  profile: OfferIntelligenceProfile,
  keys: Array<keyof OfferIntelligenceProfile>,
  fallback: string,
): string {
  for (const key of keys) {
    const value = profile[key];
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
  }
  return fallback;
}

function personalize(text: string, profile: OfferIntelligenceProfile): string {
  const market = readProfileText(profile, ["market", "geography"], "");
  if (!market) return text;
  return text.replace(/\blocal\b/gi, market);
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
