import * as React from "react";
import { Package } from "lucide-react";
import { BlockCTA, BlockShell } from "../primitives";
import type { BlockBaseProps, CTAId } from "../types";
import { AB } from "../types";

export interface OfferBundleSavingsContent {
  headline?: string;
  bundle_items: Array<{ name: string; standalone_price: number; currency: string }>;
  bundle_price: number;
  bundle_currency: string;
  savings_pct?: number;
  cta_id?: CTAId;
}

export interface OfferBundleSavingsProps extends BlockBaseProps {
  content: OfferBundleSavingsContent;
}

function fmt(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
}

export function OfferBundleSavings({ content, sectionId, resolveCTA, styleOverrides }: OfferBundleSavingsProps): JSX.Element {
  const cta = content.cta_id ? resolveCTA?.(content.cta_id) : undefined;
  const sumStandalone = content.bundle_items.reduce((acc, i) => acc + i.standalone_price, 0);
  const savings = sumStandalone - content.bundle_price;
  return (
    <BlockShell sectionId={sectionId} sectionType="offer.bundle-savings" styleOverrides={styleOverrides}>
      <div className="mx-auto max-w-2xl rounded-2xl border-2 border-signal-500 bg-white p-8 text-center shadow-xl">
        <Package className="mx-auto h-10 w-10 text-signal-600" />
        {content.headline && (
          <h2 className="mt-4 font-display text-h2 font-semibold text-slate-900" {...AB("offer-headline")}>
            {content.headline}
          </h2>
        )}
        <ul className="mt-6 space-y-2 text-left">
          {content.bundle_items.map((item, i) => (
            <li key={i} className="flex items-baseline justify-between border-b border-dashed border-slate-200 pb-2">
              <span className="text-body text-slate-700">{item.name}</span>
              <span className="text-body-sm tabular-nums text-slate-500 line-through">{fmt(item.standalone_price, item.currency)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-6 flex items-baseline justify-center gap-3">
          <span className="text-body text-slate-500 line-through">{fmt(sumStandalone, content.bundle_currency)}</span>
          <span className="text-display-1 font-black text-signal-700 tabular-nums">{fmt(content.bundle_price, content.bundle_currency)}</span>
        </div>
        <div className="mt-2 inline-block rounded-full bg-emerald-100 px-4 py-1 text-body-sm font-semibold text-emerald-800">
          Save {fmt(savings, content.bundle_currency)}{content.savings_pct ? ` (${content.savings_pct}%)` : ""}
        </div>
        <div className="mt-6 flex justify-center">
          <BlockCTA cta={cta} variantOverride="primary" size="xl" fallbackLabel="Get the bundle" />
        </div>
      </div>
    </BlockShell>
  );
}
