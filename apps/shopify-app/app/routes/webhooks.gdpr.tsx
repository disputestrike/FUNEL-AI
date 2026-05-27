/**
 * Mandatory GDPR webhooks: customers/data_request, customers/redact, shop/redact.
 *
 * All three are forwarded to GoFunnelAI which is the actual data controller.
 */

import { type ActionFunctionArgs } from "@remix-run/node"
import { authenticate } from "../shopify.server"
import { funnelClient } from "../funnel-client.server"

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, payload } = await authenticate.webhook(request)
  try {
    const sdk = await funnelClient(shop)
    await sdk.compliance.gdpr({ topic, shop, payload })
  } catch {
    // No link â†’ nothing to redact; still ack the webhook.
  }
  return new Response(null, { status: 200 })
}
