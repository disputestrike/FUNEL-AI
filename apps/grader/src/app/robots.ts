import type { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_BASE_URL ?? "https://gofunnelai.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/grade", "/grade/vs/", "/grade/learn/", "/grade/examples/"],
        disallow: ["/grade/s/", "/api/"],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
  };
}
