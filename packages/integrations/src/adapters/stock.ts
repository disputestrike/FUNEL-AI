/**
 * Licensed-stock image adapter — Unsplash (primary) + Pexels (fallback).
 *
 * Returns license metadata + attribution per image so the rendered funnel can
 * comply with the licensor's terms (Unsplash requires download tracking +
 * photographer credit on free-tier funnels; Pexels requires attribution).
 *
 * Env:
 *   UNSPLASH_ACCESS_KEY — required for Unsplash search/track endpoints.
 *   PEXELS_API_KEY      — required for Pexels search.
 */

export type StockSource = "unsplash" | "pexels";

export type StockLicense =
  | "unsplash_license_v1"
  | "pexels_free_license"
  | "unknown_free_license";

export interface StockSearchInput {
  /** Free-text concept query (e.g. "solar panels suburban roof"). */
  query: string;
  /** Optional industry hint, used to bias keywords (e.g. "solar"). */
  industry?: string;
  /** Aspect orientation. */
  orientation?: "landscape" | "portrait" | "squarish";
  /** Per_page (1-30). */
  perPage?: number;
  abortSignal?: AbortSignal;
}

export interface StockImage {
  url: string;
  thumbUrl: string;
  width: number;
  height: number;
  source: StockSource;
  license: StockLicense;
  attribution: {
    photographer: string;
    photographerUrl?: string;
    sourceUrl: string;
    /** Pre-rendered text suitable for footer credit lines. */
    htmlCredit: string;
  };
  /** Provider download/tracking endpoint to call before display (Unsplash requirement). */
  trackDownloadUrl?: string;
}

export interface StockClientConfig {
  unsplashAccessKey?: string;
  pexelsApiKey?: string;
  fetchImpl?: typeof fetch;
}

export class StockClient {
  private readonly unsplashKey: string;
  private readonly pexelsKey: string;
  private readonly fetchImpl: typeof fetch;

  constructor(cfg: StockClientConfig = {}) {
    this.unsplashKey = cfg.unsplashAccessKey ?? process.env["UNSPLASH_ACCESS_KEY"] ?? "";
    this.pexelsKey = cfg.pexelsApiKey ?? process.env["PEXELS_API_KEY"] ?? "";
    this.fetchImpl = cfg.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  hasAnyKey(): boolean {
    return this.unsplashKey.length > 0 || this.pexelsKey.length > 0;
  }

  /**
   * Search providers in order (Unsplash → Pexels) and return the first hit.
   * Throws if no provider returns a result OR no keys are configured.
   */
  async search(input: StockSearchInput): Promise<StockImage> {
    const q = composeQuery(input.query, input.industry);
    const errors: string[] = [];

    if (this.unsplashKey) {
      try {
        const hit = await this.searchUnsplash(q, input);
        if (hit) return hit;
      } catch (err) {
        errors.push(`unsplash: ${String(err)}`);
      }
    }
    if (this.pexelsKey) {
      try {
        const hit = await this.searchPexels(q, input);
        if (hit) return hit;
      } catch (err) {
        errors.push(`pexels: ${String(err)}`);
      }
    }
    throw new Error(`Stock search failed for "${q}". ${errors.join(" | ") || "no keys configured"}`);
  }

  /** Call Unsplash's download-tracking endpoint per their API guidelines. */
  async trackDownload(image: StockImage): Promise<void> {
    if (!image.trackDownloadUrl || !this.unsplashKey) return;
    try {
      await this.fetchImpl(image.trackDownloadUrl, {
        headers: { Authorization: `Client-ID ${this.unsplashKey}` },
      });
    } catch {
      // best-effort; non-blocking
    }
  }

  private async searchUnsplash(query: string, input: StockSearchInput): Promise<StockImage | undefined> {
    const params = new URLSearchParams({
      query,
      per_page: String(input.perPage ?? 5),
      orientation: input.orientation ?? "landscape",
      content_filter: "high",
    });
    const res = await this.fetchImpl(`https://api.unsplash.com/search/photos?${params.toString()}`, {
      headers: { Authorization: `Client-ID ${this.unsplashKey}`, "Accept-Version": "v1" },
      signal: input.abortSignal,
    });
    if (!res.ok) {
      throw new Error(`Unsplash search ${res.status}`);
    }
    const json = (await res.json()) as {
      results?: Array<{
        id: string;
        urls: { regular: string; small: string; thumb: string };
        width: number;
        height: number;
        links: { html: string; download_location: string };
        user: { name: string; links: { html: string } };
      }>;
    };
    const first = json.results?.[0];
    if (!first) return undefined;

    const photographer = first.user.name;
    const photographerUrl = `${first.user.links.html}?utm_source=gofunnelai&utm_medium=referral`;
    const sourceUrl = `${first.links.html}?utm_source=gofunnelai&utm_medium=referral`;
    return {
      url: first.urls.regular,
      thumbUrl: first.urls.thumb,
      width: first.width,
      height: first.height,
      source: "unsplash",
      license: "unsplash_license_v1",
      attribution: {
        photographer,
        photographerUrl,
        sourceUrl,
        htmlCredit: `Photo by <a href="${photographerUrl}">${escapeHtml(photographer)}</a> on <a href="${sourceUrl}">Unsplash</a>`,
      },
      trackDownloadUrl: first.links.download_location,
    };
  }

  private async searchPexels(query: string, input: StockSearchInput): Promise<StockImage | undefined> {
    const params = new URLSearchParams({
      query,
      per_page: String(input.perPage ?? 5),
      orientation: input.orientation ?? "landscape",
    });
    const res = await this.fetchImpl(`https://api.pexels.com/v1/search?${params.toString()}`, {
      headers: { Authorization: this.pexelsKey },
      signal: input.abortSignal,
    });
    if (!res.ok) {
      throw new Error(`Pexels search ${res.status}`);
    }
    const json = (await res.json()) as {
      photos?: Array<{
        id: number;
        width: number;
        height: number;
        url: string;
        photographer: string;
        photographer_url: string;
        src: { large2x: string; large: string; medium: string; tiny: string };
      }>;
    };
    const first = json.photos?.[0];
    if (!first) return undefined;
    return {
      url: first.src.large2x ?? first.src.large,
      thumbUrl: first.src.tiny ?? first.src.medium,
      width: first.width,
      height: first.height,
      source: "pexels",
      license: "pexels_free_license",
      attribution: {
        photographer: first.photographer,
        photographerUrl: first.photographer_url,
        sourceUrl: first.url,
        htmlCredit: `Photo by <a href="${first.photographer_url}">${escapeHtml(first.photographer)}</a> on <a href="${first.url}">Pexels</a>`,
      },
    };
  }
}

/** Bias the query with industry-specific concept keywords. */
function composeQuery(query: string, industry?: string): string {
  const hint = industry ? INDUSTRY_KEYWORDS[industry.toLowerCase()] : undefined;
  if (!hint) return query;
  return `${query} ${hint}`;
}

const INDUSTRY_KEYWORDS: Record<string, string> = {
  solar: "solar panel rooftop home",
  hvac: "HVAC technician home repair",
  real_estate: "modern home exterior",
  coaching: "professional mentor desk",
  fitness: "athlete training gym",
  med_spa: "spa treatment clean clinic",
  cosmetic_surgery: "modern aesthetic clinic",
  dental: "dental office clean smile",
  chiropractic: "chiropractor adjustment patient",
  insurance: "professional advisor office",
  mortgage: "house keys couple home",
  financial_advisor: "advisor laptop charts",
  legal: "law office professional",
  saas: "modern office workspace laptop",
  ecommerce: "product flatlay studio light",
  agency: "creative team meeting",
  education: "students classroom learning",
  home_services: "contractor home exterior",
  supplements: "wellness product flatlay",
  info_products: "creator desk laptop",
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
