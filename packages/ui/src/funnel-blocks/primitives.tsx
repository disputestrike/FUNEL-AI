import * as React from "react";
import { cn } from "../lib/cn";
import { Button, type ButtonProps } from "../primitives/button";
import type { BlockBaseProps, ResolvedAsset, ResolvedCTA, StyleOverrides } from "./types";

/**
 * Internal building blocks used across the 60 funnel blocks. Kept here so each
 * block file stays focused on its own layout.
 */

const paddingY: Record<NonNullable<StyleOverrides["padding_y"]>, string> = {
  none: "py-0",
  sm: "py-8 md:py-10",
  md: "py-12 md:py-16",
  lg: "py-16 md:py-24",
  xl: "py-24 md:py-32",
};

const maxWidth: Record<NonNullable<StyleOverrides["max_width"]>, string> = {
  narrow: "max-w-prose",
  default: "max-w-app",
  wide: "max-w-marketing",
  full: "max-w-none",
};

const alignment: Record<NonNullable<StyleOverrides["alignment"]>, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

/**
 * BlockShell — the canonical <section> wrapper for every funnel block.
 * Emits `data-section-id`/`data-section-type` per doc 18 convention so the
 * editor and analytics can target sections.
 */
export interface BlockShellProps extends React.HTMLAttributes<HTMLElement> {
  sectionId: string;
  sectionType: string;
  styleOverrides?: StyleOverrides;
  innerClassName?: string;
}

export const BlockShell = React.forwardRef<HTMLElement, BlockShellProps>(
  ({ sectionId, sectionType, styleOverrides, className, innerClassName, children, ...props }, ref) => {
    const padY = paddingY[styleOverrides?.padding_y ?? "lg"];
    const maxW = maxWidth[styleOverrides?.max_width ?? "wide"];
    const align = styleOverrides?.alignment ? alignment[styleOverrides.alignment] : "";
    const inline: React.CSSProperties = {};
    if (styleOverrides?.background) inline.backgroundColor = styleOverrides.background;
    if (styleOverrides?.text_color) inline.color = styleOverrides.text_color;
    return (
      <section
        ref={ref}
        data-section-id={sectionId}
        data-section-type={sectionType}
        style={inline}
        className={cn(
          "relative w-full",
          padY,
          styleOverrides?.border_top && "border-t border-slate-200",
          styleOverrides?.border_bottom && "border-b border-slate-200",
          align,
          className,
        )}
        {...props}
      >
        <div className={cn("mx-auto px-4 md:px-6", maxW, innerClassName)}>{children}</div>
      </section>
    );
  },
);
BlockShell.displayName = "BlockShell";

/**
 * Renders a CTA reference as a styled Button. The CTA's `action.type` drives
 * the underlying element (link, button, anchor) and the `style` field maps
 * onto Button variants.
 */
export interface BlockCTAProps extends Omit<ButtonProps, "children" | "size" | "variant"> {
  cta?: ResolvedCTA;
  fallbackLabel?: string;
  size?: ButtonProps["size"];
  variantOverride?: ButtonProps["variant"];
}

export function BlockCTA({ cta, fallbackLabel, size, variantOverride, className, ...rest }: BlockCTAProps): JSX.Element | null {
  if (!cta && !fallbackLabel) return null;
  const variant = (variantOverride ?? cta?.style?.variant ?? "primary") as ButtonProps["variant"];
  const ctaSize = (size ?? cta?.style?.size ?? "lg") as ButtonProps["size"];
  const isLink = cta?.action.type === "link" && cta?.action.link_url;
  const isPhone = cta?.action.type === "phone-call" && cta?.action.phone_e164;
  const isDownload = cta?.action.type === "download" && cta?.action.link_url;
  const trackingAttrs = cta?.tracking_id ? { "data-cta-tracking-id": cta.tracking_id } : {};
  if (isLink) {
    return (
      <Button
        variant={variant}
        size={ctaSize}
        asChild
        className={cn(cta?.style?.full_width_on_mobile && "w-full sm:w-auto", className)}
        {...rest}
      >
        <a href={cta.action.link_url} {...trackingAttrs}>
          {cta.label}
          {cta.sublabel && <span className="ml-2 text-caption font-normal opacity-80">{cta.sublabel}</span>}
        </a>
      </Button>
    );
  }
  if (isPhone) {
    return (
      <Button variant={variant} size={ctaSize} asChild className={className} {...rest}>
        <a href={`tel:${cta!.action.phone_e164}`} {...trackingAttrs}>
          {cta!.label}
        </a>
      </Button>
    );
  }
  if (isDownload) {
    return (
      <Button variant={variant} size={ctaSize} asChild className={className} {...rest}>
        <a href={cta!.action.link_url} download {...trackingAttrs}>
          {cta!.label}
        </a>
      </Button>
    );
  }
  return (
    <Button variant={variant} size={ctaSize} className={className} {...trackingAttrs} {...rest}>
      {cta?.label ?? fallbackLabel}
      {cta?.sublabel && <span className="ml-2 text-caption font-normal opacity-80">{cta.sublabel}</span>}
    </Button>
  );
}

/** Brand-token-aware image; uses next/image-style props but stays framework-neutral. */
export interface BlockImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src" | "alt"> {
  asset?: ResolvedAsset;
  /** Override the alt text (e.g. when the asset is decorative). */
  alt?: string;
  decorative?: boolean;
  className?: string;
}

export function BlockImage({ asset, alt, decorative, className, ...rest }: BlockImageProps): JSX.Element | null {
  if (!asset?.url) return null;
  const altText = decorative ? "" : alt ?? asset.alt_text ?? "";
  return (
    <img
      src={asset.url}
      alt={altText}
      aria-hidden={decorative ? true : undefined}
      width={asset.width_px}
      height={asset.height_px}
      loading="lazy"
      decoding="async"
      className={cn("h-auto w-full object-cover", className)}
      {...rest}
    />
  );
}

/** Resolves a list of CTA IDs and renders them as a button row. */
export function BlockCTARow({
  ctas,
  resolveCTA,
  className,
}: {
  ctas: (string | undefined)[];
  resolveCTA: BlockBaseProps["resolveCTA"];
  className?: string;
}): JSX.Element {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4", className)}>
      {ctas
        .filter((id): id is string => Boolean(id))
        .map((id, i) => {
          const cta = resolveCTA?.(id);
          return <BlockCTA key={id + i} cta={cta} variantOverride={i === 0 ? "primary" : "secondary"} />;
        })}
    </div>
  );
}
