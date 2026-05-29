import * as React from "react";
import { BlockShell } from "../primitives";
import type { BlockBaseProps } from "../types";

export interface ContentCodeSnippetContent {
  headline?: string;
  language?: string;
  code: string;
}

export interface ContentCodeSnippetProps extends BlockBaseProps {
  content: ContentCodeSnippetContent;
}

export function ContentCodeSnippet({ content, sectionId, styleOverrides }: ContentCodeSnippetProps): JSX.Element {
  return (
    <BlockShell sectionId={sectionId} sectionType="content.code-snippet" styleOverrides={styleOverrides}>
      <div className="mx-auto max-w-3xl">
        {content.headline && <h2 className="font-display text-h3 font-semibold text-slate-900">{content.headline}</h2>}
        <pre className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-slate-950 p-5 text-body-sm text-slate-100 shadow-md">
          <code className={content.language ? `language-${content.language}` : undefined}>{content.code}</code>
        </pre>
      </div>
    </BlockShell>
  );
}
