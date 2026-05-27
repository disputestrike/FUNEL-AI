import Link from "next/link";
import { ArrowRight, BadgeCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "How We Score | gofunnelai.com",
  description:
    "How GoFunnelAI grades funnel quality across hook, form, trust, speed, compliance, offer, and follow-up.",
};

const SCORE_AREAS = [
  "Hook clarity",
  "Offer and free-value fit",
  "Form friction",
  "Trust stack",
  "Mobile fit",
  "Speed and accessibility",
  "Compliance risk",
  "Follow-up readiness",
];

export default function HowWeScorePage() {
  return (
    <main className="bg-slate-50">
      <section className="container max-w-4xl py-16 md:py-24">
        <p className="text-caption font-semibold uppercase tracking-wider text-signal-600">
          Funnel Grader
        </p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-950 md:text-5xl">
          How GoFunnelAI scores a funnel.
        </h1>
        <p className="mt-6 text-body-lg text-slate-600">
          The grader checks whether a page can turn traffic into qualified leads, then whether the
          follow-up system can turn those leads into booked conversations.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {SCORE_AREAS.map((area) => (
            <div key={area} className="flex gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <BadgeCheck className="mt-0.5 size-5 shrink-0 text-signal-600" />
              <span className="text-body-sm font-medium text-slate-800">{area}</span>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-semibold text-slate-950">The pass line is 80.</h2>
          <p className="mt-3 text-body text-slate-700">
            Under 80 means the funnel has at least one meaningful conversion risk. Above 80 means
            the page is launchable, with evidence attached so a human can still review the claims.
          </p>
        </div>

        <Button asChild size="lg" className="mt-8">
          <Link href="/grade">
            Grade a funnel <ArrowRight className="size-4" />
          </Link>
        </Button>
      </section>
    </main>
  );
}
