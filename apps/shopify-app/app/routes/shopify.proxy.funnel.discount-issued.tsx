/**
 * App-proxy endpoint â€” /apps/funnel/discount-issued.
 *
 * Hit by GoFunnelAI when a lead completes a discount-enabled funnel. We:
 *   1. Generate a unique single-use discount code via the Shopify Admin GraphQL API.
 *   2. Record it in DiscountIssue.
 *   3. Return the code to GoFunnelAI, which dispatches the speed-to-lead message
 *      (Resend + SignalWire) containing the code.
 *
 * App-proxy requests are HMAC-signed by Shopify; the authenticate.public
 * helper validates that.
 */

import { json, type ActionFunctionArgs } from "@remix-run/node"
import { authenticate } from "../shopify.server"
import { prisma } from "../shopify.server"

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.public.appProxy(request)
  if (!admin || !session) return json({ error: "unauthorized" }, { status: 401 })

  const { funnelId, leadEmail } = (await request.json()) as { funnelId: string; leadEmail: string }
  if (!funnelId || !leadEmail) return json({ error: "missing fields" }, { status: 400 })

  // Get the merchant's discount mapping from a shop metafield.
  const mapping = await fetchMapping(admin, funnelId)
  if (!mapping) return json({ error: "no mapping" }, { status: 404 })

  const code = `${mapping.codePrefix}-${randomCode(8)}`
  const created = await admin.graphql(
    `#graphql
      mutation Create($basicCodeDiscount: DiscountCodeBasicInput!) {
        discountCodeBasicCreate(basicCodeDiscount: $basicCodeDiscount) {
          codeDiscountNode { id }
          userErrors { field message }
        }
      }`,
    {
      variables: {
        basicCodeDiscount: {
          title: `GoFunnelAI â€” ${funnelId}`,
          code,
          startsAt: new Date().toISOString(),
          usageLimit: 1,
          appliesOncePerCustomer: true,
          customerSelection: { all: true },
          customerGets: {
            value:
              mapping.discountType === "percent"
                ? { percentage: mapping.discountValue / 100 }
                : { discountAmount: { amount: mapping.discountValue, appliesOnEachItem: false } },
            items: { all: true },
          },
        },
      },
    },
  )
  const body = (await created.json()) as any
  const errors = body?.data?.discountCodeBasicCreate?.userErrors ?? []
  if (errors.length) return json({ error: errors[0].message }, { status: 500 })

  await prisma.discountIssue.create({
    data: {
      shop: session.shop,
      funnelId,
      leadEmail,
      priceRuleId: body.data.discountCodeBasicCreate.codeDiscountNode.id,
      code,
    },
  })

  return json({ code })
}

async function fetchMapping(admin: any, funnelId: string) {
  const r = await admin.graphql(
    `#graphql
      query GetMap($key: String!) {
        shop { metafield(namespace: "funnel_ai", key: $key) { value } }
      }`,
    { variables: { key: `discount_${funnelId}` } },
  )
  const body = (await r.json()) as any
  const raw = body?.data?.shop?.metafield?.value
  if (!raw) return null
  try { return JSON.parse(raw) as { codePrefix: string; discountType: "percent" | "fixed"; discountValue: number } }
  catch { return null }
}

function randomCode(len: number): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let out = ""
  for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)]
  return out
}
