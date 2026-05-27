import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});
const display = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL ?? "https://gofunnelai.com"),
  title: { default: "GoFunnelAI â€” Funnel Grader", template: "%s | GoFunnelAI" },
  description: "GoFunnelAI â€” Autonomous lead generation, end-to-end.",
  icons: {
    icon: "/brand/logos/funelai_social_media_profile.png",
    apple: "/brand/logos/funelai_social_media_profile.png",
  },
  openGraph: {
    type: "website",
    siteName: "GoFunnelAI",
    images: [{ url: "/brand/logos/funelai_primary_logo.png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0265c5",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${display.variable}`}>
      <body>{children}</body>
    </html>
  );
}
