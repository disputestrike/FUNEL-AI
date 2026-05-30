# @funnel/shopify-app

GoFunnelAI for Shopify — built for App Store submission with Shopify CLI +
Remix + Polaris.

## What it does

- **Admin app** (Polaris UI in the embedded Shopify admin) — dashboard,
  funnel browser, lead inbox, discount automation, settings.
- **Theme app extension** — drag-in storefront section that embeds any
  GoFunnelAI funnel directly into the merchant's theme.
- **Order sync** — orders/create + orders/paid + orders/fulfilled webhooks
  forward to the GoFunnelAI CRM so funnels know when leads convert.
- **Discount automation** — when a lead completes a configured funnel,
  GoFunnelAI calls our app proxy and we issue a single-use Shopify discount
  code, sent to the lead via Resend + SignalWire from the GoFunnelAI server.

## Surfaces

| Path | Surface |
| --- | --- |
| `app/routes/app._index.tsx` | Dashboard |
| `app/routes/app.funnels.tsx` | Funnel browser |
| `app/routes/app.leads.tsx` | Lead inbox |
| `app/routes/app.discounts.tsx` | Discount automation config |
| `app/routes/app.settings.tsx` | Connect/disconnect GoFunnelAI |
| `app/routes/shopify.auth.funnel-callback.tsx` | GoFunnelAI OAuth landing |
| `app/routes/webhooks.orders.tsx` | Order sync |
| `app/routes/webhooks.app-uninstalled.tsx` | Cleanup on uninstall |
| `app/routes/webhooks.gdpr.tsx` | GDPR webhooks |
| `app/routes/shopify.proxy.funnel.discount-issued.tsx` | App proxy — discount issuance |
| `app/routes/shopify.proxy.funnel.form-submit.tsx` | App proxy — form submit |
| `extensions/storefront-embed/` | Theme app extension (storefront) |

## Install (development)

```bash
pnpm install
pnpm exec prisma migrate dev
pnpm dev          # boots `shopify app dev`, ngrok tunnel, etc.
```

You'll need a Shopify Partner account and a development store. Set in `.env`:

```
SHOPIFY_API_KEY=...
SHOPIFY_API_SECRET=...
SHOPIFY_APP_URL=https://...trycloudflare.com
DATABASE_URL=postgres://...
FUNNEL_AUTH_BASE=https://login.gofunnelai.com
FUNNEL_API_BASE=https://api.gofunnelai.com
```

## Deploy

```bash
pnpm exec shopify app deploy
```

## OAuth layering

Two OAuth flows happen back-to-back:

1. **Shopify install OAuth** — merchant installs the app; we receive an
   admin session and shop access token.
2. **GoFunnelAI OAuth** — merchant clicks *Connect to GoFunnelAI* on
   `/app/settings`; we redirect through `login.gofunnelai.com` and persist the
   workspace token in the `FunnelLink` row keyed by shop domain.

All GoFunnelAI API calls from this app flow through `@funnel/sdk` via
`funnelClient(shop)`. No SendGrid/Twilio — outreach is Resend + SignalWire
on the GoFunnelAI server.
