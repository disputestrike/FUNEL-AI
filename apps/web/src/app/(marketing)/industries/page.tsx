import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { INDUSTRY_HOOKS } from "@/lib/industries";

export const metadata: Metadata = {
  title: "30 industries. One funnel engine that knows each one.",
  description:
    "What converts a solar lead is not what converts a SaaS CFO. GoFunnel is trained on the proven patterns for each of 30 industries.",
};

/** /industries page — copy verbatim from doc 10 §1.4. */
export default function IndustriesPage() {
  return (
    <>
      <section className="hero-gradient py-20 lg:py-28">
        <div className="container max-w-prose text-center">
          <h1 className="text-h1 lg:text-display-2 font-display text-slate-900 dark:text-slate-50">
            30 industries. One funnel engine that knows each one.
          </h1>
          <p className="mt-6 text-body-lg text-slate-600 dark:text-slate-300">
            What converts a solar lead is not what converts a SaaS CFO. GoFunnel is trained on the
            proven patterns for each industry — the hooks, the offers, the objections, the price
            anchors. Pick yours below to see what we'd build you.
          </p>
        </div>
      </section>

      <section className="py-12">
        <div className="container space-y-10">
          {INDUSTRY_HOOKS.map((ind) => (
            <article
              key={ind.slug}
              id={ind.slug}
              className="scroll-mt-24 border-b border-slate-100 pb-10 last:border-none"
            >
              <div className="grid gap-6 lg:grid-cols-[200px_1fr] items-start">
                <h2 className="text-h3 font-display text-slate-900 dark:text-slate-50">
                  {ind.name}
                </h2>
                <div className="space-y-4">
                  <p className="text-body text-slate-700 dark:text-slate-200">{ind.hook}</p>
                  <Link
                    href={`/signup?industry=${ind.slug}`}
                    className="inline-flex items-center gap-1 text-body-sm font-medium text-signal-600 hover:underline"
                  >
                    See a sample funnel <ArrowRight className="size-4" />
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="tell-us" className="py-16 bg-slate-100/40 dark:bg-slate-800/40">
        <div className="container max-w-prose">
          <Card>
            <CardContent className="p-8 space-y-4">
              <h2 className="text-h3 font-display text-slate-900 dark:text-slate-50">
                Don't see your industry?
              </h2>
              <p className="text-body text-slate-600 dark:text-slate-300">
                You're probably still covered. Funnel's engine isn't 30 hard-coded templates — it's
                a reasoning system trained on what makes any offer convert. Tell us what you sell
                and we'll route you to the closest match (and add yours to the list).
              </p>
              <form action="/api/industry-request" method="post" className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <Input
                  name="pitch"
                  placeholder="I sell ____ to ____"
                  required
                  aria-label="What you sell, and to whom"
                />
                <Button type="submit">Tell Funnel →</Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>
    </>
  );
}
