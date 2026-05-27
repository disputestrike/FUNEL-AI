import * as React from "react";
import { Check, Lightbulb, Shield, Sparkles, Star, Target, Zap } from "lucide-react";
import { cn } from "../../lib/cn";
import { BlockCTA, BlockImage, BlockShell } from "../primitives";
import type { AssetId, BlockBaseProps, CTAId } from "../types";
import { AB } from "../types";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  check: Check,
  zap: Zap,
  star: Star,
  shield: Shield,
  sparkles: Sparkles,
  target: Target,
  lightbulb: Lightbulb,
};

/**
 * hero.benefit-driven — Headline + 3 benefit pillars + CTA.
 * Doc 18 B.1.5.
 */
export interface HeroBenefitDrivenContent {
  headline: string;
  subhead?: string;
  benefit_pillars: { icon?: string; label: string; description?: string }[];
  primary_cta_id: CTAId;
  hero_asset_id?: AssetId;
}

export type HeroBenefitDrivenVariant = "pillars-below" | "pillars-side";

export interface HeroBenefitDrivenProps extends BlockBaseProps {
  content: HeroBenefitDrivenContent;
  variant?: HeroBenefitDrivenVariant;
}

export function HeroBenefitDriven({ content, variant = "pillars-below", sectionId, resolveAsset, resolveCTA, styleOverrides }: HeroBenefitDrivenProps): JSX.Element {
  const primary = resolveCTA?.(content.primary_cta_id);
  const heroAsset = content.hero_asset_id ? resolveAsset?.(content.hero_asset_id) : undefined;
  const pillars = content.benefit_pillars.slice(0, 3);
  return (
    <BlockShell sectionId={sectionId} sectionType="hero.benefit-driven" styleOverrides={styleOverrides} className="bg-slate-50">
      <div className={cn(variant === "pillars-side" ? "grid grid-cols-1 gap-12 md:grid-cols-2 md:items-center" : "mx-auto max-w-marketing text-center")}>
        <div>
          <h1 className="font-display text-h1 font-semibold text-slate-900 md:text-display-2" {...AB("hero-headline")}>
            {content.headline}
          </h1>
          {content.subhead && (
            <p className={cn("mt-6 text-body-lg text-slate-700", variant === "pillars-below" && "mx-auto max-w-2xl")}>
              {content.subhead}
            </p>
          )}
          <div className="mt-10">
            <BlockCTA cta={primary} variantOverride="primary" size="lg" {...AB("hero-primary-cta")} />
          </div>
        </div>
        <ul
          className={cn(
            "mt-12 grid gap-6",
            variant === "pillars-below" ? "grid-cols-1 md:grid-cols-3 md:gap-8" : "grid-cols-1 sm:grid-cols-2 md:grid-cols-1 md:mt-0",
          )}
          {...AB("hero-pillars")}
        >
          {pillars.map((pillar, i) => {
            const Icon = pillar.icon ? iconMap[pillar.icon] ?? Check : Check;
            return (
              <li key={i} className="rounded-lg border border-slate-200 bg-card p-6 shadow-sm">
                <Icon className="h-8 w-8 text-signal-500" aria-hidden="true" />
                <h3 className="mt-4 text-h5 font-semibold text-slate-900">{pillar.label}</h3>
                {pillar.description && <p className="mt-2 text-body-sm text-slate-600">{pillar.description}</p>}
              </li>
            );
          })}
        </ul>
        {variant === "pillars-side" && heroAsset && (
          <div className="hidden md:col-span-2 md:block">
            <BlockImage asset={heroAsset} className="rounded-xl shadow-lg" />
          </div>
        )}
      </div>
    </BlockShell>
  );
}
