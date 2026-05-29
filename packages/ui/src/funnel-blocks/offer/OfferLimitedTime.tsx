import * as React from "react";
import { Clock } from "lucide-react";
import { BlockCTA, BlockShell } from "../primitives";
import type { BlockBaseProps, CTAId } from "../types";
import { AB } from "../types";

export interface OfferLimitedTimeContent {
  headline: string;
  subhead?: string;
  ends_at?: string;
  cta_id?: CTAId;
}

export interface OfferLimitedTimeProps extends BlockBaseProps {
  content: OfferLimitedTimeContent;
}

export function OfferLimitedTime({ content, sectionId, resolveCTA, styleOverrides }: OfferLimitedTimeProps): JSX.Element {
  const cta = content.cta_id ? resolveCTA?.(content.cta_id) : undefined;
  return (
    <BlockShell sectionId={sectionId} sectionType="offer.limited-time" styleOverrides={styleOverrides} className="bg-gradient-to-r from-ember-50 to-amber-50">
      <div className="mx-auto max-w-2xl rounded-xl border border-ember-300 bg-white p-8 text-center shadow-md">
        <div className="inline-flex items-center gap-2 rounded-full bg-ember-100 px-3 py-1 text-caption font-semibold text-ember-800">
          <Clock className="h-3.5 w-3.5" />
          Limited time
        </div>
        <h2 className="mt-4 font-display text-h2 font-semibold text-slate-900" {...AB("offer-headline")}>
          {content.headline}
        </h2>
        {content.subhead && <p className="mt-3 text-body-lg text-slate-700">{content.subhead}</p>}
        {content.ends_at && (
          <p className="mt-4 text-caption font-medium text-ember-700">
            Offer ends {new Date(content.ends_at).toLocaleDateString(undefined, { dateStyle: "long" })}
          </p>
        )}
        <div className="mt-6 flex justify-center">
          <BlockCTA cta={cta} variantOverride="primary" size="xl" fallbackLabel="Claim before it ends" />
        </div>
      </div>
    </BlockShell>
  );
}
