/**
 * /app/* â€” embedded Shopify admin shell.
 *
 * All nested admin routes (index, funnels, settings, leads) inherit:
 *   - Authentication via shopify.authenticate.admin
 *   - The shop's GoFunnelAI link state (so we can show an onboarding banner
 *     if the merchant hasn't connected to GoFunnelAI yet).
 */

import { json, type LoaderFunctionArgs } from "@remix-run/node"
import { Link, Outlet, useLoaderData, useRouteError } from "@remix-run/react"
import { AppProvider as PolarisAppProvider, Frame, Navigation, TopBar } from "@shopify/polaris"
import { boundary } from "@shopify/shopify-app-remix/server"
import { authenticate } from "../shopify.server"
import { prisma } from "../shopify.server"

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request)
  const link = await prisma.funnelLink.findUnique({ where: { shop: session.shop } })
  return json({
    apiKey: process.env.SHOPIFY_API_KEY,
    shop: session.shop,
    linked: !!link,
    workspaceName: link?.workspaceName ?? null,
  })
}

export default function AppLayout() {
  const { linked, workspaceName } = useLoaderData<typeof loader>()
  return (
    <PolarisAppProvider i18n={{}}>
      <Frame
        topBar={<TopBar userMenu={null} />}
        navigation={
          <Navigation location="/app">
            <Navigation.Section
              title={workspaceName ?? "GoFunnelAI"}
              items={[
                { label: "Dashboard", url: "/app" },
                { label: "Funnel embeds", url: "/app/funnels" },
                { label: "Leads", url: "/app/leads" },
                { label: "Discount automation", url: "/app/discounts" },
                { label: "Settings", url: "/app/settings" },
              ]}
            />
          </Navigation>
        }>
        {!linked && (
          <div style={{ padding: 16, background: "#FEF3C7", borderBottom: "1px solid #F59E0B" }}>
            <strong>Almost ready â€”</strong>{" "}
            <Link to="/app/settings">connect this store to your GoFunnelAI workspace</Link> to start
            capturing leads.
          </div>
        )}
        <Outlet />
      </Frame>
    </PolarisAppProvider>
  )
}

export const ErrorBoundary = () => boundary.error(useRouteError())
export const headers = boundary.headers
