/**
 * /app/discounts â€” discount automation.
 *
 * When a lead completes a configured GoFunnelAI funnel, GoFunnelAI hits our
 * /shopify/proxy/funnel/discount-issued endpoint with `{ funnelId, leadEmail }`.
 * That endpoint creates a Shopify price rule + discount code via the Admin
 * GraphQL API and POSTs the code back to the lead via @funnel/sdk's
 * speed-to-lead pipeline (Resend email, SignalWire SMS â€” no SendGrid/Twilio).
 *
 * This page configures the funnel â†’ discount mapping.
 */

import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node"
import { Form, useLoaderData } from "@remix-run/react"
import { Banner, Button, Card, FormLayout, Page, Select, TextField, BlockStack } from "@shopify/polaris"
import { authenticate } from "../shopify.server"
import { funnelClient } from "../funnel-client.server"

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request)
  const sdk = await funnelClient(session.shop)
  const [funnels, mapping] = await Promise.all([
    sdk.funnels.list({ limit: 200 }),
    sdk.integrations.shopifyDiscountMap({ shop: session.shop }),
  ])
  return json({ funnels: funnels.data, mapping })
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request)
  const form = await request.formData()
  const sdk = await funnelClient(session.shop)
  await sdk.integrations.upsertShopifyDiscountMap({
    shop: session.shop,
    funnelId: String(form.get("funnelId")),
    discountType: String(form.get("discountType")) as "percent" | "fixed",
    discountValue: Number(form.get("discountValue")),
    codePrefix: String(form.get("codePrefix")) || "FUNNEL",
  })
  return json({ ok: true })
}

export default function Discounts() {
  const { funnels, mapping } = useLoaderData<typeof loader>()
  return (
    <Page title="Discount automation">
      <Banner tone="info">
        When a lead finishes the selected funnel, we'll generate a single-use Shopify discount code and
        text/email it to them â€” typically within 30 seconds of conversion.
      </Banner>
      <Card>
        <Form method="post">
          <FormLayout>
            <Select
              label="When this funnel completesâ€¦"
              name="funnelId"
              value={mapping?.funnelId ?? ""}
              options={[{ label: "â€”", value: "" }].concat(funnels.map((f: any) => ({ label: f.name, value: f.id })))}
              onChange={() => {}}
            />
            <Select
              label="Discount type"
              name="discountType"
              value={mapping?.discountType ?? "percent"}
              options={[
                { label: "Percent off", value: "percent" },
                { label: "Fixed amount off", value: "fixed" },
              ]}
              onChange={() => {}}
            />
            <TextField label="Discount value" name="discountValue" type="number" autoComplete="off" value={String(mapping?.discountValue ?? 10)} onChange={() => {}} />
            <TextField label="Code prefix" name="codePrefix" autoComplete="off" value={mapping?.codePrefix ?? "FUNNEL"} onChange={() => {}} />
            <BlockStack>
              <Button submit variant="primary">Save automation</Button>
            </BlockStack>
          </FormLayout>
        </Form>
      </Card>
    </Page>
  )
}
