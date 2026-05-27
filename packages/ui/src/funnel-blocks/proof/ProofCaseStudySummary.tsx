import * as React from "react";
import { BlockCTA, BlockImage, BlockShell } from "../primitives";
import type { AssetId, BlockBaseProps, CTAId } from "../types";
import { AB } from "../types";

/**
 * proof.case-study-summary — Customer + outcome + read-more CTA.
 * Doc 18 B.3.6.
 */
export interface ProofCaseStudySummaryContent {
  customer_name: string;
  customer_logo_asset_id?: AssetId;
  industry?: string;
  challenge: string;
  outcome: string;
  metrics?: { value: string; label: string }[];
  hero_asset_id?: AssetId;
  read_more_cta_id?: CTAId;
}

export type ProofCaseStudySummaryVariant = "horizontal-card" | "image-top" | "metric-led";

export interface ProofCaseStudySummaryProps extends BlockBaseProps {
  content: ProofCaseStudySummaryContent;
  variant?: ProofCaseStudySummaryVariant;
}

export function ProofCaseStudySummary({ content, variant = "horizontal-card", sectionId, resolveAsset, resolveCTA, styleOverrides }: ProofCaseStudySummaryProps): JSX.Element {
  const hero = content.hero_asset_id ? resolveAsset?.(content.hero_asset_id) : undefined;
  const logo = content.customer_logo_asset_id ? resolveAsset?.(content.customer_logo_asset_id) : undefined;
  const cta = content.read_more_cta_id ? resolveCTA?.(content.read_more_cta_id) : undefined;
  return (
    <BlockShell sectionId={sectionId} sectionType="proof.case-study-summary" styleOverrides={styleOverrides} className="bg-card">
      <article className={variant === "image-top" ? "mx-auto max-w-3xl" : "mx-auto grid max-w-marketing grid-cols-1 items-center gap-8 md:grid-cols-2"}>
        {hero && (
          <div className="overflow-hidden rounded-xl shadow-md">
            <BlockImage asset={hero} className="aspect-video" />
          </div>
        )}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            {logo && <img src={logo.url} alt="" className="h-8 w-auto" />}
            <p className="text-body-sm font-semibold text-slate-900">{content.customer_name}</p>
            {content.industry && (
              <span className="rounded-sm bg-slate-100 px-2 py-0.5 text-caption text-slate-600">
                {content.industry}
              </span>
            )}
          </div>
          <h2 className="font-display text-h3 font-semibold text-slate-900" {...AB("case-study-headline")}>
            {content.outcome}
          </h2>
          <p className="text-body text-slate-700">{content.challenge}</p>
          {content.metrics && content.metrics.length > 0 && (
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {content.metrics.map((m, i) => (
                <div key={i}>
                  <dt className="text-caption text-slate-500">{m.label}</dt>
                  <dd className="font-display text-h4 font-semibold tnum text-signal-600">{m.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {cta && <BlockCTA cta={cta} variantOverride="secondary" />}
        </div>
      </article>
    </BlockShell>
  );
}
