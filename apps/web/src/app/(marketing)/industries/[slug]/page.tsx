import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { INDUSTRY_HOOKS, INDUSTRY_HOOK_MAP } from "@/lib/industries";

interface PageProps {
  params: { slug: string };
}

export async function generateStaticParams() {
  return INDUSTRY_HOOKS.map((i) => ({ slug: i.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const ind = INDUSTRY_HOOK_MAP.get(params.slug);
  if (!ind) return { title: "Industry" };
  return {
    title: `${ind.name} funnels — built by GoFunnelAI in 60 seconds`,
    description: ind.tagline,
  };
}

/** /industries/[slug] — per-industry marketing page. */
export default function IndustrySlugPage({ params }: PageProps) {
  const ind = INDUSTRY_HOOK_MAP.get(params.slug);
  if (!ind) notFound();

  return (
    <>
      <section className="hero-gradient py-20 lg:py-28">
        <div className="container">
          <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
            <div className="space-y-6">
              <Link
                href="/industries"
                className="text-body-sm text-signal-600 hover:underline underline-offset-2"
              >
                ← All industries
              </Link>
              <h1 className="text-h1 lg:text-display-2 font-display text-slate-900 dark:text-slate-50">
                GoFunnelAI for {ind.name}
              </h1>
              <p className="text-body-lg text-slate-600 dark:text-slate-300 max-w-xl">
                {ind.tagline}
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button size="lg" asChild>
                  <Link href={`/signup?industry=${ind.slug}`}>
                    Build my {ind.name.toLowerCase()} funnel — free
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button size="lg" variant="secondary" asChild>
                  <Link href="/grade">Grade my existing funnel</Link>
                </Button>
              </div>
              {ind.regulated && (
                <div className="inline-flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-caption text-amber-800">
                  <Sparkles className="size-4" />
                  Regulated industry — compliance pass runs on every generation.
                </div>
              )}
            </div>
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-lg dark:border-slate-700 dark:bg-slate-800">
              <Image
                src={ind.image}
                alt={`${ind.name} hero`}
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
                priority
              />
            </div>
          </div>
        </div>
      </section>

      {/* The hook */}
      <section className="py-16 lg:py-20">
        <div className="container max-w-prose">
          <h2 className="text-h2 font-display text-slate-900 dark:text-slate-50">
            How we'd build a {ind.name.toLowerCase()} funnel for you.
          </h2>
          <p className="mt-6 text-body-lg text-slate-700 dark:text-slate-200">{ind.hook}</p>
        </div>
      </section>

      {/* Sample hook examples */}
      <section className="py-16 bg-slate-100/40 dark:bg-slate-800/40">
        <div className="container max-w-4xl">
          <h2 className="text-h3 font-display text-slate-900 dark:text-slate-50">
            Sample hooks we'd write for you
          </h2>
          <p className="mt-3 text-body text-slate-500">
            Real headlines we'd generate. We rewrite until we hit the 80-point quality bar.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {ind.hookExamples.map((h, i) => (
              <Card key={i} className="bg-white dark:bg-slate-900">
                <CardContent className="p-6 space-y-3">
                  <Badge variant="signal">Hook {i + 1}</Badge>
                  <p className="text-body text-slate-900 dark:text-slate-50 leading-snug">"{h}"</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Sample funnel */}
      <section className="py-16">
        <div className="container max-w-4xl">
          <h2 className="text-h3 font-display text-slate-900 dark:text-slate-50">
            What you get out of the box
          </h2>
          <div className="mt-8 grid gap-3 md:grid-cols-2">
            {[
              "Landing page tuned to your offer",
              "Lead magnet PDF (industry-specific)",
              "5-step email nurture sequence",
              "3-step SMS sequence",
              "RevTry voice script + objection handling",
              "Meta + Google ad creative",
              "Calendar booking flow",
              "CRM-ready contact pipeline",
            ].map((bullet) => (
              <div key={bullet} className="flex items-start gap-3">
                <Check className="size-5 text-success-500 shrink-0 mt-0.5" />
                <span className="text-body text-slate-700 dark:text-slate-200">{bullet}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 bg-signal-500">
        <div className="container max-w-prose text-center text-white">
          <h2 className="text-h2 font-display">
            Your {ind.name.toLowerCase()} funnel could be live in 60 seconds.
          </h2>
          <p className="mt-4 text-body-lg text-signal-100">
            Free until you make your first $1,000. No credit card.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row sm:justify-center gap-4">
            <Button
              size="lg"
              variant="secondary"
              asChild
              className="bg-white text-signal-700 hover:bg-slate-50 border-white"
            >
              <Link href={`/signup?industry=${ind.slug}`}>Build my funnel — free →</Link>
            </Button>
            <Link
              href="/industries"
              className="self-center text-body text-signal-100 hover:text-white underline-offset-4 hover:underline"
            >
              See all 30 industries →
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
