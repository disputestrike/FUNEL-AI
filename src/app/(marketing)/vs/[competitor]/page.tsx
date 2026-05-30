import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { COMPETITOR_COMPARISONS, COMPETITOR_MAP } from "@/lib/competitors";

interface PageProps {
  params: { competitor: string };
}

export async function generateStaticParams() {
  return COMPETITOR_COMPARISONS.map((c) => ({ competitor: c.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const c = COMPETITOR_MAP.get(params.competitor);
  if (!c) return { title: "Compare" };
  return {
    title: c.h1,
    description: c.subhead,
  };
}

/** /vs/[competitor] — copy verbatim from doc 10 §1.5. */
export default function CompetitorComparisonPage({ params }: PageProps) {
  const c = COMPETITOR_MAP.get(params.competitor);
  if (!c) notFound();

  return (
    <>
      <section className="hero-gradient py-20 lg:py-28">
        <div className="container max-w-prose">
          <h1 className="text-h1 lg:text-display-2 font-display text-slate-900 dark:text-slate-50">
            {c.h1}
          </h1>
          <p className="mt-6 text-body-lg text-slate-600 dark:text-slate-300">{c.subhead}</p>
        </div>
      </section>

      <section className="py-12">
        <div className="container max-w-4xl">
          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
            <table className="w-full text-body-sm tabular-nums">
              <thead className="bg-slate-50 dark:bg-slate-800">
                <tr>
                  <th className="py-3 px-4 text-left font-medium text-slate-500" />
                  <th className="py-3 px-4 text-left font-semibold text-signal-700">GoFunnelAI</th>
                  <th className="py-3 px-4 text-left font-medium text-slate-700 dark:text-slate-200">
                    {c.competitor}
                  </th>
                </tr>
              </thead>
              <tbody>
                {c.table.map((row) => (
                  <tr key={row.label} className="border-t border-slate-100 dark:border-slate-700">
                    <td className="py-3 px-4 font-medium text-slate-700 dark:text-slate-200">
                      {row.label}
                    </td>
                    <td className="py-3 px-4 text-signal-700 font-medium">{row.funnel}</td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{row.them}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="py-12">
        <div className="container max-w-prose grid gap-6">
          <Card>
            <CardContent className="p-6 space-y-3">
              <h2 className="text-h4 text-slate-900 dark:text-slate-50">
                When {c.competitor} is the better choice
              </h2>
              <p className="text-body text-slate-700 dark:text-slate-200">{c.whenThem}</p>
            </CardContent>
          </Card>
          <Card className="border-signal-200 bg-signal-50/40 dark:bg-signal-900/10">
            <CardContent className="p-6 space-y-3">
              <h2 className="text-h4 text-slate-900 dark:text-slate-50">
                When GoFunnelAI is the better choice
              </h2>
              <p className="text-body text-slate-700 dark:text-slate-200">{c.whenFunnel}</p>
            </CardContent>
          </Card>
          {c.switching && (
            <Card>
              <CardContent className="p-6 space-y-3">
                <h2 className="text-h4 text-slate-900 dark:text-slate-50">
                  Switching from {c.competitor}?
                </h2>
                <p className="text-body text-slate-700 dark:text-slate-200">{c.switching}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      <section className="py-20">
        <div className="container text-center">
          <div className="flex flex-col sm:flex-row sm:justify-center gap-3">
            <Button size="lg" asChild>
              <Link href={c.primaryCta.href}>{c.primaryCta.label}</Link>
            </Button>
            {c.secondaryCta && (
              <Button size="lg" variant="secondary" asChild>
                <Link href={c.secondaryCta.href}>{c.secondaryCta.label}</Link>
              </Button>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
