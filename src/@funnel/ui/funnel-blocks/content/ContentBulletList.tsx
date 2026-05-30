import * as React from "react";
import { BlockShell } from "../primitives";
import type { BlockBaseProps } from "../types";
import { AB } from "../types";

export interface ContentBulletListContent {
  headline?: string;
  items: string[];
}

export interface ContentBulletListProps extends BlockBaseProps {
  content: ContentBulletListContent;
}

export function ContentBulletList({ content, sectionId, styleOverrides }: ContentBulletListProps): JSX.Element {
  return (
    <BlockShell sectionId={sectionId} sectionType="content.bullet-list" styleOverrides={styleOverrides}>
      <div className="mx-auto max-w-3xl">
        {content.headline && (
          <h2 className="font-display text-h2 font-semibold text-slate-900" {...AB("bullet-headline")}>
            {content.headline}
          </h2>
        )}
        <ul className="mt-6 list-disc space-y-2 pl-6 text-body text-slate-700 marker:text-signal-500">
          {content.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      </div>
    </BlockShell>
  );
}
