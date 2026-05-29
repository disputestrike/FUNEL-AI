import * as React from "react";
import { Check } from "lucide-react";
import { BlockCTA, BlockShell } from "../primitives";
import type { BlockBaseProps, CTAId } from "../types";
import { AB } from "../types";

/**
 * offer.value-stack — Hormozi-style stack with line items, total value, and price.
 * Doc 18 B.4.4.
 */
export interface ValueStackItem {
  name: string;
  description?: string;
  value_amount: number;
  currency: string;
}

export interface OfferValueStackContent {
  headline?: string;
  subhead?: string;
  items: ValueStackItem[];
  total_value_label: string;
  your_price_amount: number;
  your_price_currency: string;
  savings_label?: string;
  cta_id: CTAId;
  disclaimer?: string;
}

export interface OfferValueStackProps extends BlockBaseProps {
  content: OfferValueStackContent;
}

function fmt(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
}

export function OfferValueStack({ content, sectionId, resolveCTA, styleOverrides }: OfferValueStackProps): JSX.Element {
  const cta = resolveCTA?.(content.cta_id);
  const totalValue = content.items.reduce((acc, i) => acc + i.value_amount, 0);
  const currency = content.items[0]?.currency ?? content.your_price_currency;
  return (
    <BlockShell sectionId={sectionId} sectionType="offer.value-stack" styleOverrides={styleOverrides} className="bg-slate-50">
      <div className="mx-auto max-w-2xl">
        {content.headline && (
          <h2 className="text-center font-display text-h2 font-semibold text-slate-900" {...AB("offer-headline")}>
            {content.headline}
          </h2>
        )}
        {content.subhead && <p className="mt-3 text-center text-body-lg text-slate-700">{content.subhead}</p>}
        <ul className="mt-8 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white shadow-sm">
          {content.items.map((item, i) => (
            <li key={i} className="flex items-start gap-4 px-5 py-4">
              <Check className="mt-1 h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
              <div className="flex-1">
                <div className="font-semibold text-slate-900">{item.name}</div>
                {item.description && <p className="mt-1 text-body-sm text-slate-600">{item.description}</p>}
              </div>
              <div className="text-right text-body-sm font-semibold tabular-nums text-slate-500 line-through">
                {fmt(item.value_amount, item.currency)}
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-6 rounded-xl border-2 border-signal-500 bg-white p-6 text-center shadow-md">
          <div className="text-caption uppercase tracking-wider text-slate-500">{content.total_value_label}</div>
          <div className="mt-2 text-h3 font-bold text-slate-400 line-through">{fmt(totalValue, currency)}</div>
          <div className="mt-4 text-caption uppercase tracking-wider text-signal-700">Your price today</div>
          <div className="mt-1 text-display-1 font-black text-signal-700 tabular-nums">
            {fmt(content.your_price_amount, content.your_price_currency)}
          </div>
          {content.savings_label && (
            <div className="mt-2 inline-block rounded-full bg-emerald-100 px-3 py-1 text-caption font-semibold text-emerald-800">
              {content.savings_label}
            </div>
          )}
          <div className="mt-6 flex justify-center">
            <BlockCTA cta={cta} variantOverride="primary" size="xl" {...AB("offer-cta")} />
          </div>
        </div>
        {content.disclaimer && <p className="mt-4 text-center text-caption text-slate-500">{content.disclaimer}</p>}
      </div>
    </BlockShell>
  );
}
