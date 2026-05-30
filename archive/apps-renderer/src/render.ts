/**
 * Server-side render of a published funnel.
 *
 * Input:
 *   - the resolved row (from published_funnels / funnels JOIN)
 *   - locale + device (used by responsive layout selection)
 * Output:
 *   - a full HTML document, with:
 *       * <head> assembled from copy_blob.meta + design_blob theme
 *       * GA4 / Meta / TikTok pixel snippets when configured
 *       * the funnel body, rendered through the block primitives
 *       * the AI disclosure footer (mandatory on free-tier)
 *       * the form-submit endpoint configured to POST back to /__form-submit
 *
 * Analytics integration:
 *   - Browser pixels fire at page load.
 *   - For every form submission the renderer queues a server-side conversion
 *     job (see forms.ts → ANALYTICS_QUEUE) so we get reliable conversions even
 *     when ad-blockers wipe the client-side pixels.
 */
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Context } from "hono";
import type { Env, HonoEnv } from "./env.js";
import type { ResolvedRouteRow } from "./lib/db.js";
import { AiDisclosureFooter, getDisclosureCopy } from "./ai-disclosure-footer.js";
import { hmacSha256Hex } from "./lib/crypto.js";

interface RenderOpts {
  locale: string;
  device: "mobile" | "desktop";
}

interface CopyBlobMeta {
  title?: string;
  description?: string;
  og_image_url?: string;
  favicon_url?: string;
}

interface ConfigBlob {
  pages?: Array<{
    id: string;
    slug?: string;
    sections?: Array<{ id: string; type: string; content?: unknown; variant?: string }>;
  }>;
  analytics?: {
    ga4_measurement_id?: string;
    meta_pixel_id?: string;
    tiktok_pixel_id?: string;
  };
  forms?: Record<string, unknown>;
  ctas?: Record<string, unknown>;
  assets?: Record<string, unknown>;
}

interface DesignBlob {
  theme?: Record<string, string>;
  fonts?: { display?: string; body?: string };
}

export async function renderPage(
  env: Env,
  c: Context<HonoEnv>,
  row: ResolvedRouteRow,
  opts: RenderOpts
): Promise<string> {
  const copy = (row.copy_blob ?? {}) as { meta?: CopyBlobMeta; body?: unknown };
  const design = (row.design_blob ?? {}) as DesignBlob;
  const config = (row.config_blob ?? {}) as ConfigBlob;
  const meta = copy.meta ?? {};
  const analytics = config.analytics ?? {};

  // Form-action token — bound to the funnel + version so a stale HTML can't
  // be replayed against a newer published version.
  const formToken = await hmacSha256Hex(
    env.FORM_HMAC_SECRET,
    `${row.funnel_id}|${row.funnel_version_id}|${Math.floor(Date.now() / 1000 / 3600)}`
  );

  // The free tier always shows the disclosure.
  const freeTier =
    row.workspace_plan === "trial" ||
    row.workspace_plan === "free" ||
    row.workspace_plan === "starter";
  const disclosureRequested = row.funnel_ai_disclosure?.enabled ?? row.ai_disclosure?.enabled ?? true;
  const showDisclosure = freeTier || disclosureRequested;

  const pageBodyHtml = renderToStaticMarkup(
    <FunnelBody config={config} design={design} />
  );

  const footerHtml = renderToStaticMarkup(
    <AiDisclosureFooter locale={opts.locale} hide={!showDisclosure} poweredBy={freeTier} />
  );

  const themeVarsCss = buildThemeVars(design);
  const analyticsHead = analyticsHeadSnippets(analytics);
  const analyticsBody = analyticsBodySnippets(analytics, row);

  const title = meta.title ?? "GoFunnelAI";
  const description = meta.description ?? "";
  const ogImage = meta.og_image_url ?? "";
  const favicon = meta.favicon_url ?? `${env.ASSETS_PUBLIC_BASE}/favicon.ico`;

  const canonicalHost = row.workspace_slug
    ? `${row.workspace_slug}.${env.APEX_DOMAIN}`
    : env.APEX_DOMAIN;
  const canonicalUrl = `https://${canonicalHost}/${row.funnel_slug ?? ""}`.replace(/\/+$/, "/");

  // Form action — same-origin /__form-submit, plus the workspace + funnel id
  // baked in as query string for server-side rate-limiting + multi-tenant
  // routing on the Workers worker side.
  const formActionUrl = `/__form-submit?funnel=${encodeURIComponent(row.funnel_id)}&workspace=${encodeURIComponent(row.workspace_id)}`;

  return `<!doctype html>
<html lang="${escapeHtml(opts.locale)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${escapeHtml(canonicalUrl)}">
${ogImage ? `<meta property="og:image" content="${escapeHtml(ogImage)}">` : ""}
<meta name="twitter:card" content="summary_large_image">
<meta name="generator" content="GoFunnelAI">
<link rel="canonical" href="${escapeHtml(canonicalUrl)}">
<link rel="icon" href="${escapeHtml(favicon)}">
<meta name="x-funnel-id" content="${escapeHtml(row.funnel_id)}">
<meta name="x-funnel-version-id" content="${escapeHtml(row.funnel_version_id)}">
<style>:root{${themeVarsCss}}*,*:before,*:after{box-sizing:border-box}html,body{margin:0;padding:0;font-family:${escapeHtml(design.fonts?.body ?? "system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif")}}</style>
${analyticsHead}
</head>
<body data-funnel-id="${escapeHtml(row.funnel_id)}" data-funnel-version="${escapeHtml(row.funnel_version_id)}" data-locale="${escapeHtml(opts.locale)}" data-device="${escapeHtml(opts.device)}">
<main id="funnel-body">${pageBodyHtml}</main>
${footerHtml}
${analyticsBody}
<script>
(function(){
  var forms = document.querySelectorAll('form[data-funnel-form]');
  forms.forEach(function(form){
    form.setAttribute('action', ${JSON.stringify(formActionUrl)});
    form.setAttribute('method', 'POST');
    var t = document.createElement('input');
    t.type = 'hidden'; t.name = 'funnel_token'; t.value = ${JSON.stringify(formToken)};
    form.appendChild(t);
    var hp = document.createElement('input');
    hp.type = 'text'; hp.name = 'hp_email'; hp.tabIndex = -1; hp.autocomplete = 'off';
    hp.setAttribute('aria-hidden', 'true');
    hp.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;opacity:0';
    form.appendChild(hp);
  });
})();
</script>
</body>
</html>`;
}

/**
 * Render the funnel body. The real implementation iterates config.pages /
 * sections and instantiates the matching block component from
 * apps/renderer/src/blocks. For now we stitch a minimal scaffold so the
 * top-to-bottom flow is exercised end-to-end; the block instantiation table
 * is owned by blocks/primitives.tsx and is not in scope here.
 */
function FunnelBody({ config }: { config: ConfigBlob; design: DesignBlob }): React.ReactElement {
  const pages = config.pages ?? [];
  // Single-page funnels are the default; multi-step funnels render the first
  // page server-side and load others via client-side navigation.
  const page = pages[0];
  return (
    <div data-page-id={page?.id ?? "default"}>
      {(page?.sections ?? []).map((s) => (
        <section key={s.id} id={`section-${s.id}`} data-section-type={s.type}>
          {/* Block dispatch is wired through the block registry in
              apps/renderer/src/blocks; the renderer-as-library code path
              keeps this generic so we can SSR even with unknown block types. */}
          <div data-section-content data-section-variant={s.variant ?? "default"} />
        </section>
      ))}
    </div>
  );
}

function buildThemeVars(design: DesignBlob): string {
  const theme = design.theme ?? {};
  const defaults: Record<string, string> = {
    "--color-primary-500": "#6366f1",
    "--color-primary-600": "#4f46e5",
    "--color-primary-50": "#eef2ff",
    "--color-secondary-500": "#0ea5e9",
    "--color-secondary-600": "#0284c7",
    "--color-neutral-900": "#0f172a",
    "--color-neutral-100": "#f1f5f9",
    "--color-neutral-50": "#fafafa",
    "--color-semantic-error": "#ef4444",
    "--radius-md": "8px",
    "--shadow-md": "0 4px 12px rgba(0,0,0,0.08)",
  };
  const merged = { ...defaults, ...theme };
  return Object.entries(merged)
    .map(([k, v]) => `${k}:${v}`)
    .join(";");
}

function analyticsHeadSnippets(a: NonNullable<ConfigBlob["analytics"]>): string {
  let s = "";
  if (a.ga4_measurement_id) {
    const id = a.ga4_measurement_id.replace(/[^A-Za-z0-9_-]/g, "");
    s += `<script async src="https://www.googletagmanager.com/gtag/js?id=${id}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${id}',{anonymize_ip:true});</script>`;
  }
  if (a.meta_pixel_id) {
    const id = a.meta_pixel_id.replace(/[^A-Za-z0-9_-]/g, "");
    s += `<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${id}');fbq('track','PageView');</script>`;
  }
  if (a.tiktok_pixel_id) {
    const id = a.tiktok_pixel_id.replace(/[^A-Za-z0-9_-]/g, "");
    s += `<script>!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=i;ttq._t=ttq._t||{};ttq._t[e]=+new Date();ttq._o=ttq._o||{};ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript";o.async=!0;o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};ttq.load('${id}');ttq.page();}(window,document,'ttq');</script>`;
  }
  return s;
}

function analyticsBodySnippets(
  a: NonNullable<ConfigBlob["analytics"]>,
  row: ResolvedRouteRow
): string {
  // A noscript fallback for the Meta pixel.
  if (!a.meta_pixel_id) return "";
  const id = a.meta_pixel_id.replace(/[^A-Za-z0-9_-]/g, "");
  return `<noscript><img height="1" width="1" alt="" style="display:none" src="https://www.facebook.com/tr?id=${id}&ev=PageView&noscript=1&fid=${encodeURIComponent(row.funnel_id)}"></noscript>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// keep this import bound so the disclosure copy registry is reachable at
// build time for tree-shaking.
void getDisclosureCopy;
