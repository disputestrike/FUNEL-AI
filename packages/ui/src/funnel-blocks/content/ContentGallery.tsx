import * as React from "react";
import { BlockImage, BlockShell } from "../primitives";
import type { AssetId, BlockBaseProps } from "../types";
import { AB } from "../types";

export interface ContentGalleryContent {
  headline?: string;
  asset_ids: AssetId[];
  columns?: 2 | 3 | 4;
}

export interface ContentGalleryProps extends BlockBaseProps {
  content: ContentGalleryContent;
}

export function ContentGallery({ content, sectionId, resolveAsset, styleOverrides }: ContentGalleryProps): JSX.Element {
  const cols = content.columns ?? 3;
  const colsClass =
    cols === 2 ? "md:grid-cols-2" : cols === 4 ? "md:grid-cols-2 lg:grid-cols-4" : "md:grid-cols-2 lg:grid-cols-3";
  return (
    <BlockShell sectionId={sectionId} sectionType="content.gallery" styleOverrides={styleOverrides}>
      {content.headline && (
        <h2 className="text-center font-display text-h2 font-semibold text-slate-900" {...AB("gallery-headline")}>
          {content.headline}
        </h2>
      )}
      <div className={`mt-8 grid grid-cols-1 gap-4 ${colsClass}`}>
        {content.asset_ids.map((id, i) => {
          const a = resolveAsset?.(id);
          return (
            <div key={i} className="aspect-square overflow-hidden rounded-lg bg-slate-100 shadow-sm">
              <BlockImage asset={a} className="h-full w-full" />
            </div>
          );
        })}
      </div>
    </BlockShell>
  );
}
