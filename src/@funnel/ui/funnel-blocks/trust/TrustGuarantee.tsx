import * as React from "react";
import { ShieldCheck } from "lucide-react";
import { BlockShell } from "../primitives";
import type { BlockBaseProps } from "../types";
import { AB } from "../types";

export interface TrustGuaranteeContent {
  headline: string;
  body: string;
  guarantee_period_label?: string;
}

export interface TrustGuaranteeProps extends BlockBaseProps {
  content: TrustGuaranteeContent;
}

export function TrustGuarantee({ content, sectionId, styleOverrides }: TrustGuaranteeProps): JSX.Element {
  return (
    <BlockShell sectionId={sectionId} sectionType="trust.guarantee" styleOverrides={styleOverrides}>
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 rounded-2xl border-2 border-emerald-500 bg-emerald-50 p-8 text-center shadow-sm md:flex-row md:text-left">
        <ShieldCheck className="h-16 w-16 shrink-0 text-emerald-600" />
        <div>
          <h2 className="font-display text-h3 font-bold text-emerald-900" {...AB("trust-headline")}>
            {content.headline}
          </h2>
          <p className="mt-2 text-body text-emerald-800">{content.body}</p>
          {content.guarantee_period_label && (
            <p className="mt-2 text-caption font-semibold uppercase tracking-wider text-emerald-700">{content.guarantee_period_label}</p>
          )}
        </div>
      </div>
    </BlockShell>
  );
}
