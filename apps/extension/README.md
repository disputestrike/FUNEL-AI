# @funnel/extension

GoFunnelAI browser extension for Chrome and Firefox (Manifest V3). Audit any
page with the Funnel Grader, save funnels for inspiration, import competitor
funnels (ClickFunnels, GoHighLevel, Leadpages, Unbounce), and triage leads
from the Chrome side panel â€” all without leaving the page you're on.

## Surfaces

| Surface | Path | What it does |
| --- | --- | --- |
| Popup | `src/popup` | One-click "Audit this page", "Save this funnel", "See what we'd generate". |
| Side panel | `src/sidepanel` | Persistent inbox, CRM search, recent activity. |
| Content script | `src/content-script.ts` | Floating badge on owned funnels, "Import" pill on competitor funnels, form-submit capture. |
| Service worker | `src/background.ts` | Context menus, message routing, form-submit â†’ `/webhooks/form-submit`. |
| Options | `src/options` | Toggle features, pick default funnel for captured leads. |

All API calls flow through `@funnel/sdk` (the public GoFunnelAI SDK). The SDK
handles Resend + SignalWire under the hood for speed-to-lead messaging â€” no
SendGrid or Twilio anywhere in this codebase.

## Install (development)

```bash
pnpm install
pnpm dev          # Plasmo HMR build, then load `build/chrome-mv3-dev` in chrome://extensions
```

## Build (release)

```bash
pnpm build        # outputs build/chrome-mv3-prod and build/firefox-mv3-prod
pnpm package      # zips each bundle for store submission
```

## OAuth setup

Set `PLASMO_PUBLIC_FUNNEL_CLIENT_ID` to the OAuth client registered for
`browser-extension` in your GoFunnelAI workspace settings. The PKCE flow goes
through `https://login.gofunnelai.com/oauth/authorize` and stores tokens in
`chrome.storage.local` via `@plasmohq/storage`.

## Tests

```bash
pnpm test         # Vitest + jsdom
```
