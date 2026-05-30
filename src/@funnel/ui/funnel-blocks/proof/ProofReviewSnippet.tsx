import * as React from "react";
import { Star } from "lucide-react";
import { BlockShell } from "../primitives";
import type { AssetId, BlockBaseProps } from "../types";
import { AB } from "../types";

/**
 * proof.review-snippet — Third-party review rating + quote (G2, Trustpilot, etc.).
 * Doc 18 B.3.8.
 */
export interface ProofReviewSnippetContent {
  provider_name: string;             // "G2", "Trustpilot", "Google"
  provider_logo_asset_id?: AssetId;
  rating: number;                    // 0.0 – 5.0
  rating_count?: number;
  review_quote?: string;
  link_url?: string;
}

export type ProofReviewSnippetVariant = "compact" | "expanded" | "badge-row";

export interface ProofReviewSnippetProps extends BlockBaseProps {
  content: ProofReviewSnippetContent;
  variant?: ProofReviewSnippetVariant;
}

export function ProofReviewSnippet({ content, variant = "expanded", sectionId, resolveAsset, styleOverrides }: ProofReviewSnippetProps): JSX.Element {
  const logo = content.provider_logo_asset_id ? resolveAsset?.(content.provider_logo_asset_id) : undefined;
  const full = Math.floor(content.rating);
  const hasHalf = content.rating - full >= 0.5;
  return (
    <BlockShell sectionId={sectionId} sectionType="proof.review-snippet" styleOverrides={{ padding_y: "md", ...styleOverrides }} className="bg-card">
      <div className={`mx-auto ${variant === "compact" ? "max-w-md text-center" : "max-w-2xl"} rounded-lg border border-slate-200 p-6`}>
        <div className="flex items-center gap-3" {...AB("review-header")}>
          {logo && <img src={logo.url} alt={content.provider_name} className="h-7 w-auto" />}
          <div className="flex items-center gap-1.5">
            <span className="flex">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  aria-hidden="true"
                  className={`h-5 w-5 ${i < full || (i === full && hasHalf) ? "fill-ember-400 text-ember-400" : "text-slate-200"}`}
                />
              ))}
            </span>
            <span className="text-body font-semibold tnum text-slate-900">{content.rating.toFixed(1)}</span>
            {content.rating_count !== undefined && (
              <span className="text-body-sm text-slate-500 tnum">({content.rating_count.toLocaleString()})</span>
            )}
          </div>
        </div>
        {content.review_quote && variant !== "compact" && (
          <blockquote className="mt-4 text-body text-slate-700">“{content.review_quote}”</blockquote>
        )}
        {content.link_url && (
          <a href={content.link_url} className="mt-3 inline-block text-body-sm text-signal-600 underline-offset-4 hover:underline" rel="nofollow noopener">
            Read reviews on {content.provider_name}
          </a>
        )}
      </div>
    </BlockShell>
  );
}
