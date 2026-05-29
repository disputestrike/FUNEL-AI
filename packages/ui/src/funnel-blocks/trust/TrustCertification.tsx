import * as React from "react";
import { Award } from "lucide-react";
import { BlockImage, BlockShell } from "../primitives";
import type { AssetId, BlockBaseProps } from "../types";

export interface TrustCertificationContent {
  headline?: string;
  certifications: Array<{ name: string; issuer?: string; asset_id?: AssetId; year?: string }>;
}

export interface TrustCertificationProps extends BlockBaseProps {
  content: TrustCertificationContent;
}

export function TrustCertification({ content, sectionId, resolveAsset, styleOverrides }: TrustCertificationProps): JSX.Element {
  return (
    <BlockShell sectionId={sectionId} sectionType="trust.certification" styleOverrides={styleOverrides}>
      {content.headline && <h2 className="text-center font-display text-h2 font-semibold text-slate-900">{content.headline}</h2>}
      <ul className="mx-auto mt-8 grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {content.certifications.map((c, i) => {
          const a = c.asset_id ? resolveAsset?.(c.asset_id) : undefined;
          return (
            <li key={i} className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              {a ? (
                <BlockImage asset={a} className="h-12 w-12 rounded-md" />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-md bg-slate-100">
                  <Award className="h-6 w-6 text-slate-600" />
                </div>
              )}
              <div>
                <div className="font-semibold text-slate-900">{c.name}</div>
                {(c.issuer || c.year) && (
                  <div className="text-caption text-slate-500">
                    {c.issuer}
                    {c.issuer && c.year ? " · " : ""}
                    {c.year}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </BlockShell>
  );
}
