/** B.5 CTA blocks — 4 components. */

import * as React from "react";
import { type BlockContext, CTA, Img, Section } from "./primitives.js";

type Props<T> = { id: string; content: T; ctx: BlockContext; variant?: string };

// B.5.1 — cta.button-single
export interface CtaButtonSingleContent {
  cta_id: string;
  alignment?: "left" | "center" | "right";
  microcopy_above?: string;
  microcopy_below?: string;
}
export function CtaButtonSingle(p: Props<CtaButtonSingleContent>): React.ReactElement {
  const align =
    p.content.alignment === "left" ? "text-left" : p.content.alignment === "right" ? "text-right" : "text-center";
  return (
    <Section id={p.id} type="cta.button-single" className="bg-white py-12">
      <div className={`mx-auto max-w-3xl px-6 ${align}`}>
        {p.content.microcopy_above && <p className="text-sm text-[var(--color-neutral-600)] mb-3">{p.content.microcopy_above}</p>}
        <CTA ctaId={p.content.cta_id} ctx={p.ctx} sizeOverride="xl" />
        {p.content.microcopy_below && <p className="text-sm text-[var(--color-neutral-600)] mt-3">{p.content.microcopy_below}</p>}
      </div>
    </Section>
  );
}

// B.5.2 — cta.button-pair
export interface CtaButtonPairContent {
  primary_cta_id: string;
  secondary_cta_id: string;
  alignment?: "left" | "center" | "right";
  layout?: "side-by-side" | "stacked";
}
export function CtaButtonPair(p: Props<CtaButtonPairContent>): React.ReactElement {
  const align =
    p.content.alignment === "left" ? "justify-start" : p.content.alignment === "right" ? "justify-end" : "justify-center";
  const layout = p.content.layout === "stacked" ? "flex-col" : "flex-col sm:flex-row";
  return (
    <Section id={p.id} type="cta.button-pair" className="bg-white py-12">
      <div className={`mx-auto max-w-3xl px-6 flex ${layout} gap-3 sm:gap-4 ${align}`}>
        <CTA ctaId={p.content.primary_cta_id} ctx={p.ctx} sizeOverride="lg" />
        <CTA ctaId={p.content.secondary_cta_id} ctx={p.ctx} sizeOverride="lg" variantOverride="ghost" />
      </div>
    </Section>
  );
}

// B.5.3 — cta.banner
export interface CtaBannerContent {
  headline: string;
  subhead?: string;
  cta_id: string;
  background_treatment?: "solid_primary" | "gradient" | "dark" | "image";
  background_asset_id?: string;
}
export function CtaBanner(p: Props<CtaBannerContent>): React.ReactElement {
  const bg =
    p.content.background_treatment === "dark"
      ? "bg-[var(--color-neutral-900)] text-white"
      : p.content.background_treatment === "gradient"
      ? "bg-gradient-to-r from-[var(--color-primary-600)] to-[var(--color-primary-500)] text-white"
      : p.content.background_treatment === "image"
      ? "relative text-white"
      : "bg-[var(--color-primary-500)] text-white";
  return (
    <Section id={p.id} type="cta.banner" className={`${bg} py-16 relative overflow-hidden`}>
      {p.content.background_treatment === "image" && p.content.background_asset_id && (
        <>
          <Img assetId={p.content.background_asset_id} ctx={p.ctx} className="absolute inset-0 w-full h-full object-cover -z-10" />
          <div aria-hidden="true" className="absolute inset-0 bg-black/50 -z-10" />
        </>
      )}
      <div className="mx-auto max-w-4xl px-6 text-center relative">
        <h2 className="font-display text-3xl md:text-4xl font-bold">{p.content.headline}</h2>
        {p.content.subhead && <p className="mt-4 opacity-90">{p.content.subhead}</p>}
        <div className="mt-8"><CTA ctaId={p.content.cta_id} ctx={p.ctx} sizeOverride="xl" variantOverride="secondary" /></div>
      </div>
    </Section>
  );
}

// B.5.4 — cta.floating
export interface CtaFloatingContent {
  cta_id: string;
  position?: "bottom_mobile_side_desktop" | "bottom_always" | "side_always";
  hide_after_section_id?: string;
  dismissible?: boolean;
}
export function CtaFloating(p: Props<CtaFloatingContent>): React.ReactElement {
  return (
    <div
      role="region"
      aria-label="Quick action"
      data-funnel-floating-cta="1"
      data-position={p.content.position ?? "bottom_mobile_side_desktop"}
      data-hide-after={p.content.hide_after_section_id ?? ""}
      data-dismissible={p.content.dismissible ? "1" : "0"}
      className="fixed bottom-4 inset-x-4 md:inset-x-auto md:right-4 z-[200]"
    >
      <div className="rounded-[var(--radius-full)] bg-[var(--color-primary-500)] text-white shadow-[var(--shadow-xl)] px-1">
        <CTA ctaId={p.content.cta_id} ctx={{ ...p.ctx, section_id: p.id, page_id: p.ctx.page_id, funnel_id: p.ctx.funnel_id, funnel_version_id: p.ctx.funnel_version_id, registries: p.ctx.registries, locale: p.ctx.locale, free_tier: p.ctx.free_tier }} />
      </div>
      {p.content.dismissible && (
        <button type="button" aria-label="Close call to action" data-funnel-floating-cta-close className="absolute -top-2 -right-2 bg-white rounded-full w-6 h-6 shadow text-[var(--color-neutral-700)]">×</button>
      )}
    </div>
  );
}
