import Link from "next/link";
import { Check, X } from "lucide-react";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Free until you make your first $1,000. Then $49/month. No setup fees, no ad markup, no surprises on month two.",
};

/** Pricing page - copy verbatim from doc 10 section 1.2. */
export default function PricingPage() {
  return (
    <>
      <section className="hero-gradient py-20 lg:py-28">
        <div className="container max-w-prose text-center">
          <h1 className="text-h1 lg:text-display-2 font-display text-slate-900 dark:text-slate-50">
            Pricing that doesn't punish you for being early.
          </h1>
          <p className="mt-6 text-body-lg text-slate-600 dark:text-slate-300">
            Free until you make your first $1,000. Then $49 a month. No setup fees, no ad markup,
            no surprises on month two.
          </p>
        </div>
      </section>

      {/* Free tier callout */}
      <section className="py-12">
        <div className="container">
          <Card className="bg-slate-50 border-slate-200 dark:bg-slate-800/40">
            <CardContent className="p-8 md:p-10 grid gap-6 md:grid-cols-[1fr_auto] items-center">
              <div>
                <Badge variant="signal" className="mb-3">
                  Free, forever
                </Badge>
                <h2 className="text-h3 text-slate-900 dark:text-slate-50">
                  The free tier. Actually free. Forever.
                </h2>
                <p className="mt-3 text-body text-slate-600 dark:text-slate-300">
                  One funnel. 100 leads a month. 10 RevTry voice minutes. Subdomain on{" "}
                  <span className="font-mono">gofunnelai.com</span>. PayPal connection optional - you
                  only link it when you upgrade. No credit card to start.
                </p>
              </div>
              <Button size="lg" asChild>
                <Link href="/signup">Start free &rarr;</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* 4-tier cards */}
      <section className="py-12">
        <div className="container">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {TIERS.map((t) => (
              <Card
                key={t.name}
                className={
                  t.featured
                    ? "border-signal-500 ring-2 ring-signal-100 dark:ring-signal-900"
                    : "border-slate-200"
                }
              >
                <CardContent className="p-6 space-y-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-h4 text-slate-900 dark:text-slate-50">{t.name}</h3>
                    {t.featured && <Badge variant="signal">Most popular</Badge>}
                  </div>
                  <p className="text-body-sm text-slate-500">{t.tagline}</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-h2 font-display tabular-nums text-slate-900 dark:text-slate-50">
                      {t.price}
                    </span>
                    <span className="text-body-sm text-slate-500">/ month</span>
                  </div>
                  <ul className="space-y-2 text-body-sm text-slate-700 dark:text-slate-200">
                    {t.bullets.map((b) => (
                      <li key={b} className="flex gap-2">
                        <Check className="size-4 text-success-500 shrink-0 mt-0.5" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                  {t.freeUntilK && (
                    <p className="text-caption text-signal-600">
                      "Free until $1K" option: <strong>Yes - opt-in at signup</strong>
                    </p>
                  )}
                  <Button
                    variant={t.featured ? "primary" : "secondary"}
                    className="w-full"
                    asChild
                  >
                    <Link href={t.cta.href}>{t.cta.label}</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison table */}
      <section className="py-20">
        <div className="container">
          <h2 className="text-h3 font-display text-slate-900 dark:text-slate-50 mb-8">
            Compare every plan.
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-body-sm tabular-nums">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="py-3 pr-4 text-left text-slate-500" />
                  {["Free", "Starter", "Growth", "Scale", "Agency"].map((c) => (
                    <th key={c} className="py-3 px-3 text-left font-semibold text-slate-900 dark:text-slate-50">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARE.map((row) => (
                  <tr key={row[0]} className="border-b border-slate-100">
                    <td className="py-3 pr-4 font-medium text-slate-700 dark:text-slate-200">
                      {row[0]}
                    </td>
                    {row.slice(1).map((v, i) => (
                      <td key={i} className="py-3 px-3 text-slate-600 dark:text-slate-300">
                        {v === "-" ? <X className="size-4 text-slate-300" /> : v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Free until $1K callout */}
      <section className="py-16 bg-slate-100/40 dark:bg-slate-800/40">
        <div className="container max-w-prose">
          <h2 className="text-h2 font-display text-slate-900 dark:text-slate-50">
            Free until you make your first $1,000.
          </h2>
          <p className="mt-4 text-body text-slate-700 dark:text-slate-300">
            Opt into this option at signup on the Starter plan. We don't charge you a dollar of
            subscription until Funnel has generated $1,000 of attributed revenue for your
            business - verified through your Stripe or PayPal, or self-reported with a 30-day hold.
            Once you cross $1K, your monthly plan kicks in.
          </p>
          <h3 className="mt-8 text-h5 text-slate-900 dark:text-slate-50">Why we do this:</h3>
          <p className="mt-2 text-body text-slate-700 dark:text-slate-300">
            Because most "free trials" expire before you've gotten value. Most lead gen tools
            charge you whether they worked or not. We think that's backward. If we don't earn you
            $1K, you don't pay us $49.
          </p>
          <p className="mt-6 text-body-sm text-slate-500">
            Available on Starter only. Not available on Growth, Scale, or Agency (those plans are
            for operators already past first revenue).{" "}
            <Link href="/legal/free-until-1k" className="text-signal-600 hover:underline">
              Read the full terms &rarr;
            </Link>
          </p>
        </div>
      </section>

      {/* PPP */}
      <section className="py-16">
        <div className="container max-w-prose">
          <h2 className="text-h3 font-display text-slate-900 dark:text-slate-50">
            Pricing for where you actually live.
          </h2>
          <p className="mt-3 text-body text-slate-700 dark:text-slate-300">
            We support purchasing power parity in 90 countries. GoFunnel costs less in Sao Paulo than
            in San Francisco - because it should. We auto-detect your country at signup and show
            you local pricing in your local currency.{" "}
            <Link href="/ppp" className="text-signal-600 hover:underline">
              See the full PPP table &rarr;
            </Link>
          </p>
        </div>
      </section>

      {/* Add-ons */}
      <section className="py-16 bg-slate-100/40 dark:bg-slate-800/40">
        <div className="container">
          <h2 className="text-h3 font-display text-slate-900 dark:text-slate-50">
            Add-ons (only when you need them).
          </h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {ADDONS.map((a) => (
              <Card key={a.title}>
                <CardContent className="p-6 space-y-2">
                  <h3 className="text-h5 text-slate-900 dark:text-slate-50">{a.title}</h3>
                  <p className="text-body-sm text-slate-600 dark:text-slate-300">{a.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing FAQ */}
      <section className="py-20">
        <div className="container max-w-prose">
          <h2 className="text-h2 font-display text-slate-900 dark:text-slate-50 text-center">
            Pricing FAQ
          </h2>
          <Accordion type="single" collapsible className="mt-10">
            {PRICING_FAQ.map((q, i) => (
              <AccordionItem key={i} value={`p${i}`}>
                <AccordionTrigger className="text-body font-medium text-left">
                  {q.q}
                </AccordionTrigger>
                <AccordionContent className="text-body">{q.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      <section className="py-20">
        <div className="container text-center">
          <h2 className="text-h2 font-display">Pick a plan. Or don't. Free works too.</h2>
          <div className="mt-8 flex flex-col sm:flex-row sm:justify-center gap-3">
            <Button size="lg" variant="secondary" asChild>
              <Link href="/signup">Start free &rarr;</Link>
            </Button>
            <Button size="lg" asChild>
              <Link href="/signup?plan=growth">Start with Growth &rarr;</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}

const TIERS = [
  {
    name: "Starter",
    price: "$49",
    tagline: "For solo operators getting their first leads.",
    bullets: [
      "3 funnels",
      "2,000 leads/month",
      "200 RevTry minutes/month",
      "1 user seat",
      "Subdomain on gofunnelai.com",
      "A/B testing (2 variants)",
      "Ad publishing - Meta, Google",
      "Email + chat support",
    ],
    freeUntilK: true,
    cta: { label: "Start with Starter ->", href: "/signup?plan=starter" },
    featured: false,
  },
  {
    name: "Growth",
    price: "$149",
    tagline: "For operators getting serious about pipeline.",
    bullets: [
      "10 funnels",
      "10,000 leads/month",
      "1,000 RevTry minutes/month",
      "3 user seats",
      "1 custom domain",
      "A/B testing (unlimited variants)",
      "Ad publishing - Meta, Google, TikTok, LinkedIn",
      "All integrations (HubSpot, Salesforce, Zapier, webhooks)",
      "Priority chat support",
    ],
    freeUntilK: false,
    cta: { label: "Start with Growth ->", href: "/signup?plan=growth" },
    featured: true,
  },
  {
    name: "Scale",
    price: "$497",
    tagline: "For teams running 6-figure monthly ad spend.",
    bullets: [
      "50 funnels",
      "100,000 leads/month",
      "5,000 RevTry minutes/month",
      "10 user seats",
      "Unlimited custom domains",
      "Custom RevTry voice (clone your own)",
      "Advanced compliance pack (HIPAA, GLBA, FINRA pre-checks)",
      "Dedicated success manager",
      "Priority phone + Slack Connect support",
    ],
    freeUntilK: false,
    cta: { label: "Talk to us ->", href: "/contact?plan=scale" },
    featured: false,
  },
  {
    name: "Agency",
    price: "$997",
    tagline: "For agencies running funnels for clients.",
    bullets: [
      "Unlimited funnels",
      "Unlimited sub-accounts (your clients)",
      "20,000 RevTry minutes/month (pooled)",
      "White-label everything (logo, domain, login, emails, invoice)",
      "Reseller margins on every plan you resell",
      "Agency Academy access",
      "Dedicated agency partner manager",
    ],
    freeUntilK: false,
    cta: { label: "Become a partner ->", href: "/contact?plan=agency" },
    featured: false,
  },
];

const COMPARE: string[][] = [
  ["Funnels", "1", "3", "10", "50", "Unlimited"],
  ["Leads / month", "100", "2,000", "10,000", "100,000", "Unlimited"],
  ["RevTry minutes / month", "10", "200", "1,000", "5,000", "20,000 (pooled)"],
  ["User seats", "1", "1", "3", "10", "Unlimited"],
  ["Custom domain", "-", "-", "1", "Unlimited", "Unlimited"],
  ["A/B test variants", "-", "2", "Unlimited", "Unlimited", "Unlimited"],
  ["Ad publishing", "-", "Meta + Google", "All four", "All four", "All four"],
  ["Native integrations", "-", "-", "All", "All", "All"],
  ["Custom RevTry voice", "-", "-", "-", "Yes", "Yes"],
  ["Regulated-industry pack", "-", "-", "-", "Yes", "Yes"],
  ["Sub-accounts", "-", "-", "-", "-", "Unlimited"],
  ["White-label", "-", "-", "-", "-", "Full"],
  ["Support", "Community", "Email + chat", "Priority chat", "Phone + Slack", "Dedicated partner"],
];

const ADDONS = [
  { title: "Extra RevTry minutes", body: "$0.18 / minute, billed monthly. No subscription. No commitment. Caps you set in dashboard." },
  { title: "Extra leads", body: "$0.02 / lead above your plan's allowance. Hard cap at 2x your plan limit unless you raise it." },
  { title: "Custom workspace branding", body: "$29 / month. Your logo, your accent color, your custom favicon, your support email forwarding. (Included free on Agency.)" },
  { title: "Voice cloning (your own voice)", body: "$99 one-time. 5-minute recording, secure consent process, available within 24 hours. (Included on Scale + Agency.)" },
];

const PRICING_FAQ = [
  { q: "Can I change plans anytime?", a: "Yes. Upgrade takes effect immediately, prorated to your billing date. Downgrade takes effect at your next billing date - you keep current plan features until then." },
  { q: "What happens if I exceed my lead limit or RevTry minutes?", a: "We email you at 80% and 100%. At 100%, new leads still come in but RevTry doesn't auto-call them - they queue. You can buy add-on minutes/leads with one click, or upgrade your plan. We never silently overcharge." },
  { q: "Is there a long-term contract?", a: "No. Monthly, cancel anytime, no clawback. Annual plans get 2 months free; refunded pro-rata if you cancel." },
  { q: "Do you charge for ad spend?", a: "No markup. Ad spend goes straight from your card to the ad platform." },
  { q: "Do you have an enterprise plan above Agency?", a: "Yes - GoFunnel Enterprise for accounts north of $50K/mo in ad spend or 500+ sub-accounts. Custom SLAs, SSO, dedicated infra, on-prem options. Email enterprise@gofunnelai.com." },
  { q: "I'm a nonprofit / educator / founder under 22. Anything for me?", a: "Yes. 50% off Growth and Scale for verified nonprofits, accredited educators, and founders under 22. Apply at /community-pricing." },
];
