/**
 * Shopify webhook: orders/create | orders/paid | orders/fulfilled.
 *
 * Forwards every order to the GoFunnelAI CRM so funnels know when leads
 * convert to buyers â€” this powers the "x% of leads from Funnel A purchase
 * within 7 days" reporting.
 *
 * We do NOT use SendGrid/Twilio here â€” outreach happens server-side in
 * GoFunnelAI using Resend + SignalWire.
 */

import { type ActionFunctionArgs } from "@remix-run/node"
import { authenticate } from "../shopify.server"
import { funnelClient } from "../funnel-client.server"

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, payload } = await authenticate.webhook(request)
  const sdk = await funnelClient(shop)

  await sdk.crm.recordOrder({
    surface: "shopify-app",
    topic,
    shop,
    orderId: String(payload.id),
    orderName: String(payload.name ?? ""),
    email: String(payload.email ?? payload.customer?.email ?? ""),
    phone: String(payload.phone ?? payload.customer?.phone ?? ""),
    total: Number(payload.total_price ?? 0),
    currency: String(payload.currency ?? "USD"),
    lineItems: (payload.line_items ?? []).map((li: any) => ({
      sku: li.sku,
      name: li.name,
      quantity: li.quantity,
      price: Number(li.price),
    })),
    capturedAt: new Date().toISOString(),
  })

  return new Response(null, { status: 200 })
}
