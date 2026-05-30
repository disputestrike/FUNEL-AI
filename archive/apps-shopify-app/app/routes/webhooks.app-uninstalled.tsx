/**
 * orders/app-uninstalled — purge sessions + FunnelLink + DiscountIssue rows.
 */

import { type ActionFunctionArgs } from "@remix-run/node"
import { authenticate, sessionStorage } from "../shopify.server"
import { prisma } from "../shopify.server"

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, session } = await authenticate.webhook(request)
  if (session) await sessionStorage.deleteSessions([session.id])
  await prisma.funnelLink.deleteMany({ where: { shop } })
  await prisma.discountIssue.deleteMany({ where: { shop } })
  return new Response(null, { status: 200 })
}
