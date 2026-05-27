"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Marketing home hero.
 *
 * Copy: verbatim from doc 10 §1.1 Hero.
 * Visual: split-screen 6s loop (left = user typing; right = page assembling).
 * Implemented as a CSS-driven animated scene — no JS animation library.
 */
export function HomeHero() {
  return (
    <section className="hero-gradient relative overflow-hidden">
      <div className="container py-20 md:py-28 lg:py-32">
        <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
          <div className="space-y-8">
            <h1 className="text-display-2 lg:text-display-1 font-display text-slate-900 dark:text-slate-50">
              Type your business.
              <br />
              Get a customer.
            </h1>
            <p className="text-body-lg text-slate-600 dark:text-slate-300 max-w-xl">
              GoFunnel is an autonomous lead generation system. Tell it what you sell in one sentence
              — it builds the landing page, writes the ads, qualifies the leads by voice, and books
              the calls. You watch.
            </p>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <Button size="lg" asChild>
                <Link href="/signup">
                  Build my funnel — free <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Link
                href="/grade"
                className="inline-flex items-center gap-1 text-body text-slate-700 hover:text-slate-900 hover:underline underline-offset-4"
              >
                Or grade your existing funnel free <ArrowRight className="size-4" />
              </Link>
            </div>
            <p className="text-body-sm text-slate-500">
              60 seconds. No credit card. Free until you make your first $1,000.
            </p>
          </div>

          {/* Right-pane mock scene. Purely decorative; not interactive. */}
          <div
            className="relative aspect-[4/5] w-full max-w-[480px] mx-auto rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden dark:bg-slate-800 dark:border-slate-700"
            aria-hidden
          >
            <HeroSceneMock />
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroSceneMock() {
  return (
    <div className="absolute inset-0 p-6 flex flex-col gap-4">
      {/* The typed-sentence input. */}
      <div className="space-y-2">
        <div className="h-2 w-24 rounded bg-slate-200" />
        <div className="h-10 rounded-md border border-slate-200 px-3 flex items-center text-body-sm text-slate-700 font-mono">
          <span className="reveal-word" style={{ animationDelay: "200ms" }}>
            I sell solar installs to homeowners in Phoenix
          </span>
          <span className="ml-1 inline-block w-px h-4 bg-slate-900 animate-pulse" />
        </div>
      </div>

      {/* The generated page assembling. */}
      <div className="mt-4 flex-1 space-y-3 overflow-hidden">
        <div
          className="h-6 w-3/4 rounded skeleton animate-fade-up"
          style={{ animationDelay: "800ms" }}
        />
        <div
          className="h-3 w-full rounded skeleton animate-fade-up"
          style={{ animationDelay: "1000ms" }}
        />
        <div
          className="h-9 rounded skeleton w-1/2 animate-fade-up"
          style={{ animationDelay: "1400ms" }}
        />
        <div className="grid grid-cols-3 gap-2 mt-3">
          {[1600, 1800, 2000].map((d) => (
            <div
              key={d}
              className="h-12 rounded skeleton animate-fade-up"
              style={{ animationDelay: `${d}ms` }}
            />
          ))}
        </div>
        <div
          className="h-20 rounded skeleton mt-3 animate-fade-up"
          style={{ animationDelay: "2400ms" }}
        />
      </div>

      {/* Quality score dial. */}
      <div
        className="absolute bottom-6 right-6 flex items-center gap-2 rounded-full bg-signal-500 text-white px-3 py-1.5 shadow-md animate-fade-up"
        style={{ animationDelay: "2800ms" }}
      >
        <span className="text-caption font-medium">Quality</span>
        <span className="text-body-sm font-mono font-semibold tabular-nums">91</span>
      </div>
    </div>
  );
}
