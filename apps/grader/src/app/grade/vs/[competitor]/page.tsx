import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Footer } from "@/components/grader/Footer";
import { Hero } from "@/components/grader/Hero";
import { COMPETITORS, type CompetitorSlug } from "@funnel/shared";
import { competitorLabel, competitorMetadata, isKnownCompetitor } from "@/lib/seo";

interface CompetitorPageProps {
  params: { competitor: string };
}

export function generateStaticParams() {
  return COMPETITORS.map((c) => ({ competitor: c }));
}

export async function generateMetadata({
  params,
}: CompetitorPageProps): Promise<Metadata> {
  if (!isKnownCompetitor(params.competitor)) return {};
  return competitorMetadata(params.competitor);
}

export default function CompetitorPage({ params }: CompetitorPageProps) {
  if (!isKnownCompetitor(params.competitor)) notFound();
  const slug = params.competitor as CompetitorSlug;
  const label = competitorLabel(slug);

  return (
    <main className="min-h-screen bg-gradient-to-b from-white via-brand-50/30 to-white">
      <Hero
        eyebrow={`${label} funnel checker`}
        headline={`Free ${label} funnel audit.`}
        subhead={`Paste your ${label} landing-page URL. We'll score it in 15 seconds and ship 3 specific improvements you can apply today — without leaving ${label}.`}
      />

      <section className="container pb-16">
        <h2 className="font-display text-center text-2xl font-bold text-ink-900">
          What we check on every {label} page
        </h2>
        <div className="mt-8 overflow-hidden rounded-2xl border border-ink-100 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-ink-50 text-ink-900/70">
              <tr>
                <th className="px-4 py-3">Dimension</th>
                <th className="px-4 py-3">What we measure</th>
                <th className="px-4 py-3">Why it moves conversion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {[
                ["Hook strength", "Headline + value prop above the fold", "5-second test â†’ cold traffic conversion"],
                ["Form friction", "Field count, labels, payment surface", "Each extra field cuts conversion ~5%"],
                ["Trust signals", "Testimonials, logos, badges, guarantees", "Direct lift on Cold/Warm CR"],
                ["Mobile + speed", "LCP, FCP, CLS, mobile Lighthouse", ">3s LCP = 32% bounce"],
                ["Compliance", "Privacy link, disclaimers, claims", "Avoids account suspensions on paid traffic"],
              ].map(([dim, what, why]) => (
                <tr key={dim}>
                  <td className="px-4 py-3 font-semibold">{dim}</td>
                  <td className="px-4 py-3 text-ink-900/80">{what}</td>
                  <td className="px-4 py-3 text-ink-900/60">{why}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="container pb-24">
        <h2 className="font-display text-center text-2xl font-bold text-ink-900">FAQ</h2>
        <div className="mx-auto mt-8 max-w-2xl divide-y divide-ink-100">
          {[
            {
              q: `Does this work for ${label} pages?`,
              a: `Yes. Our audit runs against any public landing-page URL — ${label} pages render identically to our headless browser as they would to a visitor.`,
            },
            {
              q: "Is there a catch?",
              a: "No. The audit is free. You can see your score, sub-scores, and 3 improvements without signing up. We do ask for an email if you want the PDF report.",
            },
            {
              q: `Will this replace ${label}?`,
              a: "Not today. We're focused on grading first. Once GoFunnelAI launches in full, we'll let you generate a complete replacement funnel — for now, the audit alone is worth your time.",
            },
          ].map(({ q, a }) => (
            <details key={q} className="group py-4">
              <summary className="cursor-pointer list-none text-base font-semibold text-ink-900">
                {q}
                <span className="float-right text-ink-900/40 group-open:rotate-180 transition">â–¾</span>
              </summary>
              <p className="mt-2 text-sm text-ink-900/70">{a}</p>
            </details>
          ))}
        </div>
      </section>

      <Footer />
    </main>
  );
}
