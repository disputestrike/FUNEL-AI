/**
 * Side panel — persistent across tabs, anchored to the Chrome window.
 *
 * Three sections:
 *   1. Lead inbox — latest leads across all the user's funnels.
 *   2. Quick CRM search — typeahead against /crm/search.
 *   3. Recent activity — latest events (lead, sale, page view).
 */

import React, { useEffect, useMemo, useState } from "react"
import { Card, Stack, Input, Badge, EmptyState, Spinner, Avatar, Tabs } from "@funnel/ui"
import { client } from "../sdk-client"
import { useInbox, type InboxLead } from "../store"

export function SidePanel() {
  const { leads, loading, setLeads, setLoading, markRead } = useInbox()
  const [tab, setTab] = useState<"inbox" | "search" | "activity">("inbox")
  const [query, setQuery] = useState("")
  const [searchResults, setSearchResults] = useState<InboxLead[]>([])
  const [activity, setActivity] = useState<{ id: string; text: string; at: string }[]>([])

  useEffect(() => {
    setLoading(true)
    void client()
      .leads.list({ unreadFirst: true, limit: 50 })
      .then((data) => setLeads(data as InboxLead[]))
      .catch(() => setLeads([]))
  }, [setLeads, setLoading])

  useEffect(() => {
    if (tab !== "activity") return
    void client()
      .events.recent({ limit: 30 })
      .then(setActivity)
      .catch(() => setActivity([]))
  }, [tab])

  useEffect(() => {
    if (tab !== "search" || query.trim().length < 2) {
      setSearchResults([])
      return
    }
    const handle = setTimeout(async () => {
      const r = await client().crm.search(query)
      setSearchResults(r as InboxLead[])
    }, 200)
    return () => clearTimeout(handle)
  }, [query, tab])

  const unreadCount = useMemo(() => leads.filter((l) => l.unread).length, [leads])

  return (
    <div style={{ padding: 12, fontFamily: '-apple-system, "Segoe UI", sans-serif' }}>
      <Tabs
        value={tab}
        onChange={(v) => setTab(v as typeof tab)}
        items={[
          { value: "inbox", label: `Inbox${unreadCount ? ` (${unreadCount})` : ""}` },
          { value: "search", label: "Search" },
          { value: "activity", label: "Activity" },
        ]}
      />

      {tab === "inbox" && (
        <Stack gap={6}>
          {loading && <Spinner />}
          {!loading && leads.length === 0 && (
            <EmptyState title="No leads yet" body="Capture a form anywhere on the web — we'll show it here." />
          )}
          {leads.map((lead) => (
            <Card
              key={lead.id}
              compact
              onClick={() => {
                markRead(lead.id)
                void client().leads.markRead(lead.id)
              }}>
              <Stack direction="row" align="center" gap={10}>
                <Avatar name={lead.name} />
                <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                  <strong style={{ fontSize: 13 }}>{lead.name || lead.email}</strong>
                  <span style={{ fontSize: 11, color: "#71717a" }}>
                    {lead.funnelName} · {new Date(lead.capturedAt).toLocaleString()}
                  </span>
                </Stack>
                {lead.unread && <Badge tone="violet">New</Badge>}
              </Stack>
            </Card>
          ))}
        </Stack>
      )}

      {tab === "search" && (
        <Stack gap={8}>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search leads, companies, deals..."
            autoFocus
          />
          {searchResults.map((lead) => (
            <Card key={lead.id} compact>
              <strong style={{ fontSize: 13 }}>{lead.name}</strong>
              <div style={{ fontSize: 11, color: "#71717a" }}>{lead.email}</div>
            </Card>
          ))}
        </Stack>
      )}

      {tab === "activity" && (
        <Stack gap={4}>
          {activity.map((e) => (
            <div key={e.id} style={{ fontSize: 12, color: "#52525b", padding: "6px 0", borderBottom: "1px solid #f4f4f5" }}>
              <span>{e.text}</span>
              <span style={{ float: "right", color: "#a1a1aa" }}>{new Date(e.at).toLocaleTimeString()}</span>
            </div>
          ))}
        </Stack>
      )}
    </div>
  )
}
