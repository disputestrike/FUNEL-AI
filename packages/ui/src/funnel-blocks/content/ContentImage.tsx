import * as React from "react";
import { BlockImage, BlockShell } from "../primitives";
import type { AssetId, BlockBaseProps } from "../types";

export interface ContentImageContent {
  asset_id: AssetId;
  caption?: string;
  max_width?: "narrow" | "default" | "wide";
}

export interface ContentImageProps extends BlockBaseProps {
  content: ContentImageContent;
}

const W = { narrow: "max-w-xl", default: "max-w-3xl", wide: "max-w-5xl" } as const;

export function ContentImage({ content, sectionId, resolveAsset, styleOverrides }: ContentImageProps): JSX.Element {
  const asset = resolveAsset?.(content.asset_id);
  return (
    <BlockShell sectionId={sectionId} sectionType="content.image" styleOverrides={styleOverrides}>
      <figure className={`mx-auto ${W[content.max_width ?? "default"]}`}>
        <BlockImage asset={asset} className="rounded-xl shadow-md" />
        {content.caption && <figcaption className="mt-3 text-center text-caption text-slate-500">{content.caption}</figcaption>}
      </figure>
    </BlockShell>
  );
}
