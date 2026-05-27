import type { Metadata } from "next";

import { Footer } from "@/components/grader/Footer";
import { Hero } from "@/components/grader/Hero";
import { graderHomeMetadata, graderJsonLd } from "@/lib/seo";

export const metadata: Metadata = graderHomeMetadata;

export default function GradePage() {
  const turnstileSitekey = process.env.NEXT_PUBLIC_TURNSTILE_SITEKEY ?? null;
  return (
    <main className="min-h-screen bg-gradient-to-b from-white via-brand-50/30 to-white">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(graderJsonLd()) }}
      />
      <Hero turnstileSitekey={turnstileSitekey} />

      <section className="container pb-24">
        <h2 className="font-display text-center text-2xl font-bold text-ink-900">
          What you get in 15 seconds
        </h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              t: "Overall score (0–100)",
              d: "Plus a letter grade and a one-paragraph critique you can act on today.",
            },
            {
              t: "5 sub-scores",
              d: "Hook strength, form friction, trust signals, mobile speed, and compliance.",
            },
            {
              t: "3 specific improvements",
              d: "Before/after copy and effort vs. impact ranking — not generic advice.",
            },
            {
              t: "Shareable score URL",
              d: "Send your audit to your team or post your score to LinkedIn.",
            },
            {
              t: "Downloadable PDF",
              d: "Full detailed breakdown including every flag and rewrite suggestion.",
            },
            {
              t: "Preview funnel",
              d: "Watch our AI build a replacement hero section tailored to your business.",
            },
          ].map((card) => (
            <div key={card.t} className="rounded-xl border border-ink-100 bg-white p-6">
              <h3 className="font-display text-lg font-bold text-ink-900">{card.t}</h3>
              <p className="mt-2 text-sm text-ink-900/70">{card.d}</p>
            </div>
          ))}
        </div>
      </section>

      <Footer />
    </main>
  );
}
