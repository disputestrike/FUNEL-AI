import * as React from "react";
import { Quote } from "lucide-react";
import { BlockShell } from "../primitives";
import type { BlockBaseProps } from "../types";

export interface ContentQuoteContent {
  quote: string;
  author?: string;
  source?: string;
}

export interface ContentQuoteProps extends BlockBaseProps {
  content: ContentQuoteContent;
}

export function ContentQuote({ content, sectionId, styleOverrides }: ContentQuoteProps): JSX.Element {
  return (
    <BlockShell sectionId={sectionId} sectionType="content.quote" styleOverrides={styleOverrides} className="bg-slate-50">
      <figure className="mx-auto max-w-3xl text-center">
        <Quote className="mx-auto h-10 w-10 text-signal-500" />
        <blockquote className="mt-6 font-display text-h3 font-medium leading-snug text-slate-900">“{content.quote}”</blockquote>
        {(content.author || content.source) && (
          <figcaption className="mt-4 text-body-sm text-slate-600">
            {content.author && <span className="font-semibold text-slate-900">{content.author}</span>}
            {content.author && content.source && " · "}
            {content.source}
          </figcaption>
        )}
      </figure>
    </BlockShell>
  );
}
