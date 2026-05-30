import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "../../lib/cn";
import { BlockCTA, BlockShell } from "../primitives";
import type { BlockBaseProps, CTAId } from "../types";
import { AB } from "../types";

/**
 * offer.pricing-tiers — 3-card pricing layout. Doc 18 B.4.5.
 */
export interface PricingTier {
  name: string;
  price_amount: number;
  price_currency: string;
  price_period?: "month" | "year" | "one_time";
  description?: string;
  features: string[];
  cta_id?: CTAId;
  featured?: boolean;
  badge?: string;
}

export interface OfferPricingTiersContent {
  headline?: string;
  subhead?: string;
  tiers: PricingTier[];
}

export interface OfferPricingTiersProps extends BlockBaseProps {
  content: OfferPricingTiersContent;
}

function fmt(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
}

export function OfferPricingTiers({ content, sectionId, resolveCTA, styleOverrides }: OfferPricingTiersProps): JSX.Element {
  const tiers = content.tiers ?? [];
  return (
    <BlockShell sectionId={sectionId} sectionType="offer.pricing-tiers" styleOverrides={styleOverrides}>
      {content.headline && (
        <h2 className="text-center font-display text-h2 font-semibold text-slate-900" {...AB("offer-headline")}>
          {content.headline}
        </h2>
      )}
      {content.subhead && <p className="mx-auto mt-3 max-w-2xl text-center text-body-lg text-slate-600">{content.subhead}</p>}
      <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {tiers.map((tier, i) => {
          const cta = tier.cta_id ? resolveCTA?.(tier.cta_id) : undefined;
          return (
            <div
              key={i}
              className={cn(
                "relative flex flex-col rounded-2xl border bg-white p-6 shadow-sm transition-all",
                tier.featured ? "border-signal-500 ring-2 ring-signal-500 lg:scale-105 shadow-xl" : "border-slate-200",
              )}
            >
              {tier.badge && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-signal-500 px-3 py-1 text-caption font-semibold text-white shadow-sm">
                  {tier.badge}
                </span>
              )}
              <div className="text-h4 font-semibold text-slate-900">{tier.name}</div>
              {tier.description && <p className="mt-1 text-body-sm text-slate-600">{tier.description}</p>}
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-display-2 font-bold text-slate-900 tabular-nums">{fmt(tier.price_amount, tier.price_currency)}</span>
                {tier.price_period && tier.price_period !== "one_time" && (
                  <span className="text-body-sm text-slate-500">/{tier.price_period}</span>
                )}
              </div>
              <ul className="mt-6 flex-1 space-y-3">
                {tier.features.map((f, fi) => (
                  <li key={fi} className="flex items-start gap-3 text-body-sm text-slate-700">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                <BlockCTA cta={cta} variantOverride={tier.featured ? "primary" : "secondary"} fallbackLabel="Get started" size="lg" className="w-full" />
              </div>
            </div>
          );
        })}
      </div>
    </BlockShell>
  );
}
