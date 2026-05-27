import Link from "next/link";
import { ArrowRight, BadgeCheck, FileText, Route, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Welcome | gofunnelai.com",
};

const STEPS = [
  {
    title: "Generate the first funnel",
    body: "Use one sentence to build the landing page, free asset, offer stack, upsells, and proof evidence.",
    icon: Sparkles,
  },
  {
    title: "Review the free asset",
    body: "Confirm the lead magnet gives value before asking for the booking, quote, or payment.",
    icon: FileText,
  },
  {
    title: "Launch the route",
    body: "Connect domain, ads, payments, voice, and CRM credentials when you are ready to publish.",
    icon: Route,
  },
];

export default function WelcomePage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <p className="text-caption font-semibold uppercase tracking-wider text-signal-600">
            Account ready
          </p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-950 md:text-6xl">
            Your GoFunnel workspace is ready.
          </h1>
          <p className="mt-6 text-body-lg text-slate-600">
            Start with the generator, then review the dashboard evidence before connecting real
            launch credentials.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/generate">
                Generate my first funnel <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/dashboard">Open dashboard</Link>
            </Button>
          </div>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {STEPS.map(({ title, body, icon: Icon }) => (
            <article key={title} className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <Icon className="size-6 text-signal-600" />
              <h2 className="mt-4 text-xl font-semibold text-slate-950">{title}</h2>
              <p className="mt-3 text-body-sm text-slate-600">{body}</p>
            </article>
          ))}
        </div>

        <div className="mt-8 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex gap-3">
            <BadgeCheck className="mt-0.5 size-5 shrink-0 text-success-600" />
            <div>
              <h2 className="text-xl font-semibold text-slate-950">Freeze baseline preserved.</h2>
              <p className="mt-2 text-body-sm text-slate-600">
                This workspace starts from the approved GoFunnelAI visual baseline and only moves
                forward from there.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
