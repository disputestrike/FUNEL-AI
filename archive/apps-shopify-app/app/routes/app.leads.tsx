/**
 * /app/leads — paginated lead inbox for this shop.
 */

import { json, type LoaderFunctionArgs } from "@remix-run/node"
import { useLoaderData } from "@remix-run/react"
import { Card, DataTable, Page } from "@shopify/polaris"
import { authenticate } from "../shopify.server"
import { funnelClient } from "../funnel-client.server"

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request)
  const sdk = await funnelClient(session.shop)
  const url = new URL(request.url)
  const cursor = url.searchParams.get("cursor") ?? undefined
  const leads = await sdk.leads.list({ surface: "shopify-app", cursor, limit: 50 })
  return json({ leads: leads.data })
}

export default function Leads() {
  const { leads } = useLoaderData<typeof loader>()
  return (
    <Page title="Leads">
      <Card>
        <DataTable
          columnContentTypes={["text", "text", "text", "text", "text"]}
          headings={["Name", "Email", "Funnel", "Captured", "Status"]}
          rows={leads.map((l: any) => [l.name || "—", l.email, l.funnelName, new Date(l.capturedAt).toLocaleString(), l.status])}
        />
      </Card>
    </Page>
  )
}
