/**
 * Brand tokens used by every email template. Mirrors @funnel/ui/tokens but
 * inlined here so the email package can stand alone in a worker runtime
 * that doesn't bundle the UI lib.
 */

export const BRAND = {
  name: "GoFunnelAI",
  domain: "gofunnelai.com",
  app_url: "https://app.gofunnelai.com",
  site_url: "https://gofunnelai.com",
  support_email: "support@gofunnelai.com",
  reply_to: "no-reply@gofunnelai.com",
  logo_url: "https://gofunnelai.com/brand/logo-mark-512.png",
  logo_wordmark_url: "https://gofunnelai.com/brand/logo-wordmark-256.png",
  address: "GoFunnelAI · 548 Market St #29132 · San Francisco, CA 94104",
} as const;

export const TOKENS = {
  color: {
    bg: "#FFFFFF",
    bg_alt: "#F8FAFC",
    text: "#0F172A",
    text_muted: "#475569",
    border: "#E2E8F0",
    primary: "#0F172A",
    primary_hover: "#1E293B",
    accent: "#F59E0B",
    success: "#10B981",
    warning: "#F59E0B",
    danger: "#EF4444",
    link: "#3B82F6",
  },
  font: {
    sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
    mono: '"SFMono-Regular", Menlo, Monaco, Consolas, monospace',
  },
  radius: { sm: 6, md: 10, lg: 16 },
  spacing: { xs: 8, sm: 12, md: 16, lg: 24, xl: 32 },
} as const;
