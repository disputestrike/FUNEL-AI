import { UrlForm } from "./UrlForm";

interface HeroProps {
  eyebrow?: string;
  headline?: string;
  subhead?: string;
  turnstileSitekey?: string | null;
}

export function Hero({
  eyebrow = "Free — 15 seconds — no signup",
  headline = "Grade any landing page in 15 seconds.",
  subhead = "Paste a URL. Get a 0–100 score, 5 sub-scores, and 3 specific improvements — written by AI agents that have read 10,000+ pages.",
  turnstileSitekey,
}: HeroProps) {
  return (
    <section className="container relative pt-20 pb-16 text-center sm:pt-24 sm:pb-20">
      <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
        <span className="h-2 w-2 rounded-full bg-brand-500" />
        {eyebrow}
      </div>
      <h1 className="font-display text-4xl font-bold tracking-tight text-ink-900 sm:text-6xl">
        {headline}
      </h1>
      <p className="mx-auto mt-5 max-w-2xl text-lg text-ink-900/70">{subhead}</p>
      <div className="mt-10">
        <UrlForm turnstileSitekey={turnstileSitekey} />
      </div>
      <div className="mx-auto mt-12 flex max-w-3xl flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-ink-900/40">
        <span>Hook strength</span>
        <span>·</span>
        <span>Form friction</span>
        <span>·</span>
        <span>Trust signals</span>
        <span>·</span>
        <span>Mobile speed</span>
        <span>·</span>
        <span>Compliance flags</span>
      </div>
    </section>
  );
}
