/**
 * App-proxy endpoint â€” /apps/funnel/form-submit.
 *
 * Storefront forms shipped by the theme app extension POST to this URL
 * (which Shopify rewrites & HMAC-signs to our app). We forward to
 * /v1/webhooks/form-submit on the GoFunnelAI API so the speed-to-lead pipeline
 * triggers within seconds.
 */

import { json, type ActionFunctionArgs } from "@remix-run/node"
import { authenticate } from "../shopify.server"
import { funnelClient } from "../funnel-client.server"

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.public.appProxy(request)
  if (!session) return json({ error: "unauthorized" }, { status: 401 })

  const body = (await request.json()) as {
    funnelId?: string
    fields: Record<string, string>
    pageUrl?: string
  }

  const sdk = await funnelClient(session.shop)
  await sdk.webhooks.formSubmit({
    surface: "shopify-app",
    source: "shopify-storefront",
    shop: session.shop,
    funnelId: body.funnelId,
    fields: body.fields,
    pageUrl: body.pageUrl ?? "",
    capturedAt: new Date().toISOString(),
  })
  return json({ ok: true })
}
