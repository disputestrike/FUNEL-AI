import * as React from "react";
import { cn } from "../../lib/cn";
import { BlockCTA, BlockShell } from "../primitives";
import type { AssetId, BlockBaseProps, CTAId } from "../types";
import { AB } from "../types";

/**
 * hero.video — Headline + subhead + CTA above the fold, video below.
 * Doc 18 B.1.2.
 */
export interface HeroVideoContent {
  eyebrow?: string;
  headline: string;
  subhead?: string;
  primary_cta_id: CTAId;
  video_asset_id: AssetId;
  poster_asset_id?: AssetId;
  autoplay_muted_loop?: boolean;
  show_play_count?: number;
}

export type HeroVideoVariant = "video-below" | "video-side" | "video-modal-trigger";

export interface HeroVideoProps extends BlockBaseProps {
  content: HeroVideoContent;
  variant?: HeroVideoVariant;
}

export function HeroVideo({ content, variant = "video-below", sectionId, resolveAsset, resolveCTA, styleOverrides }: HeroVideoProps): JSX.Element {
  const videoAsset = resolveAsset?.(content.video_asset_id);
  const posterAsset = content.poster_asset_id ? resolveAsset?.(content.poster_asset_id) : undefined;
  const primary = resolveCTA?.(content.primary_cta_id);

  const videoEl = videoAsset ? (
    <div className="overflow-hidden rounded-xl shadow-xl">
      <video
        controls
        muted={content.autoplay_muted_loop}
        loop={content.autoplay_muted_loop}
        autoPlay={content.autoplay_muted_loop}
        preload="metadata"
        poster={posterAsset?.url}
        className="aspect-video h-auto w-full"
      >
        <source src={videoAsset.url} />
        {videoAsset.alt_text}
      </video>
    </div>
  ) : null;

  if (variant === "video-side") {
    return (
      <BlockShell sectionId={sectionId} sectionType="hero.video" styleOverrides={styleOverrides} className="bg-slate-50">
        <div className="grid grid-cols-1 items-center gap-8 md:grid-cols-2 md:gap-12">
          <div className="space-y-6">
            {content.eyebrow && <span className="text-caption font-medium uppercase tracking-wider text-signal-600">{content.eyebrow}</span>}
            <h1 className="font-display text-h1 font-semibold text-slate-900 md:text-display-2" {...AB("hero-headline")}>{content.headline}</h1>
            {content.subhead && <p className="text-body-lg text-slate-700">{content.subhead}</p>}
            <BlockCTA cta={primary} variantOverride="primary" {...AB("hero-primary-cta")} />
          </div>
          {videoEl}
        </div>
      </BlockShell>
    );
  }

  return (
    <BlockShell sectionId={sectionId} sectionType="hero.video" styleOverrides={styleOverrides} className="bg-slate-50">
      <div className="mx-auto max-w-prose text-center">
        {content.eyebrow && <span className="text-caption font-medium uppercase tracking-wider text-signal-600">{content.eyebrow}</span>}
        <h1 className="mt-2 font-display text-h1 font-semibold text-slate-900 md:text-display-2" {...AB("hero-headline")}>{content.headline}</h1>
        {content.subhead && <p className="mx-auto mt-6 max-w-2xl text-body-lg text-slate-700">{content.subhead}</p>}
        <div className="mt-8 flex justify-center"><BlockCTA cta={primary} variantOverride="primary" size="xl" {...AB("hero-primary-cta")} /></div>
        {content.show_play_count !== undefined && (
          <p className="mt-3 text-caption text-slate-500 tnum">{content.show_play_count.toLocaleString()} plays</p>
        )}
      </div>
      <div className={cn("mt-12", variant === "video-modal-trigger" && "mx-auto max-w-3xl")}>{videoEl}</div>
    </BlockShell>
  );
}
