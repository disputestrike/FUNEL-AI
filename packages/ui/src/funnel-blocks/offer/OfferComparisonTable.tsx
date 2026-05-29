import * as React from "react";
import { Check, X } from "lucide-react";
import { BlockShell } from "../primitives";
import type { BlockBaseProps } from "../types";
import { AB } from "../types";

export interface OfferComparisonTableContent {
  headline?: string;
  columns: string[];
  rows: Array<{ feature: string; values: Array<string | boolean> }>;
}

export interface OfferComparisonTableProps extends BlockBaseProps {
  content: OfferComparisonTableContent;
}

export function OfferComparisonTable({ content, sectionId, styleOverrides }: OfferComparisonTableProps): JSX.Element {
  return (
    <BlockShell sectionId={sectionId} sectionType="offer.comparison-table" styleOverrides={styleOverrides}>
      {content.headline && (
        <h2 className="text-center font-display text-h2 font-semibold text-slate-900" {...AB("offer-headline")}>
          {content.headline}
        </h2>
      )}
      <div className="mx-auto mt-10 max-w-4xl overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-body-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-5 py-4 font-semibold text-slate-900">Feature</th>
              {content.columns.map((col, i) => (
                <th key={i} className="px-5 py-4 text-center font-semibold text-slate-900">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {content.rows.map((row, ri) => (
              <tr key={ri} className="border-t border-slate-200">
                <td className="px-5 py-4 font-medium text-slate-900">{row.feature}</td>
                {row.values.map((v, ci) => (
                  <td key={ci} className="px-5 py-4 text-center text-slate-700">
                    {typeof v === "boolean" ? (
                      v ? (
                        <Check className="mx-auto h-5 w-5 text-emerald-600" />
                      ) : (
                        <X className="mx-auto h-5 w-5 text-slate-300" />
                      )
                    ) : (
                      v
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </BlockShell>
  );
}
