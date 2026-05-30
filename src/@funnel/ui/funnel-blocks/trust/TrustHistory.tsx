import * as React from "react";
import { BlockShell } from "../primitives";
import type { BlockBaseProps } from "../types";

export interface TrustHistoryContent {
  headline?: string;
  milestones: Array<{ year: string; title: string; description?: string }>;
}

export interface TrustHistoryProps extends BlockBaseProps {
  content: TrustHistoryContent;
}

export function TrustHistory({ content, sectionId, styleOverrides }: TrustHistoryProps): JSX.Element {
  return (
    <BlockShell sectionId={sectionId} sectionType="trust.history" styleOverrides={styleOverrides}>
      {content.headline && <h2 className="text-center font-display text-h2 font-semibold text-slate-900">{content.headline}</h2>}
      <ol className="mx-auto mt-10 max-w-2xl space-y-6 border-l-2 border-signal-200 pl-6">
        {content.milestones.map((m, i) => (
          <li key={i} className="relative">
            <span className="absolute -left-[31px] mt-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-signal-500 bg-white" />
            <div className="text-caption font-semibold uppercase tracking-wider text-signal-700">{m.year}</div>
            <div className="mt-1 font-semibold text-slate-900">{m.title}</div>
            {m.description && <p className="mt-1 text-body-sm text-slate-600">{m.description}</p>}
          </li>
        ))}
      </ol>
    </BlockShell>
  );
}
