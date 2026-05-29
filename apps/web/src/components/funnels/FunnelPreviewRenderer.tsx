"use client";

/**
 * Live funnel preview — renders sections, hero, and visuals as they stream
 * in from the generation event stream. Designed to be driven by the
 * `useGenerationStream` hook: pass it the in-progress draft shape and it
 * fades, animates, and skeleton-loads anything that hasn't arrived yet.
 *
 * Used in: apps/web/src/app/dashboard/generate/page.tsx (right panel).
 */

import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/cn";

export type PreviewSection = {
  id: string;
  type: "hero" | "proof" | "promise" | "objections" | "cta" | "lead_magnet" | string;
  title?: string;
  body?: string;
};

export type PreviewHero = {
  headline?: string;
  subhead?: string;
  ctaLabel?: string;
  imageUrl?: string | null;
  imageAlt?: string;
};

export type PreviewPalette = {
  primary?: string;
  secondary?: string;
  accent?: string;
  bg?: string;
  fg?: string;
};

export interface FunnelPreviewDraft {
  hero?: PreviewHero;
  sections?: PreviewSection[];
  palette?: PreviewPalette;
  businessName?: string;
}

export interface FunnelPreviewRendererProps {
  draft: FunnelPreviewDraft;
  /** "mobile" renders inside a 375px phone frame with notch. */
  device: "desktop" | "mobile";
  /** Show a subtle "live" indicator while events are still streaming. */
  isStreaming?: boolean;
}

const DEFAULT_PALETTE: Required<PreviewPalette> = {
  primary: "#0F4FF0",
  secondary: "#0A2540",
  accent: "#22D3A5",
  bg: "#FFFFFF",
  fg: "#0A2540",
};

export function FunnelPreviewRenderer({
  draft,
  device,
  isStreaming,
}: FunnelPreviewRendererProps) {
  const palette = { ...DEFAULT_PALETTE, ...(draft.palette ?? {}) };
  const sections = draft.sections ?? [];
  const hero = draft.hero;

  const isMobile = device === "mobile";

  return (
    <div
      className={cn(
        "flex w-full justify-center",
        isMobile ? "px-2 py-6" : "px-4 py-6",
      )}
    >
      {isMobile ? (
        <MobileFrame>
          <FunnelBody
            hero={hero}
            sections={sections}
            palette={palette}
            isStreaming={isStreaming}
            isMobile
            businessName={draft.businessName}
          />
        </MobileFrame>
      ) : (
        <DesktopFrame>
          <FunnelBody
            hero={hero}
            sections={sections}
            palette={palette}
            isStreaming={isStreaming}
            businessName={draft.businessName}
          />
        </DesktopFrame>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Device frames                                                              */
/* -------------------------------------------------------------------------- */

function DesktopFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full max-w-[1280px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
      <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
        <div className="ml-3 flex-1 truncate rounded-md bg-white px-3 py-1 text-xs text-slate-500">
          gofunnelai.com / preview
        </div>
      </div>
      <div className="max-h-[72vh] overflow-auto">{children}</div>
    </div>
  );
}

function MobileFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative w-[375px] shrink-0 rounded-[44px] border-[10px] border-slate-900 bg-slate-900 shadow-2xl">
      {/* notch */}
      <div className="absolute left-1/2 top-0 z-10 h-6 w-32 -translate-x-1/2 rounded-b-2xl bg-slate-900" />
      <div className="relative h-[720px] overflow-hidden rounded-[34px] bg-white">
        <div className="h-full overflow-auto">{children}</div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Body                                                                       */
/* -------------------------------------------------------------------------- */

function FunnelBody({
  hero,
  sections,
  palette,
  isStreaming,
  isMobile,
  businessName,
}: {
  hero?: PreviewHero;
  sections: PreviewSection[];
  palette: Required<PreviewPalette>;
  isStreaming?: boolean;
  isMobile?: boolean;
  businessName?: string;
}) {
  return (
    <div
      className="min-h-[480px]"
      style={{ background: palette.bg, color: palette.fg }}
    >
      <HeroBlock
        hero={hero}
        palette={palette}
        isMobile={isMobile}
        businessName={businessName}
        isStreaming={isStreaming}
      />

      <div
        className={cn(
          "mx-auto space-y-8 py-10",
          isMobile ? "max-w-full px-5" : "max-w-4xl px-8",
        )}
      >
        {sections.length === 0 ? (
          <SectionSkeleton />
        ) : (
          <AnimatePresence initial={false}>
            {sections.map((section) => (
              <motion.div
                key={section.id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: [0, 0, 0.2, 1] }}
              >
                <SectionBlock section={section} palette={palette} />
              </motion.div>
            ))}
          </AnimatePresence>
        )}

        {isStreaming ? <SectionSkeleton compact /> : null}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Hero with typing headline + image swap                                     */
/* -------------------------------------------------------------------------- */

function HeroBlock({
  hero,
  palette,
  isMobile,
  businessName,
  isStreaming,
}: {
  hero?: PreviewHero;
  palette: Required<PreviewPalette>;
  isMobile?: boolean;
  businessName?: string;
  isStreaming?: boolean;
}) {
  const headline = hero?.headline ?? "";
  const subhead = hero?.subhead ?? "";
  const ctaLabel = hero?.ctaLabel ?? "Get started";

  return (
    <header
      className={cn("relative overflow-hidden", isMobile ? "px-5 py-10" : "px-8 py-16")}
      style={{
        background: `linear-gradient(135deg, ${palette.primary}15, ${palette.accent}15)`,
      }}
    >
      <div className={cn("mx-auto", isMobile ? "max-w-full" : "max-w-3xl")}>
        <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider" style={{ color: palette.primary }}>
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: palette.primary }}
          />
          {businessName ?? "Powered by GoFunnelAI"}
        </div>

        <h1
          className={cn(
            "font-display font-semibold tracking-tight",
            isMobile ? "text-[34px] leading-[38px]" : "text-h1",
          )}
        >
          {headline ? (
            <AnimatedText text={headline} />
          ) : (
            <span className="inline-block h-[1em] w-3/4 animate-pulse rounded bg-slate-200" />
          )}
        </h1>

        <p className={cn("mt-4 text-slate-700", isMobile ? "text-base" : "text-body-lg")}>
          {subhead ? (
            <AnimatedText text={subhead} delayMs={150} />
          ) : (
            <span className="inline-block h-[1em] w-2/3 animate-pulse rounded bg-slate-200" />
          )}
        </p>

        <div className="mt-8 flex items-center gap-3">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-white shadow-md"
            style={{
              background: `linear-gradient(90deg, ${palette.primary}, ${palette.accent})`,
            }}
          >
            {ctaLabel}
            <ArrowRight className="h-4 w-4" />
          </button>
          {isStreaming ? (
            <span className="text-xs text-slate-500">Generating…</span>
          ) : null}
        </div>

        <div className="mt-8">
          {hero?.imageUrl ? (
            <motion.img
              key={hero.imageUrl}
              src={hero.imageUrl}
              alt={hero.imageAlt ?? "Hero visual"}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="aspect-[16/9] w-full rounded-xl object-cover shadow-md"
            />
          ) : (
            <div className="aspect-[16/9] w-full overflow-hidden rounded-xl bg-gradient-to-br from-slate-100 to-slate-200">
              <div className="h-full w-full animate-pulse" />
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

/* -------------------------------------------------------------------------- */
/* Section blocks                                                             */
/* -------------------------------------------------------------------------- */

function SectionBlock({
  section,
  palette,
}: {
  section: PreviewSection;
  palette: Required<PreviewPalette>;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      {section.title ? (
        <h3 className="text-h4 font-semibold" style={{ color: palette.secondary }}>
          {section.title}
        </h3>
      ) : null}
      {section.body ? (
        <p className="mt-3 text-body text-slate-700">{section.body}</p>
      ) : null}
      {section.type === "cta" ? (
        <button
          type="button"
          className="mt-5 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white"
          style={{ background: palette.primary }}
        >
          Continue
          <ArrowRight className="h-4 w-4" />
        </button>
      ) : null}
    </section>
  );
}

function SectionSkeleton({ compact }: { compact?: boolean }) {
  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-6">
      <div className="h-5 w-1/3 animate-pulse rounded bg-slate-200" />
      <div className="h-3 w-full animate-pulse rounded bg-slate-100" />
      {!compact ? (
        <>
          <div className="h-3 w-5/6 animate-pulse rounded bg-slate-100" />
          <div className="h-3 w-2/3 animate-pulse rounded bg-slate-100" />
        </>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Animated typing text — word-by-word fade-in.                                */
/* -------------------------------------------------------------------------- */

function AnimatedText({ text, delayMs = 0 }: { text: string; delayMs?: number }) {
  const words = text.split(" ");
  return (
    <span aria-label={text}>
      {words.map((word, i) => (
        <motion.span
          key={`${word}-${i}`}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.25,
            delay: delayMs / 1000 + i * 0.04,
            ease: [0, 0, 0.2, 1],
          }}
          className="inline-block"
        >
          {word}
          {i < words.length - 1 ? " " : ""}
        </motion.span>
      ))}
    </span>
  );
}
