=== GoFunnelAI ===
Contributors: funnelai
Tags: funnel, landing-page, lead-capture, crm, gravity-forms, wpforms, contact-form-7, woocommerce
Requires at least: 6.2
Tested up to: 6.5
Requires PHP: 7.4
Stable tag: 0.1.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Embed GoFunnelAI funnels into any WordPress page or post, sync every form submission to the GoFunnelAI CRM, and trigger the speed-to-lead pipeline within seconds.

== Description ==

GoFunnelAI is the easiest way to design, ship, and optimize high-converting funnels â€” without leaving WordPress.

This plugin lets you:

* **Embed** any of your GoFunnelAI funnels as a Gutenberg block or `[funnelai id="..."]` shortcode. Pre-renders to static HTML at edit time so SEO is unaffected.
* **Capture leads** from Gravity Forms, WPForms, Contact Form 7, and WooCommerce checkouts and forward them to your GoFunnelAI CRM.
* **Trigger speed-to-lead** outreach (email via Resend, SMS via SignalWire) within seconds of capture, fully managed by GoFunnelAI.
* **Track embed views and conversions** via a built-in tracking pixel so you can attribute conversions to the WP page they ran on.

No SendGrid or Twilio anywhere â€” GoFunnelAI uses Resend + SignalWire end-to-end.

== Installation ==

1. Upload the plugin folder to `/wp-content/plugins/`.
2. Activate the plugin in **Plugins â†’ Installed Plugins**.
3. Go to **GoFunnelAI â†’ Settings** and click **Connect to GoFunnelAI** to authorize the site via OAuth.
4. Add a **GoFunnelAI Block** to any page, or use `[funnelai id="fn_..."]` in the classic editor.

== Frequently Asked Questions ==

= Do I need a GoFunnelAI account? =
Yes â€” sign up at https://gofunnelai.com then connect this site to your workspace from the plugin settings page.

= Will embedding a funnel hurt my SEO? =
No. The block bakes the funnel HTML into the post at edit time, so the front-end serves a static snapshot with no JavaScript required.

= Which form plugins are supported for lead capture? =
Gravity Forms, WPForms, Contact Form 7, and WooCommerce checkouts. You can toggle each one on or off in **GoFunnelAI â†’ Settings**.

= How quickly does the speed-to-lead pipeline fire? =
GoFunnelAI targets sub-30-second outreach after a form submission, sending the first touch via Resend (email) and SignalWire (SMS).

= Does the plugin store lead data inside WordPress? =
No â€” the submission is forwarded directly to your GoFunnelAI workspace. The plugin only stores OAuth tokens and your settings inside `wp_options`.

== Screenshots ==

1. The GoFunnelAI admin landing page with one-click OAuth.
2. The Gutenberg block picker â€” search and embed any of your funnels.
3. Form-forwarding settings â€” toggle Gravity / WPForms / CF7 / Woo.
4. The Funnel browser submenu â€” embed any funnel into a new page in one click.

== Changelog ==

= 0.1.0 =
* Initial release: Gutenberg block + shortcode + OAuth + Gravity/WPForms/CF7/Woo lead capture.
