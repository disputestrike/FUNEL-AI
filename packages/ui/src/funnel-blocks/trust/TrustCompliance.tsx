import * as React from "react";
import { Lock } from "lucide-react";
import { BlockShell } from "../primitives";
import type { BlockBaseProps } from "../types";

export interface TrustComplianceContent {
  headline?: string;
  badges: Array<{ label: string; description?: string }>;
}

export interface TrustComplianceProps extends BlockBaseProps {
  content: TrustComplianceContent;
}

export function TrustCompliance({ content, sectionId, styleOverrides }: TrustComplianceProps): JSX.Element {
  return (
    <BlockShell sectionId={sectionId} sectionType="trust.compliance" styleOverrides={styleOverrides} className="bg-slate-50">
      {content.headline && <h2 className="text-center font-display text-h3 font-semibold text-slate-900">{content.headline}</h2>}
      <ul className="mx-auto mt-8 grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {content.badges.map((b, i) => (
          <li key={i} className="rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm">
            <Lock className="mx-auto h-8 w-8 text-slate-600" />
            <div className="mt-2 font-semibold text-slate-900">{b.label}</div>
            {b.description && <p className="mt-1 text-caption text-slate-500">{b.description}</p>}
          </li>
        ))}
      </ul>
    </BlockShell>
  );
}
