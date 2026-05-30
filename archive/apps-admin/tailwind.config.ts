import type { Config } from "tailwindcss";
import {
  BRAND_TOKENS,
  BRAND_RADIUS,
  BRAND_SHADOWS,
  BRAND_DURATIONS,
  BRAND_EASING,
} from "@funnel/shared/constants";

/**
 * Tailwind config for the admin console.
 *
 * Same brand tokens as web, but admin chrome leans on the `error` palette
 * (red bar, red badges) to keep staff visually aware they're in a
 * privileged context. The shadcn semantic aliases match web so any
 * @funnel/ui primitive renders identically.
 */
const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/**/*.{ts,tsx,mdx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: "1rem", md: "1.5rem", lg: "2rem" },
      screens: { sm: "640px", md: "768px", lg: "1024px", xl: "1280px", "2xl": "1536px" },
    },
    extend: {
      colors: {
        signal: BRAND_TOKENS.signal,
        ember: BRAND_TOKENS.ember,
        aqua: BRAND_TOKENS.aqua,
        slate: BRAND_TOKENS.slate,
        success: BRAND_TOKENS.success,
        warning: BRAND_TOKENS.warning,
        error: BRAND_TOKENS.error,
        info: BRAND_TOKENS.info,
        background: BRAND_TOKENS.slate[50],
        foreground: BRAND_TOKENS.slate[900],
        muted: BRAND_TOKENS.slate[100],
        "muted-foreground": BRAND_TOKENS.slate[500],
        border: BRAND_TOKENS.slate[200],
        input: BRAND_TOKENS.slate[200],
        ring: BRAND_TOKENS.signal[500],
        primary: { DEFAULT: BRAND_TOKENS.signal[500], foreground: "#FFFFFF" },
        destructive: { DEFAULT: BRAND_TOKENS.error[500], foreground: "#FFFFFF" },
        accent: { DEFAULT: BRAND_TOKENS.slate[100], foreground: BRAND_TOKENS.slate[900] },
        card: { DEFAULT: "#FFFFFF", foreground: BRAND_TOKENS.slate[900] },
        popover: { DEFAULT: "#FFFFFF", foreground: BRAND_TOKENS.slate[900] },
      },
      borderRadius: {
        none: BRAND_RADIUS.none,
        sm: BRAND_RADIUS.sm,
        DEFAULT: BRAND_RADIUS.md,
        md: BRAND_RADIUS.md,
        lg: BRAND_RADIUS.lg,
        xl: BRAND_RADIUS.xl,
        full: BRAND_RADIUS.full,
      },
      boxShadow: {
        sm: BRAND_SHADOWS.sm,
        DEFAULT: BRAND_SHADOWS.sm,
        md: BRAND_SHADOWS.md,
        lg: BRAND_SHADOWS.lg,
        xl: BRAND_SHADOWS.xl,
      },
      transitionDuration: {
        micro: BRAND_DURATIONS.micro,
        small: BRAND_DURATIONS.small,
        medium: BRAND_DURATIONS.medium,
        large: BRAND_DURATIONS.large,
      },
      transitionTimingFunction: {
        "ease-out-brand": BRAND_EASING.out,
        "ease-in-brand": BRAND_EASING.in,
        "ease-inout-brand": BRAND_EASING.inOut,
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
