/**
 * Competitor comparison content for the /vs/[slug] SEO pages.
 * All copy is verbatim from doc 10 §1.5.
 */

export type CompetitorComparison = {
  slug: string;
  competitor: string;
  h1: string;
  subhead: string;
  table: { label: string; funnel: string; them: string }[];
  whenThem: string;
  whenFunnel: string;
  switching?: string;
  primaryCta: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
};

export const COMPETITOR_COMPARISONS: CompetitorComparison[] = [
  {
    slug: "clickfunnels",
    competitor: "ClickFunnels",
    h1: "Funnel vs. ClickFunnels — which one should you actually use?",
    subhead:
      "ClickFunnels invented the modern funnel builder. Funnel invented the autonomous one. Here's the honest comparison.",
    table: [
      { label: "Time to first live funnel", funnel: "60 seconds", them: "4–12 hours" },
      { label: "Writes your copy", funnel: "Yes", them: "No" },
      { label: "Picks your offer", funnel: "Yes", them: "No" },
      { label: "AI voice agent calls leads", funnel: "Yes (RevTry)", them: "No" },
      { label: "Launches ads for you", funnel: "Yes", them: "No" },
      { label: "Visual page editor", funnel: "Limited (intentionally)", them: "Best-in-class" },
      { label: "Membership / course hosting", funnel: "Via integration", them: "Built-in" },
      { label: "Affiliate program", funnel: "Coming Q3 2026", them: "Built-in" },
      { label: "Templates library", funnel: "Generated for you", them: "100+ pre-built" },
      { label: "Floor price", funnel: "$0", them: "$97/mo" },
      { label: "Free tier", funnel: "Yes, forever", them: "14-day trial" },
    ],
    whenThem:
      "If you're a visual builder who loves dragging things around, you've already invested 100 hours learning CF, you're running a membership site or affiliate program inside the funnel, or you need a specific niche template they've already built — ClickFunnels is genuinely a better fit. We're optimizing for the operator who wants the funnel built for them, not the operator who enjoys building it. That's a real trade-off and we won't pretend it isn't.",
    whenFunnel:
      "You want a funnel live this afternoon. You don't have a copywriter. You don't have an agency budget. You'd rather your tool do the qualifying calls than hire an SDR. You want the system to learn and improve nightly without your input. You don't want to pay $97/mo before you've made $1.",
    switching:
      "We'll import your funnel URLs, scrape your copy and structure, regenerate them at the Funnel quality bar, and let you compare side-by-side before you switch. Free migration concierge on Growth and above.",
    primaryCta: { label: "Try Funnel free →", href: "/signup" },
    secondaryCta: { label: "Talk to a migration concierge →", href: "/contact?topic=migration" },
  },
  {
    slug: "gohighlevel",
    competitor: "GoHighLevel",
    h1: "Funnel vs. GoHighLevel — agency tool vs. autonomous engine.",
    subhead:
      "GoHighLevel is the agency operating system. Funnel is the autonomous funnel engine. Different jobs. Sometimes overlapping.",
    table: [
      { label: "Time to first live funnel", funnel: "60 seconds", them: "8–20 hours" },
      { label: "Writes your copy", funnel: "Yes", them: "No" },
      { label: "AI voice agent calls leads", funnel: "Yes — included", them: "Bolt-on add-on" },
      { label: "Launches ads for you", funnel: "Yes", them: "No" },
      { label: "Native CRM", funnel: "Yes", them: "Yes (deeper)" },
      { label: "Pipeline management", funnel: "Yes", them: "Yes (deeper)" },
      { label: "SMS / email automation", funnel: "Yes", them: "Yes (deeper)" },
      { label: "White-label agency portal", funnel: "Yes (Agency tier)", them: "Yes (their core use case)" },
      { label: "Sub-account management", funnel: "Unlimited (Agency)", them: "Unlimited" },
      { label: "Floor price", funnel: "$0", them: "$97/mo" },
      { label: "Learning curve", funnel: "One sentence", them: "60+ hours" },
    ],
    whenThem:
      "You're running an agency that needs deep workflow automation, complex pipeline customization, granular sub-account permissions, and white-label SaaS-reseller mechanics that you've spent a year tuning. GHL is genuinely deeper as an agency back-office. We're a generation engine — they're an operating system.",
    whenFunnel:
      "You want the funnel itself built and improved for you, not just hosted. You want voice agent calls included, not bolted on. You want one sentence to become a complete launched funnel, not a 60-hour onboarding.",
    switching:
      "Import your sub-accounts, contacts, and pipelines via our migration tool. Most agencies switch one client at a time over 30 days. Migration concierge on Agency plan.",
    primaryCta: { label: "Try Funnel free →", href: "/signup" },
    secondaryCta: { label: "Talk to a migration concierge →", href: "/contact?topic=migration" },
  },
  {
    slug: "leadpages",
    competitor: "Leadpages",
    h1: "Funnel vs. Leadpages — pages alone, or the whole machine?",
    subhead:
      "Leadpages builds beautiful landing pages. Funnel builds the page, writes the ads, calls the leads, and books the meetings. Different tier of product.",
    table: [
      { label: "Time to first live funnel", funnel: "60 seconds", them: "1–4 hours" },
      { label: "Writes your copy", funnel: "Yes", them: "No" },
      { label: "AI voice agent calls leads", funnel: "Yes", them: "No" },
      { label: "Launches ads for you", funnel: "Yes", them: "No" },
      { label: "Native CRM", funnel: "Yes", them: "No (integrations only)" },
      { label: "Email / SMS sequences built for you", funnel: "Yes", them: "No" },
      { label: "Template library", funnel: "Generated", them: "200+ pre-built" },
      { label: "Floor price", funnel: "$0", them: "$37/mo" },
      { label: "Free tier", funnel: "Yes, forever", them: "14-day trial" },
    ],
    whenThem:
      "You already have copy. You already have a CRM. You already have an SDR. You already have an agency running ads. You just need a great-looking page builder for $37/mo. Leadpages is excellent at that single job.",
    whenFunnel:
      "You don't have all of those other pieces — and you don't want to assemble them. Funnel collapses the whole stack into one tool.",
    switching:
      "Paste your existing Leadpages URL into Funnel and we'll regenerate it at the Funnel quality bar in 60 seconds. Free.",
    primaryCta: { label: "Try Funnel free →", href: "/signup" },
    secondaryCta: { label: "Grade my Leadpages page →", href: "/grade" },
  },
  {
    slug: "unbounce",
    competitor: "Unbounce",
    h1: "Funnel vs. Unbounce — the AI optimizer, or the autonomous builder?",
    subhead:
      "Unbounce pioneered AI-assisted landing pages. Funnel went further: it generates the page, the ads, the calls, and the bookings without you writing a single line.",
    table: [
      { label: "Time to first live funnel", funnel: "60 seconds", them: "1–4 hours" },
      { label: "AI writes copy", funnel: "Yes — full funnel", them: "Yes — sections" },
      { label: "AI voice agent calls leads", funnel: "Yes", them: "No" },
      { label: "Launches ads for you", funnel: "Yes", them: "No" },
      { label: "Smart Traffic (route variants by visitor)", funnel: "Coming Q4", them: "Yes — their flagship feature" },
      { label: "Floor price", funnel: "$0", them: "$99/mo" },
      { label: "Free tier", funnel: "Yes, forever", them: "14-day trial" },
    ],
    whenThem:
      "You're running large-scale paid traffic and need Unbounce's Smart Traffic — the AI router that personalizes which variant each visitor sees. That feature is mature, ours is in beta. If you live or die by Smart Traffic, Unbounce remains the call.",
    whenFunnel:
      "You don't yet have the volume that makes Smart Traffic matter. You want the funnel built, the ads launched, and the leads called — without learning a tool. You want a $0 floor instead of $99.",
    primaryCta: { label: "Try Funnel free →", href: "/signup" },
  },
  {
    slug: "systeme",
    competitor: "Systeme.io",
    h1: "Funnel vs. Systeme.io — free-tier funnel builder vs. autonomous engine.",
    subhead:
      "Systeme has the best free tier in the legacy funnel space. Funnel is the only autonomous engine with a free tier at all.",
    table: [
      { label: "Time to first live funnel", funnel: "60 seconds", them: "2–8 hours" },
      { label: "Writes your copy", funnel: "Yes", them: "No" },
      { label: "AI voice agent calls leads", funnel: "Yes", them: "No" },
      { label: "Launches ads for you", funnel: "Yes", them: "No" },
      { label: "Course / membership hosting", funnel: "Via integration", them: "Built-in" },
      { label: "Affiliate program", funnel: "Coming Q3 2026", them: "Built-in" },
      { label: "Free tier", funnel: "1 funnel + 100 leads + 10 RevTry min", them: "3 funnels + unlimited emails" },
      { label: "Floor paid plan", funnel: "$49/mo", them: "$27/mo" },
    ],
    whenThem:
      "You're price-sensitive, you want to build everything by hand, and you need built-in course hosting + affiliate program. Systeme is genuinely cheap and full-featured for that use case.",
    whenFunnel:
      "You'd rather have the funnel built for you than save $22/mo. You want the leads called by AI within 6 seconds. You want the recursive learning that gets you better every week.",
    primaryCta: { label: "Try Funnel free →", href: "/signup" },
  },
];

export const COMPETITOR_MAP = new Map(COMPETITOR_COMPARISONS.map((c) => [c.slug, c]));
