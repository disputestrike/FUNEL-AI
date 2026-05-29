import * as React from "react";
import { Check } from "lucide-react";
import { BlockCTA, BlockImage, BlockShell } from "../primitives";
import type { AssetId, BlockBaseProps, CTAId } from "../types";
import { AB } from "../types";

export interface OfferSingleCardContent {
  headline?: string;
  product_name: string;
  price_amount: number;
  price_currency: string;
  description?: string;
  features?: string[];
  image_asset_id?: AssetId;
  cta_id?: CTAId;
}

export interface OfferSingleCardProps extends BlockBaseProps {
  content: OfferSingleCardContent;
}

function fmt(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
}

export function OfferSingleCard({ content, sectionId, resolveAsset, resolveCTA, styleOverrides }: OfferSingleCardProps): JSX.Element {
  const asset = content.image_asset_id ? resolveAsset?.(content.image_asset_id) : undefined;
  const cta = content.cta_id ? resolveCTA?.(content.cta_id) : undefined;
  return (
    <BlockShell sectionId={sectionId} sectionType="offer.single-card" styleOverrides={styleOverrides} className="bg-slate-50">
      {content.headline && (
        <h2 className="text-center font-display text-h2 font-semibold text-slate-900" {...AB("offer-headline")}>
          {content.headline}
        </h2>
      )}
      <div className="mx-auto mt-10 max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
        <div className="grid grid-cols-1 md:grid-cols-2">
          {asset && (
            <div className="aspect-square md:aspect-auto">
              <BlockImage asset={asset} className="h-full w-full" />
            </div>
          )}
          <div className="flex flex-col justify-center p-8">
            <h3 className="text-h3 font-bold text-slate-900">{content.product_name}</h3>
            {content.description && <p className="mt-2 text-body text-slate-700">{content.description}</p>}
            <div className="mt-6 text-display-2 font-black text-signal-700 tabular-nums">
              {fmt(content.price_amount, content.price_currency)}
            </div>
            {content.features && (
              <ul className="mt-4 space-y-2">
                {content.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-body-sm text-slate-700">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-6">
              <BlockCTA cta={cta} variantOverride="primary" size="lg" fallbackLabel="Get yours" className="w-full sm:w-auto" />
            </div>
          </div>
        </div>
      </div>
    </BlockShell>
  );
}
