/**
 * Marketing-page hooks + page data for the 30 industries GoFunnelAI supports.
 *
 * Includes the original 30-industry hooks plus the requested per-industry
 * slugs used by /industries/[slug] dynamic pages.
 */

export type IndustryHook = {
  slug: string;
  name: string;
  /** Short tagline for grid cards. */
  tagline: string;
  /** Long-form marketing hook, used on /industries and /industries/[slug]. */
  hook: string;
  /** Sample funnel offer headlines we'd write for this industry. */
  hookExamples: string[];
  /** Marketing image URL (Unsplash placeholder). */
  image: string;
  /** Optional regulated-industry flag — surfaces compliance copy. */
  regulated?: boolean;
};

export const INDUSTRY_HOOKS: IndustryHook[] = [
  {
    slug: "solar",
    name: "Solar",
    tagline: "Bill comparison hooks. Utility-rate-aware copy.",
    hook: "Homeowners researching solar are stuck between fear of the upfront cost and the math that says it pays back in 7 years. GoFunnelAI leads with the bill comparison (your bill today vs. your bill with solar), uses utility-rate-aware copy, and qualifies for roof type, ownership, and credit before RevTry books the site survey.",
    hookExamples: [
      "Cut your electric bill by 73% — see your savings in 60 seconds.",
      "Your neighbor in [zip] just locked in a 2.99% solar loan. Here's how.",
      "Federal tax credit drops Dec 31. Free quote, no door-knock.",
    ],
    image: "https://images.unsplash.com/photo-1509391366360-2e959784a276?w=800&auto=format&fit=crop&q=60",
  },
  {
    slug: "roofing",
    name: "Roofing",
    tagline: "Storm-aware copy. Insurance-claim routing.",
    hook: "Roofing leads are emergency-driven (storm) or maintenance-driven (age + insurance). GoFunnelAI reads the local weather feed and rewrites your hook within 4 hours of a hailstorm in your zip code. RevTry asks about insurance claim status and books the inspector.",
    hookExamples: [
      "Hail hit your zip last Tuesday. Free 17-point inspection — same day.",
      "Roof over 12 years old? Most insurers want it replaced before they renew.",
      "We file the claim with you. 94% approved on first submission.",
    ],
    image: "https://images.unsplash.com/photo-1632753249836-b8c8eee62f9f?w=800&auto=format&fit=crop&q=60",
  },
  {
    slug: "hvac",
    name: "HVAC",
    tagline: "Two paths — emergency repair, fall maintenance.",
    hook: "Replacement vs. repair decision is the whole sale. GoFunnelAI builds two paths — one for the AC-died-today emergency, one for the fall maintenance plan — and RevTry triages by urgency, age of unit, and whether they own the home.",
    hookExamples: [
      "AC out? We can be at your door before 5pm — guaranteed or it's free.",
      "Unit over 10 years old? Replacement costs less than 2 more breakdowns.",
      "Fall tune-up: $79, includes a free duct camera scan.",
    ],
    image: "https://images.unsplash.com/photo-1631545806609-2c4a8ce5e7c1?w=800&auto=format&fit=crop&q=60",
  },
  {
    slug: "dental",
    name: "Dental",
    tagline: "Cosmetic + family. HIPAA handled.",
    hook: "Cosmetic dentistry (high-ticket, image-driven) and family dentistry (insurance-driven) need different funnels. GoFunnelAI builds either, handles HIPAA, and RevTry verifies insurance before booking the consult.",
    hookExamples: [
      "Straighter teeth in 6 months — without braces. Free smile assessment.",
      "New patient special: $79 cleaning, X-rays, and exam.",
      "Implants in one visit. Yes — even your back tooth.",
    ],
    image: "https://images.unsplash.com/photo-1606811971618-4486d14f3f99?w=800&auto=format&fit=crop&q=60",
    regulated: true,
  },
  {
    slug: "chiro",
    name: "Chiropractic",
    tagline: "Pain-driven hooks. Insurance pre-check.",
    hook: "Pain-driven traffic with insurance complexity. GoFunnelAI hooks on the specific pain (back, neck, sciatica, migraine), builds an educational lead magnet, and RevTry confirms insurance before the first adjustment appointment.",
    hookExamples: [
      "Sciatica that won't quit? 6 in 10 patients see relief in their first visit.",
      "Free spinal scan — the same exam your insurance would pay $180 for.",
      "Headaches every week? It's probably not your eyes.",
    ],
    image: "https://images.unsplash.com/photo-1599045118108-bf9954418b76?w=800&auto=format&fit=crop&q=60",
    regulated: true,
  },
  {
    slug: "med-spa",
    name: "Med Spa",
    tagline: "Before/after compliance. Service-specific funnels.",
    hook: "Botox, fillers, body contouring, hair removal — each is a different funnel. GoFunnelAI uses before/after compliance copy, qualifies by treatment area, and books the consult with the right injector.",
    hookExamples: [
      "Botox starting at $9/unit — booked online, no haggle.",
      "Lose your double chin in one visit. No surgery. No downtime.",
      "Laser hair removal: full legs, $89/session (normally $250).",
    ],
    image: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=800&auto=format&fit=crop&q=60",
    regulated: true,
  },
  {
    slug: "cosmetic-surgery",
    name: "Cosmetic Surgery",
    tagline: "Education-first. Financing-aware.",
    hook: "Cosmetic surgery sells on trust, results, and financing. GoFunnelAI builds before/after-driven funnels with FDA-compliant copy, surfaces financing partners (Cherry, CareCredit, Affirm) at the right moment, and RevTry triages by procedure interest before booking the consult.",
    hookExamples: [
      "Rhinoplasty consult — virtual or in person. Financing in 60 seconds.",
      "Mommy makeover packages from $189/mo. See real patient results.",
      "Tummy tuck — what to expect at week 1, week 6, week 12.",
    ],
    image: "https://images.unsplash.com/photo-1559757175-08f0e0e0c8e7?w=800&auto=format&fit=crop&q=60",
    regulated: true,
  },
  {
    slug: "weight-loss-glp1",
    name: "Weight Loss / GLP-1",
    tagline: "Compliant GLP-1 hooks. Telehealth-ready.",
    hook: "GLP-1 is the fastest-growing weight-loss vertical and the most compliance-fraught. GoFunnelAI handles compounded vs. brand disclosure, eligibility quizzes, and telehealth intake — all FDA-aware. RevTry handles the pre-consult call before the lead sees a clinician.",
    hookExamples: [
      "GLP-1 from $199/mo — see if you qualify in 60 seconds.",
      "Lost 24 lbs in 12 weeks: meet the program patients are switching to.",
      "Insurance covering Wegovy? We'll find out for you — free.",
    ],
    image: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=800&auto=format&fit=crop&q=60",
    regulated: true,
  },
  {
    slug: "hair-restoration",
    name: "Hair Restoration",
    tagline: "Density-grade quiz. Consult booking.",
    hook: "Hair restoration is a long consideration cycle. GoFunnelAI builds a density-quiz funnel that grades hair loss, recommends NeoGraft vs. FUE vs. PRP, and RevTry books the in-office consult while the lead is still on the page.",
    hookExamples: [
      "Score your hair loss in 90 seconds. Get a custom restoration plan.",
      "NeoGraft starting at $4/graft — for a limited number of patients.",
      "PRP injections — what 6 sessions actually look like.",
    ],
    image: "https://images.unsplash.com/photo-1626808642875-0aa545482dfb?w=800&auto=format&fit=crop&q=60",
    regulated: true,
  },
  {
    slug: "personal-injury-law",
    name: "Personal Injury Law",
    tagline: "State-specific bar-rule compliance.",
    hook: "Personal injury lead gen is brutal — bar rules, attorney advertising compliance, and 30-second response window. GoFunnelAI builds state-specific compliant funnels, RevTry runs the intake script your firm approved, and bookings flow to Clio, MyCase, or Filevine.",
    hookExamples: [
      "Hurt in a wreck this week? You have 7 days to act. Free case review.",
      "We've recovered $182M for clients like you. No fee unless we win.",
      "Slip & fall? Insurance lowballed you. Talk to a lawyer free, today.",
    ],
    image: "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800&auto=format&fit=crop&q=60",
    regulated: true,
  },
  {
    slug: "family-law",
    name: "Family Law",
    tagline: "Sensitive intake. Empathetic copy.",
    hook: "Divorce, custody, and adoption leads are emotional, not transactional. GoFunnelAI writes copy that earns trust without dramatizing pain, RevTry handles the empathetic intake, and the firm sees only qualified, ready-to-act leads.",
    hookExamples: [
      "Considering divorce? Talk to a lawyer privately, no obligation.",
      "Custody questions? A 20-minute call could change your year.",
      "Prenups, in plain English. Flat fee from $1,200.",
    ],
    image: "https://images.unsplash.com/photo-1505664194779-8beaceb93744?w=800&auto=format&fit=crop&q=60",
    regulated: true,
  },
  {
    slug: "dui-defense",
    name: "DUI Defense",
    tagline: "Urgent, time-sensitive intake.",
    hook: "DUI leads are 24-hour windows. GoFunnelAI builds a same-day-call funnel with bar-rule-compliant copy, RevTry triages urgency (arrest within 48h, license hearing deadline, license suspended), and routes to the on-call attorney.",
    hookExamples: [
      "Arrested this weekend? You have 10 days to save your license.",
      "Refused the breathalyzer? Talk to a lawyer before your DMV hearing.",
      "First DUI? It doesn't have to be on your record. Free case review.",
    ],
    image: "https://images.unsplash.com/photo-1521791136064-7986c2920216?w=800&auto=format&fit=crop&q=60",
    regulated: true,
  },
  {
    slug: "bankruptcy",
    name: "Bankruptcy",
    tagline: "Chapter 7 vs. 13 routing.",
    hook: "Bankruptcy is high-volume, low-fee, high-empathy. GoFunnelAI screens for Chapter 7 vs. 13 vs. debt settlement, handles the means-test pre-qual, and RevTry books the consult with the right attorney.",
    hookExamples: [
      "Drowning in debt? Find out in 60 seconds if Chapter 7 wipes it.",
      "Behind on your mortgage? Chapter 13 can save your home.",
      "Free bankruptcy consult — bring nothing but your last pay stub.",
    ],
    image: "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=800&auto=format&fit=crop&q=60",
    regulated: true,
  },
  {
    slug: "insurance",
    name: "Insurance",
    tagline: "Multi-line: P&C, life, health.",
    hook: "P&C insurance: GoFunnelAI quote-shops with a multi-carrier hook. Life insurance: GoFunnelAI builds a 'term vs. whole' educational funnel. Health: GoFunnelAI routes by state and qualifies for ACA vs. private vs. Medicare.",
    hookExamples: [
      "Drivers in [state] are overpaying by $612/yr. See your savings.",
      "$500K term life from $18/mo — no exam if you're under 50.",
      "Medicare turning 65? Compare every plan in your zip.",
    ],
    image: "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=800&auto=format&fit=crop&q=60",
    regulated: true,
  },
  {
    slug: "mortgage",
    name: "Mortgage",
    tagline: "APR-disclosure-ready. NMLS-aware.",
    hook: "Rate-driven traffic with brutal compliance requirements. GoFunnelAI handles the APR disclosure, NMLS ID display, and equal housing logo automatically. RevTry asks the four pre-qual questions (credit range, down payment, income, target home price) before booking.",
    hookExamples: [
      "Refi in 14 days, no appraisal. Lock today's rate.",
      "First-time buyer? You may qualify for 3% down — and no PMI.",
      "VA loan calculator: what you can actually buy with 0 down.",
    ],
    image: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&auto=format&fit=crop&q=60",
    regulated: true,
  },
  {
    slug: "financial-advisors",
    name: "Financial Advisors",
    tagline: "FINRA-compliant copy. Form ADV-aware.",
    hook: "The FINRA copy minefield. GoFunnelAI's compliance agent runs every line against the Form ADV. RevTry never quotes returns, books a 'discovery meeting' (not a 'free consultation'), and the whole flow is audit-loggable.",
    hookExamples: [
      "Retiring in 5 years? Schedule a discovery meeting with a fiduciary.",
      "Tax-efficient rollover review — fee-only, no products.",
      "Estate planning for families with $1M+ in assets.",
    ],
    image: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800&auto=format&fit=crop&q=60",
    regulated: true,
  },
  {
    slug: "real-estate-agents",
    name: "Real Estate Agents",
    tagline: "CMA magnets. Buyer + listing funnels.",
    hook: "For listing agents, GoFunnelAI builds a home-value-CMA-magnet that pulls Zestimate-adjacent data and routes to RevTry, who books the listing appointment. For buyer's agents, it builds a neighborhood-tour funnel with a 14-day nurture sequence.",
    hookExamples: [
      "What's your home worth in today's market? Free CMA in 60 seconds.",
      "Homes in [neighborhood] under $750K — see them this weekend.",
      "Selling in 2026? Pre-listing checklist + market report.",
    ],
    image: "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&auto=format&fit=crop&q=60",
  },
  {
    slug: "property-managers",
    name: "Property Managers",
    tagline: "Owner acquisition. Tenant placement.",
    hook: "Property managers have two acquisition jobs: signing new owners and placing tenants in vacant units. GoFunnelAI builds both — an owner-acquisition funnel with a vacancy-loss calculator, and a tenant-acquisition funnel that integrates with AppFolio or Buildium.",
    hookExamples: [
      "Owning a rental? See what professional management actually costs.",
      "Your vacancy is costing you $94/day. Place a tenant in 14 days.",
      "Free rental valuation — what your unit should rent for, by zip.",
    ],
    image: "https://images.unsplash.com/photo-1554995207-c18c203602cb?w=800&auto=format&fit=crop&q=60",
  },
  {
    slug: "coaches",
    name: "Coaches",
    tagline: "High-ticket discovery calls.",
    hook: "Coaches sell on transformation stories, not on credentials. GoFunnelAI builds a transformation-driven funnel, RevTry handles the discovery call qualification (income, commitment, fit), and only ready-to-buy leads reach you.",
    hookExamples: [
      "Are you the kind of leader who's ready for the next level? 15-min audit.",
      "From $0 to $10K months — meet the 4-step framework.",
      "I help [niche] [outcome] in [timeframe]. Book a free strategy session.",
    ],
    image: "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=800&auto=format&fit=crop&q=60",
  },
  {
    slug: "course-creators",
    name: "Course Creators",
    tagline: "Launch sequences. Cart-open flows.",
    hook: "Course launches are a sequence, not a page. GoFunnelAI builds the pre-launch waitlist, the cart-open page, the upsell, and the abandonment recovery — and RevTry handles the high-ticket 'talk to the founder' call for $2K+ courses.",
    hookExamples: [
      "The next cohort opens Monday. Reserve your seat (waitlist-only).",
      "47 students closed deals using this exact 4-module framework.",
      "Take the free 'are you ready?' quiz before you enroll.",
    ],
    image: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&auto=format&fit=crop&q=60",
  },
  {
    slug: "fitness-trainers",
    name: "Fitness Trainers",
    tagline: "Transformation-driven. Online + in-person.",
    hook: "Online and in-person each get a different funnel. GoFunnelAI uses transformation photos (with consent compliance), pulls testimonials from your reviews, and builds the lead-magnet PDF tailored to your method.",
    hookExamples: [
      "Lose 20 lbs in 12 weeks — without giving up your weekends.",
      "21-day kickstart, all online. $19 to start, cancel anytime.",
      "Hate cardio? So do I. Here's what actually works.",
    ],
    image: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&auto=format&fit=crop&q=60",
  },
  {
    slug: "ecom-physical",
    name: "Ecommerce (Physical)",
    tagline: "Cold-traffic landers that hand off to Shopify.",
    hook: "GoFunnelAI doesn't replace your storefront — it builds the cold-traffic landing page that hands warm visitors to your Shopify. With abandoned-cart RevTry callbacks and SMS-flow trigger integration.",
    hookExamples: [
      "The pillow 14,000 side-sleepers can't stop posting about.",
      "Try it 100 nights. If it doesn't change your sleep, we pay shipping back.",
      "Free shipping over $75. Order by 2pm, ships same day.",
    ],
    image: "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=800&auto=format&fit=crop&q=60",
  },
  {
    slug: "supplements",
    name: "Supplements",
    tagline: "Subscription-first. FTC-compliant claims.",
    hook: "Supplements are subscription LTV games. GoFunnelAI handles structure-function claim compliance, builds quiz-funnel personalization, and the post-purchase upsell flow that doubles AOV.",
    hookExamples: [
      "Take the 60-second quiz. Get a personalized stack — shipped monthly.",
      "Magnesium glycinate that actually helps you sleep. Backed by RCTs.",
      "Skip the third bottle? Most customers don't.",
    ],
    image: "https://images.unsplash.com/photo-1556228841-a3c527ebefe5?w=800&auto=format&fit=crop&q=60",
    regulated: true,
  },
  {
    slug: "saas-demo-requests",
    name: "SaaS Demo Requests",
    tagline: "ICP qualification. CRM-aware routing.",
    hook: "B2B SaaS funnels are demo-driven. GoFunnelAI builds the demo signup, the use-case-specific landing page, and RevTry qualifies for ICP fit (company size, role, tech stack) before booking the AE call. CRM-aware routing to HubSpot or Salesforce.",
    hookExamples: [
      "Replace [legacy tool] in 7 days. See it live — 15-min demo.",
      "Used by 1,400 RevOps teams. Book a tailored walkthrough.",
      "Free trial — or get the demo first. Your call.",
    ],
    image: "https://images.unsplash.com/photo-1551434678-e076c223a692?w=800&auto=format&fit=crop&q=60",
  },
  {
    slug: "recruiting-staffing",
    name: "Recruiting / Staffing",
    tagline: "Two-sided: candidates + employers.",
    hook: "Staffing firms run two funnels at once — candidate-acquisition and employer-acquisition. GoFunnelAI builds both, RevTry triages by role type and urgency, and the leads land in Bullhorn, JobAdder, or Crelate.",
    hookExamples: [
      "Hiring nurses in [state]? We have 240 pre-screened candidates.",
      "Looking for a contract role? Talk to a recruiter in 24 hours.",
      "Salary benchmarks for [role] in [city]. Free 2026 report.",
    ],
    image: "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=800&auto=format&fit=crop&q=60",
  },
  {
    slug: "windows",
    name: "Windows",
    tagline: "Whole-house quotes. Financing-aware.",
    hook: "Window replacement is a high-ticket home services sale with seasonal urgency. GoFunnelAI builds an energy-savings-calculator funnel, RevTry confirms ownership + project scope, and the inspector arrives ready to quote.",
    hookExamples: [
      "Your windows are leaking $400/yr in energy. See the math.",
      "Whole-house replacement from $189/mo — locked rates for 30 days.",
      "Free in-home estimate. No high-pressure pitch. We promise.",
    ],
    image: "https://images.unsplash.com/photo-1503594384566-461fe158e797?w=800&auto=format&fit=crop&q=60",
  },
  {
    slug: "garage-doors",
    name: "Garage Doors",
    tagline: "Same-day repair, replacement upsells.",
    hook: "Garage doors split between same-day repair (broken spring) and replacement (curb appeal). GoFunnelAI builds both with urgency-triaged hooks, RevTry books the truck same-day for repair leads, and the inspector upsells replacement on-site.",
    hookExamples: [
      "Broken spring? We're at your door in under 2 hours — guaranteed.",
      "New garage door installed in one day. Financing from $79/mo.",
      "Smart-opener add-on: $189 installed today, no extra trip charge.",
    ],
    image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&auto=format&fit=crop&q=60",
  },
  {
    slug: "pest-control",
    name: "Pest Control",
    tagline: "Same-day booking. Pest-specific hooks.",
    hook: "Most pest leads convert in under 10 minutes or never. GoFunnelAI hooks on the specific pest (termites vs. roaches vs. mosquitos), shows local infestation data, and RevTry books the same-day inspection while the lead is still on the page.",
    hookExamples: [
      "See a roach? There are 50 more. Same-day service from $79.",
      "Termites are eating $3K of your home a year. Free inspection.",
      "Mosquito-free yard, all summer. Plans from $49/mo.",
    ],
    image: "https://images.unsplash.com/photo-1576020799627-aeac74d58064?w=800&auto=format&fit=crop&q=60",
  },
  {
    slug: "cleaning",
    name: "Cleaning Services",
    tagline: "Recurring revenue. Same-week bookings.",
    hook: "House and office cleaning convert on price clarity and trust. GoFunnelAI builds an instant-quote-calculator funnel, RevTry confirms scope + recurrence, and the first job is booked same-week — locked in as recurring revenue.",
    hookExamples: [
      "Get a quote in 60 seconds. Book your first clean for this week.",
      "Bi-weekly cleans from $129. Vetted, insured, English-speaking.",
      "Move-out cleaning: get your deposit back. Guaranteed.",
    ],
    image: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=800&auto=format&fit=crop&q=60",
  },
  {
    slug: "landscaping",
    name: "Landscaping",
    tagline: "Design + maintenance contracts.",
    hook: "Landscaping splits between recurring maintenance (weekly mow, fertilization plans) and one-off design/build projects. GoFunnelAI builds both with seasonally-aware hooks, RevTry triages by project size, and the estimator arrives qualified.",
    hookExamples: [
      "Lawn turning yellow? 5-step fertilization plan from $39/visit.",
      "Backyard makeover — financing from $129/mo. Free design consult.",
      "Spring cleanups: book by April 1 to lock in 2025 pricing.",
    ],
    image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&auto=format&fit=crop&q=60",
  },
];

export const INDUSTRY_HOOK_MAP = new Map(INDUSTRY_HOOKS.map((i) => [i.slug, i]));

/** Returns the industry record, or null if the slug isn't in the catalog. */
export function getIndustry(slug: string): IndustryHook | null {
  return INDUSTRY_HOOK_MAP.get(slug) ?? null;
}
