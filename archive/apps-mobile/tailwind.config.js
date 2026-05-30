/**
 * NativeWind / Tailwind config for the GoFunnelAI mobile app.
 *
 * Tokens mirror packages/ui/tailwind.config.ts and doc 22
 * (brand-and-design-system.md). Keep these in sync.
 */
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./lib/**/*.{js,jsx,ts,tsx}",
    "./styles/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Primary — Indigo-Violet "Signal"
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
        // Secondary — Amber "Ember"
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
        // Accent — Teal "Aqua"
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
        // Neutral — Warm "Slate"
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
        // Semantic
        success: { 500: "#10A37F", 600: "#0E8268" },
        warning: { 500: "#E0A030", 600: "#B87E1F" },
        error: { 500: "#DC4A4A", 600: "#B83838" },
        info: { 500: "#3D7CE0", 600: "#2B5FB8" },
      },
      borderRadius: {
        none: "0px",
        sm: "4px",
        md: "8px",
        lg: "12px",
        xl: "16px",
        full: "9999px",
      },
      fontFamily: {
        sans: ["Inter", "System"],
        mono: ["JetBrainsMono", "Menlo"],
      },
      fontSize: {
        // [size, lineHeight]
        caption: ["12px", "16px"],
        "body-sm": ["14px", "20px"],
        body: ["16px", "24px"],
        "body-lg": ["18px", "28px"],
        h6: ["16px", "22px"],
        h5: ["18px", "24px"],
        h4: ["22px", "28px"],
        h3: ["28px", "34px"],
        h2: ["36px", "40px"],
        h1: ["48px", "52px"],
      },
      spacing: {
        // 4-px scale per doc 22 Â§G
        1: "4px",
        2: "8px",
        3: "12px",
        4: "16px",
        6: "24px",
        8: "32px",
        12: "48px",
        16: "64px",
        24: "96px",
        32: "128px",
      },
    },
  },
  plugins: [],
};
