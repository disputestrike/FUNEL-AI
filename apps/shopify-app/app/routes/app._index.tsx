/**
 * /app â€” dashboard. Three Polaris cards:
 *   1. Lead capture summary (today / this week / all-time).
 *   2. Top-converting funnel embeds.
 *   3. Auto-issued discount codes on funnel completion.
 */

import { json, type LoaderFunctionArgs } from "@remix-run/node"
import { useLoaderData } from "@remix-run/react"
import { Card, DataTable, Layout, Page, Text, BlockStack } from "@shopify/polaris"
import { authenticate } from "../shopify.server"
import { funnelClient } from "../funnel-client.server"
import { prisma } from "../shopify.server"

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request)
  const link = await prisma.funnelLink.findUnique({ where: { shop: session.shop } })
  if (!link) return json({ linked: false as const })

  const sdk = await funnelClient(session.shop)
  const [summary, embeds, discounts] = await Promise.all([
    sdk.leads.summary({ window: "30d" }),
    sdk.funnels.topEmbeds({ surface: "shopify-app", limit: 5 }),
    prisma.discountIssue.findMany({
      where: { shop: session.shop },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ])
  return json({ linked: true as const, summary, embeds, discounts })
}

export default function Index() {
  const data = useLoaderData<typeof loader>()
  if (!data.linked) {
    return (
      <Page title="GoFunnelAI">
        <Card>
          <Text as="p">Connect to a GoFunnelAI workspace from the settings page to get started.</Text>
        </Card>
      </Page>
    )
  }
  const { summary, embeds, discounts } = data
  return (
    <Page title="Dashboard">
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="200">
              <Text as="h2" variant="headingMd">Lead capture (last 30 days)</Text>
              <Text as="p">Captured: {summary.total} Â· Replied to within 60s: {summary.fastReplies}</Text>
            </BlockStack>
          </Card>
        </Layout.Section>
        <Layout.Section>
          <Card>
            <Text as="h2" variant="headingMd">Top embeds</Text>
            <DataTable
              columnContentTypes={["text", "numeric", "numeric"]}
              headings={["Funnel", "Views", "Conv %"]}
              rows={embeds.map((e) => [e.name, e.views, `${e.conversionRate}%`])}
            />
          </Card>
        </Layout.Section>
        <Layout.Section>
          <Card>
            <Text as="h2" variant="headingMd">Recent auto-issued discount codes</Text>
            <DataTable
              columnContentTypes={["text", "text", "text"]}
              headings={["Lead", "Code", "When"]}
              rows={discounts.map((d) => [d.leadEmail, d.code, d.createdAt.toLocaleString()])}
            />
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  )
}
