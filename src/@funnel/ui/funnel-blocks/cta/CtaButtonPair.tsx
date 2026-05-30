import * as React from "react";
import { BlockCTA, BlockShell } from "../primitives";
import type { BlockBaseProps, CTAId } from "../types";
import { AB } from "../types";

export interface CtaButtonPairContent {
  primary_cta_id: CTAId;
  secondary_cta_id?: CTAId;
  headline?: string;
  subhead?: string;
}

export interface CtaButtonPairProps extends BlockBaseProps {
  content: CtaButtonPairContent;
}

export function CtaButtonPair({ content, sectionId, resolveCTA, styleOverrides }: CtaButtonPairProps): JSX.Element {
  const primary = resolveCTA?.(content.primary_cta_id);
  const secondary = content.secondary_cta_id ? resolveCTA?.(content.secondary_cta_id) : undefined;
  return (
    <BlockShell sectionId={sectionId} sectionType="cta.button-pair" styleOverrides={styleOverrides}>
      <div className="mx-auto max-w-2xl space-y-4 text-center">
        {content.headline && <h2 className="font-display text-h2 font-semibold text-slate-900" {...AB("cta-headline")}>{content.headline}</h2>}
        {content.subhead && <p className="text-body-lg text-slate-600">{content.subhead}</p>}
        <div className="flex flex-col items-center justify-center gap-3 pt-2 sm:flex-row sm:gap-4">
          <BlockCTA cta={primary} variantOverride="primary" size="lg" {...AB("cta-primary")} />
          <BlockCTA cta={secondary} variantOverride="secondary" size="lg" />
        </div>
      </div>
    </BlockShell>
  );
}
