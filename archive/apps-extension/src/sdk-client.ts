/**
 * Thin factory that hands @funnel/sdk a token provider tied to our auth module.
 * Every surface in the extension (popup, sidepanel, background, content)
 * imports `client()` from here so we have one place to wire credentials.
 */

import { FunnelClient } from "@funnel/sdk"
import { getAccessToken } from "./auth"

let cached: FunnelClient | null = null

export function client(): FunnelClient {
  if (cached) return cached
  cached = new FunnelClient({
    baseUrl: process.env.PLASMO_PUBLIC_FUNNEL_API ?? "https://api.gofunnelai.com",
    getToken: getAccessToken,
    surface: "browser-extension",
  })
  return cached
}
