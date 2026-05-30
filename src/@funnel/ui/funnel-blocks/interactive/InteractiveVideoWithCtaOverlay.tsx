import * as React from "react";
import { BlockCTA, BlockImage, BlockShell } from "../primitives";
import type { AssetId, BlockBaseProps, CTAId } from "../types";

export interface InteractiveVideoWithCtaOverlayContent {
  video_asset_id?: AssetId;
  poster_asset_id?: AssetId;
  headline?: string;
  subhead?: string;
  cta_id?: CTAId;
}

export interface InteractiveVideoWithCtaOverlayProps extends BlockBaseProps {
  content: InteractiveVideoWithCtaOverlayContent;
}

export function InteractiveVideoWithCtaOverlay({ content, sectionId, resolveAsset, resolveCTA, styleOverrides }: InteractiveVideoWithCtaOverlayProps): JSX.Element {
  const video = content.video_asset_id ? resolveAsset?.(content.video_asset_id) : undefined;
  const poster = content.poster_asset_id ? resolveAsset?.(content.poster_asset_id) : undefined;
  const cta = content.cta_id ? resolveCTA?.(content.cta_id) : undefined;
  return (
    <BlockShell sectionId={sectionId} sectionType="interactive.video-with-cta-overlay" styleOverrides={styleOverrides}>
      <div className="relative mx-auto aspect-video max-w-4xl overflow-hidden rounded-2xl bg-slate-900 shadow-xl">
        {video?.url ? (
          <video src={video.url} poster={poster?.url} autoPlay muted loop playsInline className="absolute inset-0 h-full w-full object-cover" />
        ) : poster ? (
          <BlockImage asset={poster} className="absolute inset-0 h-full w-full" decorative />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/30 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-8 text-center text-white md:p-12">
          {content.headline && <h2 className="font-display text-h2 font-bold drop-shadow">{content.headline}</h2>}
          {content.subhead && <p className="mt-2 text-body-lg opacity-90">{content.subhead}</p>}
          <div className="mt-6 flex justify-center">
            <BlockCTA cta={cta} variantOverride="primary" size="xl" fallbackLabel="Get started" />
          </div>
        </div>
      </div>
    </BlockShell>
  );
}
