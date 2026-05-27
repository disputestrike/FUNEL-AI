/**
 * Options page â€” opens in a full tab via chrome.runtime.openOptionsPage().
 *
 * Controls:
 *   - Toggle the on-page badge for owned funnels.
 *   - Toggle the competitor-funnel detection pill.
 *   - Toggle "auto-detect form fields for save-to-CRM".
 *   - Default funnel for form captures (falls back to "ungated inbox").
 *   - Sign out.
 */

import React, { useEffect, useState } from "react"
import { Storage } from "@plasmohq/storage"
import { Card, Stack, Toggle, Select, Button } from "@funnel/ui"
import { client } from "../sdk-client"
import { getCurrentUser, logout, type FunnelUser } from "../auth"

const storage = new Storage({ area: "local" })

interface Prefs {
  showOwnerBadge: boolean
  showCompetitorPill: boolean
  autoDetectForms: boolean
  defaultFunnelId: string | null
}

const DEFAULTS: Prefs = {
  showOwnerBadge: true,
  showCompetitorPill: true,
  autoDetectForms: true,
  defaultFunnelId: null,
}

export function Options() {
  const [user, setUser] = useState<FunnelUser | null>(null)
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS)
  const [funnels, setFunnels] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    void getCurrentUser().then(setUser)
    void storage.get("prefs").then((v) => v && setPrefs(v as Prefs))
    void client()
      .funnels.list()
      .then((list) => setFunnels(list.map((f) => ({ id: f.id, name: f.name }))))
      .catch(() => setFunnels([]))
  }, [])

  function update<K extends keyof Prefs>(key: K, value: Prefs[K]) {
    const next = { ...prefs, [key]: value }
    setPrefs(next)
    void storage.set("prefs", next)
  }

  return (
    <div style={{ maxWidth: 720, margin: "40px auto", padding: 24, fontFamily: '-apple-system, "Segoe UI", sans-serif' }}>
      <h1 style={{ fontSize: 24, marginBottom: 24 }}>GoFunnelAI extension settings</h1>

      <Stack gap={16}>
        <Card title="Account">
          {user ? (
            <Stack direction="row" align="center" gap={12}>
              <div style={{ flex: 1 }}>
                <strong>{user.name}</strong>
                <div style={{ fontSize: 13, color: "#71717a" }}>
                  {user.email} Â· {user.workspaceName}
                </div>
              </div>
              <Button
                variant="secondary"
                onClick={async () => {
                  await logout()
                  setUser(null)
                }}>
                Sign out
              </Button>
            </Stack>
          ) : (
            <p>Open the extension popup to sign in.</p>
          )}
        </Card>

        <Card title="On-page features">
          <Stack gap={10}>
            <Toggle
              label="Show Grader badge on my own funnels"
              checked={prefs.showOwnerBadge}
              onChange={(v) => update("showOwnerBadge", v)}
            />
            <Toggle
              label="Detect competitor funnels (CF/GHL/Leadpages/Unbounce)"
              checked={prefs.showCompetitorPill}
              onChange={(v) => update("showCompetitorPill", v)}
            />
            <Toggle
              label="Auto-detect form fields on viewed pages"
              checked={prefs.autoDetectForms}
              onChange={(v) => update("autoDetectForms", v)}
            />
          </Stack>
        </Card>

        <Card title="Lead routing">
          <Stack gap={10}>
            <p style={{ fontSize: 13, color: "#52525b", margin: 0 }}>
              When the extension captures a form submission on a page that isn't tagged with a
              GoFunnelAI funnel ID, route the lead to this funnel's inbox.
            </p>
            <Select
              value={prefs.defaultFunnelId ?? ""}
              onChange={(v) => update("defaultFunnelId", v || null)}
              options={[{ value: "", label: "Ungated inbox" }, ...funnels.map((f) => ({ value: f.id, label: f.name }))]}
            />
          </Stack>
        </Card>
      </Stack>
    </div>
  )
}
