/**
 * Design tokens as TypeScript constants.
 *
 * Two purposes:
 *   1. JS access at runtime (e.g. charts that need a HEX directly).
 *   2. The seed values that ThemeProvider injects as CSS custom properties.
 *
 * Mirror of `tailwind.config.ts`. Keep in sync.
 */

export const colors = {
  signal: {
    50: "#F4F3FF",
    100: "#E8E6FF",
    200: "#CFCBFF",
    300: "#A8A1FF",
    400: "#827AFF",
    500: "#5B4FFF",
    600: "#4A3FE0",
    700: "#3A30B8",
    800: "#2B238A",
    900: "#1D175E",
  },
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
  semantic: {
    success: { 500: "#10A37F", 600: "#0E8268" },
    warning: { 500: "#E0A030", 600: "#B87E1F" },
    error: { 500: "#DC4A4A", 600: "#B83838" },
    info: { 500: "#3D7CE0", 600: "#2B5FB8" },
  },
} as const;

export const typography = {
  fontFamilies: {
    body: "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
    display: "'Inter Display', Inter, ui-sans-serif, system-ui",
    mono: "'JetBrains Mono', ui-monospace, Menlo, Monaco, monospace",
  },
  fontSizes: {
    caption: "0.75rem",
    "body-sm": "0.875rem",
    body: "1rem",
    "body-lg": "1.125rem",
    h6: "1rem",
    h5: "1.125rem",
    h4: "1.375rem",
    h3: "1.75rem",
    h2: "2.25rem",
    h1: "3rem",
    "display-2": "4rem",
    "display-1": "5rem",
  },
  fontWeights: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  lineHeights: {
    tight: 1.05,
    snug: 1.2,
    normal: 1.5,
    relaxed: 1.625,
    loose: 1.75,
  },
} as const;

export const spacing = {
  0: "0",
  1: "0.25rem", // 4
  2: "0.5rem", // 8
  3: "0.75rem", // 12
  4: "1rem", // 16
  6: "1.5rem", // 24
  8: "2rem", // 32
  12: "3rem", // 48
  16: "4rem", // 64
  24: "6rem", // 96
  32: "8rem", // 128
} as const;

export const borderRadius = {
  none: "0",
  sm: "0.25rem",
  md: "0.5rem",
  lg: "0.75rem",
  xl: "1rem",
  full: "9999px",
} as const;

export const shadows = {
  sm: "0 1px 2px rgba(23, 21, 15, 0.04)",
  md: "0 4px 12px rgba(23, 21, 15, 0.06)",
  lg: "0 12px 32px rgba(23, 21, 15, 0.10)",
  xl: "0 24px 64px rgba(23, 21, 15, 0.14)",
  glow: "0 0 0 4px rgba(91, 79, 255, 0.18)",
} as const;

export const motion = {
  durations: {
    micro: "75ms",
    small: "100ms",
    medium: "200ms",
    large: "400ms",
    xl: "800ms",
  },
  easings: {
    out: "cubic-bezier(0.0, 0.0, 0.2, 1)",
    in: "cubic-bezier(0.4, 0.0, 1, 1)",
    inOut: "cubic-bezier(0.4, 0.0, 0.2, 1)",
    bouncy: "cubic-bezier(0.34, 1.56, 0.64, 1)",
  },
} as const;

export const zIndex = {
  base: 0,
  raised: 10,
  dropdown: 100,
  sticky: 200,
  overlay: 300,
  modal: 400,
  popover: 500,
  toast: 600,
} as const;

export const breakpoints = {
  md: 768,
  lg: 1024,
  xl: 1280,
} as const;

export const tokens = {
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
  motion,
  zIndex,
  breakpoints,
} as const;

export type Tokens = typeof tokens;

/** HEX -> "H S% L%" (the shadcn convention used in CSS vars). */
export function hexToHslTriplet(hex: string): string {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let hh = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        hh = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        hh = (b - r) / d + 2;
        break;
      case b:
        hh = (r - g) / d + 4;
        break;
    }
    hh /= 6;
  }
  return `${Math.round(hh * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}
