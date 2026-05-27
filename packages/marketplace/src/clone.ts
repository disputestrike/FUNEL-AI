/**
 * cloneTemplate — deep-clone a purchased template's funnel JSON into the
 * buyer's workspace.
 *
 * Steps:
 *   1. Verify a paid, non-refunded `Purchase` exists for this buyer.
 *   2. Re-key all IDs (funnel, pages, sections, CTAs, forms, pixels).
 *   3. Strip the creator's integration connections — buyer must reconnect
 *      Stripe / Meta / Google etc.
 *   4. Reset custom domain on the clone (defaults to a workspace subdomain).
 *   5. Persist via `MarketplaceDb#cloneFunnelInto` (which the consuming app
 *      implements against its own funnels table).
 *   6. Emit `template_cloned`.
 */

import type { MarketplaceDb } from "./port.js";
import { MarketplaceError, type Purchase } from "./types.js";

export interface CloneContext {
  db: MarketplaceDb;
  now?: () => Date;
}

export async function cloneTemplate(
  ctx: CloneContext,
  template_id: string,
  buyer_workspace_id: string,
): Promise<{ new_funnel_id: string; purchase: Purchase }> {
  const purchase = await ctx.db.hasPaidPurchase(template_id, buyer_workspace_id);
  if (!purchase) {
    throw new MarketplaceError("No paid purchase on record.", "NO_PAID_PURCHASE", 402);
  }
  if (purchase.status !== "paid") {
    throw new MarketplaceError(
      `Purchase status is ${purchase.status}; cannot clone.`,
      "PURCHASE_NOT_PAID",
      402,
    );
  }
  if (purchase.cloned_funnel_id) {
    return { new_funnel_id: purchase.cloned_funnel_id, purchase };
  }

  const template = await ctx.db.getTemplate(template_id);
  if (!template) throw new MarketplaceError("Template missing.", "TEMPLATE_NOT_FOUND", 404);

  const version = await ctx.db.getTemplateVersion(purchase.template_version_id);
  if (!version) throw new MarketplaceError("Template version missing.", "VERSION_NOT_FOUND", 404);

  // Re-build a `FunnelStub`-like object for the cloner. The buyer-side
  // implementation of `cloneFunnelInto` is responsible for assigning new
  // IDs, re-hosting assets, and writing the new row into `funnels`.
  const sourceFunnel = {
    id: template.funnel_id,
    workspace_id: template.creator_workspace_id,
    created_by: template.creator_id,
    lifetime_revenue_usd_cents: 0,
    published_at: null,
    unique_customer_count: 0,
    funnel_blob: stripIntegrations(version.funnel_blob),
    email_sequences_blob: version.email_sequences_blob,
    sms_sequences_blob: version.sms_sequences_blob,
    voice_script_blob: version.voice_script_blob,
    ad_creative_blob: version.ad_creative_blob,
    kb_pack_ref: version.kb_pack_ref,
  };

  const { new_funnel_id } = await ctx.db.cloneFunnelInto({
    source_funnel: sourceFunnel,
    buyer_workspace_id,
    template_parent_id: template.id,
    template_version_id: version.id,
  });

  const updated = await ctx.db.updatePurchase(purchase.id, {
    cloned_funnel_id: new_funnel_id,
    updated_at: (ctx.now ? ctx.now() : new Date()).toISOString(),
  });

  await safeEmit("template_cloned", {
    template_id,
    template_version_id: version.id,
    buyer_workspace_id,
    buyer_user_id: purchase.buyer_user_id,
    new_funnel_id,
    purchase_id: purchase.id,
  });

  return { new_funnel_id, purchase: updated };
}

/** Recursively strip integration connection keys + custom domain. */
function stripIntegrations(blob: unknown): unknown {
  if (blob == null || typeof blob !== "object") return blob;
  if (Array.isArray(blob)) return blob.map(stripIntegrations);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(blob as Record<string, unknown>)) {
    if (
      k === "integration_credentials" ||
      k === "stripe_account_id" ||
      k === "paypal_account_id" ||
      k === "custom_domain" ||
      k === "custom_domain_id" ||
      k === "ssl_cert_id" ||
      k === "tracking_pixel_secrets" ||
      k === "meta_pixel_token" ||
      k === "google_ads_conversion_secret" ||
      k === "webhook_signing_secret" ||
      k === "api_keys"
    ) {
      continue;
    }
    out[k] = stripIntegrations(v);
  }
  return out;
}

async function safeEmit(name: string, payload: unknown): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, no-console
    console.log(JSON.stringify({ event: name, ts: Date.now(), ...((payload as object) ?? {}) }));
  } catch {
    /* no-op */
  }
}
