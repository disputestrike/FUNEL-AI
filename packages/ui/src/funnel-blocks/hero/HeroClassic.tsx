import * as React from "react";
import { cn } from "../../lib/cn";
import { BlockCTA, BlockImage, BlockShell } from "../primitives";
import type { AssetId, BlockBaseProps, CTAId } from "../types";
import { AB } from "../types";

/**
 * hero.classic — Headline + subhead + CTA + hero image, paired left-right.
 * Doc 18 B.1.1.
 */
export interface HeroClassicContent {
  eyebrow?: string;
  headline: string;
  subhead?: string;
  primary_cta_id: CTAId;
  secondary_cta_id?: CTAId;
  hero_asset_id: AssetId;
  trust_strip?: { label: string; asset_id?: AssetId }[];
}

export type HeroClassicVariant = "image-right" | "image-left" | "image-background";

export interface HeroClassicProps extends BlockBaseProps {
  content: HeroClassicContent;
  variant?: HeroClassicVariant;
}

export function HeroClassic({
  content,
  variant = "image-right",
  sectionId,
  resolveAsset,
  resolveCTA,
  styleOverrides,
}: HeroClassicProps): JSX.Element {
  const heroAsset = resolveAsset?.(content.hero_asset_id);
  const primary = resolveCTA?.(content.primary_cta_id);
  const secondary = content.secondary_cta_id ? resolveCTA?.(content.secondary_cta_id) : undefined;

  if (variant === "image-background") {
    return (
      <BlockShell sectionId={sectionId} sectionType="hero.classic" styleOverrides={styleOverrides} className="overflow-hidden text-white">
        {heroAsset && (
          <div className="absolute inset-0 -z-10">
            <BlockImage asset={heroAsset} className="h-full w-full" decorative />
            <div className="absolute inset-0 bg-gradient-to-br from-slate-900/70 via-slate-900/60 to-signal-900/60" aria-hidden="true" />
          </div>
        )}
        <div className="mx-auto max-w-prose space-y-6 py-16 text-center md:py-24">
          {content.eyebrow && (
            <span className="inline-block text-caption font-medium uppercase tracking-wider text-signal-200" {...AB("hero-eyebrow")}>
              {content.eyebrow}
            </span>
          )}
          <h1 className="font-display text-h1 font-semibold leading-tight md:text-display-2" {...AB("hero-headline")}>
            {content.headline}
          </h1>
          {content.subhead && <p className="text-body-lg opacity-90" {...AB("hero-subhead")}>{content.subhead}</p>}
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <BlockCTA cta={primary} variantOverride="primary" {...AB("hero-primary-cta")} />
            <BlockCTA cta={secondary} variantOverride="ghost" />
          </div>
        </div>
      </BlockShell>
    );
  }

  const imageFirst = variant === "image-left";
  return (
    <BlockShell sectionId={sectionId} sectionType="hero.classic" styleOverrides={styleOverrides} className="bg-slate-50">
      <div className="grid grid-cols-1 items-center gap-8 md:grid-cols-2 md:gap-16">
        <div className={cn("space-y-6", imageFirst && "md:order-2")}>
          {content.eyebrow && (
            <span className="inline-block text-caption font-medium uppercase tracking-wider text-signal-600" {...AB("hero-eyebrow")}>
              {content.eyebrow}
            </span>
          )}
          <h1 className="font-display text-h1 font-semibold leading-tight text-slate-900 md:text-display-2" {...AB("hero-headline")}>
            {content.headline}
          </h1>
          {content.subhead && (
            <p className="text-body-lg text-slate-700" {...AB("hero-subhead")}>
              {content.subhead}
            </p>
          )}
          <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
            <BlockCTA cta={primary} variantOverride="primary" {...AB("hero-primary-cta")} />
            <BlockCTA cta={secondary} variantOverride="secondary" />
          </div>
          {content.trust_strip && content.trust_strip.length > 0 && (
            <ul className="flex flex-wrap items-center gap-x-6 gap-y-3 pt-2 text-caption text-slate-500">
              {content.trust_strip.map((item, i) => {
                const a = item.asset_id ? resolveAsset?.(item.asset_id) : undefined;
                return (
                  <li key={i} className="flex items-center gap-2">
                    {a && <img src={a.url} alt="" className="h-6 w-auto opacity-80" />}
                    <span>{item.label}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className={cn("relative aspect-[4/3] overflow-hidden rounded-xl shadow-xl", imageFirst && "md:order-1")}>
          <BlockImage asset={heroAsset} className="h-full w-full" />
        </div>
      </div>
    </BlockShell>
  );
}
