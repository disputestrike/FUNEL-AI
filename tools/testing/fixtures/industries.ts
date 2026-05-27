/**
 * 30 industries × 10 sample BusinessProfile fixtures = 300 profiles.
 * Generated programmatically with a deterministic RNG (see ../random.ts)
 * so each run is identical.
 */
import { nextInt, pickOne, seedRandom } from "../random";

seedRandom(0xfb91_1nd >>> 0);

export const INDUSTRIES = [
  "ecommerce",
  "saas",
  "coaching",
  "real-estate",
  "fitness",
  "beauty",
  "legal",
  "medical",
  "dental",
  "chiropractic",
  "financial-advisor",
  "insurance",
  "auto-dealer",
  "home-services",
  "restaurant",
  "cannabis",
  "crypto",
  "agency",
  "education",
  "non-profit",
  "b2b-services",
  "manufacturing",
  "consulting",
  "veterinary",
  "construction",
  "interior-design",
  "wedding",
  "events",
  "travel",
  "media",
] as const;
export type Industry = (typeof INDUSTRIES)[number];

/** Regulated verticals — Compliance agent should require human review. */
export const REGULATED_INDUSTRIES: ReadonlySet<Industry> = new Set([
  "legal",
  "medical",
  "dental",
  "chiropractic",
  "financial-advisor",
  "insurance",
  "cannabis",
  "crypto",
]);

export interface BusinessProfileFixture {
  id: string;
  industry: Industry;
  business_name: string;
  city: string;
  offer: string;
  price_usd: number;
  audience: string;
  url: string;
  is_regulated: boolean;
}

const CITIES = ["Austin", "Denver", "Seattle", "Boston", "Miami", "Portland", "Chicago", "Atlanta", "Phoenix", "Nashville"];

function genOne(industry: Industry, idx: number): BusinessProfileFixture {
  const city = pickOne(CITIES);
  return {
    id: `bp_${industry}_${idx}`,
    industry,
    business_name: `${industry.replace(/-/g, " ")} #${idx} of ${city}`,
    city,
    offer: `Premium ${industry} offer for ${city} residents`,
    price_usd: 49 + nextInt(950),
    audience: `${city}-area ${industry} buyers, age 25-54`,
    url: `https://example-${industry}-${idx}.test`,
    is_regulated: REGULATED_INDUSTRIES.has(industry),
  };
}

export const BUSINESS_PROFILES: BusinessProfileFixture[] = INDUSTRIES.flatMap((ind) =>
  Array.from({ length: 10 }, (_, i) => genOne(ind, i + 1)),
);

export function profilesByIndustry(ind: Industry): BusinessProfileFixture[] {
  return BUSINESS_PROFILES.filter((p) => p.industry === ind);
}
