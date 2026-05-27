/**
 * Academy SEO pages.
 *
 * Every course publishes an indexable landing page at:
 *   `/academy/<slug>` plus the marketing landing pages
 *   `/academy/marketing-for-<industry>`
 *
 * This module generates:
 *   - `<title>` and `<meta description>`
 *   - schema.org/Course JSON-LD
 *   - schema.org/FAQPage JSON-LD (when FAQs are configured)
 *   - sitemap entries
 *
 * The SSR layer (apps/academy) reads these AcademySeoPage rows at render time;
 * the cache key lets edge workers serve crawlers without round-tripping.
 */

import { ulid } from "ulid";
import { z } from "zod";
import {
  INDUSTRY_VERTICALS,
  type AcademySeoPage,
  type Course,
  type IndustryVertical,
} from "./types.js";

export interface SeoStore {
  insertPage(page: AcademySeoPage): Promise<void>;
  upsertPage(page: AcademySeoPage): Promise<AcademySeoPage>;
  getPageByPath(urlPath: string): Promise<AcademySeoPage | null>;
  listPages(filter: { industry?: IndustryVertical }): Promise<AcademySeoPage[]>;
}

/* ===== Page generation ================================================ */

/**
 * Generate the SEO page descriptor for an Academy course. We don't render the
 * HTML here â€” that's the SSR layer's job â€” but we pre-compute every piece of
 * metadata the page needs.
 */
export function buildCoursePage(args: {
  course: Course;
  /** Cluster of FAQs to render under the syllabus. */
  faqs?: Array<{ q: string; a: string }>;
  /** Public absolute URL where this page is served. */
  canonical_url: string;
  /** Provider / school name in JSON-LD. */
  provider_name?: string;
  provider_url?: string;
}): AcademySeoPage {
  const c = args.course;
  const title = c.seo_title ?? `${c.title} | GoFunnelAI Academy`;
  const description =
    c.seo_description ??
    `${c.subtitle ?? c.description.slice(0, 160)}`.trim();

  // schema.org/Course â€” Google's "Course" rich result requires `provider`.
  const courseJsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Course",
    name: c.title,
    description: c.description,
    provider: {
      "@type": "Organization",
      name: args.provider_name ?? "GoFunnelAI Academy",
      sameAs: args.provider_url ?? "https://academy.gofunnelai.com",
    },
    courseCode: c.id,
    educationalLevel: c.level,
    timeRequired: `PT${Math.max(1, c.total_minutes)}M`,
    inLanguage: "en",
    offers: c.tier === "paid"
      ? [{
          "@type": "Offer",
          price: ((c.price_cents ?? 0) / 100).toFixed(2),
          priceCurrency: "USD",
          availability: "https://schema.org/InStock",
          url: args.canonical_url,
        }]
      : [{
          "@type": "Offer",
          price: "0.00",
          priceCurrency: "USD",
          availability: "https://schema.org/InStock",
          url: args.canonical_url,
        }],
  };

  const allJsonLd: Record<string, unknown>[] = [courseJsonLd];

  if (args.faqs && args.faqs.length > 0) {
    allJsonLd.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: args.faqs.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    });
  }

  return {
    id: `seo_${ulid()}`,
    course_id: c.id,
    url_path: `/academy/${c.slug}`,
    title,
    meta_description: description.slice(0, 180),
    primary_keyword: c.industry ? `marketing for ${c.industry}` : c.title,
    faq: args.faqs ?? [],
    schema_org_json_ld: { "@graph": allJsonLd },
    rendered_html_cache_key: null,
    last_rendered_at: null,
  };
}

/**
 * Build an industry-landing page (e.g. /academy/marketing-for-hvac). This is
 * the page that ranks for the long-tail "marketing for X" queries; it lists
 * every Academy course in the vertical + the cohort-based program.
 */
export function buildIndustryLandingPage(args: {
  industry: IndustryVertical;
  courses_in_industry: Course[];
  canonical_url: string;
}): AcademySeoPage {
  if (!INDUSTRY_VERTICALS.includes(args.industry)) {
    throw new Error(`Unknown industry: ${args.industry}`);
  }
  const friendly = humanizeIndustry(args.industry);
  const slug = `marketing-for-${args.industry.replace(/_/g, "-")}`;
  const title = `Marketing for ${friendly} â€” GoFunnelAI Academy`;
  const description = `Complete guide + courses to grow your ${friendly} business with AI funnels, voice agents, and ad campaigns. ${args.courses_in_industry.length} courses inside.`;

  return {
    id: `seo_${ulid()}`,
    course_id: args.courses_in_industry[0]?.id ?? "",
    url_path: `/academy/${slug}`,
    title,
    meta_description: description.slice(0, 180),
    primary_keyword: `marketing for ${args.industry}`,
    faq: industryFaqs(args.industry, friendly),
    schema_org_json_ld: {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: title,
      description,
      url: args.canonical_url,
      hasPart: args.courses_in_industry.map((c) => ({
        "@type": "Course",
        name: c.title,
        description: c.description,
      })),
    },
    rendered_html_cache_key: null,
    last_rendered_at: null,
  };
}

/** Default vertical-FAQ pack â€” these win long-tail traffic on Google. */
function industryFaqs(industry: IndustryVertical, friendly: string): Array<{ q: string; a: string }> {
  return [
    {
      q: `How does GoFunnelAI help ${friendly} businesses get more leads?`,
      a: `GoFunnelAI generates a complete lead-gen funnel â€” landing page, email sequence, SMS sequence, and AI voice follow-up â€” tuned to the ${friendly} vertical's best-converting offers, in under 60 seconds.`,
    },
    {
      q: `Are the ${friendly} marketing courses free?`,
      a: `Yes â€” every Operator-level Academy course is free. Industry Mastery programs (paid, $297-$1,997) go deeper with cohort-based delivery, mentorship, and a graded capstone.`,
    },
    {
      q: `What is the GoFunnelAI certification?`,
      a: `Three ladders: Certified Operator (basic), Certified Strategist (advanced â€” 50+ courses + capstone + mentor review), and Certified Agency Partner (for agencies serving ${friendly} clients). Each comes with a verifiable credential and LinkedIn share.`,
    },
    {
      q: `Do you partner with colleges?`,
      a: `Yes. GoFunnelAI for Education is free for accredited institutions, including HBCUs and community colleges. We integrate with Canvas, Blackboard, and Moodle via LTI 1.3, and ship a 12-week curriculum-in-a-box.`,
    },
  ];
}

function humanizeIndustry(v: IndustryVertical): string {
  return v
    .split("_")
    .map((w) => (w === "pi" ? "Personal Injury" : w[0]?.toUpperCase() + w.slice(1)))
    .join(" ");
}

/* ===== Sitemap ======================================================== */

export interface SitemapEntry {
  loc: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: number;
}

export function renderSitemapXml(entries: SitemapEntry[]): string {
  const items = entries.map((e) => {
    const parts = [`    <loc>${escapeXml(e.loc)}</loc>`];
    if (e.lastmod) parts.push(`    <lastmod>${e.lastmod}</lastmod>`);
    if (e.changefreq) parts.push(`    <changefreq>${e.changefreq}</changefreq>`);
    if (e.priority !== undefined) parts.push(`    <priority>${e.priority.toFixed(1)}</priority>`);
    return `  <url>\n${parts.join("\n")}\n  </url>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items.join("\n")}\n</urlset>`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Build the full Academy sitemap from courses + industry landing pages. */
export function buildAcademySitemap(args: {
  base_url: string;
  pages: AcademySeoPage[];
}): string {
  const entries: SitemapEntry[] = args.pages.map((p) => ({
    loc: `${args.base_url}${p.url_path}`,
    lastmod: p.last_rendered_at ?? undefined,
    changefreq: "weekly",
    priority: 0.7,
  }));
  // Always include the catalog root.
  entries.unshift({ loc: `${args.base_url}/academy`, changefreq: "daily", priority: 0.9 });
  return renderSitemapXml(entries);
}

const PublishSeoSchema = z.object({
  course_id: z.string().min(1),
  url_path: z.string().regex(/^\/academy\/[a-z0-9-]+$/),
  title: z.string().max(80),
  meta_description: z.string().max(180),
  primary_keyword: z.string().min(1),
});

export async function publishCourseSeoPage(
  page: AcademySeoPage,
  store: SeoStore,
): Promise<AcademySeoPage> {
  PublishSeoSchema.parse({
    course_id: page.course_id,
    url_path: page.url_path,
    title: page.title,
    meta_description: page.meta_description,
    primary_keyword: page.primary_keyword,
  });
  return store.upsertPage(page);
}
