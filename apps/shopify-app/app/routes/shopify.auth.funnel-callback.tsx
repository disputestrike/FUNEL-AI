/**
 * GoFunnelAI OAuth callback â€” completes the second OAuth hop (after Shopify's
 * own install OAuth). Persists the FunnelLink row and bounces back into the
 * embedded admin.
 */

import { redirect, type LoaderFunctionArgs } from "@remix-run/node"
import { authenticate } from "../shopify.server"
import { prisma } from "../shopify.server"

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request)
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  if (!code) throw new Response("Missing code", { status: 400 })
  if (state !== session.shop) throw new Response("State mismatch", { status: 400 })

  const tokenRes = await fetch(`${process.env.FUNNEL_AUTH_BASE ?? "https://login.gofunnelai.com"}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      client_id: `shopify_${session.shop}`,
      redirect_uri: `${process.env.SHOPIFY_APP_URL}/shopify/auth/funnel-callback`,
    }),
  })
  if (!tokenRes.ok) throw new Response("Token exchange failed", { status: 502 })
  const body = (await tokenRes.json()) as {
    access_token: string
    refresh_token: string
    expires_in: number
    workspace: { id: string; name: string }
  }
  await prisma.funnelLink.upsert({
    where: { shop: session.shop },
    create: {
      shop: session.shop,
      workspaceId: body.workspace.id,
      workspaceName: body.workspace.name,
      accessToken: body.access_token,
      refreshToken: body.refresh_token,
      expiresAt: new Date(Date.now() + body.expires_in * 1000),
    },
    update: {
      workspaceId: body.workspace.id,
      workspaceName: body.workspace.name,
      accessToken: body.access_token,
      refreshToken: body.refresh_token,
      expiresAt: new Date(Date.now() + body.expires_in * 1000),
    },
  })
  return redirect("/app/settings?connected=1")
}
