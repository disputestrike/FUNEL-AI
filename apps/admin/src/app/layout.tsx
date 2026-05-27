import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import { AdminShell } from "@/components/AdminShell";
import { tryAdminSession } from "@/lib/session";
import { readImpersonationId } from "@/lib/impersonation";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  // Admin console is internal only â€” keep it out of search indices forever.
  metadataBase: new URL("https://admin.gofunnelai.com"),
  title: { default: "GoFunnelAI Admin", template: "%s Â· GoFunnelAI Admin" },
  description: "Internal staff console â€” restricted access.",
  robots: { index: false, follow: false, nocache: true, noarchive: true, nosnippet: true },
  icons: {
    icon: "/brand/logos/funelai_social_media_profile.png",
    apple: "/brand/logos/funelai_social_media_profile.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#7F1D1D", // error-900 â€” keep tab chrome red so staff knows
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await tryAdminSession();
  const impersonationId = readImpersonationId();

  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {/* Skip link for keyboard users */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-signal-500 focus:px-3 focus:py-1.5 focus:text-white"
        >
          Skip to main content
        </a>

        <AdminShell session={session} impersonationId={impersonationId}>
          {children}
        </AdminShell>

        <Toaster
          position="top-right"
          closeButton
          toastOptions={{
            classNames: {
              toast: "border border-slate-200 bg-white text-slate-900 shadow-lg rounded-md",
            },
          }}
        />
      </body>
    </html>
  );
}
