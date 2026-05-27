/**
 * Remix root document — wraps every admin route in Polaris's AppProvider
 * and the App Bridge React provider, so child routes can use the host
 * navigation and toasts.
 */

import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "@remix-run/react"
import { AppProvider } from "@shopify/shopify-app-remix/react"

export default function App() {
  const apiKey = (typeof window !== "undefined" && (window as any).__SHOPIFY_API_KEY__) || ""
  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <link rel="preconnect" href="https://cdn.shopify.com/" />
        <link rel="stylesheet" href="https://cdn.shopify.com/static/fonts/inter/v4/styles.css" />
        <Meta />
        <Links />
      </head>
      <body>
        <AppProvider isEmbeddedApp apiKey={apiKey}>
          <Outlet />
        </AppProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}
