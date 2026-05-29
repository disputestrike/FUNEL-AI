import * as React from "react";
import { BlockCTA } from "../primitives";
import type { BlockBaseProps, CTAId } from "../types";

export interface CtaFloatingContent {
  cta_id: CTAId;
  label_override?: string;
}

export interface CtaFloatingProps extends BlockBaseProps {
  content: CtaFloatingContent;
}

export function CtaFloating({ content, sectionId, resolveCTA }: CtaFloatingProps): JSX.Element {
  const cta = resolveCTA?.(content.cta_id);
  return (
    <div
      data-section-id={sectionId}
      data-section-type="cta.floating"
      className="sticky bottom-4 z-30 mx-auto flex w-full max-w-md justify-center px-4"
    >
      <div className="w-full rounded-xl border border-signal-200 bg-white p-3 shadow-2xl">
        <BlockCTA cta={cta} variantOverride="primary" size="lg" className="w-full" fallbackLabel={content.label_override} />
      </div>
    </div>
  );
}
