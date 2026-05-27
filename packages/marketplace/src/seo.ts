/**
 * Marketplace SEO: per-template indexable listing pages.
 *
 * Each template at `gofunnelai.com/marketplace/<slug>` gets:
 *   - <title>, <meta description>, canonical URL
 *   - schema.org Product + Offer + AggregateRating + Review microdata
 *   - Open Graph + Twitter cards
 *   - Breadcrumb (Marketplace â€º Category â€º Template title)
 *
 * Returns a `MarketplaceSeoBlob` ready for the renderer to inline as
 * JSON-LD <script type="application/ld+json">.
 */

import { createHash } from "node:crypto";

import type { Review, Template } from "./types.js";

const RESERVED_SLUGS = new Set([
  "create",
  "checkout",
  "categories",
  "creators",
  "admin",
  "api",
  "search",
  "settings",
  "new",
  "edit",
]);

const STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "of",
  "in",
  "on",
  "for",
  "to",
  "with",
  "by",
  "your",
  "my",
  "our",
  "this",
  "that",
]);

export function generateSlug(input: { title: string; salt: string }): string {
  const base = input.title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[Ì€-Í¯]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/g)
    .filter((w) => w && !STOPWORDS.has(w))
    .join("-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);

  const slug = base || "template";
  if (RESERVED_SLUGS.has(slug)) {
    return `${slug}-${shortDigest(input.salt)}`;
  }
  // Append 6-char digest for uniqueness without collision retries.
  return `${slug}-${shortDigest(input.salt)}`;
}

function shortDigest(s: string): string {
  return createHash("sha256").update(s).digest("hex").slice(0, 6);
}

export interface MarketplaceSeoBlob {
  /** <title> */
  title: string;
  /** <meta name="description"> */
  description: string;
  /** Canonical URL */
  canonical_url: string;
  /** JSON-LD blob (stringify before inlining). */
  jsonld: Record<string, unknown>;
  /** Open Graph tags. */
  og: Record<string, string>;
  /** Twitter Card tags. */
  twitter: Record<string, string>;
  /** Breadcrumb sequence. */
  breadcrumbs: { name: string; url: string }[];
}

export function renderTemplateSeo(args: {
  base_url: string;
  template: Template;
  reviews: Review[];
}): MarketplaceSeoBlob {
  const url = `${args.base_url}/marketplace/${args.template.slug}`;
  const visibleReviews = args.reviews.filter((r) => r.status === "visible");
  const avg =
    visibleReviews.length === 0
      ? args.template.avg_rating
      : visibleReviews.reduce((s, r) => s + r.stars, 0) / visibleReviews.length;
  const ratingCount = visibleReviews.length;

  const jsonld: Record<string, unknown> = {
    "@context": "https://schema.org/",
    "@type": "Product",
    name: args.template.title,
    description: args.template.description.slice(0, 5000),
    image: args.template.preview_image_url ?? `${args.base_url}/og/template/${args.template.slug}.png`,
    sku: args.template.id,
    brand: { "@type": "Brand", name: "GoFunnelAI" },
    category: args.template.category,
    offers: {
      "@type": "Offer",
      price: (args.template.price_usd_cents / 100).toFixed(2),
      priceCurrency: "USD",
      availability:
        args.template.status === "published"
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      url,
    },
  };
  if (ratingCount > 0) {
    jsonld.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: avg.toFixed(2),
      reviewCount: ratingCount,
    };
    jsonld.review = visibleReviews.slice(0, 10).map((r) => ({
      "@type": "Review",
      reviewRating: { "@type": "Rating", ratingValue: r.stars, bestRating: 5 },
      datePublished: r.created_at,
      reviewBody: r.comment.slice(0, 1000),
      author: { "@type": "Person", name: `Verified buyer` },
    }));
  }

  return {
    title: `${args.template.title} â€” GoFunnelAI Template`,
    description: args.template.description.slice(0, 160),
    canonical_url: url,
    jsonld,
    og: {
      "og:type": "product",
      "og:title": args.template.title,
      "og:description": args.template.description.slice(0, 200),
      "og:url": url,
      "og:image": args.template.preview_image_url ?? `${args.base_url}/og/template/${args.template.slug}.png`,
      "og:site_name": "GoFunnelAI Marketplace",
    },
    twitter: {
      "twitter:card": "summary_large_image",
      "twitter:title": args.template.title,
      "twitter:description": args.template.description.slice(0, 200),
      "twitter:image":
        args.template.preview_image_url ?? `${args.base_url}/og/template/${args.template.slug}.png`,
    },
    breadcrumbs: [
      { name: "Marketplace", url: `${args.base_url}/marketplace` },
      {
        name: humanizeCategory(args.template.category),
        url: `${args.base_url}/marketplace?category=${encodeURIComponent(args.template.category)}`,
      },
      { name: args.template.title, url },
    ],
  };
}

function humanizeCategory(c: string): string {
  return c.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

/** Generate a sitemap XML fragment for a batch of templates. */
export function renderSitemapFragment(args: {
  base_url: string;
  templates: { slug: string; updated_at: string }[];
}): string {
  const items = args.templates
    .map(
      (t) =>
        `  <url>\n    <loc>${args.base_url}/marketplace/${t.slug}</loc>\n    <lastmod>${t.updated_at}</lastmod>\n    <changefreq>weekly</changefreq>\n  </url>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items}\n</urlset>\n`;
}
