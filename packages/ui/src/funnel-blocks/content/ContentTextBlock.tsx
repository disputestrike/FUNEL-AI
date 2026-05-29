import * as React from "react";
import { BlockShell } from "../primitives";
import type { BlockBaseProps } from "../types";
import { AB } from "../types";

export interface ContentTextBlockContent {
  headline?: string;
  body_markdown: string;
}

export interface ContentTextBlockProps extends BlockBaseProps {
  content: ContentTextBlockContent;
}

export function ContentTextBlock({ content, sectionId, styleOverrides }: ContentTextBlockProps): JSX.Element {
  return (
    <BlockShell sectionId={sectionId} sectionType="content.text-block" styleOverrides={styleOverrides}>
      <article className="prose prose-slate mx-auto max-w-3xl">
        {content.headline && (
          <h2 className="font-display text-h2 font-semibold text-slate-900" {...AB("content-headline")}>
            {content.headline}
          </h2>
        )}
        <div className="whitespace-pre-line text-body text-slate-700">{content.body_markdown}</div>
      </article>
    </BlockShell>
  );
}
