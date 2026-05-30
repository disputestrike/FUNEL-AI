import * as React from "react";
import { BlockImage, BlockShell } from "../primitives";
import type { AssetId, BlockBaseProps } from "../types";

export interface TrustBadgeRowContent {
  headline?: string;
  badges: Array<{ label: string; asset_id?: AssetId }>;
}

export interface TrustBadgeRowProps extends BlockBaseProps {
  content: TrustBadgeRowContent;
}

export function TrustBadgeRow({ content, sectionId, resolveAsset, styleOverrides }: TrustBadgeRowProps): JSX.Element {
  return (
    <BlockShell sectionId={sectionId} sectionType="trust.badge-row" styleOverrides={styleOverrides} className="bg-slate-50">
      {content.headline && <p className="mb-6 text-center text-caption font-semibold uppercase tracking-wider text-slate-500">{content.headline}</p>}
      <ul className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
        {content.badges.map((b, i) => {
          const a = b.asset_id ? resolveAsset?.(b.asset_id) : undefined;
          return (
            <li key={i} className="flex items-center gap-2 text-body-sm text-slate-600">
              {a && <BlockImage asset={a} className="h-8 w-auto" />}
              <span>{b.label}</span>
            </li>
          );
        })}
      </ul>
    </BlockShell>
  );
}
