import * as React from "react";
import { BlockShell } from "../primitives";
import type { AssetId, BlockBaseProps } from "../types";
import { AB } from "../types";

/**
 * proof.video-testimonial — Customer video + attribution + outcome.
 * Doc 18 B.3.7.
 */
export interface ProofVideoTestimonialContent {
  video_asset_id: AssetId;
  poster_asset_id?: AssetId;
  author_name: string;
  author_title?: string;
  author_company?: string;
  outcome_text?: string;
  /** Caption track is required for accessibility (validator enforces). */
  captions_asset_id?: AssetId;
}

export type ProofVideoTestimonialVariant = "single-video" | "carousel";

export interface ProofVideoTestimonialProps extends BlockBaseProps {
  content: ProofVideoTestimonialContent;
  variant?: ProofVideoTestimonialVariant;
}

export function ProofVideoTestimonial({ content, sectionId, resolveAsset, styleOverrides }: ProofVideoTestimonialProps): JSX.Element {
  const video = resolveAsset?.(content.video_asset_id);
  const poster = content.poster_asset_id ? resolveAsset?.(content.poster_asset_id) : undefined;
  const captions = content.captions_asset_id ? resolveAsset?.(content.captions_asset_id) : undefined;
  return (
    <BlockShell sectionId={sectionId} sectionType="proof.video-testimonial" styleOverrides={styleOverrides} className="bg-slate-50">
      <div className="mx-auto max-w-3xl">
        <div className="overflow-hidden rounded-xl shadow-xl">
          {video && (
            <video controls preload="metadata" poster={poster?.url} className="aspect-video w-full" {...AB("proof-video")}>
              <source src={video.url} />
              {captions && <track kind="captions" src={captions.url} srcLang="en" label="English" default />}
            </video>
          )}
        </div>
        <p className="mt-4 text-center text-body-sm text-slate-600">
          <span className="font-semibold text-slate-900">{content.author_name}</span>
          {content.author_title && `, ${content.author_title}`}
          {content.author_company && ` @ ${content.author_company}`}
        </p>
        {content.outcome_text && (
          <p className="mt-2 text-center font-display text-h4 font-semibold text-slate-900">{content.outcome_text}</p>
        )}
      </div>
    </BlockShell>
  );
}
