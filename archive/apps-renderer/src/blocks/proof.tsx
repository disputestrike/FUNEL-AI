/** B.3 Proof blocks — 8 components. */

import * as React from "react";
import { type BlockContext, Img, Section } from "./primitives.js";

type Props<T> = { id: string; content: T; ctx: BlockContext; variant?: string };

// B.3.1 — proof.testimonial-grid
export interface ProofTestimonialGridContent {
  headline?: string;
  testimonials: Array<{
    id: string;
    quote: string;
    author_name: string;
    author_title?: string;
    author_photo_asset_id?: string;
    star_rating?: 1 | 2 | 3 | 4 | 5;
    source_attribution?: string;
  }>;
  show_star_ratings?: boolean;
}

export function ProofTestimonialGrid(p: Props<ProofTestimonialGridContent>): React.ReactElement {
  const cols = p.variant === "grid-2-col-larger-quotes" ? "md:grid-cols-2" : "md:grid-cols-3";
  return (
    <Section id={p.id} type="proof.testimonial-grid" className="bg-[var(--color-neutral-50)] py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-6">
        {p.content.headline && <h2 className="text-center font-display text-3xl font-bold md:text-4xl">{p.content.headline}</h2>}
        <div className={`mt-12 grid grid-cols-1 gap-6 ${cols}`}>
          {p.content.testimonials.map((t) => (
            <figure key={t.id} className="rounded-[var(--radius-lg)] bg-white p-6 shadow-[var(--shadow-sm)]">
              {p.content.show_star_ratings && t.star_rating && (
                <div aria-label={`${t.star_rating} out of 5 stars`} className="text-[var(--color-accent-500)]">
                  {"★".repeat(t.star_rating)}{"☆".repeat(5 - t.star_rating)}
                </div>
              )}
              <blockquote className="mt-4 text-[var(--color-neutral-800)]">{t.quote}</blockquote>
              <figcaption className="mt-6 flex items-center gap-3">
                {t.author_photo_asset_id && <Img assetId={t.author_photo_asset_id} ctx={p.ctx} className="h-10 w-10 rounded-full object-cover" />}
                <div>
                  <div className="font-semibold">{t.author_name}</div>
                  {t.author_title && <div className="text-sm text-[var(--color-neutral-600)]">{t.author_title}</div>}
                </div>
              </figcaption>
              {t.source_attribution && <div className="mt-2 text-xs text-[var(--color-neutral-500)]">{t.source_attribution}</div>}
            </figure>
          ))}
        </div>
      </div>
    </Section>
  );
}

// B.3.2 — proof.testimonial-single-large
export interface ProofTestimonialSingleLargeContent {
  quote: string;
  author_name: string;
  author_title?: string;
  author_photo_asset_id: string;
  result_metric?: { value: string; label: string };
  source_attribution?: string;
}
export function ProofTestimonialSingleLarge(p: Props<ProofTestimonialSingleLargeContent>): React.ReactElement {
  return (
    <Section id={p.id} type="proof.testimonial-single-large" className="bg-white py-16 md:py-24">
      <div className="mx-auto max-w-5xl px-6 grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-10 items-center">
        <Img assetId={p.content.author_photo_asset_id} ctx={p.ctx} className="rounded-[var(--radius-xl)] w-full aspect-square object-cover" />
        <div>
          {p.content.result_metric && (
            <div className="mb-4">
              <div className="text-5xl font-bold text-[var(--color-primary-600)]">{p.content.result_metric.value}</div>
              <div className="text-sm text-[var(--color-neutral-600)]">{p.content.result_metric.label}</div>
            </div>
          )}
          <blockquote className="text-2xl text-[var(--color-neutral-800)] leading-relaxed">"{p.content.quote}"</blockquote>
          <figcaption className="mt-4">
            <div className="font-semibold">{p.content.author_name}</div>
            {p.content.author_title && <div className="text-sm text-[var(--color-neutral-600)]">{p.content.author_title}</div>}
            {p.content.source_attribution && <div className="text-xs text-[var(--color-neutral-500)] mt-1">{p.content.source_attribution}</div>}
          </figcaption>
        </div>
      </div>
    </Section>
  );
}

// B.3.3 — proof.logo-bar
export interface ProofLogoBarContent {
  headline?: string;
  logos: Array<{ asset_id: string; name: string; link_url?: string }>;
  grayscale?: boolean;
}
export function ProofLogoBar(p: Props<ProofLogoBarContent>): React.ReactElement {
  return (
    <Section id={p.id} type="proof.logo-bar" className="bg-white py-12">
      <div className="mx-auto max-w-7xl px-6">
        {p.content.headline && <p className="text-center text-sm uppercase tracking-wider text-[var(--color-neutral-600)]">{p.content.headline}</p>}
        <div className={`mt-6 flex flex-wrap items-center justify-center gap-8 md:gap-12 ${p.content.grayscale ? "[&_img]:grayscale" : ""}`}>
          {p.content.logos.map((l, i) => {
            const img = <Img key={i} assetId={l.asset_id} ctx={p.ctx} className="h-8 md:h-10 w-auto opacity-70" />;
            return l.link_url ? (
              <a key={i} href={l.link_url} rel="noopener nofollow" target="_blank" aria-label={l.name}>{img}</a>
            ) : (
              img
            );
          })}
        </div>
      </div>
    </Section>
  );
}

// B.3.4 — proof.stat-row
export interface ProofStatRowContent {
  headline?: string;
  stats: Array<{ value: string; label: string; sublabel?: string }>;
  animate_count_up?: boolean;
}
export function ProofStatRow(p: Props<ProofStatRowContent>): React.ReactElement {
  return (
    <Section id={p.id} type="proof.stat-row" className="bg-[var(--color-neutral-50)] py-16">
      <div className="mx-auto max-w-6xl px-6">
        {p.content.headline && <h2 className="text-center font-display text-3xl font-bold">{p.content.headline}</h2>}
        <dl className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {p.content.stats.map((s, i) => (
            <div key={i}>
              <dt className="sr-only">{s.label}</dt>
              <dd className="text-4xl md:text-5xl font-bold text-[var(--color-primary-600)]" data-funnel-countup={p.content.animate_count_up ? "1" : undefined}>
                {s.value}
              </dd>
              <p className="mt-2 text-sm font-medium text-[var(--color-neutral-700)]">{s.label}</p>
              {s.sublabel && <p className="text-xs text-[var(--color-neutral-500)]">{s.sublabel}</p>}
            </div>
          ))}
        </dl>
      </div>
    </Section>
  );
}

// B.3.5 — proof.before-after
export interface ProofBeforeAfterContent {
  before_asset_id: string;
  after_asset_id: string;
  before_label: string;
  after_label: string;
  interaction_mode: "slider_drag" | "side_by_side" | "tap_to_toggle";
  caption?: string;
  result_metric?: { value: string; label: string };
}
export function ProofBeforeAfter(p: Props<ProofBeforeAfterContent>): React.ReactElement {
  return (
    <Section id={p.id} type="proof.before-after" className="bg-white py-16">
      <div className="mx-auto max-w-5xl px-6">
        <div
          data-funnel-before-after="1"
          data-mode={p.content.interaction_mode}
          className="grid grid-cols-2 gap-4"
        >
          <figure>
            <Img assetId={p.content.before_asset_id} ctx={p.ctx} className="w-full rounded-[var(--radius-lg)]" />
            <figcaption className="mt-2 text-center text-sm text-[var(--color-neutral-600)]">{p.content.before_label}</figcaption>
          </figure>
          <figure>
            <Img assetId={p.content.after_asset_id} ctx={p.ctx} className="w-full rounded-[var(--radius-lg)]" />
            <figcaption className="mt-2 text-center text-sm text-[var(--color-neutral-600)]">{p.content.after_label}</figcaption>
          </figure>
        </div>
        {p.content.caption && <p className="mt-6 text-center text-sm text-[var(--color-neutral-700)]">{p.content.caption}</p>}
      </div>
    </Section>
  );
}

// B.3.6 — proof.case-study-summary
export interface ProofCaseStudySummaryContent {
  client_name: string;
  client_logo_asset_id?: string;
  hero_asset_id?: string;
  summary: string;
  metrics: Array<{ value: string; label: string }>;
  read_more_cta_id?: string;
}
export function ProofCaseStudySummary(p: Props<ProofCaseStudySummaryContent>): React.ReactElement {
  return (
    <Section id={p.id} type="proof.case-study-summary" className="bg-[var(--color-neutral-50)] py-16">
      <div className="mx-auto max-w-5xl px-6 grid md:grid-cols-2 gap-10 items-center">
        {p.content.hero_asset_id && <Img assetId={p.content.hero_asset_id} ctx={p.ctx} className="rounded-[var(--radius-xl)] w-full" />}
        <div>
          {p.content.client_logo_asset_id && <Img assetId={p.content.client_logo_asset_id} ctx={p.ctx} className="h-8 mb-4" />}
          <h3 className="text-xl font-semibold">{p.content.client_name}</h3>
          <p className="mt-2 text-[var(--color-neutral-700)]">{p.content.summary}</p>
          <dl className="mt-6 grid grid-cols-3 gap-4">
            {p.content.metrics.map((m, i) => (
              <div key={i}>
                <dd className="text-2xl font-bold">{m.value}</dd>
                <dt className="text-xs text-[var(--color-neutral-600)]">{m.label}</dt>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </Section>
  );
}

// B.3.7 — proof.video-testimonial
export interface ProofVideoTestimonialContent {
  video_asset_id: string;
  poster_asset_id?: string;
  author_name: string;
  author_title?: string;
  result_metric?: { value: string; label: string };
  transcript_text?: string;
}
export function ProofVideoTestimonial(p: Props<ProofVideoTestimonialContent>): React.ReactElement {
  const videoUrl = p.ctx.registries.assets[p.content.video_asset_id]?.url;
  const poster = p.ctx.registries.assets[p.content.poster_asset_id ?? ""]?.url;
  return (
    <Section id={p.id} type="proof.video-testimonial" className="bg-white py-16">
      <div className="mx-auto max-w-5xl px-6 grid md:grid-cols-2 gap-10 items-center">
        <div className="rounded-[var(--radius-xl)] overflow-hidden shadow-[var(--shadow-lg)]">
          {videoUrl && <video src={videoUrl} poster={poster} controls preload="metadata" className="w-full" />}
        </div>
        <div>
          {p.content.result_metric && (
            <div className="mb-4">
              <div className="text-4xl font-bold text-[var(--color-primary-600)]">{p.content.result_metric.value}</div>
              <div className="text-sm text-[var(--color-neutral-600)]">{p.content.result_metric.label}</div>
            </div>
          )}
          <div className="text-lg font-semibold">{p.content.author_name}</div>
          {p.content.author_title && <div className="text-sm text-[var(--color-neutral-600)]">{p.content.author_title}</div>}
          {p.content.transcript_text && (
            <details className="mt-4 text-sm">
              <summary className="cursor-pointer underline">View transcript</summary>
              <p className="mt-2 text-[var(--color-neutral-700)] whitespace-pre-line">{p.content.transcript_text}</p>
            </details>
          )}
        </div>
      </div>
    </Section>
  );
}

// B.3.8 — proof.review-snippet
export interface ProofReviewSnippetContent {
  source: "google" | "trustpilot" | "yelp" | "facebook" | "g2" | "capterra" | "custom";
  source_logo_asset_id?: string;
  average_rating: number;
  review_count: number;
  link_url?: string;
  sample_review_quotes?: Array<{ quote: string; author_name?: string }>;
}
export function ProofReviewSnippet(p: Props<ProofReviewSnippetContent>): React.ReactElement {
  return (
    <Section id={p.id} type="proof.review-snippet" className="bg-white py-12">
      <div className="mx-auto max-w-4xl px-6 flex flex-col md:flex-row items-center justify-center gap-6">
        {p.content.source_logo_asset_id && <Img assetId={p.content.source_logo_asset_id} ctx={p.ctx} className="h-8" />}
        <div className="text-center">
          <div className="text-3xl font-bold text-[var(--color-accent-500)]" aria-label={`${p.content.average_rating} out of 5 stars`}>
            {"★".repeat(Math.round(p.content.average_rating))}{"☆".repeat(5 - Math.round(p.content.average_rating))}
          </div>
          <div className="text-sm text-[var(--color-neutral-700)] mt-1">
            {p.content.average_rating.toFixed(1)} from {p.content.review_count.toLocaleString()} reviews on {p.content.source}
          </div>
          {p.content.link_url && <a href={p.content.link_url} rel="noopener nofollow" target="_blank" className="text-xs underline mt-1 inline-block">Read all reviews</a>}
        </div>
      </div>
    </Section>
  );
}
