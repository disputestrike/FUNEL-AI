/**
 * Server-side GoFunnelAI SDK factory.
 *
 * The Shopify session token doesn't grant GoFunnelAI access — we exchange the
 * shop domain for a GoFunnelAI workspace token at app install. The token is
 * stored on the FunnelLink row keyed by shop. This helper looks up the link
 * for a given shop and returns an SDK instance bound to it.
 */

import { FunnelClient } from "@funnel/sdk"
import { prisma } from "./shopify.server"

export async function funnelClient(shop: string): Promise<FunnelClient> {
  const link = await prisma.funnelLink.findUnique({ where: { shop } })
  if (!link) throw new Error(`No GoFunnelAI workspace linked for ${shop}`)
  return new FunnelClient({
    baseUrl: process.env.FUNNEL_API_BASE ?? "https://api.gofunnelai.com",
    surface: "shopify-app",
    workspaceId: link.workspaceId,
    getToken: async () => {
      // Refresh on the fly if within 60s of expiry.
      if (link.expiresAt.getTime() - Date.now() > 60_000) return link.accessToken
      const res = await fetch(`${process.env.FUNNEL_AUTH_BASE ?? "https://login.gofunnelai.com"}/oauth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_type: "refresh_token",
          refresh_token: link.refreshToken,
          client_id: `shopify_${shop}`,
        }),
      })
      if (!res.ok) throw new Error("GoFunnelAI refresh failed")
      const body = (await res.json()) as {
        access_token: string
        refresh_token: string
        expires_in: number
      }
      const fresh = await prisma.funnelLink.update({
        where: { shop },
        data: {
          accessToken: body.access_token,
          refreshToken: body.refresh_token,
          expiresAt: new Date(Date.now() + body.expires_in * 1000),
        },
      })
      return fresh.accessToken
    },
  })
}
