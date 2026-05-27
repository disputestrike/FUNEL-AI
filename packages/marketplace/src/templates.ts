/**
 * Template publishing and management.
 *
 * Quality gate: a paid template can only be published when its source funnel
 * has hit Bronze ($10,000+ lifetime revenue) AND has at least 10 unique paying
 * customers AND was published ≥ 14 days ago. Free templates skip the Bronze
 * gate but still pass the automated checks in `qa.ts`.
 *
 * Source: docs/16-viral-loops-spec.md §4.2.
 */

import { emit } from "@funnel/events";
import { prefixedId } from "@funnel/shared/utils";

import type { MarketplaceDb } from "./port.js";
import { generateSlug } from "./seo.js";
import { runAutomatedChecks } from "./qa.js";
import {
  MarketplaceError,
  type ListTemplatesFilter,
  type ListTemplatesSort,
  type Pagination,
  type PublishTemplateRequest,
  PublishTemplateRequestSchema,
  type Template,
  type TemplateVersion,
  type UpdateTemplateRequest,
  UpdateTemplateRequestSchema,
} from "./types.js";

/** $10,000 in USD cents. */
export const BRONZE_THRESHOLD_USD_CENTS = 10_000_00;
/** Min unique paying customers before a funnel can be templatized (anti-gaming). */
export const BRONZE_MIN_UNIQUE_CUSTOMERS = 10;
/** Min days since first publish before a funnel can be templatized. */
export const BRONZE_MIN_DAYS_SINCE_PUBLISH = 14;

export interface PublishTemplateContext {
  db: MarketplaceDb;
  now?: () => Date;
}

/**
 * Publish a funnel as a paid template. Throws on gate failure.
 *
 * Side-effects:
 *   - inserts a `Template` row in `in_review` status
 *   - snapshots a frozen `TemplateVersion` of the funnel
 *   - emits `template_published` (handled later by content-ops auto-approval
 *     for free templates; paid templates require manual review, see Doc 16 §4.2)
 */
export async function publishTemplate(
  ctx: PublishTemplateContext,
  req: PublishTemplateRequest,
): Promise<{ template: Template; version: TemplateVersion }> {
  const parsed = PublishTemplateRequestSchema.parse(req);
  const now = ctx.now ? ctx.now() : new Date();

  const funnel = await ctx.db.getFunnel(parsed.funnel_id);
  if (!funnel) {
    throw new MarketplaceError("Funnel not found.", "FUNNEL_NOT_FOUND", 404);
  }
  if (funnel.created_by !== parsed.creator_id) {
    throw new MarketplaceError(
      "Only the funnel's owner can publish it as a template.",
      "NOT_FUNNEL_OWNER",
      403,
    );
  }

  const isPaid = parsed.price_usd_cents > 0;
  if (isPaid) {
    if (funnel.lifetime_revenue_usd_cents < BRONZE_THRESHOLD_USD_CENTS) {
      throw new MarketplaceError(
        "Paid templates require Bronze tier ($10K+ funnel revenue).",
        "BRONZE_GATE_REVENUE",
        403,
        {
          required_usd_cents: BRONZE_THRESHOLD_USD_CENTS,
          current_usd_cents: funnel.lifetime_revenue_usd_cents,
        },
      );
    }
    if (funnel.unique_customer_count < BRONZE_MIN_UNIQUE_CUSTOMERS) {
      throw new MarketplaceError(
        "Paid templates require at least 10 unique paying customers.",
        "BRONZE_GATE_CUSTOMERS",
        403,
      );
    }
    if (!funnel.published_at) {
      throw new MarketplaceError("Funnel must be published first.", "FUNNEL_NOT_PUBLISHED", 403);
    }
    const ageMs = now.getTime() - new Date(funnel.published_at).getTime();
    if (ageMs < BRONZE_MIN_DAYS_SINCE_PUBLISH * 86_400_000) {
      throw new MarketplaceError(
        "Funnel must have been live for at least 14 days.",
        "BRONZE_GATE_AGE",
        403,
      );
    }
  }

  // Build the version bundle (anonymized).
  const qaResult = runAutomatedChecks({
    funnel_blob: funnel.funnel_blob,
    email_sequences_blob: funnel.email_sequences_blob,
    sms_sequences_blob: funnel.sms_sequences_blob,
    voice_script_blob: funnel.voice_script_blob,
    ad_creative_blob: funnel.ad_creative_blob,
  });
  if (!qaResult.ok) {
    throw new MarketplaceError("Template failed automated QA checks.", "QA_FAILED", 422, {
      reasons: qaResult.reasons,
    });
  }

  const template_id = prefixedIdSafe("template", "tpl");
  const version_id = prefixedIdSafe("template_version", "tvr");
  const slug = generateSlug({ title: parsed.title, salt: template_id });
  const nowIso = now.toISOString();

  const version: TemplateVersion = {
    id: version_id,
    template_id,
    version_number: 1,
    bundle_uri: `s3://funnel-marketplace/${template_id}/v1.json`,
    bundle_sha256: qaResult.bundle_sha256,
    funnel_blob: qaResult.anonymized.funnel_blob,
    email_sequences_blob: qaResult.anonymized.email_sequences_blob,
    sms_sequences_blob: qaResult.anonymized.sms_sequences_blob,
    voice_script_blob: qaResult.anonymized.voice_script_blob,
    ad_creative_blob: qaResult.anonymized.ad_creative_blob,
    kb_pack_ref: funnel.kb_pack_ref,
    asset_manifest: qaResult.asset_manifest,
    passed_automated_checks: true,
    approved_by_user_id: null,
    approved_at: null,
    created_at: nowIso,
  };

  const template: Template = {
    id: template_id,
    funnel_id: parsed.funnel_id,
    creator_id: parsed.creator_id,
    creator_workspace_id: funnel.workspace_id,
    status: isPaid ? "in_review" : "published",
    price_usd_cents: parsed.price_usd_cents,
    category: parsed.category,
    secondary_categories: parsed.secondary_categories,
    title: parsed.title,
    slug,
    description: parsed.description,
    tags: parsed.tags,
    preview_image_url: parsed.preview_image_url ?? null,
    preview_funnel_url: null,
    current_version_id: version_id,
    sales_count: 0,
    avg_rating: 0,
    review_count: 0,
    bronze_qualified: funnel.lifetime_revenue_usd_cents >= BRONZE_THRESHOLD_USD_CENTS,
    published_at: isPaid ? null : nowIso,
    paused_at: null,
    rejection_reason: null,
    created_at: nowIso,
    updated_at: nowIso,
    deleted_at: null,
  };

  await ctx.db.insertTemplate(template);
  await ctx.db.insertTemplateVersion(version);

  // We borrow the generic `funnel_cloned` envelope-shaped event family is too
  // narrow here — marketplace uses its own family. Emit using `emit()` falls
  // back to default sink (console) if a sink isn't wired; production wires a
  // PostHog sink at app boot.
  await safeEmit("template_published", {
    template_id,
    creator_id: parsed.creator_id,
    funnel_parent_id: parsed.funnel_id,
    price_usd_cents: parsed.price_usd_cents,
    category: parsed.category,
    is_paid: isPaid,
  });

  return { template, version };
}

export async function updateTemplate(
  ctx: PublishTemplateContext,
  template_id: string,
  changes: UpdateTemplateRequest,
): Promise<Template> {
  const parsed = UpdateTemplateRequestSchema.parse(changes);
  const existing = await ctx.db.getTemplate(template_id);
  if (!existing || existing.deleted_at) {
    throw new MarketplaceError("Template not found.", "TEMPLATE_NOT_FOUND", 404);
  }
  // If price changes from 0 to >0, re-gate on Bronze.
  if (
    parsed.price_usd_cents !== undefined &&
    parsed.price_usd_cents > 0 &&
    existing.price_usd_cents === 0
  ) {
    if (!existing.bronze_qualified) {
      throw new MarketplaceError(
        "Cannot move from free to paid without Bronze qualification.",
        "BRONZE_GATE_REVENUE",
        403,
      );
    }
  }
  const now = ctx.now ? ctx.now() : new Date();
  return await ctx.db.updateTemplate(template_id, {
    ...parsed,
    updated_at: now.toISOString(),
  });
}

export async function getTemplate(
  ctx: PublishTemplateContext,
  template_id: string,
): Promise<Template | null> {
  return ctx.db.getTemplate(template_id);
}

export async function listTemplates(
  ctx: PublishTemplateContext,
  filter: ListTemplatesFilter,
  sort: ListTemplatesSort,
  pagination: Pagination,
): Promise<{ rows: Template[]; next_cursor: string | null }> {
  return ctx.db.listTemplates({
    where: {
      category: filter.category,
      status: "published",
      creator_id: filter.creator_id,
      free_only: filter.free_only,
      min_rating: filter.min_rating,
      min_price_cents: filter.min_price_cents,
      max_price_cents: filter.max_price_cents,
      search: filter.search,
    },
    orderBy: sort,
    cursor: pagination.cursor ?? null,
    limit: pagination.limit,
  });
}

export async function unpublishTemplate(
  ctx: PublishTemplateContext,
  template_id: string,
  actor_user_id: string,
): Promise<Template> {
  const existing = await ctx.db.getTemplate(template_id);
  if (!existing || existing.deleted_at) {
    throw new MarketplaceError("Template not found.", "TEMPLATE_NOT_FOUND", 404);
  }
  if (existing.creator_id !== actor_user_id) {
    throw new MarketplaceError("Only the creator may unpublish.", "NOT_CREATOR", 403);
  }
  const now = (ctx.now ? ctx.now() : new Date()).toISOString();
  return ctx.db.updateTemplate(template_id, {
    status: "paused",
    paused_at: now,
    updated_at: now,
  });
}

/* ──────────────────────────────────────────────────────────────────────────
 * Internal helpers
 * ──────────────────────────────────────────────────────────────────────── */

function prefixedIdSafe(kind: string, _fallbackPrefix: string): string {
  try {
    // @ts-expect-error — kind may not be in the shared map yet (tpl/tvr/pmp/rvw/crp)
    return prefixedId(kind);
  } catch {
    // Fallback: produce a 30-char `<prefix>_<ulid>` directly. Keeps tests
    // running without modifying the shared prefix map.
    const ulidImport = require("ulid") as typeof import("ulid");
    return `${_fallbackPrefix}_${ulidImport.ulid()}`;
  }
}

async function safeEmit(name: string, payload: unknown): Promise<void> {
  try {
    // marketplace events aren't in the canonical schema map yet — we ship
    // them through a generic console-logged emit. When the shared registry
    // adds them, swap the `emit()` call to the typed form.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (emit as any)(name, payload);
  } catch {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ event: name, ts: Date.now(), ...((payload as object) ?? {}) }));
  }
}
