import type { Metadata } from "next";
import { COMPETITORS, type CompetitorSlug } from "@funnel/shared";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://gofunnelai.com";

/** Metadata for /grade — primary keyword "free funnel audit". */
export const graderHomeMetadata: Metadata = {
  title: "Free Funnel Audit — Grade Any Landing Page in 15 Seconds | GoFunnelAI",
  description:
    "Paste a URL. Get a 0–100 score, 5 sub-scores, and 3 specific improvements. AI-powered, free, no signup to see your score.",
  alternates: { canonical: `${BASE_URL}/grade` },
  openGraph: {
    title: "Free Funnel Audit — Grade Any Landing Page in 15 Seconds",
    description: "AI-powered. 15 seconds. Free.",
    url: `${BASE_URL}/grade`,
    images: [`${BASE_URL}/og/grader-default.png`],
    type: "website",
    siteName: "GoFunnelAI",
  },
  twitter: { card: "summary_large_image", site: "@gofunnelai" },
  robots: { index: true, follow: true },
};

const COMPETITOR_LABELS: Record<CompetitorSlug, string> = {
  clickfunnels: "ClickFunnels",
  leadpages: "Leadpages",
  unbounce: "Unbounce",
  instapage: "Instapage",
  funnelytics: "Funnelytics",
  landingi: "Landingi",
};

export function competitorLabel(slug: CompetitorSlug): string {
  return COMPETITOR_LABELS[slug];
}

export function isKnownCompetitor(slug: string): slug is CompetitorSlug {
  return (COMPETITORS as readonly string[]).includes(slug);
}

/** Per-competitor metadata for `/grade/vs/[competitor]`. */
export function competitorMetadata(slug: CompetitorSlug): Metadata {
  const label = COMPETITOR_LABELS[slug];
  return {
    title: `Free ${label} Funnel Checker — Grade Your ${label} Page | GoFunnelAI`,
    description: `Paste your ${label} landing page URL. Get an AI score in 15 seconds with 3 specific improvements. Free, no signup.`,
    alternates: { canonical: `${BASE_URL}/grade/vs/${slug}` },
    openGraph: {
      title: `Free ${label} Funnel Checker — 15-second audit`,
      description: `AI-powered ${label} page audit. Free.`,
      url: `${BASE_URL}/grade/vs/${slug}`,
      images: [`${BASE_URL}/og/grader-vs-${slug}.png`],
      type: "article",
    },
    twitter: { card: "summary_large_image" },
  };
}

/** Per-share-page metadata — noindex by default. */
export function shareMetadata(opts: {
  shareCode: string;
  url: string;
  scoreOverall: number;
  grade: string;
  topLine: string;
}): Metadata {
  const { shareCode, url, scoreOverall, grade, topLine } = opts;
  const host = safeHost(url);
  return {
    title: `Audit: ${host} scored ${scoreOverall}/100 — GoFunnelAI Grader`,
    description: `Free AI funnel audit. We scored ${host} ${scoreOverall}/100 (${grade}). ${topLine}`,
    alternates: { canonical: `${BASE_URL}/grade/s/${shareCode}` },
    robots: { index: false, follow: true },
    openGraph: {
      title: `${host} scored ${scoreOverall}/100`,
      description: `Free AI funnel audit by GoFunnelAI. See the breakdown.`,
      url: `${BASE_URL}/grade/s/${shareCode}`,
      images: [`${BASE_URL}/api/share/${shareCode}/og`],
      type: "article",
    },
    twitter: { card: "summary_large_image", site: "@gofunnelai" },
  };
}

function safeHost(raw: string): string {
  try {
    return new URL(raw).hostname;
  } catch {
    return raw;
  }
}

/** JSON-LD blob for the homepage SoftwareApplication + FAQ schema. */
export function graderJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        name: "GoFunnelAI Grader",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        url: `${BASE_URL}/grade`,
      },
      {
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: "Is the Funnel Grader free?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Yes. You can grade any public landing page in 15 seconds, no signup required to see your score.",
            },
          },
          {
            "@type": "Question",
            name: "How accurate is the audit?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Five specialized AI agents score hook strength, form friction, trust signals, speed, and compliance. Results match expert direct-response copywriters within Â±5 points on calibration tests.",
            },
          },
        ],
      },
    ],
  };
}
