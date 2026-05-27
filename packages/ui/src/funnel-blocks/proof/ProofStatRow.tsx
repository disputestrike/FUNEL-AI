import * as React from "react";
import { BlockShell } from "../primitives";
import type { BlockBaseProps } from "../types";
import { AB } from "../types";

/**
 * proof.stat-row — A row of headline stats.
 * Doc 18 B.3.4.
 */
export interface ProofStatRowContent {
  headline?: string;
  stats: { value: string; label: string; sublabel?: string }[];
}

export type ProofStatRowVariant = "three-up" | "four-up" | "two-up-large";

export interface ProofStatRowProps extends BlockBaseProps {
  content: ProofStatRowContent;
  variant?: ProofStatRowVariant;
}

export function ProofStatRow({ content, variant = "three-up", sectionId, styleOverrides }: ProofStatRowProps): JSX.Element {
  const cols = variant === "four-up" ? "md:grid-cols-4" : variant === "two-up-large" ? "md:grid-cols-2" : "md:grid-cols-3";
  return (
    <BlockShell sectionId={sectionId} sectionType="proof.stat-row" styleOverrides={styleOverrides} className="bg-card">
      {content.headline && (
        <h2 className="mb-8 text-center font-display text-h2 font-semibold text-slate-900" {...AB("proof-headline")}>
          {content.headline}
        </h2>
      )}
      <ul className={`grid grid-cols-1 gap-8 text-center ${cols}`}>
        {content.stats.map((stat, i) => (
          <li key={i} className="space-y-2">
            <p className="font-display text-display-2 font-semibold tnum text-signal-600 md:text-display-1">{stat.value}</p>
            <p className="text-body font-semibold text-slate-900">{stat.label}</p>
            {stat.sublabel && <p className="text-caption text-slate-500">{stat.sublabel}</p>}
          </li>
        ))}
      </ul>
    </BlockShell>
  );
}
