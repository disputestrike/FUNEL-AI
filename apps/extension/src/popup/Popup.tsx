/**
 * Popup â€” opens when the user clicks the toolbar icon.
 *
 * Three primary actions, in priority order:
 *   1. Audit this page (calls Grader)
 *   2. Save this funnel (adds to inspiration library)
 *   3. See what we'd generate (preview)
 *
 * Login state lives in @plasmohq/storage and is mirrored into the Zustand
 * session store. If the user isn't logged in we replace the action stack
 * with a single "Sign in to GoFunnelAI" button that triggers the OAuth flow.
 */

import React, { useEffect, useState } from "react"
import { Button, Card, Stack, Score, Spinner } from "@funnel/ui"
import { client } from "../sdk-client"
import { getCurrentUser, login, logout, type FunnelUser } from "../auth"
import { useAudit } from "../store"

export function Popup() {
  const [user, setUser] = useState<FunnelUser | null>(null)
  const [tabUrl, setTabUrl] = useState<string>("")
  const { loading, score, error, setLoading, setScore, setError } = useAudit()

  useEffect(() => {
    void getCurrentUser().then(setUser)
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (tab?.url) setTabUrl(tab.url)
    })
  }, [])

  if (!user) {
    return (
      <Card title="GoFunnelAI" subtitle="Audit and save funnels from any page">
        <Stack gap={12}>
          <p style={{ margin: 0, fontSize: 13, color: "#52525b" }}>
            Sign in to your GoFunnelAI workspace to audit pages, save funnels for inspiration,
            and import competitor funnels with one click.
          </p>
          <Button
            variant="primary"
            onClick={async () => {
              try {
                const u = await login()
                setUser(u)
              } catch (e) {
                setError(e instanceof Error ? e.message : String(e))
              }
            }}>
            Sign in to GoFunnelAI
          </Button>
          {error && <p style={{ color: "#dc2626", fontSize: 12 }}>{error}</p>}
        </Stack>
      </Card>
    )
  }

  async function runAudit() {
    if (!tabUrl) return
    setLoading(tabUrl)
    try {
      const result = await client().grader.auditUrl(tabUrl)
      setScore(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  async function saveFunnel() {
    if (!tabUrl) return
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.id) return
    const [{ result: html } = { result: "" }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => document.documentElement.outerHTML,
    })
    await client().funnels.saveInspiration({
      url: tabUrl,
      html: html ?? "",
      capturedAt: new Date().toISOString(),
    })
  }

  async function previewGenerate() {
    if (!tabUrl) return
    const preview = await client().generator.previewFromUrl(tabUrl)
    chrome.tabs.create({ url: preview.editorUrl })
  }

  function openSidePanel() {
    chrome.windows.getCurrent((w) => {
      if (w.id) chrome.sidePanel.open({ windowId: w.id })
    })
  }

  return (
    <Card
      title={`Hi, ${user.name.split(" ")[0]}`}
      subtitle={user.workspaceName}
      headerAction={
        <button
          style={{ background: "none", border: 0, color: "#71717a", fontSize: 12, cursor: "pointer" }}
          onClick={async () => {
            await logout()
            setUser(null)
          }}>
          Sign out
        </button>
      }>
      <Stack gap={10}>
        <Button variant="primary" disabled={loading} onClick={runAudit}>
          {loading ? <Spinner size={14} /> : "Audit this page"}
        </Button>
        <Button variant="secondary" onClick={saveFunnel}>
          Save this funnel
        </Button>
        <Button variant="secondary" onClick={previewGenerate}>
          See what we'd generate
        </Button>
        <Button variant="ghost" onClick={openSidePanel}>
          Open lead inbox â†’
        </Button>

        {error && <p style={{ color: "#dc2626", fontSize: 12 }}>{error}</p>}

        {score && (
          <Card variant="inset" title="Grader result">
            <Stack gap={6}>
              <Score label="Overall" value={score.overall} />
              <Score label="Copy" value={score.copy} compact />
              <Score label="Design" value={score.design} compact />
              <Score label="CTA" value={score.cta} compact />
              <Score label="Speed" value={score.speed} compact />
              <hr style={{ border: 0, borderTop: "1px solid #e4e4e7", margin: "6px 0" }} />
              <strong style={{ fontSize: 12 }}>Top improvements</strong>
              <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: "#3f3f46" }}>
                {score.improvements.slice(0, 3).map((tip, i) => (
                  <li key={i}>{tip}</li>
                ))}
              </ul>
            </Stack>
          </Card>
        )}
      </Stack>
    </Card>
  )
}
