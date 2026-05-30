import * as React from "react";
import { Check } from "lucide-react";
import { BlockShell } from "../primitives";
import type { BlockBaseProps } from "../types";
import { AB } from "../types";

export interface OfferBenefitListContent {
  headline?: string;
  subhead?: string;
  benefits: Array<{ title: string; description?: string }>;
}

export interface OfferBenefitListProps extends BlockBaseProps {
  content: OfferBenefitListContent;
}

export function OfferBenefitList({ content, sectionId, styleOverrides }: OfferBenefitListProps): JSX.Element {
  return (
    <BlockShell sectionId={sectionId} sectionType="offer.benefit-list" styleOverrides={styleOverrides}>
      <div className="mx-auto max-w-3xl">
        {content.headline && (
          <h2 className="text-center font-display text-h2 font-semibold text-slate-900" {...AB("offer-headline")}>
            {content.headline}
          </h2>
        )}
        {content.subhead && <p className="mt-3 text-center text-body-lg text-slate-600">{content.subhead}</p>}
        <ul className="mt-8 space-y-4">
          {content.benefits.map((b, i) => (
            <li key={i} className="flex items-start gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                <Check className="h-4 w-4 text-emerald-700" aria-hidden="true" />
              </div>
              <div>
                <div className="font-semibold text-slate-900">{b.title}</div>
                {b.description && <p className="mt-1 text-body-sm text-slate-600">{b.description}</p>}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </BlockShell>
  );
}
