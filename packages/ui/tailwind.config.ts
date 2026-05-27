import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

/**
 * GoFunnelAI brand tokens, derived from doc 22 (Brand and Design System).
 *
 * Anti-positions held in this config:
 *   - Anti-bloat: a fixed spacing scale, a fixed radius ladder, only 4 font weights.
 *   - Anti-amateur: warm slate neutrals (not cold blue-gray), one primary color,
 *     gradients reserved for marketing surfaces only.
 *
 * Colors expose two access paths:
 *   1. Static HEX values (signal.500 etc.) â€” for marketing surfaces and SDKs.
 *   2. CSS-var-backed semantic tokens (background, foreground, primary, etc.) â€”
 *      for the dashboard surfaces where ThemeProvider can re-skin per workspace.
 */
const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/**/*.{ts,tsx}",
    "../../apps/**/src/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: "1rem",
        md: "1.5rem",
      },
      screens: {
        sm: "640px",
        md: "768px",
        lg: "1024px",
        xl: "1280px",
        "2xl": "1280px",
      },
    },
    screens: {
      md: "768px",
      lg: "1024px",
      xl: "1280px",
    },
    extend: {
      colors: {
        // Signal (primary) â€” confident indigo-violet.
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
        // Ember (secondary) â€” warm amber, used sparingly.
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
        // Aqua (accent) â€” calm teal.
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
        // Slate (neutral) â€” warm gray, not cold blue.
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
        success: { 500: "#10A37F", 600: "#0E8268" },
        warning: { 500: "#E0A030", 600: "#B87E1F" },
        error: { 500: "#DC4A4A", 600: "#B83838" },
        info: { 500: "#3D7CE0", 600: "#2B5FB8" },

        // CSS-var-backed semantic tokens for shadcn-style components.
        // Values are HSL triplets (filled by ThemeProvider / globals.css).
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Helvetica Neue",
          "sans-serif",
        ],
        display: ["Inter Display", "Inter", "ui-sans-serif", "system-ui"],
        mono: ["JetBrains Mono", "ui-monospace", "Menlo", "Monaco", "monospace"],
      },
      fontSize: {
        // Token ladder per doc 22 Part F.
        "caption": ["0.75rem", { lineHeight: "1rem", letterSpacing: "0.01em", fontWeight: "500" }],
        "body-sm": ["0.875rem", { lineHeight: "1.25rem", letterSpacing: "0", fontWeight: "400" }],
        "body": ["1rem", { lineHeight: "1.5rem", letterSpacing: "0", fontWeight: "400" }],
        "body-lg": ["1.125rem", { lineHeight: "1.75rem", letterSpacing: "0", fontWeight: "400" }],
        "h6": ["1rem", { lineHeight: "1.375rem", letterSpacing: "0", fontWeight: "600" }],
        "h5": ["1.125rem", { lineHeight: "1.5rem", letterSpacing: "-0.005em", fontWeight: "600" }],
        "h4": ["1.375rem", { lineHeight: "1.75rem", letterSpacing: "-0.01em", fontWeight: "600" }],
        "h3": ["1.75rem", { lineHeight: "2.125rem", letterSpacing: "-0.015em", fontWeight: "600" }],
        "h2": ["2.25rem", { lineHeight: "2.5rem", letterSpacing: "-0.02em", fontWeight: "600" }],
        "h1": ["3rem", { lineHeight: "3.25rem", letterSpacing: "-0.02em", fontWeight: "600" }],
        "display-2": ["4rem", { lineHeight: "4.25rem", letterSpacing: "-0.025em", fontWeight: "600" }],
        "display-1": ["5rem", { lineHeight: "5.25rem", letterSpacing: "-0.03em", fontWeight: "600" }],
      },
      fontWeight: {
        normal: "400",
        medium: "500",
        semibold: "600",
        bold: "700",
      },
      spacing: {
        // The fixed ladder. 4, 8, 12, 16, 24, 32, 48, 64, 96, 128 (px).
        // Tailwind defaults already give 0, 0.5(2px), 1(4px), 2(8px), 3(12px),
        // 4(16px), 6(24px), 8(32px), 12(48px), 16(64px), 24(96px), 32(128px).
        // We add no custom intermediate values â€” restraint is the brand.
      },
      borderRadius: {
        none: "0",
        sm: "0.25rem",   // 4
        md: "0.5rem",    // 8
        lg: "0.75rem",   // 12
        xl: "1rem",      // 16
        full: "9999px",
      },
      boxShadow: {
        sm: "0 1px 2px rgba(23, 21, 15, 0.04)",
        md: "0 4px 12px rgba(23, 21, 15, 0.06)",
        lg: "0 12px 32px rgba(23, 21, 15, 0.10)",
        xl: "0 24px 64px rgba(23, 21, 15, 0.14)",
        glow: "0 0 0 4px rgba(91, 79, 255, 0.18)",
      },
      transitionDuration: {
        micro: "75ms",
        small: "100ms",
        medium: "200ms",
        large: "400ms",
        xl: "800ms",
      },
      transitionTimingFunction: {
        "ease-out": "cubic-bezier(0.0, 0.0, 0.2, 1)",
        "ease-in": "cubic-bezier(0.4, 0.0, 1, 1)",
        "ease-in-out": "cubic-bezier(0.4, 0.0, 0.2, 1)",
        bouncy: "cubic-bezier(0.34, 1.56, 0.64, 1)",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-100% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "accordion-down": {
          "0%": { height: "0" },
          "100%": { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          "0%": { height: "var(--radix-accordion-content-height)" },
          "100%": { height: "0" },
        },
        "dot-pulse": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.6", transform: "scale(0.92)" },
        },
      },
      animation: {
        shimmer: "shimmer 1.5s linear infinite",
        "fade-in": "fade-in 200ms cubic-bezier(0.0, 0.0, 0.2, 1)",
        "slide-up": "slide-up 200ms cubic-bezier(0.0, 0.0, 0.2, 1)",
        "accordion-down": "accordion-down 200ms cubic-bezier(0.0, 0.0, 0.2, 1)",
        "accordion-up": "accordion-up 200ms cubic-bezier(0.4, 0.0, 1, 1)",
        "dot-pulse": "dot-pulse 1.2s cubic-bezier(0.4, 0.0, 0.2, 1) infinite",
      },
      zIndex: {
        base: "0",
        raised: "10",
        dropdown: "100",
        sticky: "200",
        overlay: "300",
        modal: "400",
        popover: "500",
        toast: "600",
      },
      maxWidth: {
        prose: "45rem",
        app: "64rem",
        marketing: "80rem",
      },
    },
  },
  plugins: [animate],
};

export default config;
