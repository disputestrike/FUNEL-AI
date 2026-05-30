import * as React from "react";
import { BlockShell } from "../primitives";
import type { AssetId, BlockBaseProps } from "../types";
import { AB } from "../types";

/**
 * proof.logo-bar — Row of customer/partner logos.
 * Doc 18 B.3.3.
 */
export interface ProofLogoBarContent {
  eyebrow?: string;
  logos: { asset_id: AssetId; name: string; href?: string }[];
}

export type ProofLogoBarVariant = "grayscale" | "color" | "scrolling-marquee";

export interface ProofLogoBarProps extends BlockBaseProps {
  content: ProofLogoBarContent;
  variant?: ProofLogoBarVariant;
}

export function ProofLogoBar({ content, variant = "grayscale", sectionId, resolveAsset, styleOverrides }: ProofLogoBarProps): JSX.Element {
  return (
    <BlockShell sectionId={sectionId} sectionType="proof.logo-bar" styleOverrides={{ padding_y: "md", ...styleOverrides }} className="bg-slate-50">
      {content.eyebrow && (
        <p className="mb-6 text-center text-caption font-medium uppercase tracking-wider text-slate-500" {...AB("proof-eyebrow")}>
          {content.eyebrow}
        </p>
      )}
      <ul className="flex flex-wrap items-center justify-center gap-x-10 gap-y-6">
        {content.logos.map((logo, i) => {
          const asset = resolveAsset?.(logo.asset_id);
          if (!asset) return null;
          const img = (
            <img
              src={asset.url}
              alt={logo.name}
              className={`h-8 w-auto md:h-10 ${variant === "grayscale" ? "opacity-60 grayscale transition-all duration-medium ease-out hover:opacity-100 hover:grayscale-0" : ""}`}
            />
          );
          return <li key={i}>{logo.href ? <a href={logo.href}>{img}</a> : img}</li>;
        })}
      </ul>
    </BlockShell>
  );
}
