import * as React from "react";
import { cn } from "@/lib/cn";

const BRAND_NAME = "GoFunnelAI";
const WORDMARK_RATIO = 1406 / 374;
const MARK_RATIO = 1043 / 1136;

const WORDMARK_SRC = {
  auto: "/brand/logos/gofunnelai_primary.png",
  light: "/brand/logos/gofunnelai_primary.png",
  dark: "/brand/logos/gofunnelai_white.png",
} as const;

/**
 * GoFunnelAI wordmark from the supplied brand PNGs.
 */
export function Wordmark({
  className,
  variant = "auto",
  height = 36,
}: {
  className?: string;
  variant?: "auto" | "light" | "dark";
  height?: number;
}) {
  const width = Math.round(height * WORDMARK_RATIO);

  return (
    <span
      className={cn("inline-flex shrink-0 items-center select-none", className)}
      aria-label={BRAND_NAME}
      style={{ height, width }}
    >
      <img
        src={WORDMARK_SRC[variant]}
        alt={BRAND_NAME}
        className="block h-full w-full object-contain"
        draggable={false}
      />
    </span>
  );
}

/** The mark alone (16-64px contexts). Square social profile icon. */
export function Mark({ className, size = 32 }: { className?: string; size?: number }) {
  return (
    <span
      aria-label={BRAND_NAME}
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <img
        src="/brand/logos/gofunnelai_mark.png"
        alt={BRAND_NAME}
        className="block h-full object-contain"
        draggable={false}
        style={{ width: Math.round(size * MARK_RATIO) }}
      />
    </span>
  );
}

export function Lockup({
  className,
  height = 36,
  variant = "auto",
}: {
  className?: string;
  height?: number;
  variant?: "auto" | "light" | "dark";
}) {
  return <Wordmark className={className} height={height} variant={variant} />;
}
