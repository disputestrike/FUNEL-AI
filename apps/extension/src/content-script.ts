/**
 * Content script â€” injected on every page.
 *
 * Three jobs:
 *   1. If the page is one of the user's own GoFunnelAI funnels (matched by
 *      data-funnel-id meta tag), render a small floating badge with the
 *      current Grader score.
 *   2. If the page looks like a competitor funnel (CF/GHL/Leadpages/Unbounce),
 *      show a non-modal "Import this funnel" pill at the bottom-right.
 *   3. Detect form submissions and forward the captured fields up to the
 *      background worker, which calls /webhooks/form-submit via @funnel/sdk.
 *
 * Everything is scoped under a single shadow root host element to avoid
 * stomping on the host page's styles.
 */

import { detectCompetitorPage, extractSkeleton } from "./import"

const HOST_ID = "__funnel-ai-host"

;(function bootstrap() {
  if (window.self !== window.top) return // don't run inside iframes
  if (document.getElementById(HOST_ID)) return // already injected
  if (location.protocol !== "http:" && location.protocol !== "https:") return

  const host = document.createElement("div")
  host.id = HOST_ID
  host.style.cssText = "all: initial; position: fixed; z-index: 2147483647;"
  document.documentElement.appendChild(host)
  const shadow = host.attachShadow({ mode: "closed" })

  injectStyles(shadow)
  maybeRenderOwnerBadge(shadow)
  maybeRenderCompetitorPill(shadow)
  wireFormCapture()
})()

function injectStyles(shadow: ShadowRoot) {
  const style = document.createElement("style")
  style.textContent = `
    .funnel-badge, .funnel-pill {
      position: fixed; right: 16px; font-family: -apple-system, "Segoe UI", sans-serif;
      font-size: 13px; line-height: 1.3; color: #fff; border-radius: 9999px;
      box-shadow: 0 8px 24px rgba(0,0,0,.18); cursor: pointer; user-select: none;
      backdrop-filter: blur(6px);
    }
    .funnel-badge { bottom: 16px; padding: 10px 14px; background: linear-gradient(135deg,#6d28d9,#7c3aed); }
    .funnel-badge.warn { background: linear-gradient(135deg,#d97706,#f59e0b); }
    .funnel-badge.bad  { background: linear-gradient(135deg,#dc2626,#ef4444); }
    .funnel-pill { bottom: 16px; padding: 10px 14px; background: rgba(17,24,39,.92); }
    .funnel-pill b { color: #c4b5fd; }
    .funnel-pill .x { margin-left: 8px; opacity: .6; }
  `
  shadow.appendChild(style)
}

function maybeRenderOwnerBadge(shadow: ShadowRoot) {
  const meta = document.querySelector('meta[name="funnel-ai:funnel-id"]')
  const funnelId = meta?.getAttribute("content")
  if (!funnelId) return

  const badge = document.createElement("div")
  badge.className = "funnel-badge"
  badge.textContent = "GoFunnelAI â€” loading score..."
  badge.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "open-funnel", funnelId })
  })
  shadow.appendChild(badge)

  chrome.runtime.sendMessage({ type: "owner-page", funnelId, url: location.href }, (resp) => {
    if (!resp?.score) return
    const s = resp.score.overall as number
    badge.textContent = `GoFunnelAI score: ${s}/100`
    if (s < 50) badge.classList.add("bad")
    else if (s < 75) badge.classList.add("warn")
  })
}

function maybeRenderCompetitorPill(shadow: ShadowRoot) {
  const detection = detectCompetitorPage(location.href, document.documentElement.outerHTML)
  if (!detection) return

  const skeleton = extractSkeleton(document)
  const pill = document.createElement("div")
  pill.className = "funnel-pill"
  pill.innerHTML =
    `Looks like a <b>${detection.platform}</b> funnel â€” ` +
    `<u>import to GoFunnelAI</u> (${skeleton.formCount} forms, ${skeleton.ctaCount} CTAs) ` +
    `<span class="x">Ã—</span>`
  pill.addEventListener("click", (e) => {
    if ((e.target as HTMLElement)?.classList.contains("x")) {
      pill.remove()
      return
    }
    chrome.runtime.sendMessage({
      type: "import-request",
      url: location.href,
      platform: detection.platform,
    })
  })
  shadow.appendChild(pill)

  chrome.runtime.sendMessage({ type: "competitor-detected", platform: detection.platform })
}

function wireFormCapture() {
  // Listen at the capture phase so we still see the values when frameworks
  // (Webflow/Shopify/etc.) cancel the bubble phase.
  document.addEventListener(
    "submit",
    (e) => {
      const form = e.target as HTMLFormElement
      if (!form || form.tagName !== "FORM") return
      const fields: Record<string, string> = {}
      for (const el of Array.from(form.elements) as HTMLInputElement[]) {
        if (!el.name || el.type === "password" || el.type === "submit") continue
        fields[el.name] = el.value
      }
      const funnelId =
        document.querySelector('meta[name="funnel-ai:funnel-id"]')?.getAttribute("content") ?? undefined
      chrome.runtime
        .sendMessage({
          type: "form-submitted",
          payload: { url: location.href, fields, funnelId },
        })
        .catch(() => {})
    },
    true,
  )

  // Also send a one-shot "form-detected" message so the inbox sidebar can
  // offer a "Save this form to CRM" hint without a submit needing to happen.
  const forms = document.querySelectorAll("form")
  if (forms.length > 0) {
    chrome.runtime.sendMessage({
      type: "form-detected",
      payload: {
        url: location.href,
        fields: Array.from(forms[0]!.querySelectorAll("input,select,textarea"))
          .map((el) => (el as HTMLInputElement).name)
          .filter(Boolean),
      },
    })
  }
}
