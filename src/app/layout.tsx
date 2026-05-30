import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

// Inter Display isn't on Google Fonts as a separate file - use Inter for both;
// the display variant in Tailwind picks the same family but the
// type-scale enforces the display sizing.
const interDisplay = Inter({
  subsets: ["latin"],
  variable: "--font-inter-display",
  display: "swap",
  weight: ["500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://gofunnelai.com"),
  title: {
    default: "GoFunnelAI - Type your business. Get a customer.",
    template: "%s - GoFunnelAI",
  },
  description:
    "GoFunnel is an autonomous lead generation system. Tell it what you sell in one sentence - it builds the landing page, writes the ads, qualifies the leads by voice, and books the calls. You watch.",
  keywords: [
    "lead generation",
    "AI funnel builder",
    "autonomous marketing",
    "AI sales agent",
    "landing page builder",
  ],
  openGraph: {
    type: "website",
    siteName: "GoFunnelAI",
    title: "GoFunnelAI - Type your business. Get a customer.",
    description:
      "60 seconds. No credit card. Free until you make your first $1,000.",
    images: [
      { url: "/brand/logos/gofunnelai_og.png", width: 1200, height: 630 },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@gofunnelai",
    creator: "@gofunnelai",
  },
  icons: {
    icon: "/brand/logos/gofunnelai_mark.png",
    apple: "/brand/logos/gofunnelai_mark.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#FAFAF9",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${interDisplay.variable} ${jetbrainsMono.variable}`}
    >
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased dark:bg-slate-900 dark:text-slate-50">
        <SessionProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            forcedTheme="light"
            enableSystem={false}
            disableTransitionOnChange
          >
            {/* Skip link - required by doc 22 section L (a11y). */}
            <a
              href="#main"
              className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-signal-500 focus:px-4 focus:py-2 focus:text-white"
            >
              Skip to main content
            </a>
            {children}
            <Toaster
              position="top-right"
              closeButton
              richColors={false}
              toastOptions={{
                classNames: {
                  toast:
                    "border border-slate-200 bg-white text-slate-900 shadow-lg rounded-md",
                  title: "text-body font-medium",
                  description: "text-body-sm text-slate-500",
                },
              }}
            />
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
