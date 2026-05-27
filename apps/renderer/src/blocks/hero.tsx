/** B.1 Hero blocks — 6 components. */

import * as React from "react";
import { type BlockContext, CTA, Form, Img, Section } from "./primitives.js";

type Props<T> = { id: string; content: T; ctx: BlockContext; variant?: string };

// B.1.1 — hero.classic
export interface HeroClassicContent {
  eyebrow?: string;
  headline: string;
  subhead?: string;
  primary_cta_id: string;
  secondary_cta_id?: string;
  hero_asset_id: string;
  trust_strip?: Array<{ label: string; asset_id?: string }>;
}

export function HeroClassic(p: Props<HeroClassicContent>): React.ReactElement {
  const reverse = p.variant === "image-left";
  const bg = p.variant === "image-background";
  return (
    <Section
      id={p.id}
      type="hero.classic"
      className="relative overflow-hidden bg-[var(--color-neutral-50)] py-16 md:py-24"
    >
      <div
        className={`mx-auto grid max-w-7xl grid-cols-1 items-center gap-10 px-6 md:gap-16 ${
          bg ? "" : "md:grid-cols-2"
        } ${reverse ? "md:[direction:rtl]" : ""}`}
      >
        <div className="space-y-6 md:[direction:ltr]">
          {p.content.eyebrow && (
            <span className="inline-block text-sm font-medium uppercase tracking-wider text-[var(--color-primary-600)]">
              {p.content.eyebrow}
            </span>
          )}
          <h1 className="font-display text-4xl font-bold leading-tight text-[var(--color-neutral-900)] md:text-6xl">
            {p.content.headline}
          </h1>
          {p.content.subhead && (
            <p className="text-lg leading-relaxed text-[var(--color-neutral-700)] md:text-xl">
              {p.content.subhead}
            </p>
          )}
          <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
            <CTA ctaId={p.content.primary_cta_id} ctx={p.ctx} sizeOverride="lg" />
            <CTA
              ctaId={p.content.secondary_cta_id}
              ctx={p.ctx}
              sizeOverride="lg"
              variantOverride="ghost"
            />
          </div>
          {p.content.trust_strip && p.content.trust_strip.length > 0 && (
            <div className="flex flex-wrap items-center gap-4 pt-2 text-xs text-[var(--color-neutral-600)]">
              {p.content.trust_strip.map((t, i) => (
                <div key={i} className="flex items-center gap-2">
                  {t.asset_id && <Img assetId={t.asset_id} ctx={p.ctx} className="h-5 w-auto" />}
                  <span>{t.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        {!bg && (
          <div className="relative aspect-[4/3] overflow-hidden rounded-[var(--radius-xl)] shadow-[var(--shadow-xl)] md:[direction:ltr]">
            <Img
              assetId={p.content.hero_asset_id}
              ctx={p.ctx}
              priority
              className="h-full w-full object-cover"
            />
          </div>
        )}
      </div>
      {bg && (
        <div className="absolute inset-0 -z-10">
          <Img assetId={p.content.hero_asset_id} ctx={p.ctx} priority className="h-full w-full object-cover" />
          <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-black/60 to-black/20" />
        </div>
      )}
    </Section>
  );
}

// B.1.2 — hero.video
export interface HeroVideoContent {
  eyebrow?: string;
  headline: string;
  subhead?: string;
  primary_cta_id: string;
  video_asset_id: string;
  poster_asset_id?: string;
  autoplay_muted_loop?: boolean;
}

export function HeroVideo(p: Props<HeroVideoContent>): React.ReactElement {
  const videoSrc = p.ctx.registries.assets[p.content.video_asset_id]?.url;
  const poster = p.ctx.registries.assets[p.content.poster_asset_id ?? ""]?.url;
  const autoplay = !!p.content.autoplay_muted_loop;
  return (
    <Section id={p.id} type="hero.video" className="bg-[var(--color-neutral-50)] py-16 md:py-24">
      <div className="mx-auto max-w-5xl px-6 text-center">
        {p.content.eyebrow && <span className="text-sm uppercase tracking-wider text-[var(--color-primary-600)]">{p.content.eyebrow}</span>}
        <h1 className="mx-auto max-w-3xl font-display text-4xl font-bold leading-tight text-[var(--color-neutral-900)] md:text-6xl">{p.content.headline}</h1>
        {p.content.subhead && <p className="mx-auto mt-6 max-w-2xl text-lg text-[var(--color-neutral-700)]">{p.content.subhead}</p>}
        <div className="mt-8 flex justify-center"><CTA ctaId={p.content.primary_cta_id} ctx={p.ctx} sizeOverride="xl" /></div>
        <div className="mt-12 overflow-hidden rounded-[var(--radius-xl)] shadow-[var(--shadow-xl)]">
          {videoSrc && (
            <video
              src={videoSrc}
              poster={poster}
              controls
              preload="metadata"
              autoPlay={autoplay}
              muted={autoplay}
              loop={autoplay}
              playsInline
              className="w-full"
            />
          )}
        </div>
      </div>
    </Section>
  );
}

// B.1.3 — hero.split
export interface HeroSplitContent {
  headline: string;
  subhead?: string;
  bullet_points?: string[];
  form_id?: string;
  inline_cta_id?: string;
  hero_asset_id?: string;
}

export function HeroSplit(p: Props<HeroSplitContent>): React.ReactElement {
  return (
    <Section id={p.id} type="hero.split" className="bg-gradient-to-br from-[var(--color-primary-50)] to-[var(--color-neutral-50)] py-16 md:py-24">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-6 md:grid-cols-[1.2fr_1fr] md:gap-16">
        <div className="space-y-6">
          <h1 className="font-display text-4xl font-bold md:text-5xl">{p.content.headline}</h1>
          {p.content.subhead && <p className="text-lg text-[var(--color-neutral-700)]">{p.content.subhead}</p>}
          {p.content.bullet_points && (
            <ul className="space-y-3">
              {p.content.bullet_points.map((b, i) => (
                <li key={i} className="flex gap-3"><span aria-hidden="true" className="text-[var(--color-accent-500)]">✓</span>{b}</li>
              ))}
            </ul>
          )}
          {p.content.inline_cta_id && <CTA ctaId={p.content.inline_cta_id} ctx={p.ctx} />}
        </div>
        {p.content.form_id ? (
          <div className="rounded-[var(--radius-xl)] bg-white p-8 shadow-[var(--shadow-lg)]"><Form formId={p.content.form_id} ctx={p.ctx} /></div>
        ) : (
          <Img assetId={p.content.hero_asset_id} ctx={p.ctx} priority className="rounded-[var(--radius-xl)] w-full" />
        )}
      </div>
    </Section>
  );
}

// B.1.4 — hero.minimal
export interface HeroMinimalContent {
  headline: string;
  primary_cta_id: string;
  background_treatment?: "white" | "gradient" | "dark";
}

export function HeroMinimal(p: Props<HeroMinimalContent>): React.ReactElement {
  const bg =
    p.content.background_treatment === "dark"
      ? "bg-[var(--color-neutral-900)] text-white"
      : p.content.background_treatment === "gradient"
      ? "bg-gradient-to-br from-[var(--color-primary-50)] to-[var(--color-neutral-50)]"
      : "bg-[var(--color-neutral-50)]";
  return (
    <Section id={p.id} type="hero.minimal" className={`${bg} py-32 md:py-48`}>
      <div className="mx-auto max-w-3xl px-6 text-center">
        <h1 className="font-display text-5xl font-bold leading-[1.05] tracking-tight md:text-7xl">{p.content.headline}</h1>
        <div className="mt-10"><CTA ctaId={p.content.primary_cta_id} ctx={p.ctx} sizeOverride="xl" /></div>
      </div>
    </Section>
  );
}

// B.1.5 — hero.benefit-driven
export interface HeroBenefitDrivenContent {
  headline: string;
  subhead?: string;
  benefit_pillars: Array<{ icon?: string; label: string; description?: string }>;
  primary_cta_id: string;
  hero_asset_id?: string;
}

export function HeroBenefitDriven(p: Props<HeroBenefitDrivenContent>): React.ReactElement {
  return (
    <Section id={p.id} type="hero.benefit-driven" className="bg-[var(--color-neutral-50)] py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-6 text-center">
        <h1 className="font-display text-4xl font-bold md:text-6xl">{p.content.headline}</h1>
        {p.content.subhead && <p className="mx-auto mt-6 max-w-2xl text-lg text-[var(--color-neutral-700)]">{p.content.subhead}</p>}
        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-8">
          {p.content.benefit_pillars.map((pillar, i) => (
            <div key={i} className="rounded-[var(--radius-lg)] bg-white p-6 shadow-[var(--shadow-sm)]">
              {pillar.icon && <div aria-hidden="true" className="mx-auto h-10 w-10 text-[var(--color-primary-500)] text-3xl">{pillar.icon}</div>}
              <h3 className="mt-4 text-lg font-semibold">{pillar.label}</h3>
              {pillar.description && <p className="mt-2 text-sm text-[var(--color-neutral-700)]">{pillar.description}</p>}
            </div>
          ))}
        </div>
        <div className="mt-12"><CTA ctaId={p.content.primary_cta_id} ctx={p.ctx} sizeOverride="lg" /></div>
      </div>
    </Section>
  );
}

// B.1.6 — hero.urgency
export interface HeroUrgencyContent {
  headline: string;
  subhead?: string;
  countdown: {
    target_iso8601: string;
    show_days?: boolean;
    label_text?: string;
    behavior_on_expiry: "hide_block" | "show_expired_message" | "evergreen_reset_per_visitor";
  };
  primary_cta_id: string;
}

export function HeroUrgency(p: Props<HeroUrgencyContent>): React.ReactElement {
  return (
    <Section id={p.id} type="hero.urgency" className="bg-gradient-to-r from-[var(--color-primary-600)] to-[var(--color-primary-500)] py-12 text-white md:py-16">
      <div className="mx-auto max-w-4xl px-6 text-center">
        {p.content.countdown.label_text && <p className="text-sm font-medium uppercase tracking-wider">{p.content.countdown.label_text}</p>}
        <div
          className="mt-4"
          data-funnel-countdown="1"
          data-target={p.content.countdown.target_iso8601}
          data-show-days={p.content.countdown.show_days ? "1" : "0"}
          data-on-expiry={p.content.countdown.behavior_on_expiry}
          aria-live="polite"
        >
          <span className="text-3xl md:text-5xl font-bold tabular-nums">--:--:--</span>
        </div>
        <h2 className="mt-6 font-display text-3xl font-bold md:text-5xl">{p.content.headline}</h2>
        {p.content.subhead && <p className="mt-4 text-lg opacity-90">{p.content.subhead}</p>}
        <div className="mt-8"><CTA ctaId={p.content.primary_cta_id} ctx={p.ctx} sizeOverride="lg" variantOverride="secondary" /></div>
      </div>
    </Section>
  );
}
