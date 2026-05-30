/** B.6 Content blocks — 8 components. */

import * as React from "react";
import { type BlockContext, Img, Section } from "./primitives.js";

type Props<T> = { id: string; content: T; ctx: BlockContext; variant?: string };

/** Safe-ish minimal markdown renderer — supports bold, italic, links, code,
 *  lists, blockquote. No raw HTML, no script injection. Workers can't load
 *  marked or markdown-it cheaply so we ship this small one. */
function renderMd(md: string): string {
  const esc = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  let html = esc(md);
  // links [text](url) — only http(s) urls
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" rel="noopener" target="_blank">$1</a>');
  // bold + italic
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  // inline code
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  // blockquote
  html = html.replace(/(^|\n)&gt; (.+)/g, "$1<blockquote>$2</blockquote>");
  // bullet list
  html = html.replace(/(^|\n)[-*] (.+)/g, "$1<li>$2</li>");
  html = html.replace(/(<li>[\s\S]+?<\/li>)/g, "<ul>$1</ul>");
  // paragraphs
  html = html
    .split(/\n{2,}/)
    .map((p) => (p.match(/^<(ul|blockquote|h[1-6])/) ? p : `<p>${p.replace(/\n/g, "<br/>")}</p>`))
    .join("\n");
  return html;
}

// B.6.1 — content.text-block
export interface ContentTextBlockContent {
  headline?: string;
  body_markdown: string;
  alignment?: "left" | "center";
  max_width?: "narrow" | "default" | "wide";
}
export function ContentTextBlock(p: Props<ContentTextBlockContent>): React.ReactElement {
  const maxw = p.content.max_width === "narrow" ? "max-w-2xl" : p.content.max_width === "wide" ? "max-w-5xl" : "max-w-3xl";
  const align = p.content.alignment === "center" ? "text-center" : "text-left";
  return (
    <Section id={p.id} type="content.text-block" className="bg-white py-12">
      <div className={`mx-auto ${maxw} px-6 ${align} prose`}>
        {p.content.headline && <h2 className="font-display text-3xl font-bold">{p.content.headline}</h2>}
        <div className="mt-6" dangerouslySetInnerHTML={{ __html: renderMd(p.content.body_markdown) }} />
      </div>
    </Section>
  );
}

// B.6.2 — content.faq
export interface ContentFaqContent {
  headline?: string;
  items: Array<{ question: string; answer_markdown: string }>;
  expand_first_by_default?: boolean;
  emit_schema_markup?: boolean;
}
export function ContentFaq(p: Props<ContentFaqContent>): React.ReactElement {
  return (
    <Section id={p.id} type="content.faq" className="bg-white py-16">
      <div className="mx-auto max-w-3xl px-6">
        {p.content.headline && <h2 className="text-center font-display text-3xl font-bold">{p.content.headline}</h2>}
        <div className="mt-8 divide-y divide-[var(--color-neutral-200)]">
          {p.content.items.map((it, i) => (
            <details key={i} open={i === 0 && !!p.content.expand_first_by_default}>
              <summary className="cursor-pointer py-4 font-medium flex justify-between items-center">
                <span>{it.question}</span>
                <span aria-hidden="true">+</span>
              </summary>
              <div className="pb-4 text-[var(--color-neutral-700)]" dangerouslySetInnerHTML={{ __html: renderMd(it.answer_markdown) }} />
            </details>
          ))}
        </div>
      </div>
    </Section>
  );
}

// B.6.3 — content.video-embed
export interface ContentVideoEmbedContent {
  video_asset_id: string;
  poster_asset_id?: string;
  caption?: string;
  aspect_ratio?: "16:9" | "9:16" | "1:1" | "4:5";
  autoplay_muted_loop?: boolean;
}
export function ContentVideoEmbed(p: Props<ContentVideoEmbedContent>): React.ReactElement {
  const videoUrl = p.ctx.registries.assets[p.content.video_asset_id]?.url;
  const poster = p.ctx.registries.assets[p.content.poster_asset_id ?? ""]?.url;
  const ar = p.content.aspect_ratio ?? "16:9";
  const arStyle = { aspectRatio: ar.replace(":", "/") };
  return (
    <Section id={p.id} type="content.video-embed" className="bg-white py-12">
      <div className="mx-auto max-w-4xl px-6">
        <div className="rounded-[var(--radius-xl)] overflow-hidden shadow-[var(--shadow-md)]" style={arStyle}>
          {videoUrl && (
            <video
              src={videoUrl}
              poster={poster}
              controls
              preload="metadata"
              autoPlay={!!p.content.autoplay_muted_loop}
              muted={!!p.content.autoplay_muted_loop}
              loop={!!p.content.autoplay_muted_loop}
              playsInline
              className="w-full h-full object-cover"
            />
          )}
        </div>
        {p.content.caption && <p className="mt-4 text-center text-sm text-[var(--color-neutral-600)]">{p.content.caption}</p>}
      </div>
    </Section>
  );
}

// B.6.4 — content.image
export interface ContentImageContent {
  asset_id: string;
  caption?: string;
  link_url?: string;
  max_width?: "narrow" | "default" | "wide" | "full";
}
export function ContentImage(p: Props<ContentImageContent>): React.ReactElement {
  const maxw = p.content.max_width === "narrow" ? "max-w-2xl" : p.content.max_width === "wide" ? "max-w-6xl" : p.content.max_width === "full" ? "max-w-none" : "max-w-4xl";
  const img = <Img assetId={p.content.asset_id} ctx={p.ctx} className="w-full rounded-[var(--radius-lg)]" />;
  return (
    <Section id={p.id} type="content.image" className="bg-white py-8">
      <figure className={`mx-auto ${maxw} px-6`}>
        {p.content.link_url ? <a href={p.content.link_url} rel="noopener">{img}</a> : img}
        {p.content.caption && <figcaption className="mt-3 text-center text-sm text-[var(--color-neutral-600)]">{p.content.caption}</figcaption>}
      </figure>
    </Section>
  );
}

// B.6.5 — content.gallery
export interface ContentGalleryContent {
  headline?: string;
  images: Array<{ asset_id: string; caption?: string }>;
  layout: "grid_3col" | "grid_4col" | "carousel" | "masonry";
  enable_lightbox?: boolean;
}
export function ContentGallery(p: Props<ContentGalleryContent>): React.ReactElement {
  const cols =
    p.content.layout === "grid_4col"
      ? "grid-cols-2 md:grid-cols-4"
      : p.content.layout === "grid_3col"
      ? "grid-cols-2 md:grid-cols-3"
      : p.content.layout === "masonry"
      ? "columns-2 md:columns-3"
      : "flex overflow-x-auto snap-x";
  return (
    <Section id={p.id} type="content.gallery" className="bg-white py-12">
      <div className="mx-auto max-w-7xl px-6">
        {p.content.headline && <h2 className="text-center font-display text-3xl font-bold mb-8">{p.content.headline}</h2>}
        <div className={`gap-4 ${cols}`} data-funnel-gallery={p.content.enable_lightbox ? "1" : "0"} aria-roledescription={p.content.layout === "carousel" ? "carousel" : undefined}>
          {p.content.images.map((im, i) => (
            <figure key={i} className={p.content.layout === "carousel" ? "snap-start min-w-[80%] md:min-w-[40%] mr-4" : "mb-4 break-inside-avoid"}>
              <Img assetId={im.asset_id} ctx={p.ctx} className="w-full rounded-[var(--radius-md)]" />
              {im.caption && <figcaption className="text-xs text-[var(--color-neutral-600)] mt-1">{im.caption}</figcaption>}
            </figure>
          ))}
        </div>
      </div>
    </Section>
  );
}

// B.6.6 — content.code-snippet
export interface ContentCodeSnippetContent {
  headline?: string;
  language: string;
  code: string;
  show_copy_button?: boolean;
  filename?: string;
  highlight_lines?: number[];
}
export function ContentCodeSnippet(p: Props<ContentCodeSnippetContent>): React.ReactElement {
  const lines = p.content.code.split("\n");
  const highlight = new Set(p.content.highlight_lines ?? []);
  return (
    <Section id={p.id} type="content.code-snippet" className="bg-white py-12">
      <div className="mx-auto max-w-4xl px-6">
        {p.content.headline && <h3 className="font-semibold mb-4">{p.content.headline}</h3>}
        <div className="rounded-[var(--radius-md)] bg-[var(--color-neutral-900)] text-white overflow-hidden">
          {p.content.filename && (
            <div className="flex justify-between items-center px-4 py-2 border-b border-white/10 text-xs">
              <span>{p.content.filename}</span>
              {p.content.show_copy_button && <button type="button" data-funnel-copy-code className="opacity-70 hover:opacity-100" aria-label="Copy code">Copy</button>}
            </div>
          )}
          <pre className="overflow-x-auto p-4 text-sm leading-relaxed font-mono">
            <code data-language={p.content.language}>
              {lines.map((line, i) => (
                <span key={i} className={highlight.has(i + 1) ? "bg-white/10 block" : "block"}>{line || " "}</span>
              ))}
            </code>
          </pre>
        </div>
      </div>
    </Section>
  );
}

// B.6.7 — content.quote
export interface ContentQuoteContent {
  quote: string;
  attribution?: string;
  source_url?: string;
  treatment?: "large_quotes" | "minimal" | "card";
}
export function ContentQuote(p: Props<ContentQuoteContent>): React.ReactElement {
  const t = p.content.treatment ?? "large_quotes";
  return (
    <Section id={p.id} type="content.quote" className="bg-white py-16">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <blockquote cite={p.content.source_url} className={`${t === "large_quotes" ? "text-3xl md:text-4xl" : "text-xl"} font-display text-[var(--color-neutral-900)]`}>
          {t === "large_quotes" && <span aria-hidden="true" className="text-6xl text-[var(--color-primary-200)] block leading-none">"</span>}
          {p.content.quote}
        </blockquote>
        {p.content.attribution && <p className="mt-4 text-sm text-[var(--color-neutral-600)]">— {p.content.attribution}</p>}
      </div>
    </Section>
  );
}

// B.6.8 — content.bullet-list
export interface ContentBulletListContent {
  headline?: string;
  items: Array<{ icon?: string; text: string }>;
  alignment?: "left" | "center";
  columns?: 1 | 2 | 3;
}
export function ContentBulletList(p: Props<ContentBulletListContent>): React.ReactElement {
  const colsClass = p.content.columns === 3 ? "md:grid-cols-3" : p.content.columns === 2 ? "md:grid-cols-2" : "grid-cols-1";
  return (
    <Section id={p.id} type="content.bullet-list" className="bg-white py-12">
      <div className={`mx-auto max-w-5xl px-6 ${p.content.alignment === "center" ? "text-center" : ""}`}>
        {p.content.headline && <h2 className="font-display text-3xl font-bold">{p.content.headline}</h2>}
        <ul className={`mt-8 grid gap-4 ${colsClass}`}>
          {p.content.items.map((it, i) => (
            <li key={i} className="flex gap-3">
              {it.icon && <span aria-hidden="true" className="text-[var(--color-accent-500)]">{it.icon}</span>}
              <span>{it.text}</span>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}
