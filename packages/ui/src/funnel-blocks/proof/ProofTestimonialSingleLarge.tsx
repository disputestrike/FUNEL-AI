import * as React from "react";
import { Quote } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "../../primitives/avatar";
import { BlockShell } from "../primitives";
import type { AssetId, BlockBaseProps } from "../types";
import { AB } from "../types";

/**
 * proof.testimonial-single-large — One big quote, one face, one company.
 * Doc 18 B.3.2.
 */
export interface ProofTestimonialSingleLargeContent {
  quote: string;
  author_name: string;
  author_title?: string;
  author_company?: string;
  author_avatar_asset_id?: AssetId;
  company_logo_asset_id?: AssetId;
  result_metric?: { value: string; label: string };
}

export type ProofTestimonialSingleLargeVariant = "centered" | "side-by-side";

export interface ProofTestimonialSingleLargeProps extends BlockBaseProps {
  content: ProofTestimonialSingleLargeContent;
  variant?: ProofTestimonialSingleLargeVariant;
}

export function ProofTestimonialSingleLarge({ content, variant = "centered", sectionId, resolveAsset, styleOverrides }: ProofTestimonialSingleLargeProps): JSX.Element {
  const avatar = content.author_avatar_asset_id ? resolveAsset?.(content.author_avatar_asset_id) : undefined;
  const logo = content.company_logo_asset_id ? resolveAsset?.(content.company_logo_asset_id) : undefined;
  return (
    <BlockShell sectionId={sectionId} sectionType="proof.testimonial-single-large" styleOverrides={styleOverrides} className="bg-slate-50">
      <figure className={variant === "side-by-side" ? "mx-auto grid max-w-marketing grid-cols-1 items-center gap-10 md:grid-cols-[1fr_auto]" : "mx-auto max-w-3xl text-center"}>
        <Quote aria-hidden="true" className={variant === "centered" ? "mx-auto h-10 w-10 text-signal-500" : "h-10 w-10 text-signal-500"} />
        <blockquote className="mt-4 font-display text-h3 font-semibold leading-snug text-slate-900 md:text-h2" {...AB("proof-quote")}>
          “{content.quote}”
        </blockquote>
        <figcaption className={`mt-6 flex items-center gap-4 ${variant === "centered" ? "justify-center" : ""}`}>
          <Avatar className="h-14 w-14">
            {avatar && <AvatarImage src={avatar.url} alt="" />}
            <AvatarFallback>{content.author_name.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="text-left text-body-sm">
            <p className="font-semibold text-slate-900">{content.author_name}</p>
            {(content.author_title || content.author_company) && (
              <p className="text-slate-500">
                {content.author_title}
                {content.author_title && content.author_company ? ", " : ""}
                {content.author_company}
              </p>
            )}
          </div>
          {logo && <img src={logo.url} alt="" className="ml-2 h-8 w-auto opacity-80" />}
        </figcaption>
        {content.result_metric && (
          <div className="mt-6 inline-flex items-baseline gap-2 rounded-md bg-signal-50 px-4 py-2 text-signal-700 tnum">
            <span className="font-display text-h3 font-semibold">{content.result_metric.value}</span>
            <span className="text-body-sm">{content.result_metric.label}</span>
          </div>
        )}
      </figure>
    </BlockShell>
  );
}
