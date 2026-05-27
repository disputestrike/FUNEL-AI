/**
 * GoFunnelAI brand tokens â€” single source of truth.
 *
 * Pulled directly from `22-brand-and-design-system.md` v1.0.
 * Consumed by the web app's tailwind.config.ts via @funnel/shared,
 * by the renderer, and by any future Storybook / marketing surface.
 *
 * If you need to change a token, change it here. Do not invent
 * shadow palettes inside individual apps.
 */

export const BRAND_TOKENS = {
  /** Primary â€” Indigo-Violet "Signal". Reserved for the dot, primary CTAs, links, focus. */
  signal: {
    50: "#FFF3EB",
    100: "#FFE1C7",
    200: "#FFBF82",
    300: "#FF9841",
    400: "#FF7A00",
    500: "#E8456F",
    600: "#D91A8F",
    700: "#9B1DD1",
    800: "#6817D2",
    900: "#2B0B45",
  },
  /** Secondary â€” Amber "Ember". Accent moments only; never the primary CTA. */
  ember: {
    50: "#FFFAF0",
    100: "#FFF1D6",
    200: "#FFE0A8",
    300: "#FFC766",
    400: "#FFB13D",
    500: "#F59020",
    600: "#D6741A",
    700: "#A85714",
    800: "#7A3E0E",
    900: "#4D2608",
  },
  /** Tertiary â€” Teal "Aqua". Info states, peripheral highlights, higher award tiers. */
  aqua: {
    50: "#F0FBFB",
    100: "#D6F5F4",
    200: "#A8EAEA",
    300: "#66D9D9",
    400: "#33C7C7",
    500: "#15A8A8",
    600: "#0E8A8A",
    700: "#0A6B6B",
    800: "#074D4D",
    900: "#053838",
  },
  /** Neutral â€” Warm Gray "Slate". The workhorse. */
  slate: {
    50: "#FAFAF9",
    100: "#F4F3F1",
    200: "#E8E6E2",
    300: "#D4D1CB",
    400: "#A8A39A",
    500: "#75716A",
    600: "#525048",
    700: "#3D3B35",
    800: "#28261F",
    900: "#17150F",
  },
  /** Semantic â€” always paired with an icon. */
  success: { 500: "#10A37F", 600: "#0E8268" },
  warning: { 500: "#E0A030", 600: "#B87E1F" },
  error: { 500: "#DC4A4A", 600: "#B83838" },
  info: { 500: "#3D7CE0", 600: "#2B5FB8" },
} as const;

export const BRAND_RADIUS = {
  none: "0px",
  sm: "4px",
  md: "8px",
  lg: "12px",
  xl: "16px",
  full: "9999px",
} as const;

export const BRAND_SHADOWS = {
  sm: "0 1px 2px rgba(23, 21, 15, 0.04)",
  md: "0 4px 12px rgba(23, 21, 15, 0.06)",
  lg: "0 12px 32px rgba(23, 21, 15, 0.10)",
  xl: "0 24px 64px rgba(23, 21, 15, 0.14)",
} as const;

export const BRAND_DURATIONS = {
  micro: "75ms",
  small: "100ms",
  medium: "200ms",
  large: "400ms",
  xl: "800ms",
} as const;

export const BRAND_EASING = {
  out: "cubic-bezier(0.0, 0.0, 0.2, 1)",
  in: "cubic-bezier(0.4, 0.0, 1, 1)",
  inOut: "cubic-bezier(0.4, 0.0, 0.2, 1)",
} as const;

/** Locked product names â€” never rewrite these in copy. */
export const BRAND_NAMES = {
  product: "GoFunnelAI",
  ai: "Funnel",
  voice: "RevTry",
  grader: "Funnel Grader",
  conference: "FunnelCon",
} as const;

export type BrandTokens = typeof BRAND_TOKENS;
