import * as React from "react";
import { cn } from "../../lib/cn";
import { BlockCTA, BlockShell } from "../primitives";
import type { BlockBaseProps, CTAId } from "../types";
import { AB } from "../types";

/**
 * cta.button-single — Centered (or aligned) single CTA with optional microcopy.
 * Doc 18 B.5.1.
 */
export interface CtaButtonSingleContent {
  cta_id: CTAId;
  alignment: "left" | "center" | "right";
  microcopy_above?: string;
  microcopy_below?: string;
}

export interface CtaButtonSingleProps extends BlockBaseProps {
  content: CtaButtonSingleContent;
}

export function CtaButtonSingle({ content, sectionId, resolveCTA, styleOverrides }: CtaButtonSingleProps): JSX.Element {
  const cta = resolveCTA?.(content.cta_id);
  const align = content.alignment ?? "center";
  const flex =
    align === "left" ? "items-start text-left" : align === "right" ? "items-end text-right" : "items-center text-center";
  return (
    <BlockShell sectionId={sectionId} sectionType="cta.button-single" styleOverrides={styleOverrides}>
      <div className={cn("mx-auto flex max-w-2xl flex-col gap-3", flex)}>
        {content.microcopy_above && <p className="text-caption font-medium uppercase tracking-wider text-signal-700">{content.microcopy_above}</p>}
        <BlockCTA cta={cta} variantOverride="primary" size="xl" {...AB("cta-primary")} />
        {content.microcopy_below && <p className="text-body-sm text-slate-500">{content.microcopy_below}</p>}
      </div>
    </BlockShell>
  );
}
