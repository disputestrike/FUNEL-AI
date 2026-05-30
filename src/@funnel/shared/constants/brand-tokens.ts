/**
 * GoFunnelAI canonical brand tokens (doc 22).
 *
 * Every Funnel that doesn't override these inherits this token tree. Color
 * names mirror the doc: `signal` = primary, `ember` = secondary,
 * `aqua` = accent, `slate` = neutral.
 */

import type { FunnelBrandTokens } from "../types/branding.js";

/**
 * Canonical funnel-schema-shaped brand tokens. Exported under this name to
 * avoid conflicting with the legacy flat `BRAND_TOKENS` constant exported
 * from `./brand.ts` (kept for the funnel-grader app).
 */
export const FUNNEL_BRAND_TOKENS: FunnelBrandTokens = {
  colors: {
    primary: {
      "50": "#F4F3FF",
      "100": "#E8E6FF",
      "200": "#CFCBFF",
      "300": "#A8A1FF",
      "400": "#827AFF",
      "500": "#5B4FFF",
      "600": "#4A3FE0",
      "700": "#3A30B8",
      "800": "#2B238A",
      "900": "#1D175E",
    },
    secondary: {
      "50": "#FFFAF0",
      "100": "#FFF1D6",
      "200": "#FFE0A8",
      "300": "#FFC766",
      "400": "#FFB13D",
      "500": "#F59020",
      "600": "#D6741A",
      "700": "#A85714",
      "800": "#7A3E0E",
      "900": "#4D2608",
    },
    accent: {
      "50": "#F0FBFB",
      "100": "#D6F5F4",
      "200": "#A8EAEA",
      "300": "#66D9D9",
      "400": "#33C7C7",
      "500": "#15A8A8",
      "600": "#0E8A8A",
      "700": "#0A6B6B",
      "800": "#074D4D",
      "900": "#053838",
    },
    neutral: {
      "50": "#FAFAF9",
      "100": "#F4F3F1",
      "200": "#E8E6E2",
      "300": "#D4D1CB",
      "400": "#A8A39A",
      "500": "#75716A",
      "600": "#525048",
      "700": "#3D3B35",
      "800": "#28261F",
      "900": "#17150F",
    },
    semantic: {
      success: "#10A37F",
      warning: "#E0A030",
      error: "#DC4A4A",
      info: "#3D7CE0",
    },
  },
  typography: {
    font_families: {
      heading_display: "Inter Display",
      heading_text: "Inter",
      body: "Inter",
      mono: "JetBrains Mono",
    },
    font_sizes: {
      xs: "0.75rem",
      sm: "0.875rem",
      base: "1rem",
      lg: "1.125rem",
      xl: "1.375rem",
      h6: "1rem",
      h5: "1.125rem",
      h4: "1.375rem",
      h3: "1.75rem",
      h2: "2.25rem",
      h1: "3rem",
      display: "5rem", // 80px display-1
    },
    font_weights: {
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    line_heights: {
      tight: 1.05,
      snug: 1.2,
      normal: 1.5,
      relaxed: 1.625,
      loose: 1.75,
    },
    letter_spacings: {
      tighter: "-0.03em",
      tight: "-0.02em",
      normal: "0em",
      wide: "0.01em",
      wider: "0.05em",
    },
  },
  spacing: {
    "0": "0rem",
    "1": "0.25rem", // 4px
    "2": "0.5rem", // 8px
    "3": "0.75rem", // 12px
    "4": "1rem", // 16px
    "6": "1.5rem", // 24px
    "8": "2rem", // 32px
    "12": "3rem", // 48px
    "16": "4rem", // 64px
    "24": "6rem", // 96px
    "32": "8rem", // 128px
  },
  border_radius: {
    none: "0",
    sm: "0.25rem", // 4px
    md: "0.5rem", // 8px
    lg: "0.75rem", // 12px
    xl: "1rem", // 16px
    full: "9999px",
  },
  shadows: {
    sm: "0 1px 2px rgba(23, 21, 15, 0.04)",
    md: "0 4px 12px rgba(23, 21, 15, 0.06)",
    lg: "0 12px 32px rgba(23, 21, 15, 0.10)",
    xl: "0 24px 64px rgba(23, 21, 15, 0.14)",
    glow: "0 0 0 4px rgba(91, 79, 255, 0.18)",
  },
  motion: {
    durations: {
      fastest: "75ms",
      faster: "100ms",
      fast: "150ms",
      normal: "250ms",
      slow: "400ms",
    },
    easings: {
      ease_out: "cubic-bezier(0.16, 1, 0.3, 1)",
      ease_in_out: "cubic-bezier(0.65, 0, 0.35, 1)",
      bouncy: "cubic-bezier(0.34, 1.56, 0.64, 1)",
    },
  },
  z_index: {
    base: 0,
    raised: 10,
    dropdown: 100,
    sticky: 200,
    overlay: 300,
    modal: 400,
    popover: 500,
    toast: 600,
  },
};

/**
 * Returns a deep-clone of `FUNNEL_BRAND_TOKENS` you can mutate as a per-
 * workspace override base. Frozen tokens cannot be mutated in place.
 */
export function cloneBrandTokens(): FunnelBrandTokens {
  return JSON.parse(JSON.stringify(FUNNEL_BRAND_TOKENS)) as FunnelBrandTokens;
}
