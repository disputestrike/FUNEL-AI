import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "About — we're building the last lead gen tool you'll ever need.",
  description:
    "Founded in 2025. Built in San Francisco and Lagos. Hellbent on one belief: a small business should not need an agency, a copywriter, an SDR, and a media buyer to compete.",
};

/** /about — copy verbatim from doc 10 §1.6. */
export default function AboutPage() {
  return (
    <>
      <section className="hero-gradient py-20 lg:py-28">
        <div className="container max-w-prose text-center">
          <h1 className="text-h1 lg:text-display-2 font-display text-slate-900 dark:text-slate-50">
            We're building the last lead gen tool you'll ever need.
          </h1>
          <p className="mt-6 text-body-lg text-slate-600 dark:text-slate-300">
            Founded in 2025. Built in San Francisco and Lagos. Hellbent on one belief: a small
            business should not need an agency, a copywriter, an SDR, and a media buyer to compete.
          </p>
        </div>
      </section>

      <section className="py-20">
        <div className="container max-w-prose">
          <h2 className="text-h2 font-display text-slate-900 dark:text-slate-50">
            The founder note.
          </h2>
          <div className="mt-8 space-y-5 text-body-lg text-slate-700 dark:text-slate-200">
            <p>In 2015, I built my first funnel by hand. It took me three weeks. It made $0.</p>
            <p>
              In 2018, I hired a $7,500/month agency to build the next one. It took six weeks. It
              also made $0, but with much better fonts.
            </p>
            <p>
              In 2021, I started running my own ads. I learned Meta Ads Manager, then Google Ads,
              then TikTok Ads. I bought ClickFunnels. I bought HighLevel. I learned Webflow. I
              wired up Zapier. I taped together a stack of seventeen tools, each one solving 6% of
              the problem.
            </p>
            <p>
              By 2023 I was finally making money — and spending all of it on tools, contractors,
              and the SDR who called the leads. The math worked. Barely.
            </p>
            <p>
              Then I watched my friend Sarah, who runs a single-location med spa in Cleveland, try
              to do the same thing. She didn't have eight years to learn Meta Ads. She didn't have
              $90K/year for an SDR. She had a phone in her pocket and a list of things she needed
              done.
            </p>
            <p>GoFunnel is for Sarah.</p>
            <p>
              We started building in early 2025 with a hypothesis: by 2026, AI will be good enough
              that a single sentence — “I sell solar installs to Phoenix homeowners” — should be
              enough input to produce a working landing page, a tested ad creative, a written email
              sequence, an AI agent that calls leads in your voice, and a booked call on your
              calendar.
            </p>
            <p>
              90 days into our public launch, the hypothesis is holding. GoFunnel users have closed
              $14.2M of pipeline. Sarah's med spa has gone from 4 leads/month to 31 leads/month.
              She has not opened ClickFunnels in 76 days.
            </p>
            <p>
              We are not done. The engine gets smarter every night. The voice gets more human every
              release. The price floor stays at $0 — and stays there on purpose, because the
              operators who need this most cannot afford a $97/month minimum.
            </p>
            <p>
              If you are an operator with a phone in your pocket and a list of things that need
              doing, GoFunnel is for you. Type your business. Get a customer. We'll handle the
              in-between.
            </p>
            <p className="text-body font-medium text-slate-500">— Ben & the team</p>
          </div>
        </div>
      </section>

      <section className="py-20 bg-slate-100/40 dark:bg-slate-800/40">
        <div className="container">
          <h2 className="text-h2 font-display text-slate-900 dark:text-slate-50">
            The people building it.
          </h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {TEAM.map((m) => (
              <Card key={m.name}>
                <CardContent className="p-6 space-y-3">
                  <div className="aspect-square rounded-md bg-slate-200 dark:bg-slate-700" aria-hidden />
                  <div className="space-y-1">
                    <h3 className="text-h5 text-slate-900 dark:text-slate-50">{m.name}</h3>
                    <p className="text-caption text-slate-500">{m.title}</p>
                  </div>
                  <p className="text-body-sm text-slate-600 dark:text-slate-300">{m.bio}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="mt-10 text-body text-slate-700 dark:text-slate-200">
            We're hiring.{" "}
            <a href="/careers" className="text-signal-600 hover:underline">
              Open roles →
            </a>
          </p>
        </div>
      </section>

      <section className="py-20">
        <div className="container max-w-prose">
          <h2 className="text-h2 font-display text-slate-900 dark:text-slate-50">The mission.</h2>
          <p className="mt-6 text-h3 font-display text-slate-900 dark:text-slate-50">
            Make autonomous lead generation cheap enough that anyone can compete.
          </p>
          <p className="mt-6 text-body text-slate-700 dark:text-slate-200">
            For most of marketing history, growth has been the domain of operators who could afford
            a team. The small operator — the solo dentist, the new agent, the family roofer — has
            been priced out of the same playbook. Funnel exists to close that gap. When a single
            sentence produces a working funnel, the competitive moat of “I can afford a marketing
            team” disappears. We think that's good.
          </p>
        </div>
      </section>

      <section className="py-20 bg-slate-100/40 dark:bg-slate-800/40">
        <div className="container max-w-prose">
          <h2 className="text-h2 font-display text-slate-900 dark:text-slate-50">
            What we believe.
          </h2>
          <ol className="mt-10 space-y-8">
            {PRINCIPLES.map((p, i) => (
              <li key={p.title}>
                <h3 className="text-h4 text-slate-900 dark:text-slate-50">
                  <span className="text-signal-500 mr-3 font-mono tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {p.title}
                </h3>
                <p className="mt-3 text-body text-slate-700 dark:text-slate-200">{p.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </>
  );
}

const TEAM = [
  { name: "Ben Akinmoye", title: "Founder & CEO", bio: "Built funnels for 11 years before deciding the tool should build them instead." },
  { name: "Sara Kim", title: "Co-founder & CTO", bio: "Led infrastructure at Stripe. Believes any operator who can text can launch a funnel." },
  { name: "Daniel Park", title: "Head of Generation", bio: "Trained the agent orchestra. Will not let a sub-80 funnel ship." },
  { name: "Priya Naidu", title: "Head of RevTry", bio: "Convinced ElevenLabs to ship the latency improvements we needed." },
  { name: "Marta Olsen", title: "Head of Brand & UX", bio: "Made sure the product feels warm, not cold." },
  { name: "Jordan Hall", title: "Head of Trust & Safety", bio: "Wrote the AUP and the human-review queue." },
  { name: "Alex Reyes", title: "Head of Growth", bio: "Buys ads on the platforms Funnel writes ads for. Reports back what works." },
  { name: "Maya Chen", title: "Head of Customer Success", bio: "Talks to 30 users a week. Tells the rest of us what they actually need." },
];

const PRINCIPLES = [
  {
    title: "Tools should do the work, not narrate it.",
    body: "The previous generation of marketing tools was great at helping you do the work. We think the next generation should do the work, full stop, and leave you the part that needs you: judgment, taste, and the conversation with the customer.",
  },
  {
    title: "Price floors are exclusionary.",
    body: "A $97/mo minimum is a tax on the operators who need help most. Funnel's floor is $0 and stays there. Free forever, free until first dollar, free if it doesn't work for you.",
  },
  {
    title: "AI should sound like a person, and say so when asked.",
    body: "RevTry never lies about being human. But it doesn't open with “Hi, I'm an AI” either, because that's an opening that loses the call. When asked directly, it tells the truth. Always.",
  },
  {
    title: "Your data is yours.",
    body: "Your copy, your leads, your transcripts, your revenue — exportable any time, used to train nothing. We learn from anonymized patterns. We do not learn from you.",
  },
  {
    title: "If we didn't earn it, we shouldn't charge for it.",
    body: "This is the “free until $1K” policy. It's also why we don't mark up ad spend, don't lock you into contracts, and refund 30 days no-questions. If Funnel doesn't make you money, you walking away should be the easiest thing in the world.",
  },
];
