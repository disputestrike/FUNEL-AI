import { notFound } from "next/navigation";

type LegalPage = {
  title: string;
  intro: string;
  sections: Array<{ title: string; body: string }>;
};

const LEGAL: Record<string, LegalPage> = {
  terms: {
    title: "Terms of Service",
    intro:
      "These terms govern use of GoFunnelAI, including generation, publishing, lead capture, RevTry calls, billing, and account responsibilities.",
    sections: [
      {
        title: "Use of the platform",
        body:
          "Customers are responsible for the offers they publish, the credentials they connect, and the claims they approve. GoFunnelAI supplies generation, review, and launch tooling.",
      },
      {
        title: "Generated content",
        body:
          "Generated pages, copy, assets, and lead magnets are available for customer use, subject to third-party provider terms and any required proof or compliance review.",
      },
      {
        title: "Billing",
        body:
          "Paid plans, usage, refunds, and provider pass-through costs are handled through connected payment rails and plan terms shown at purchase.",
      },
    ],
  },
  privacy: {
    title: "Privacy Policy",
    intro:
      "This policy explains how GoFunnelAI handles account data, business profiles, generated funnels, lead records, provider credentials, and analytics.",
    sections: [
      {
        title: "Data we process",
        body:
          "We process account information, workspace data, business inputs, generated assets, lead submissions, usage events, and support messages.",
      },
      {
        title: "How data is used",
        body:
          "Data is used to generate funnels, route leads, operate services, detect abuse, improve reliability, provide support, and maintain audit trails.",
      },
      {
        title: "Customer control",
        body:
          "Customers can export contacts, disconnect providers, request deletion, and configure consent language for published funnels.",
      },
    ],
  },
  aup: {
    title: "Acceptable Use Policy",
    intro:
      "GoFunnelAI cannot be used to publish deceptive offers, unsafe claims, unlawful content, or abusive lead-capture flows.",
    sections: [
      {
        title: "Prohibited content",
        body:
          "Do not publish fraudulent offers, misleading earnings claims, unauthorized medical claims, fake reviews, hate content, malware, or phishing pages.",
      },
      {
        title: "Regulated industries",
        body:
          "Medical, financial, legal, insurance, housing, employment, and similar offers must keep required disclosures and proof review in place.",
      },
      {
        title: "Enforcement",
        body:
          "Unsafe funnels can be blocked, unpublished, routed to human review, or suspended when they put users, leads, or the platform at risk.",
      },
    ],
  },
  refund: {
    title: "Refund Policy",
    intro:
      "Refund decisions are designed to be straightforward, fair, and tied to whether the platform delivered the generation and launch capacity purchased.",
    sections: [
      {
        title: "Self-serve plans",
        body:
          "Monthly plan refunds are available for accidental charges when requested promptly and when usage has not materially consumed the plan.",
      },
      {
        title: "Provider costs",
        body:
          "Third-party pass-through costs such as voice, ads, payments, or generated media may not be refundable once incurred.",
      },
      {
        title: "Enterprise agreements",
        body:
          "Enterprise, agency, and custom contracts follow the order form or written agreement attached to the workspace.",
      },
    ],
  },
  subprocessors: {
    title: "Subprocessors",
    intro:
      "GoFunnelAI uses trusted providers to operate infrastructure, AI generation, communications, payment processing, analytics, and support.",
    sections: [
      {
        title: "Core infrastructure",
        body:
          "Hosting, database, cache, observability, queueing, and deployment providers support the production platform.",
      },
      {
        title: "AI and media",
        body:
          "Language, image, video, embedding, and voice providers may process customer inputs and generated outputs for requested features.",
      },
      {
        title: "Business systems",
        body:
          "Payment, email, support, and analytics providers process the minimum data needed to deliver their function.",
      },
    ],
  },
  cookies: {
    title: "Cookie Settings",
    intro:
      "Cookies and similar storage keep users signed in, remember preferences, measure product health, and support attribution.",
    sections: [
      {
        title: "Required cookies",
        body:
          "Required storage supports authentication, security, session continuity, consent, and load balancing.",
      },
      {
        title: "Analytics cookies",
        body:
          "Analytics helps understand traffic, activation, quality, errors, and feature adoption without selling personal data.",
      },
      {
        title: "Managing preferences",
        body:
          "Customers can manage browser settings and in-product consent surfaces where applicable.",
      },
    ],
  },
};

export function generateStaticParams() {
  return Object.keys(LEGAL).map((slug) => ({ slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  const page = LEGAL[params.slug];
  if (!page) return {};
  return {
    title: `${page.title} | gofunnelai.com`,
    description: page.intro,
  };
}

export default function LegalPage({ params }: { params: { slug: string } }) {
  const page = LEGAL[params.slug];
  if (!page) notFound();

  return (
    <main className="bg-slate-50">
      <section className="container max-w-4xl py-16 md:py-24">
        <p className="text-caption font-semibold uppercase tracking-wider text-signal-600">Legal</p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-950 md:text-5xl">{page.title}</h1>
        <p className="mt-6 text-body-lg text-slate-600">{page.intro}</p>
        <div className="mt-10 space-y-5">
          {page.sections.map((section) => (
            <section key={section.title} className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-950">{section.title}</h2>
              <p className="mt-3 text-body text-slate-700">{section.body}</p>
            </section>
          ))}
        </div>
      </section>
    </main>
  );
}
