import * as React from "react";
import { BlockCTA, BlockShell } from "../primitives";
import type { BlockBaseProps, CTAId } from "../types";
import { AB } from "../types";

export interface CtaBannerContent {
  headline: string;
  subhead?: string;
  cta_id: CTAId;
}

export interface CtaBannerProps extends BlockBaseProps {
  content: CtaBannerContent;
}

export function CtaBanner({ content, sectionId, resolveCTA, styleOverrides }: CtaBannerProps): JSX.Element {
  const cta = resolveCTA?.(content.cta_id);
  return (
    <BlockShell
      sectionId={sectionId}
      sectionType="cta.banner"
      styleOverrides={styleOverrides}
      className="bg-gradient-to-r from-signal-600 via-signal-700 to-signal-800 text-white"
    >
      <div className="flex flex-col items-center gap-6 md:flex-row md:items-center md:justify-between">
        <div className="max-w-xl text-center md:text-left">
          <h2 className="font-display text-h2 font-semibold" {...AB("cta-headline")}>
            {content.headline}
          </h2>
          {content.subhead && <p className="mt-2 text-body-lg text-signal-100">{content.subhead}</p>}
        </div>
        <BlockCTA cta={cta} variantOverride="primary" size="xl" className="bg-white text-signal-700 hover:bg-slate-100" />
      </div>
    </BlockShell>
  );
}
