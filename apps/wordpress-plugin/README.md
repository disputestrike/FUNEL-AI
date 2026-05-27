# GoFunnelAI â€” WordPress Plugin

Embed GoFunnelAI funnels into any WordPress page, sync form submissions
(Gravity Forms, WPForms, Contact Form 7, WooCommerce) to the GoFunnelAI CRM,
and fire the speed-to-lead pipeline (Resend + SignalWire) within seconds.

## Surfaces

| Surface | Path |
| --- | --- |
| Main plugin entry | `funnel-ai.php` |
| Admin pages (settings + funnel browser) | `admin/` |
| Gutenberg block | `blocks/` |
| Classic-editor shortcode | `shortcode/` |
| REST API (`/wp-json/funnelai/v1/...`) | `api/` |
| Form-submission capture | `lead-capture.php` |
| OAuth flow | `includes/class-oauth.php` |
| GoFunnelAI HTTP client | `includes/class-sdk.php` |
| Uninstall sweep | `uninstall.php` |

## Install

1. Drop the folder into `wp-content/plugins/funnel-ai/`.
2. Activate from **Plugins** in `wp-admin`.
3. Visit **GoFunnelAI â†’ Settings** and click **Connect to GoFunnelAI** to run
   the OAuth/PKCE flow against `login.gofunnelai.com`.

## Embed a funnel

Two ways:

- **Gutenberg block** â€” Insert *GoFunnelAI Block* in any page; pick a funnel
  on the right sidebar, click **Bake static HTML for SEO**, publish.
- **Shortcode** â€” `[funnelai id="fn_abc123"]` (optional `section="hero"`).

The fetched HTML is cached in WP transients for 1 hour and re-baked into
the block attribute on every save so the front-end has zero API dependency.

## Lead capture

Every form submission caught from Gravity, WPForms, CF7 or Woo is normalized
to `{ source, sourceFormId, fields, pageUrl, capturedAt, funnelId? }` and
POSTed to `https://api.gofunnelai.com/v1/webhooks/form-submit` via the plugin's
PHP SDK wrapper. The server's speed-to-lead pipeline takes it from there.

## REST endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/wp-json/funnelai/v1/funnels` | Editor-side proxy to list workspace funnels |
| GET | `/wp-json/funnelai/v1/funnels/:id` | Editor-side proxy to fetch a funnel |
| GET | `/wp-json/funnelai/v1/embed/:id` | Returns cached HTML for a funnel |
| GET | `/wp-json/funnelai/v1/track` | 1Ã—1 GIF that logs embed views |
| POST | `/wp-json/funnelai/v1/webhook/external-submit` | Shared-secret-gated catch-all for non-supported form plugins |
