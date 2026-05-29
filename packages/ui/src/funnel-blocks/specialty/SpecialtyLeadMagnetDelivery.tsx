import * as React from "react";
import { Download } from "lucide-react";
import { BlockCTA, BlockImage, BlockShell } from "../primitives";
import type { AssetId, BlockBaseProps, CTAId } from "../types";

export interface SpecialtyLeadMagnetDeliveryContent {
  headline: string;
  subhead?: string;
  cover_asset_id?: AssetId;
  download_cta_id?: CTAId;
  download_url?: string;
  what_you_get?: string[];
}

export interface SpecialtyLeadMagnetDeliveryProps extends BlockBaseProps {
  content: SpecialtyLeadMagnetDeliveryContent;
}

export function SpecialtyLeadMagnetDelivery({ content, sectionId, resolveAsset, resolveCTA, styleOverrides }: SpecialtyLeadMagnetDeliveryProps): JSX.Element {
  const cover = content.cover_asset_id ? resolveAsset?.(content.cover_asset_id) : undefined;
  const cta = content.download_cta_id ? resolveCTA?.(content.download_cta_id) : undefined;
  return (
    <BlockShell sectionId={sectionId} sectionType="specialty.lead-magnet-delivery" styleOverrides={styleOverrides}>
      <div className="mx-auto grid max-w-4xl items-center gap-10 md:grid-cols-2">
        {cover && (
          <div className="relative mx-auto aspect-[3/4] w-64 overflow-hidden rounded-lg shadow-xl">
            <BlockImage asset={cover} className="h-full w-full" />
          </div>
        )}
        <div>
          <h2 className="font-display text-h2 font-bold text-slate-900">{content.headline}</h2>
          {content.subhead && <p className="mt-3 text-body-lg text-slate-700">{content.subhead}</p>}
          {content.what_you_get && (
            <ul className="mt-6 space-y-2 text-body text-slate-700">
              {content.what_you_get.map((g, i) => (
                <li key={i} className="before:mr-2 before:text-signal-500 before:content-['▸']">{g}</li>
              ))}
            </ul>
          )}
          <div className="mt-8">
            {cta ? (
              <BlockCTA cta={cta} variantOverride="primary" size="xl" />
            ) : (
              <a
                href={content.download_url ?? "#"}
                download
                className="inline-flex items-center gap-2 rounded-md bg-signal-500 px-6 py-3 font-semibold text-white shadow-sm hover:bg-signal-600"
              >
                <Download className="h-4 w-4" />
                Download now
              </a>
            )}
          </div>
        </div>
      </div>
    </BlockShell>
  );
}
