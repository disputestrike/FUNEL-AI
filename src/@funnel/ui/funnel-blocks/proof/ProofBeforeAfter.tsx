import * as React from "react";
import { BlockImage, BlockShell } from "../primitives";
import type { AssetId, BlockBaseProps } from "../types";
import { AB } from "../types";

/**
 * proof.before-after — Two images / metric pairs side-by-side.
 * Doc 18 B.3.5.
 */
export interface ProofBeforeAfterContent {
  headline?: string;
  subhead?: string;
  before: { asset_id?: AssetId; label: string; metric_value?: string };
  after: { asset_id?: AssetId; label: string; metric_value?: string };
  disclaimer?: string;
}

export type ProofBeforeAfterVariant = "side-by-side" | "slider" | "stacked";

export interface ProofBeforeAfterProps extends BlockBaseProps {
  content: ProofBeforeAfterContent;
  variant?: ProofBeforeAfterVariant;
}

export function ProofBeforeAfter({ content, variant = "side-by-side", sectionId, resolveAsset, styleOverrides }: ProofBeforeAfterProps): JSX.Element {
  const before = content.before.asset_id ? resolveAsset?.(content.before.asset_id) : undefined;
  const after = content.after.asset_id ? resolveAsset?.(content.after.asset_id) : undefined;
  return (
    <BlockShell sectionId={sectionId} sectionType="proof.before-after" styleOverrides={styleOverrides} className="bg-slate-50">
      {content.headline && (
        <h2 className="text-center font-display text-h2 font-semibold text-slate-900" {...AB("proof-headline")}>
          {content.headline}
        </h2>
      )}
      {content.subhead && <p className="mt-3 text-center text-body text-slate-700">{content.subhead}</p>}
      <div className={`mt-8 grid grid-cols-1 gap-6 ${variant === "stacked" ? "" : "md:grid-cols-2"}`}>
        {[content.before, content.after].map((side, idx) => {
          const asset = idx === 0 ? before : after;
          return (
            <figure key={idx} className="rounded-xl border border-slate-200 bg-card p-4 shadow-sm">
              <p className="text-caption font-medium uppercase tracking-wider text-slate-500">
                {idx === 0 ? "Before" : "After"}
              </p>
              {asset && (
                <div className="mt-3 aspect-video overflow-hidden rounded-lg">
                  <BlockImage asset={asset} />
                </div>
              )}
              <figcaption className="mt-4 flex items-baseline justify-between gap-3">
                <span className="text-body font-medium text-slate-900">{side.label}</span>
                {side.metric_value && <span className="font-display text-h4 font-semibold tnum text-signal-600">{side.metric_value}</span>}
              </figcaption>
            </figure>
          );
        })}
      </div>
      {content.disclaimer && <p className="mt-6 text-center text-caption text-slate-500">{content.disclaimer}</p>}
    </BlockShell>
  );
}
