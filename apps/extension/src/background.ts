/**
 * MV3 service worker.
 *
 * Responsibilities:
 *   1. Register right-click context menus ("Audit this page with GoFunnelAI",
 *      "Save funnel structure", "Import competitor funnel").
 *   2. Open the side panel on toolbar action click.
 *   3. Listen for messages from content scripts (form-detected, competitor-funnel-detected).
 *   4. Forward form submissions captured anywhere on the web to /webhooks/form-submit
 *      via @funnel/sdk so the speed-to-lead pipeline picks them up.
 *
 * Notes:
 *   - Service worker may be torn down at any moment — all state lives in
 *     chrome.storage via @plasmohq/storage and the auth module.
 *   - No SendGrid/Twilio anywhere; lead routing is purely @funnel/sdk.
 */

import { client } from "./sdk-client"
import { detectCompetitorPage } from "./import"
import { getCurrentUser } from "./auth"

const MENU_AUDIT = "funnel-audit"
const MENU_SAVE = "funnel-save"
const MENU_IMPORT = "funnel-import"

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_AUDIT,
    title: "Audit this page with GoFunnelAI",
    contexts: ["page", "link"],
  })
  chrome.contextMenus.create({
    id: MENU_SAVE,
    title: "Save this funnel for inspiration",
    contexts: ["page"],
  })
  chrome.contextMenus.create({
    id: MENU_IMPORT,
    title: "Import this funnel into GoFunnelAI",
    contexts: ["page"],
  })
})

chrome.action.onClicked.addListener((tab) => {
  // The popup is the default click target; this fires only if popup is empty.
  if (tab.windowId) chrome.sidePanel.open({ windowId: tab.windowId })
})

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id || !tab.url) return
  try {
    switch (info.menuItemId) {
      case MENU_AUDIT:
        await runAudit(tab.id, tab.url)
        break
      case MENU_SAVE:
        await saveFunnel(tab.id, tab.url)
        break
      case MENU_IMPORT:
        await importFunnel(tab.id, tab.url)
        break
    }
  } catch (err) {
    console.error("[gofunnelai.com] context menu action failed", err)
    notify("GoFunnelAI", err instanceof Error ? err.message : String(err))
  }
})

async function runAudit(tabId: number, url: string) {
  const sdk = client()
  const score = await sdk.grader.auditUrl(url)
  await chrome.storage.session.set({ [`audit:${tabId}`]: score })
  chrome.runtime.sendMessage({ type: "audit-complete", tabId, score }).catch(() => {})
  notify("Audit complete", `Overall score: ${score.overall}/100`)
}

async function saveFunnel(tabId: number, url: string) {
  const sdk = client()
  // Pull the page DOM via scripting so we don't depend on a content script
  // being injected — context menu can fire on edge-case pages where the
  // content-script match patterns don't apply (e.g. file:// or extensions).
  const [{ result: html } = { result: "" }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => document.documentElement.outerHTML,
  })
  await sdk.funnels.saveInspiration({ url, html: html ?? "", capturedAt: new Date().toISOString() })
  notify("Saved", "Added to your GoFunnelAI inspiration library")
}

async function importFunnel(tabId: number, url: string) {
  const [{ result: html } = { result: "" }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => document.documentElement.outerHTML,
  })
  const detection = detectCompetitorPage(url, html ?? "")
  if (!detection) {
    notify("No competitor funnel detected", "We couldn't find CF/GHL/Leadpages/Unbounce markers on this page.")
    return
  }
  const sdk = client()
  const imported = await sdk.imports.fromCompetitor({
    source: detection.platform,
    url,
    html: html ?? "",
  })
  notify("Imported", `Created funnel “${imported.name}” from ${detection.platform}`)
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Messages from content scripts.
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "form-detected") {
    handleFormDetected(msg.payload).catch((e) => console.error(e))
    return false
  }
  if (msg?.type === "form-submitted") {
    handleFormSubmitted(msg.payload).then(sendResponse).catch((e) => sendResponse({ ok: false, error: String(e) }))
    return true // keep channel open for async response
  }
  if (msg?.type === "competitor-detected") {
    chrome.action.setBadgeText({ text: "•", tabId: msg.tabId })
    chrome.action.setBadgeBackgroundColor({ color: "#7c3aed", tabId: msg.tabId })
    return false
  }
  return false
})

async function handleFormDetected(payload: { url: string; fields: string[] }) {
  // Tell the inbox UI a form was sighted; useful for the "Save to CRM" hint.
  chrome.runtime.sendMessage({ type: "form-sighting", payload }).catch(() => {})
}

async function handleFormSubmitted(payload: {
  url: string
  fields: Record<string, string>
  funnelId?: string
}) {
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: "not authenticated" }
  const sdk = client()
  await sdk.webhooks.formSubmit({
    surface: "browser-extension",
    workspaceId: user.workspaceId,
    funnelId: payload.funnelId,
    pageUrl: payload.url,
    fields: payload.fields,
    capturedAt: new Date().toISOString(),
  })
  return { ok: true }
}

function notify(title: string, message: string) {
  if (!chrome.notifications) return
  chrome.notifications.create({
    type: "basic",
    iconUrl: "icons/icon128.png",
    title,
    message,
  })
}
