import type { Config } from "tailwindcss";
import {
  BRAND_TOKENS,
  BRAND_RADIUS,
  BRAND_SHADOWS,
  BRAND_DURATIONS,
  BRAND_EASING,
} from "@funnel/shared/constants";

/**
 * Tailwind config for the GoFunnelAI web app.
 *
 * Pulls every color, radius, shadow, duration, and easing from
 * @funnel/shared/constants so the renderer, marketing site, and
 * Storybook stay in lockstep.
 *
 * Tokens locked in 22-brand-and-design-system.md.
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
      screens: {
        sm: "640px",
        md: "768px",
        lg: "1024px",
        xl: "1280px",
        "2xl": "1280px", // cap container at 1280 per design system
      },
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
        // shadcn semantic aliases â€” mapped to brand neutrals
        background: BRAND_TOKENS.slate[50],
        foreground: BRAND_TOKENS.slate[900],
        muted: BRAND_TOKENS.slate[100],
        "muted-foreground": BRAND_TOKENS.slate[500],
        border: BRAND_TOKENS.slate[200],
        input: BRAND_TOKENS.slate[200],
        ring: BRAND_TOKENS.signal[500],
        primary: {
          DEFAULT: BRAND_TOKENS.signal[500],
          foreground: "#FFFFFF",
        },
        destructive: {
          DEFAULT: BRAND_TOKENS.error[500],
          foreground: "#FFFFFF",
        },
        accent: {
          DEFAULT: BRAND_TOKENS.slate[100],
          foreground: BRAND_TOKENS.slate[900],
        },
        card: {
          DEFAULT: "#FFFFFF",
          foreground: BRAND_TOKENS.slate[900],
        },
        popover: {
          DEFAULT: "#FFFFFF",
          foreground: BRAND_TOKENS.slate[900],
        },
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
        xl: BRAND_DURATIONS.xl,
      },
      transitionTimingFunction: {
        "ease-out-brand": BRAND_EASING.out,
        "ease-in-brand": BRAND_EASING.in,
        "ease-inout-brand": BRAND_EASING.inOut,
      },
      fontFamily: {
        sans: [
          "var(--font-inter)",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
        display: [
          "var(--font-inter-display)",
          "var(--font-inter)",
          "sans-serif",
        ],
        mono: [
          "var(--font-jetbrains-mono)",
          "ui-monospace",
          "SFMono-Regular",
          "monospace",
        ],
      },
      fontSize: {
        // exact tokens from doc 22 Â§F
        "display-1": ["80px", { lineHeight: "84px", letterSpacing: "-0.03em", fontWeight: "600" }],
        "display-2": ["64px", { lineHeight: "68px", letterSpacing: "-0.025em", fontWeight: "600" }],
        h1: ["48px", { lineHeight: "52px", letterSpacing: "-0.02em", fontWeight: "600" }],
        h2: ["36px", { lineHeight: "40px", letterSpacing: "-0.02em", fontWeight: "600" }],
        h3: ["28px", { lineHeight: "34px", letterSpacing: "-0.015em", fontWeight: "600" }],
        h4: ["22px", { lineHeight: "28px", letterSpacing: "-0.01em", fontWeight: "600" }],
        h5: ["18px", { lineHeight: "24px", letterSpacing: "-0.005em", fontWeight: "600" }],
        h6: ["16px", { lineHeight: "22px", letterSpacing: "0", fontWeight: "600" }],
        "body-lg": ["18px", { lineHeight: "28px", letterSpacing: "0", fontWeight: "400" }],
        body: ["16px", { lineHeight: "24px", letterSpacing: "0", fontWeight: "400" }],
        "body-sm": ["14px", { lineHeight: "20px", letterSpacing: "0", fontWeight: "400" }],
        caption: ["12px", { lineHeight: "16px", letterSpacing: "0.01em", fontWeight: "500" }],
        code: ["14px", { lineHeight: "20px", letterSpacing: "0", fontWeight: "400" }],
      },
      spacing: {
        // 4, 8, 12, 16, 24, 32, 48, 64, 96, 128 â€” Tailwind already covers most
        18: "72px",
        22: "88px",
        26: "104px",
        30: "120px",
      },
      maxWidth: {
        prose: "720px",
        app: "1024px",
        marketing: "1280px",
      },
      keyframes: {
        shimmer: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "pulse-dot": {
          "0%, 100%": { opacity: "0.6", transform: "scale(1)" },
          "50%": { opacity: "1", transform: "scale(1.15)" },
        },
        "ellipsis-bounce": {
          "0%, 80%, 100%": { opacity: "0.2" },
          "40%": { opacity: "1" },
        },
        "hero-shift": {
          "0%, 100%": { backgroundPosition: "0% 0%" },
          "25%": { backgroundPosition: "100% 0%" },
          "50%": { backgroundPosition: "100% 100%" },
          "75%": { backgroundPosition: "0% 100%" },
        },
      },
      animation: {
        shimmer: "shimmer 1.5s linear infinite",
        "fade-up": "fade-up 200ms cubic-bezier(0.0, 0.0, 0.2, 1)",
        "fade-in": "fade-in 200ms cubic-bezier(0.0, 0.0, 0.2, 1)",
        "pulse-dot": "pulse-dot 1.2s cubic-bezier(0.4, 0.0, 0.2, 1) infinite",
        "ellipsis-bounce": "ellipsis-bounce 1.4s ease-in-out infinite both",
        "hero-shift": "hero-shift 8s cubic-bezier(0.4, 0.0, 0.2, 1) infinite",
      },
    },
  },
  plugins: [],
};

export default config;
