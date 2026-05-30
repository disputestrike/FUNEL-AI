/**
 * Browser Rendering wrapper: load a URL, screenshot, snapshot DOM, run
 * lightweight Lighthouse-equivalent timing collection (LCP, FCP, CLS, TTI).
 *
 * Outputs:
 *  - screenshotPng (Uint8Array, full viewport 1440x900)
 *  - html (serialized DOM, scripts/styles stripped)
 *  - text (visible text only, max 50KB)
 *  - meta (title, description, og:image)
 *  - forms (array of detected forms with field types)
 *  - timing (web-vitals approximations)
 */

import puppeteer, { type Browser } from "@cloudflare/puppeteer";

import { VIEWPORT } from "@funnel/shared";

import type { Env } from "./env.js";

export interface ScrapeResult {
  screenshotPng: Uint8Array;
  html: string;
  text: string;
  meta: { title: string | null; description: string | null; og_image: string | null };
  forms: Array<{
    field_count: number;
    field_types: string[];
    submit_label: string | null;
    has_phone: boolean;
    has_credit_card: boolean;
  }>;
  timing: {
    fcp_ms: number;
    lcp_ms: number;
    cls: number;
    tti_ms: number;
  };
  domBytes: number;
}

const RENDER_TIMEOUT_MS = 12_000;

export async function scrape(env: Env, url: string): Promise<ScrapeResult> {
  const browser = (await puppeteer.launch(env.BROWSER)) as unknown as Browser;
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: VIEWPORT.w, height: VIEWPORT.h });
    await page.setUserAgent(
      "Mozilla/5.0 (compatible; FunnelGraderBot/0.1; +https://gofunnelai.com/grade)",
    );
    await page.setExtraHTTPHeaders({ "Accept-Language": "en-US,en;q=0.9" });

    const response = await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: RENDER_TIMEOUT_MS,
    });

    const status = response?.status() ?? 0;
    if (status >= 400) {
      throw new Error(`target_returned_${status}`);
    }

    // Capture web-vitals approximations.
    const timing = await page.evaluate(() => {
      const navEntry = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      const fcpEntry = performance.getEntriesByName("first-contentful-paint")[0] as PerformanceEntry | undefined;
      const lcpEntries = performance.getEntriesByType("largest-contentful-paint") as PerformanceEntry[];
      const lcp = lcpEntries.length ? lcpEntries[lcpEntries.length - 1]!.startTime : 0;
      const fcp = fcpEntry?.startTime ?? 0;
      const tti = navEntry?.domInteractive ?? 0;
      const cls =
        (
          (performance.getEntriesByType("layout-shift") as Array<{ value: number; hadRecentInput?: boolean }>)
            .filter((e) => !e.hadRecentInput)
            .reduce((acc, e) => acc + (e.value ?? 0), 0)
        ) ?? 0;
      return { fcp_ms: Math.round(fcp), lcp_ms: Math.round(lcp), cls: Number(cls.toFixed(3)), tti_ms: Math.round(tti) };
    });

    const screenshotPng = (await page.screenshot({
      type: "png",
      fullPage: false,
    })) as Uint8Array;

    const html = await page.evaluate(() => {
      const clone = document.documentElement.cloneNode(true) as HTMLElement;
      clone.querySelectorAll("script, style, noscript, link[rel='stylesheet']").forEach((n) => n.remove());
      return clone.outerHTML;
    });
    const truncatedHtml = html.length > 200_000 ? html.slice(0, 200_000) : html;

    const text = (await page.evaluate(() => document.body?.innerText ?? "")).slice(0, 50_000);

    const meta = await page.evaluate(() => ({
      title: document.title || null,
      description:
        document.querySelector('meta[name="description"]')?.getAttribute("content") || null,
      og_image: document.querySelector('meta[property="og:image"]')?.getAttribute("content") || null,
    }));

    const forms = (await page.evaluate(() => {
      const out: Array<{
        field_count: number;
        field_types: string[];
        submit_label: string | null;
        has_phone: boolean;
        has_credit_card: boolean;
      }> = [];
      document.querySelectorAll("form").forEach((form) => {
        const inputs = Array.from(form.querySelectorAll("input,select,textarea")) as HTMLInputElement[];
        const fieldTypes = inputs.map((i) => (i.getAttribute("type") || i.tagName).toLowerCase());
        const submit =
          (form.querySelector("button[type='submit'],input[type='submit']") as HTMLElement | null) ??
          (form.querySelector("button") as HTMLElement | null);
        out.push({
          field_count: inputs.length,
          field_types: fieldTypes,
          submit_label: submit?.textContent?.trim() || submit?.getAttribute("value") || null,
          has_phone: fieldTypes.includes("tel"),
          has_credit_card: inputs.some((i) =>
            /(card|credit|cvv|ccnum|cc-)/i.test(`${i.name} ${i.id} ${i.autocomplete}`),
          ),
        });
      });
      return out;
    })) as ScrapeResult["forms"];

    return {
      screenshotPng,
      html: truncatedHtml,
      text,
      meta,
      forms,
      timing,
      domBytes: truncatedHtml.length,
    };
  } finally {
    try {
      await browser.close();
    } catch {
      /* best effort */
    }
  }
}

/** Upload screenshot to R2, return the key (signed URL constructed at read time). */
export async function uploadScreenshot(env: Env, auditId: string, png: Uint8Array): Promise<string> {
  const key = `screenshots/${auditId}.png`;
  await env.ASSETS.put(key, png, {
    httpMetadata: { contentType: "image/png", cacheControl: "public, max-age=31536000, immutable" },
  });
  return key;
}
