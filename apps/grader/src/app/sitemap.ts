import type { MetadataRoute } from "next";

import { COMPETITORS } from "@funnel/shared";

const BASE = process.env.NEXT_PUBLIC_BASE_URL ?? "https://gofunnelai.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${BASE}/grade`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    ...COMPETITORS.map((c) => ({
      url: `${BASE}/grade/vs/${c}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
