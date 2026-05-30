import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, BadgeCheck } from "lucide-react";
import { ContactForm } from "@/components/marketing/ContactForm";

type PageContent = {
  title: string;
  eyebrow: string;
  intro: string;
  sections: Array<{ title: string; body: string; points: string[] }>;
  cta: string;
  ctaHref?: string;
};

const PAGES: Record<string, PageContent> = {
  integrations: {
    eyebrow: "Product",
    title: "Integrations that launch the funnel, not a to-do list.",
    intro:
      "GoFunnelAI connects the generation engine to the places revenue actually happens: ads, payments, CRM, voice, email, calendar, analytics, and publishing.",
    sections: [
      {
        title: "Traffic",
        body: "Generate channel-ready campaigns and route launch approvals through the same quality gate as the page.",
        points: ["Meta and Google campaign adapters", "TikTok and LinkedIn creative packs", "UTM and conversion event mapping"],
      },
      {
        title: "Revenue",
        body: "Payment rails stay credential-backed so the generated funnel can sell, invoice, upsell, or hand off to a quote flow.",
        points: ["Stripe and PayPal readiness", "Tripwire and order-bump mapping", "Invoice and refund audit trails"],
      },
      {
        title: "Follow-up",
        body: "Every lead can move into voice, SMS, email, CRM, and calendar without exporting a CSV.",
        points: ["RevTry voice handoff", "Email/SMS nurture hooks", "Calendar and CRM sync points"],
      },
    ],
    cta: "Generate an integration-ready funnel",
  },
  roadmap: {
    eyebrow: "Product",
    title: "Roadmap built around launch, proof, and scale.",
    intro:
      "The product roadmap is focused on one operating promise: a customer should move from business description to live funnel to qualified leads with less manual work every week.",
    sections: [
      {
        title: "Now",
        body: "Generation, grading, offer intelligence, lead magnet selection, upsell staging, and proof gates.",
        points: ["Industry offer matrix", "Crosswalk evidence", "Quality scoring and rewrite gates"],
      },
      {
        title: "Next",
        body: "Credentialed launch adapters for ads, payments, voice, email, and publishing.",
        points: ["Provider sandbox flows", "Approval queues", "Launch audit log"],
      },
      {
        title: "Later",
        body: "Agency control, vertical benchmarks, recursive learning, and white-label workspace operations.",
        points: ["Sub-account operations", "Vertical conversion benchmarks", "Template and snapshot libraries"],
      },
    ],
    cta: "See the generation engine",
  },
  academy: {
    eyebrow: "Resources",
    title: "GoFunnel Academy turns operators into better closers.",
    intro:
      "The academy gives customers the training path behind the software: offer math, lead magnet strategy, ad review, follow-up, compliance, and conversion diagnosis.",
    sections: [
      {
        title: "Operator track",
        body: "For owners who need to launch and understand their first working funnel.",
        points: ["Offer clarity", "Free-value-first lead magnets", "Follow-up and booking basics"],
      },
      {
        title: "Agency track",
        body: "For teams building funnels for clients, including handoff, reporting, and account health.",
        points: ["Client onboarding", "Template reuse", "Quality review systems"],
      },
      {
        title: "Certification",
        body: "Proof that a user knows how to build, audit, publish, and improve funnels inside the platform.",
        points: ["Practical reviews", "Vertical playbooks", "Partner directory readiness"],
      },
    ],
    cta: "Start with a funnel grade",
  },
  help: {
    eyebrow: "Resources",
    title: "Help Center for launch blockers.",
    intro:
      "Help content is organized around the moments users get stuck: generating, editing, connecting credentials, publishing, capturing leads, and reading evidence.",
    sections: [
      {
        title: "Generate",
        body: "Understand what the engine builds and why each asset exists.",
        points: ["Business profile inputs", "Lead magnet choices", "Quality score explanations"],
      },
      {
        title: "Launch",
        body: "Connect domains, ad accounts, payments, and lead-routing credentials.",
        points: ["Railway deployment checks", "DNS and SSL", "Provider credential setup"],
      },
      {
        title: "Improve",
        body: "Use crosswalk evidence and grader feedback to make the funnel stronger.",
        points: ["Proof review", "Compliance warnings", "Conversion bottlenecks"],
      },
    ],
    cta: "Open the generator",
  },
  blog: {
    eyebrow: "Resources",
    title: "Field notes on funnels that actually convert.",
    intro:
      "The blog is where the team publishes practical analysis: industry offers, lead magnets, upsells, compliance patterns, and teardown lessons.",
    sections: [
      {
        title: "Offer strategy",
        body: "How different industries earn trust before asking for a call or payment.",
        points: ["Solar savings plans", "Med spa quizzes", "SaaS ROI calculators"],
      },
      {
        title: "Funnel teardown",
        body: "Before/after analysis of pages, forms, proof, speed, and follow-up.",
        points: ["Hook strength", "Trust stack", "CTA progression"],
      },
      {
        title: "Operations",
        body: "How to keep leads moving after the page converts.",
        points: ["RevTry callbacks", "CRM hygiene", "Nurture sequences"],
      },
    ],
    cta: "Grade a funnel",
  },
  community: {
    eyebrow: "Resources",
    title: "A community for people shipping funnels, not talking about them.",
    intro:
      "Community spaces are organized by industry and job: founders, agencies, operators, ad buyers, and sales teams can compare what is working.",
    sections: [
      {
        title: "Industry rooms",
        body: "Discuss real objections, proof assets, compliance limits, and offer structures.",
        points: ["Local services", "Medical and wellness", "B2B SaaS"],
      },
      {
        title: "Office hours",
        body: "Live reviews for launch blockers, funnel grades, and offer improvements.",
        points: ["Weekly teardown sessions", "Launch checklists", "Provider setup walkthroughs"],
      },
      {
        title: "Partner network",
        body: "Certified builders and agencies can receive implementation work from customers who want help.",
        points: ["Certification proof", "Directory profiles", "Referral workflows"],
      },
    ],
    cta: "Generate your first proof",
  },
  awards: {
    eyebrow: "Resources",
    title: "GoFunnel Awards recognize work that earns attention and revenue.",
    intro:
      "Awards are tied to measurable improvements: stronger hooks, better free assets, faster launches, lower CPL, and better booked-call rates.",
    sections: [
      {
        title: "Monthly wins",
        body: "Customers can submit launched funnels with screenshots, proof, and performance summaries.",
        points: ["Best lead magnet", "Best local services funnel", "Best B2B business case"],
      },
      {
        title: "Evidence first",
        body: "Award pages highlight what changed and why the funnel performed.",
        points: ["Before/after grades", "Conversion context", "Compliance-safe proof"],
      },
      {
        title: "Reusable lessons",
        body: "Winning patterns feed back into education and vertical playbooks.",
        points: ["Offer examples", "Asset examples", "Follow-up examples"],
      },
    ],
    cta: "Grade your funnel",
  },
  funnelcon: {
    eyebrow: "Resources",
    title: "GoFunnelCon is for operators who want the machine in public.",
    intro:
      "The event is built around live generation, live teardown, and the operating systems behind autonomous lead generation.",
    sections: [
      {
        title: "Live builds",
        body: "Watch funnels generated for real businesses, including lead magnets, offer stacks, ads, and follow-up.",
        points: ["Industry selection", "Proof review", "Launch checklist"],
      },
      {
        title: "Teardowns",
        body: "Compare generated output against old funnels and popular builder templates.",
        points: ["Quality score", "Conversion gaps", "Compliance issues"],
      },
      {
        title: "Operator sessions",
        body: "Deep sessions on sales calls, ad launch, payment flows, and agency scale.",
        points: ["RevTry scripts", "Ad launch governance", "Agency workflows"],
      },
    ],
    cta: "See what we build",
  },
  careers: {
    eyebrow: "Company",
    title: "Careers for builders who care about revenue systems.",
    intro:
      "GoFunnelAI needs people who can turn messy operator pain into products that feel obvious, useful, and fast.",
    sections: [
      {
        title: "Engineering",
        body: "Build generation systems, provider adapters, quality gates, publishing infrastructure, and analytics.",
        points: ["Full-stack product engineering", "AI orchestration", "Reliability and security"],
      },
      {
        title: "Growth",
        body: "Turn proof into demand through content, partnerships, teardown loops, and agency enablement.",
        points: ["Founder content", "Community", "Vertical partnerships"],
      },
      {
        title: "Customer success",
        body: "Help customers launch, learn, and improve until the funnel produces meaningful outcomes.",
        points: ["Activation", "Offer review", "Launch support"],
      },
    ],
    cta: "Contact the team",
  },
  press: {
    eyebrow: "Company",
    title: "Press resources for the autonomous lead generation company.",
    intro:
      "Press coverage should focus on the shift from funnel builders as tools to funnel systems as operators.",
    sections: [
      {
        title: "Company",
        body: "GoFunnelAI builds lead-generation infrastructure that creates pages, assets, follow-up, and proof gates.",
        points: ["Founded for operators", "Remote team", "Railway-ready SaaS architecture"],
      },
      {
        title: "Product",
        body: "The system combines strategy models, mechanical production adapters, voice follow-up, and quality scoring.",
        points: ["Offer intelligence", "RevTry handoff", "Crosswalk evidence"],
      },
      {
        title: "Assets",
        body: "Brand, screenshots, executive notes, and product descriptions can be provided for accurate coverage.",
        points: ["Logo pack", "Screenshots", "Founder background"],
      },
    ],
    cta: "Contact press",
  },
  contact: {
    eyebrow: "Company",
    title: "Contact the GoFunnelAI team.",
    intro:
      "Use this page for sales, support, partnerships, press, security, or investor inquiries. The fastest path is still to generate or grade a funnel first.",
    sections: [
      {
        title: "Sales",
        body: "For businesses and agencies evaluating plans, white-label, or multi-workspace rollout.",
        points: ["sales@gofunnelai.com", "Agency demos", "Enterprise setup"],
      },
      {
        title: "Support",
        body: "For launch blockers, account questions, billing, credentials, or provider setup.",
        points: ["support@gofunnelai.com", "Credential setup", "Railway deployment"],
      },
      {
        title: "Security",
        body: "For vulnerability reports, abuse reports, or trust and safety concerns.",
        points: ["security@gofunnelai.com", "Responsible disclosure", "Compliance review"],
      },
    ],
    cta: "Start from the generator",
    ctaHref: "/generate",
  },
  customers: {
    eyebrow: "Proof",
    title: "Customer stories built around outcomes, not adjectives.",
    intro:
      "The strongest stories show a before state, the generated system, and the revenue or booking result after launch.",
    sections: [
      {
        title: "Local services",
        body: "Fast quote funnels that turn intent into calls and bookings.",
        points: ["Solar consultations", "HVAC service calls", "Roofing inspections"],
      },
      {
        title: "Healthcare and wellness",
        body: "Education-first funnels with safer claims, proof review, and appointment routing.",
        points: ["Dental benefits checks", "Med spa treatment quizzes", "Fitness consult funnels"],
      },
      {
        title: "B2B",
        body: "Business-case funnels that qualify serious buyers before asking for demo time.",
        points: ["ROI calculators", "Security proof", "Implementation upsells"],
      },
    ],
    cta: "Grade your current funnel",
  },
  methodology: {
    eyebrow: "Proof",
    title: "Methodology behind pipeline and quality claims.",
    intro:
      "Metrics are strongest when the assumptions are visible. GoFunnelAI tracks generated assets, lead flow, booked calls, and user-reported close rates separately.",
    sections: [
      {
        title: "Pipeline",
        body: "Pipeline estimates combine qualified bookings with user-reported average deal value and stage probability.",
        points: ["Booking source", "Deal value", "Stage weighting"],
      },
      {
        title: "Quality score",
        body: "Funnel quality is scored across hook, form, trust, speed, mobile fit, compliance, offer coherence, and follow-up.",
        points: ["80-point floor", "Rewrite gate", "Evidence audit"],
      },
      {
        title: "Claims",
        body: "Quantitative claims require source notes or customer proof before publish.",
        points: ["Proof assets", "Compliance review", "Audit metadata"],
      },
    ],
    cta: "Run a funnel grade",
  },
  ppp: {
    eyebrow: "Pricing",
    title: "PPP pricing makes GoFunnelAI workable across markets.",
    intro:
      "Purchasing-power pricing is designed for operators outside the highest-cost markets who still need the same generation, lead magnet, follow-up, and launch systems.",
    sections: [
      {
        title: "How it works",
        body: "Eligible accounts see a regional price adjustment at checkout while keeping the same product capabilities and quality floor.",
        points: ["Country-based eligibility", "Same funnel engine", "Same support path"],
      },
      {
        title: "What changes",
        body: "Only the subscription price changes. Provider pass-through costs such as voice minutes, ad spend, payment fees, and generated media remain based on the provider charge.",
        points: ["No feature downgrade", "Transparent provider costs", "Plan limits stay visible"],
      },
      {
        title: "Review",
        body: "Agency and enterprise PPP requests can be reviewed manually when a team operates across several countries.",
        points: ["Multi-country teams", "Agency workspaces", "Manual plan review"],
      },
    ],
    cta: "Contact the team",
    ctaHref: "/contact",
  },
};

export function generateStaticParams() {
  return Object.keys(PAGES).map((slug) => ({ slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  const page = PAGES[params.slug];
  if (!page) return {};
  return {
    title: `${page.title} | gofunnelai.com`,
    description: page.intro,
  };
}

export default function MarketingInfoPage({ params }: { params: { slug: string } }) {
  const page = PAGES[params.slug];
  if (!page) notFound();
  const isContact = params.slug === "contact";

  return (
    <main className="bg-slate-50">
      <section className="container py-16 md:py-24">
        <div className="max-w-3xl">
          <p className="text-caption font-semibold uppercase tracking-wider text-signal-600">{page.eyebrow}</p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-950 md:text-6xl">{page.title}</h1>
          <p className="mt-6 text-body-lg text-slate-600">{page.intro}</p>
          <Link
            href={page.ctaHref ?? "/signup"}
            className="mt-8 inline-flex items-center gap-2 rounded-md bg-slate-950 px-5 py-3 text-body-sm font-semibold text-white hover:bg-slate-800"
          >
            {page.cta}
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>

      <section className="container pb-20">
        <div className="grid gap-5 lg:grid-cols-3">
          {page.sections.map((section) => (
            <article key={section.title} className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-950">{section.title}</h2>
              <p className="mt-3 text-body-sm text-slate-600">{section.body}</p>
              <ul className="mt-5 space-y-3">
                {section.points.map((point) => (
                  <li key={point} className="flex gap-2 text-body-sm text-slate-700">
                    <BadgeCheck className="mt-0.5 size-4 shrink-0 text-signal-600" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
        {isContact ? (
          <div className="mt-8 max-w-3xl">
            <ContactForm />
          </div>
        ) : null}
      </section>
    </main>
  );
}
