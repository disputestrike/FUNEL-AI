"use client";

import * as React from "react";
import Link from "next/link";
import { FileText, Globe, Mic2, PencilLine, ArrowRight } from "lucide-react";

/**
 * Welcome screen with first-load confetti and four onboarding-mode tiles.
 * Each tile deep-links into `/onboarding/[mode]`.
 *
 * Confetti is a CSS-only burst (no extra dependency) — 36 particles fly
 * outward from the H1 on mount, then garbage collect after 1.6s.
 */
type Mode = {
  key: "form" | "url" | "voice" | "docs";
  title: string;
  body: string;
  icon: React.ComponentType<{ className?: string }>;
};

const MODES: Mode[] = [
  {
    key: "form",
    title: "Fill out a form",
    body: "Answer six questions about your business. Best for first-timers.",
    icon: PencilLine,
  },
  {
    key: "url",
    title: "Paste a URL",
    body: "We crawl your site, extract the offer, and build a funnel that matches.",
    icon: Globe,
  },
  {
    key: "voice",
    title: "Talk to it",
    body: "30 seconds. Just say what you sell — the agent transcribes and generates.",
    icon: Mic2,
  },
  {
    key: "docs",
    title: "Upload docs",
    body: "Pitch deck, sales script, brochure — anything that already describes the offer.",
    icon: FileText,
  },
];

export function WelcomeClient({ firstName }: { firstName: string }) {
  const [particles, setParticles] = React.useState<
    Array<{ id: number; tx: number; ty: number; hue: number; delay: number }>
  >([]);

  React.useEffect(() => {
    const next = Array.from({ length: 36 }, (_, id) => {
      const angle = (id / 36) * Math.PI * 2 + Math.random() * 0.3;
      const dist = 180 + Math.random() * 220;
      return {
        id,
        tx: Math.cos(angle) * dist,
        ty: Math.sin(angle) * dist,
        hue: Math.floor(Math.random() * 360),
        delay: Math.random() * 120,
      };
    });
    setParticles(next);
    const t = setTimeout(() => setParticles([]), 1700);
    return () => clearTimeout(t);
  }, []);

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-50">
      <section className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="relative max-w-3xl">
          {particles.map((p) => (
            <span
              key={p.id}
              aria-hidden
              className="pointer-events-none absolute left-0 top-8 inline-block size-2 rounded-full"
              style={{
                background: `hsl(${p.hue} 90% 60%)`,
                animation: `confetti-burst 1.4s ${p.delay}ms ease-out forwards`,
                ["--tx" as string]: `${p.tx}px`,
                ["--ty" as string]: `${p.ty}px`,
              }}
            />
          ))}
          <p className="text-caption font-semibold uppercase tracking-wider text-signal-600">
            Workspace ready
          </p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-950 md:text-6xl">
            Welcome to GoFunnelAI, {firstName}.
          </h1>
          <p className="mt-6 max-w-2xl text-body-lg text-slate-600">
            Pick how you want to describe your business — we&apos;ll build the
            landing page, write the ads, and qualify the leads from there.
          </p>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {MODES.map(({ key, title, body, icon: Icon }) => (
            <Link
              key={key}
              href={`/onboarding/${key}`}
              className="group flex flex-col rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-signal-300 hover:shadow-md"
            >
              <Icon className="size-6 text-signal-600" />
              <h2 className="mt-4 text-h4 font-semibold text-slate-950">
                {title}
              </h2>
              <p className="mt-2 grow text-body-sm text-slate-600">{body}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-body-sm font-medium text-signal-600">
                Start <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>

        <p className="mt-12 text-body-sm text-slate-500">
          Want to skip onboarding?{" "}
          <Link href="/dashboard" className="font-medium text-signal-600 hover:underline">
            Go to the dashboard
          </Link>{" "}
          and generate from there.
        </p>
      </section>

      <style jsx>{`
        @keyframes confetti-burst {
          0% {
            transform: translate(0, 0) scale(1);
            opacity: 1;
          }
          100% {
            transform: translate(var(--tx), var(--ty)) scale(0.4);
            opacity: 0;
          }
        }
      `}</style>
    </main>
  );
}
