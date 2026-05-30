import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "../../lib/cn";
import { BlockCTA, BlockImage, BlockShell } from "../primitives";
import type { AssetId, BlockBaseProps, CTAId, FormId } from "../types";
import { AB } from "../types";

/**
 * hero.split — Text left, image-or-form right.
 * Doc 18 B.1.3.
 */
export interface HeroSplitContent {
  headline: string;
  subhead?: string;
  bullet_points?: string[];
  form_id?: FormId;
  inline_cta_id?: CTAId;
  hero_asset_id?: AssetId;
}

export type HeroSplitVariant = "text-left-form-right" | "text-left-image-right" | "text-right-image-left";

export interface HeroSplitProps extends BlockBaseProps {
  content: HeroSplitContent;
  variant?: HeroSplitVariant;
  /** Slot for the renderer to inject a fully-rendered Form. */
  renderForm?: (formId: FormId) => React.ReactNode;
}

export function HeroSplit({ content, variant = "text-left-image-right", sectionId, resolveAsset, resolveCTA, styleOverrides, renderForm }: HeroSplitProps): JSX.Element {
  const heroAsset = content.hero_asset_id ? resolveAsset?.(content.hero_asset_id) : undefined;
  const cta = content.inline_cta_id ? resolveCTA?.(content.inline_cta_id) : undefined;
  const reverse = variant === "text-right-image-left";

  return (
    <BlockShell sectionId={sectionId} sectionType="hero.split" styleOverrides={styleOverrides} className="bg-gradient-to-br from-signal-50 to-slate-50">
      <div className={cn("grid grid-cols-1 gap-8 md:gap-12", variant === "text-left-form-right" ? "md:grid-cols-[1.2fr_1fr]" : "md:grid-cols-2 md:items-center")}>
        <div className={cn("space-y-6", reverse && "md:order-2")}>
          <h1 className="font-display text-h1 font-semibold text-slate-900 md:text-h1" {...AB("hero-headline")}>{content.headline}</h1>
          {content.subhead && <p className="text-body-lg text-slate-700" {...AB("hero-subhead")}>{content.subhead}</p>}
          {content.bullet_points && content.bullet_points.length > 0 && (
            <ul className="space-y-3" {...AB("hero-bullets")}>
              {content.bullet_points.slice(0, 4).map((bp, i) => (
                <li key={i} className="flex items-start gap-3 text-body text-slate-700">
                  <Check className="mt-0.5 h-5 w-5 shrink-0 text-aqua-500" aria-hidden="true" />
                  <span>{bp}</span>
                </li>
              ))}
            </ul>
          )}
          {cta && <BlockCTA cta={cta} variantOverride="primary" {...AB("hero-primary-cta")} />}
        </div>
        <div className={cn(reverse && "md:order-1")}>
          {variant === "text-left-form-right" && content.form_id ? (
            <div className="rounded-xl border border-slate-200 bg-card p-6 shadow-lg md:p-8">{renderForm?.(content.form_id)}</div>
          ) : heroAsset ? (
            <div className="overflow-hidden rounded-xl shadow-xl">
              <BlockImage asset={heroAsset} />
            </div>
          ) : null}
        </div>
      </div>
    </BlockShell>
  );
}
