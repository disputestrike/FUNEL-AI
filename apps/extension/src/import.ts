/**
 * Detect & extract competitor funnel structure from a page.
 *
 * The heavy ETL â€” turning raw HTML into GoFunnelAI's canonical funnel JSON
 * (blocks, copy, CTAs, theme tokens) â€” runs server-side in apps/api. The
 * browser extension's job is to:
 *   1. Recognize that the current page is a CF/GHL/Leadpages/Unbounce funnel.
 *   2. Send the URL + HTML to /imports/from-competitor on the API.
 *   3. Show a one-click "Import this funnel" affordance.
 *
 * Detection is intentionally a lightweight signature scan â€” we treat false
 * positives as cheap (user just won't click the prompt) and false negatives
 * as more expensive (we miss a valuable import).
 */

export type CompetitorPlatform = "clickfunnels" | "gohighlevel" | "leadpages" | "unbounce"

export interface CompetitorDetection {
  platform: CompetitorPlatform
  confidence: number // 0..1
  signals: string[]
}

interface Signature {
  platform: CompetitorPlatform
  hostPattern?: RegExp
  htmlMarkers: string[]
}

const SIGNATURES: Signature[] = [
  {
    platform: "clickfunnels",
    hostPattern: /(clickfunnels\.com|cfpages\.com|myclickfunnels\.com)/i,
    htmlMarkers: [
      "data-cf-page",
      "cf-page-content",
      "/clickfunnels-assets/",
      "ClickFunnels.PageData",
      "etison",
    ],
  },
  {
    platform: "gohighlevel",
    hostPattern: /(gohighlevel\.com|msgsndr\.com|leadconnectorhq\.com)/i,
    htmlMarkers: [
      "data-hl-",
      "highlevel-funnels",
      "lc-funnel",
      "ghl-page-id",
      "leadconnector",
    ],
  },
  {
    platform: "leadpages",
    hostPattern: /(leadpages\.(co|net|com)|lpages\.co)/i,
    htmlMarkers: [
      "leadpages-page",
      "lp-positionable",
      "data-lp-widget",
      "lp-pom-block",
    ],
  },
  {
    platform: "unbounce",
    hostPattern: /(unbounce\.com|unbouncepages\.com)/i,
    htmlMarkers: [
      "ub-page",
      "ub-emb",
      "data-ub-",
      "unbounce-page-content",
      "unbouncepages",
    ],
  },
]

export function detectCompetitorPage(url: string, html: string): CompetitorDetection | null {
  let best: CompetitorDetection | null = null
  for (const sig of SIGNATURES) {
    const signals: string[] = []
    if (sig.hostPattern && sig.hostPattern.test(url)) signals.push(`host:${sig.platform}`)
    for (const marker of sig.htmlMarkers) {
      if (html.includes(marker)) signals.push(`marker:${marker}`)
    }
    if (signals.length === 0) continue
    const confidence = Math.min(1, signals.length / (1 + sig.htmlMarkers.length / 2))
    if (!best || confidence > best.confidence) {
      best = { platform: sig.platform, confidence, signals }
    }
  }
  return best && best.confidence >= 0.3 ? best : null
}

/**
 * Extract a coarse structural skeleton purely client-side, before shipping
 * the full HTML to the server. Lets the popup preview "we found 5 sections,
 * 2 forms, 1 video" without waiting on a round trip.
 */
export interface PageSkeleton {
  title: string
  headings: { level: number; text: string }[]
  formCount: number
  ctaCount: number
  videoCount: number
  imageCount: number
}

export function extractSkeleton(doc: Document): PageSkeleton {
  const headings = Array.from(doc.querySelectorAll("h1,h2,h3"))
    .slice(0, 30)
    .map((h) => ({ level: Number(h.tagName.slice(1)), text: (h.textContent ?? "").trim() }))
  const forms = doc.querySelectorAll("form")
  const ctas = doc.querySelectorAll(
    'a[href*="checkout"], a[href*="signup"], button[type="submit"], a[class*="btn"], a[class*="cta"]',
  )
  return {
    title: doc.title,
    headings,
    formCount: forms.length,
    ctaCount: ctas.length,
    videoCount: doc.querySelectorAll("video, iframe[src*='youtube'], iframe[src*='vimeo']").length,
    imageCount: doc.querySelectorAll("img").length,
  }
}
