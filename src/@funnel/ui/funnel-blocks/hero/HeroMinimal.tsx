import * as React from "react";
import { cn } from "../../lib/cn";
import { BlockCTA, BlockShell } from "../primitives";
import type { BlockBaseProps, CTAId } from "../types";
import { AB } from "../types";

/**
 * hero.minimal — Headline only + single CTA, lots of whitespace.
 * Doc 18 B.1.4.
 */
export interface HeroMinimalContent {
  headline: string;
  primary_cta_id: CTAId;
  background_treatment?: "white" | "gradient" | "dark";
}

export type HeroMinimalVariant = "centered" | "left-aligned" | "dark-mode";

export interface HeroMinimalProps extends BlockBaseProps {
  content: HeroMinimalContent;
  variant?: HeroMinimalVariant;
}

export function HeroMinimal({ content, variant = "centered", sectionId, resolveCTA, styleOverrides }: HeroMinimalProps): JSX.Element {
  const primary = resolveCTA?.(content.primary_cta_id);
  const isDark = variant === "dark-mode" || content.background_treatment === "dark";
  return (
    <BlockShell
      sectionId={sectionId}
      sectionType="hero.minimal"
      styleOverrides={{ ...styleOverrides, padding_y: styleOverrides?.padding_y ?? "xl" }}
      className={cn(
        isDark ? "bg-slate-900 text-slate-50" : content.background_treatment === "gradient" ? "bg-gradient-to-br from-signal-50 to-slate-50" : "bg-slate-50",
      )}
    >
      <div className={cn("mx-auto max-w-3xl", variant === "left-aligned" ? "text-left" : "text-center")}>
        <h1
          className={cn(
            "font-display text-display-2 font-semibold leading-[1.05] tracking-tight",
            isDark ? "text-slate-50" : "text-slate-900",
            "md:text-display-1",
          )}
          {...AB("hero-headline")}
        >
          {content.headline}
        </h1>
        <div className={cn("mt-10 flex", variant === "left-aligned" ? "justify-start" : "justify-center")}>
          <BlockCTA cta={primary} variantOverride="primary" size="xl" {...AB("hero-primary-cta")} />
        </div>
      </div>
    </BlockShell>
  );
}
