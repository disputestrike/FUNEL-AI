/**
 * /app/funnels â€” list of the merchant's GoFunnelAI funnels with a
 * one-click "Embed on storefront" action that injects a theme app block
 * snippet on the chosen template via the Asset API.
 */

import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node"
import { Form, useActionData, useLoaderData } from "@remix-run/react"
import { Badge, Banner, Button, Card, DataTable, Page } from "@shopify/polaris"
import { authenticate } from "../shopify.server"
import { funnelClient } from "../funnel-client.server"

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request)
  const sdk = await funnelClient(session.shop)
  const funnels = await sdk.funnels.list({ limit: 200 })
  return json({ funnels: funnels.data })
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request)
  const form = await request.formData()
  const funnelId = String(form.get("funnelId"))
  const target = String(form.get("target") || "index")

  // Use the GraphQL Admin API to set a theme app extension's metafield so
  // the block knows which funnel to render. The actual block markup ships in
  // extensions/storefront-embed.
  const response = await admin.graphql(
    `#graphql
      mutation SetEmbed($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          userErrors { field message }
        }
      }`,
    {
      variables: {
        metafields: [
          {
            namespace: "funnel_ai",
            key: `embed_${target}`,
            type: "single_line_text_field",
            value: funnelId,
            ownerId: `gid://shopify/Shop/${session.shop}`,
          },
        ],
      },
    },
  )
  const result = await response.json()
  if (result?.data?.metafieldsSet?.userErrors?.length) {
    return json({ ok: false as const, errors: result.data.metafieldsSet.userErrors })
  }
  return json({ ok: true as const })
}

export default function Funnels() {
  const { funnels } = useLoaderData<typeof loader>()
  const actionData = useActionData<typeof action>()

  return (
    <Page title="Funnel embeds">
      {actionData?.ok && <Banner tone="success">Embed updated â€” refresh your storefront to see it.</Banner>}
      <Card>
        <DataTable
          columnContentTypes={["text", "text", "numeric", "text"]}
          headings={["Funnel", "Status", "Conv %", "Embed"]}
          rows={funnels.map((f: any) => [
            f.name,
            <Badge tone={f.status === "live" ? "success" : "info"}>{f.status}</Badge>,
            `${f.conversionRate}%`,
            <Form method="post" key={f.id}>
              <input type="hidden" name="funnelId" value={f.id} />
              <input type="hidden" name="target" value="index" />
              <Button submit size="slim">Embed on Home</Button>
            </Form>,
          ])}
        />
      </Card>
    </Page>
  )
}
