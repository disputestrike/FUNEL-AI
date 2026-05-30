/** B.4 Offer blocks — 8 components. */

import * as React from "react";
import { type BlockContext, CTA, Img, Section } from "./primitives.js";

type Props<T> = { id: string; content: T; ctx: BlockContext; variant?: string };

function formatMoney(amount: number, currency: string, locale = "en-US"): string {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
}

// B.4.1 — offer.feature-grid
export interface OfferFeatureGridContent {
  headline?: string;
  subhead?: string;
  features: Array<{ icon?: string; title: string; description: string }>;
  cta_id?: string;
}
export function OfferFeatureGrid(p: Props<OfferFeatureGridContent>): React.ReactElement {
  const cols = p.variant === "4-col" ? "md:grid-cols-4" : "md:grid-cols-3";
  return (
    <Section id={p.id} type="offer.feature-grid" className="bg-white py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-6">
        {p.content.headline && <h2 className="text-center font-display text-3xl font-bold md:text-4xl">{p.content.headline}</h2>}
        {p.content.subhead && <p className="mx-auto mt-4 max-w-2xl text-center text-lg text-[var(--color-neutral-700)]">{p.content.subhead}</p>}
        <div className={`mt-12 grid grid-cols-1 gap-8 ${cols}`}>
          {p.content.features.map((f, i) => (
            <div key={i}>
              {f.icon && <div aria-hidden="true" className="text-3xl text-[var(--color-primary-500)]">{f.icon}</div>}
              <h3 className="mt-3 text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-[var(--color-neutral-700)]">{f.description}</p>
            </div>
          ))}
        </div>
        {p.content.cta_id && <div className="mt-12 text-center"><CTA ctaId={p.content.cta_id} ctx={p.ctx} /></div>}
      </div>
    </Section>
  );
}

// B.4.2 — offer.benefit-list
export interface OfferBenefitListContent {
  headline?: string;
  benefits: Array<{ icon?: string; title: string; description: string; image_asset_id?: string }>;
  cta_id?: string;
}
export function OfferBenefitList(p: Props<OfferBenefitListContent>): React.ReactElement {
  return (
    <Section id={p.id} type="offer.benefit-list" className="bg-[var(--color-neutral-50)] py-16">
      <div className="mx-auto max-w-4xl px-6">
        {p.content.headline && <h2 className="text-center font-display text-3xl font-bold mb-12">{p.content.headline}</h2>}
        <div className="space-y-8">
          {p.content.benefits.map((b, i) => (
            <div key={i} className="flex gap-6">
              {b.icon && <div aria-hidden="true" className="text-3xl text-[var(--color-accent-500)]">{b.icon}</div>}
              <div>
                <h3 className="text-xl font-semibold">{b.title}</h3>
                <p className="mt-2 text-[var(--color-neutral-700)]">{b.description}</p>
              </div>
            </div>
          ))}
        </div>
        {p.content.cta_id && <div className="mt-12 text-center"><CTA ctaId={p.content.cta_id} ctx={p.ctx} /></div>}
      </div>
    </Section>
  );
}

// B.4.3 — offer.comparison-table
export interface OfferComparisonTableContent {
  headline?: string;
  columns: Array<{ label: string; is_us?: boolean; subtext?: string }>;
  rows: Array<{
    feature: string;
    values: Array<"yes" | "no" | "partial" | "custom">;
    custom_values?: string[];
  }>;
  footer_cta_id?: string;
}
export function OfferComparisonTable(p: Props<OfferComparisonTableContent>): React.ReactElement {
  const cellFor = (v: string, custom?: string) =>
    v === "yes" ? "✓" : v === "no" ? "✕" : v === "partial" ? "~" : custom ?? "—";
  return (
    <Section id={p.id} type="offer.comparison-table" className="bg-white py-16">
      <div className="mx-auto max-w-5xl px-6">
        {p.content.headline && <h2 className="text-center font-display text-3xl font-bold mb-12">{p.content.headline}</h2>}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th scope="col" className="text-left p-3 font-medium text-[var(--color-neutral-600)]">Feature</th>
                {p.content.columns.map((c, i) => (
                  <th key={i} scope="col" className={`p-3 text-center font-semibold ${c.is_us ? "text-[var(--color-primary-600)]" : ""}`}>
                    {c.label}
                    {c.subtext && <div className="text-xs font-normal text-[var(--color-neutral-600)] mt-1">{c.subtext}</div>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {p.content.rows.map((row, i) => (
                <tr key={i} className="border-t border-[var(--color-neutral-200)]">
                  <th scope="row" className="text-left p-3 font-medium">{row.feature}</th>
                  {row.values.map((v, j) => (
                    <td key={j} className={`p-3 text-center ${p.content.columns[j]?.is_us ? "bg-[var(--color-primary-50)]" : ""}`} aria-label={v}>
                      {cellFor(v, row.custom_values?.[j])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {p.content.footer_cta_id && <div className="mt-8 text-center"><CTA ctaId={p.content.footer_cta_id} ctx={p.ctx} /></div>}
      </div>
    </Section>
  );
}

// B.4.4 — offer.value-stack
export interface OfferValueStackContent {
  headline?: string;
  subhead?: string;
  items: Array<{ name: string; description?: string; value_amount: number; currency: string }>;
  total_value_label: string;
  your_price_amount: number;
  your_price_currency: string;
  savings_label?: string;
  cta_id: string;
  disclaimer?: string;
}
export function OfferValueStack(p: Props<OfferValueStackContent>): React.ReactElement {
  const total = p.content.items.reduce((s, i) => s + i.value_amount, 0);
  const currency = p.content.items[0]?.currency ?? "USD";
  return (
    <Section id={p.id} type="offer.value-stack" className="bg-[var(--color-neutral-900)] text-white py-16">
      <div className="mx-auto max-w-2xl px-6">
        {p.content.headline && <h2 className="text-center font-display text-3xl font-bold">{p.content.headline}</h2>}
        {p.content.subhead && <p className="text-center mt-2 opacity-80">{p.content.subhead}</p>}
        <ul className="mt-8 space-y-3">
          {p.content.items.map((it, i) => (
            <li key={i} className="flex justify-between border-b border-white/10 pb-3">
              <div>
                <div className="font-medium">{it.name}</div>
                {it.description && <div className="text-sm opacity-70">{it.description}</div>}
              </div>
              <div className="font-mono opacity-90">{formatMoney(it.value_amount, it.currency)}</div>
            </li>
          ))}
        </ul>
        <div className="mt-8 flex justify-between text-lg">
          <span>{p.content.total_value_label}</span>
          <span className="line-through opacity-60 font-mono">{formatMoney(total, currency)}</span>
        </div>
        <div className="mt-2 flex justify-between text-2xl font-bold text-[var(--color-accent-500)]">
          <span>Your price today</span>
          <span className="font-mono">{formatMoney(p.content.your_price_amount, p.content.your_price_currency)}</span>
        </div>
        {p.content.savings_label && <div className="text-center text-sm opacity-80 mt-2">{p.content.savings_label}</div>}
        <div className="mt-8 text-center"><CTA ctaId={p.content.cta_id} ctx={p.ctx} sizeOverride="xl" /></div>
        {p.content.disclaimer && <p className="mt-6 text-xs opacity-70 text-center">{p.content.disclaimer}</p>}
      </div>
    </Section>
  );
}

// B.4.5 — offer.pricing-tiers
export interface OfferPricingTiersContent {
  headline?: string;
  billing_toggle?: "monthly_annual" | "none";
  tiers: Array<{
    id: string;
    name: string;
    description?: string;
    price_monthly?: { amount: number; currency: string };
    price_annual?: { amount: number; currency: string };
    is_featured?: boolean;
    feature_list: Array<{ label: string; included: boolean }>;
    cta_id: string;
  }>;
  show_savings_annual?: boolean;
}
export function OfferPricingTiers(p: Props<OfferPricingTiersContent>): React.ReactElement {
  return (
    <Section id={p.id} type="offer.pricing-tiers" className="bg-white py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-6">
        {p.content.headline && <h2 className="text-center font-display text-3xl font-bold md:text-4xl">{p.content.headline}</h2>}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          {p.content.tiers.map((tier) => (
            <div
              key={tier.id}
              className={`rounded-[var(--radius-lg)] bg-white p-8 border-2 ${
                tier.is_featured ? "border-[var(--color-primary-500)] shadow-[var(--shadow-xl)] md:scale-105" : "border-[var(--color-neutral-200)]"
              }`}
            >
              {tier.is_featured && <div className="text-xs uppercase tracking-wider font-bold text-[var(--color-primary-600)] mb-2">Most popular</div>}
              <h3 className="text-xl font-semibold">{tier.name}</h3>
              {tier.description && <p className="text-sm text-[var(--color-neutral-600)] mt-1">{tier.description}</p>}
              {tier.price_monthly && (
                <div className="mt-6">
                  <span className="text-4xl font-bold">{formatMoney(tier.price_monthly.amount, tier.price_monthly.currency)}</span>
                  <span className="text-[var(--color-neutral-600)]">/month</span>
                </div>
              )}
              <ul className="mt-6 space-y-2">
                {tier.feature_list.map((f, i) => (
                  <li key={i} className={`flex gap-2 text-sm ${f.included ? "" : "opacity-50 line-through"}`}>
                    <span aria-hidden="true">{f.included ? "✓" : "✕"}</span>{f.label}
                  </li>
                ))}
              </ul>
              <div className="mt-8"><CTA ctaId={tier.cta_id} ctx={p.ctx} className="w-full" variantOverride={tier.is_featured ? "primary" : "tertiary"} /></div>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

// B.4.6 — offer.single-card
export interface OfferSingleCardContent {
  name: string;
  description: string;
  price?: { amount: number; currency: string; recurring?: "month" | "year" | "one_time" };
  bullet_features: string[];
  hero_asset_id?: string;
  cta_id: string;
  trust_micro_copy?: string;
}
export function OfferSingleCard(p: Props<OfferSingleCardContent>): React.ReactElement {
  return (
    <Section id={p.id} type="offer.single-card" className="bg-[var(--color-neutral-50)] py-16">
      <div className="mx-auto max-w-md px-6">
        <div className="rounded-[var(--radius-xl)] bg-white p-8 shadow-[var(--shadow-lg)]">
          {p.content.hero_asset_id && <Img assetId={p.content.hero_asset_id} ctx={p.ctx} className="w-full rounded-[var(--radius-lg)] mb-6" />}
          <h2 className="text-2xl font-bold">{p.content.name}</h2>
          <p className="mt-2 text-[var(--color-neutral-700)]">{p.content.description}</p>
          {p.content.price && (
            <div className="mt-6 text-3xl font-bold">
              {formatMoney(p.content.price.amount, p.content.price.currency)}
              {p.content.price.recurring && p.content.price.recurring !== "one_time" && (
                <span className="text-base text-[var(--color-neutral-600)]">/{p.content.price.recurring}</span>
              )}
            </div>
          )}
          <ul className="mt-6 space-y-2">
            {p.content.bullet_features.map((b, i) => (
              <li key={i} className="flex gap-2 text-sm"><span aria-hidden="true">✓</span>{b}</li>
            ))}
          </ul>
          <div className="mt-8"><CTA ctaId={p.content.cta_id} ctx={p.ctx} className="w-full" /></div>
          {p.content.trust_micro_copy && <p className="mt-3 text-center text-xs text-[var(--color-neutral-600)]">{p.content.trust_micro_copy}</p>}
        </div>
      </div>
    </Section>
  );
}

// B.4.7 — offer.bundle-savings
export interface OfferBundleSavingsContent {
  headline?: string;
  bundle_items: Array<{ name: string; standalone_price: number; included: boolean }>;
  bundle_price: number;
  currency: string;
  savings_display?: "amount_and_percent" | "amount_only" | "percent_only";
  cta_id: string;
  disclaimer?: string;
}
export function OfferBundleSavings(p: Props<OfferBundleSavingsContent>): React.ReactElement {
  const standaloneTotal = p.content.bundle_items.filter((i) => i.included).reduce((s, i) => s + i.standalone_price, 0);
  const savings = standaloneTotal - p.content.bundle_price;
  const percent = standaloneTotal > 0 ? Math.round((savings / standaloneTotal) * 100) : 0;
  return (
    <Section id={p.id} type="offer.bundle-savings" className="bg-[var(--color-neutral-50)] py-16">
      <div className="mx-auto max-w-2xl px-6">
        {p.content.headline && <h2 className="text-center font-display text-3xl font-bold">{p.content.headline}</h2>}
        <ul className="mt-8 space-y-2 bg-white rounded-[var(--radius-lg)] p-6 shadow-[var(--shadow-sm)]">
          {p.content.bundle_items.map((it, i) => (
            <li key={i} className={`flex justify-between ${it.included ? "" : "opacity-50 line-through"}`}>
              <span>{it.name}</span>
              <span className="font-mono">{formatMoney(it.standalone_price, p.content.currency)}</span>
            </li>
          ))}
          <li className="border-t border-[var(--color-neutral-200)] pt-2 mt-2 flex justify-between font-bold">
            <span>Bundle price</span>
            <span className="font-mono text-[var(--color-primary-600)]">{formatMoney(p.content.bundle_price, p.content.currency)}</span>
          </li>
        </ul>
        <p className="mt-4 text-center text-sm text-[var(--color-accent-500)] font-semibold">
          You save {formatMoney(savings, p.content.currency)} ({percent}%)
        </p>
        <div className="mt-6 text-center"><CTA ctaId={p.content.cta_id} ctx={p.ctx} sizeOverride="xl" /></div>
        {p.content.disclaimer && <p className="mt-4 text-xs text-center text-[var(--color-neutral-600)]">{p.content.disclaimer}</p>}
      </div>
    </Section>
  );
}

// B.4.8 — offer.limited-time
export interface OfferLimitedTimeContent {
  headline: string;
  countdown: { target_iso8601: string; behavior_on_expiry: "hide" | "show_expired" | "evergreen_per_visitor" };
  scarcity?: { remaining: number; total: number; label: string };
  cta_id: string;
  disclaimer?: string;
}
export function OfferLimitedTime(p: Props<OfferLimitedTimeContent>): React.ReactElement {
  return (
    <Section id={p.id} type="offer.limited-time" className="bg-[var(--color-semantic-warning)]/10 py-16">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <h2 className="font-display text-3xl font-bold">{p.content.headline}</h2>
        <div
          className="mt-6 inline-block"
          data-funnel-countdown="1"
          data-target={p.content.countdown.target_iso8601}
          data-on-expiry={p.content.countdown.behavior_on_expiry}
          aria-live="polite"
        >
          <span className="text-3xl md:text-5xl font-bold tabular-nums">--:--:--</span>
        </div>
        {p.content.scarcity && (
          <p className="mt-4 text-sm text-[var(--color-semantic-error)] font-medium">
            Only {p.content.scarcity.remaining} of {p.content.scarcity.total} {p.content.scarcity.label}
          </p>
        )}
        <div className="mt-8"><CTA ctaId={p.content.cta_id} ctx={p.ctx} sizeOverride="xl" /></div>
        {p.content.disclaimer && <p className="mt-4 text-xs text-[var(--color-neutral-600)]">{p.content.disclaimer}</p>}
      </div>
    </Section>
  );
}
