/**
 * Shopify app server bootstrap.
 *
 * `@shopify/shopify-app-remix` gives us:
 *   - The OAuth handshake against the shop (offline + online tokens).
 *   - `authenticate.admin(request)` / `authenticate.webhook(request)` helpers.
 *   - Session storage (Prisma adapter â€” see prisma/schema.prisma).
 *
 * Every GoFunnelAI surface (extension/WP/Webflow/this) uses the same
 * @funnel/sdk against api.gofunnelai.com. Shopify auth lives here only so we can
 * authenticate the merchant in the Shopify admin; the SDK still needs a
 * GoFunnelAI access token, which we fetch from /shopify/exchange-token using
 * the shop domain.
 */

import "@shopify/shopify-app-remix/adapters/node"
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
  type ShopifyApp,
} from "@shopify/shopify-app-remix/server"
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma"
import { PrismaClient } from "@prisma/client"

export const prisma = new PrismaClient()

const shopify: ShopifyApp = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY!,
  apiSecretKey: process.env.SHOPIFY_API_SECRET!,
  apiVersion: ApiVersion.July24,
  scopes: (process.env.SCOPES ?? "write_products,write_discounts,read_customers,read_orders,write_script_tags").split(","),
  appUrl: process.env.SHOPIFY_APP_URL!,
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  isEmbeddedApp: true,
  future: {
    unstable_newEmbeddedAuthStrategy: true,
    v3_lineItemBilling: true,
  },
})

export default shopify
export const apiVersion = ApiVersion.July24
export const authenticate = shopify.authenticate
export const unauthenticated = shopify.unauthenticated
export const login = shopify.login
export const registerWebhooks = shopify.registerWebhooks
export const sessionStorage = shopify.sessionStorage
