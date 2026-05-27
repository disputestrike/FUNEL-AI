import * as React from "react";
import { Star } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "../../primitives/avatar";
import { BlockShell } from "../primitives";
import type { AssetId, BlockBaseProps } from "../types";
import { AB } from "../types";

/**
 * proof.testimonial-grid — 3-9 testimonial cards in a grid.
 * Doc 18 B.3.1.
 */
export interface Testimonial {
  quote: string;
  author_name: string;
  author_title?: string;
  author_company?: string;
  author_avatar_asset_id?: AssetId;
  rating?: number; // 1-5
}

export interface ProofTestimonialGridContent {
  headline?: string;
  testimonials: Testimonial[];
}

export type ProofTestimonialGridVariant = "three-column" | "two-column" | "masonry";

export interface ProofTestimonialGridProps extends BlockBaseProps {
  content: ProofTestimonialGridContent;
  variant?: ProofTestimonialGridVariant;
}

export function ProofTestimonialGrid({ content, variant = "three-column", sectionId, resolveAsset, styleOverrides }: ProofTestimonialGridProps): JSX.Element {
  const cols = variant === "two-column" ? "md:grid-cols-2" : "md:grid-cols-2 lg:grid-cols-3";
  return (
    <BlockShell sectionId={sectionId} sectionType="proof.testimonial-grid" styleOverrides={styleOverrides} className="bg-slate-50">
      {content.headline && (
        <h2 className="mb-10 text-center font-display text-h2 font-semibold text-slate-900" {...AB("proof-headline")}>
          {content.headline}
        </h2>
      )}
      <ul className={`grid grid-cols-1 gap-6 ${cols}`}>
        {content.testimonials.map((t, i) => {
          const avatar = t.author_avatar_asset_id ? resolveAsset?.(t.author_avatar_asset_id) : undefined;
          return (
            <li key={i} className="rounded-lg border border-slate-200 bg-card p-6 shadow-sm">
              {t.rating !== undefined && (
                <div className="mb-3 flex gap-0.5" aria-label={`Rated ${t.rating} of 5`}>
                  {Array.from({ length: 5 }).map((_, idx) => (
                    <Star key={idx} aria-hidden="true" className={idx < t.rating! ? "h-4 w-4 fill-ember-400 text-ember-400" : "h-4 w-4 text-slate-200"} />
                  ))}
                </div>
              )}
              <blockquote className="text-body text-slate-700">“{t.quote}”</blockquote>
              <figcaption className="mt-4 flex items-center gap-3">
                <Avatar>
                  {avatar && <AvatarImage src={avatar.url} alt="" />}
                  <AvatarFallback>{t.author_name.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="text-body-sm">
                  <p className="font-semibold text-slate-900">{t.author_name}</p>
                  {(t.author_title || t.author_company) && (
                    <p className="text-slate-500">
                      {t.author_title}
                      {t.author_title && t.author_company ? ", " : ""}
                      {t.author_company}
                    </p>
                  )}
                </div>
              </figcaption>
            </li>
          );
        })}
      </ul>
    </BlockShell>
  );
}
