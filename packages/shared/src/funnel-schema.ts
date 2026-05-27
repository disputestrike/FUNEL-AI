/**
 * Canonical Funnel JSON Schema — Zod (doc 18).
 *
 * The AI generation engine emits a `Funnel` object that conforms to this
 * schema. The renderer reads only this schema. Importers (ClickFunnels,
 * GoHighLevel, Leadpages) target this schema. Export produces this schema.
 *
 * If a behavior is not expressible here, it does not exist in the product.
 *
 * Block content discriminated union: the 60 block types enumerate every
 * `Section.type`. The eight most common block content shapes are typed
 * (hero.classic, form.classic-3-field, proof.testimonial-grid,
 * offer.value-stack, cta.button-single, content.faq, content.video-embed,
 * footer.minimal); the remaining 52 use a permissive `content: object`
 * fallback. As new blocks land, add their content schemas to
 * `BLOCK_CONTENT_SCHEMAS` and the validator picks them up automatically.
 */

import { z } from "zod";
import { BLOCK_TYPES } from "./types/funnel.js";
import { FunnelBrandTokensSchema } from "./schemas/branding.js";

// ---- Primitive shared types ---------------------------------------------

const UUID = z
  .string()
  .regex(
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
    { message: "must be a UUID" }
  );

const Slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .min(1)
  .max(80);

const URLSchema = z.string().url().max(2048);

const ISO8601 = z.string().datetime();

const HexColor = z
  .string()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/);

const SHA256_HEX = z.string().regex(/^[a-f0-9]{64}$/);

const BCP47 = z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/);

const ISO_COUNTRY = z.string().regex(/^[A-Z]{2}$/);

const SemVer = z.string().regex(/^\d+\.\d+\.\d+$/);

// ---- Block type enum ----------------------------------------------------

export const BlockTypeSchema = z.enum(BLOCK_TYPES);

// ---- Style overrides, conditional display -------------------------------

export const StyleOverridesSchema = z
  .object({
    background: HexColor.optional(),
    text_color: HexColor.optional(),
    padding_y: z.enum(["none", "sm", "md", "lg", "xl"]).optional(),
    max_width: z.enum(["narrow", "default", "wide", "full"]).optional(),
    alignment: z.enum(["left", "center", "right"]).optional(),
    border_top: z.boolean().optional(),
    border_bottom: z.boolean().optional(),
  })
  .strict();

export const ConditionalDisplaySchema = z
  .object({
    device: z.enum(["all", "mobile_only", "desktop_only"]).optional(),
    geo_allow: z.array(ISO_COUNTRY).optional(),
    geo_deny: z.array(ISO_COUNTRY).optional(),
    utm_match: z.record(z.string()).optional(),
    schedule_start: ISO8601.optional(),
    schedule_end: ISO8601.optional(),
  })
  .strict();

// ---- Block content schemas (8 of 60 typed) ------------------------------

/** B.1.1 — hero.classic. Headline + subhead + CTA + hero image. */
export const HeroClassicContentSchema = z
  .object({
    eyebrow: z.string().max(40).optional(),
    headline: z.string().min(1).max(120),
    subhead: z.string().max(240).optional(),
    primary_cta_id: UUID,
    secondary_cta_id: UUID.optional(),
    hero_asset_id: UUID,
    trust_strip: z
      .array(
        z.object({
          label: z.string().max(40),
          asset_id: UUID.optional(),
        })
      )
      .max(8)
      .optional(),
  })
  .strict();

/** B.2.2 — form.classic-3-field. Name + email + phone. The workhorse. */
export const FormClassic3FieldContentSchema = z
  .object({
    form_id: UUID,
    headline: z.string().max(120).optional(),
    subhead: z.string().max(240).optional(),
    consent_copy_override: z.string().max(600).optional(),
    show_phone_optional: z.boolean().optional(),
  })
  .strict();

/** B.3.1 — proof.testimonial-grid. */
export const ProofTestimonialGridContentSchema = z
  .object({
    headline: z.string().max(120).optional(),
    testimonials: z
      .array(
        z.object({
          id: z.string().min(1),
          quote: z.string().min(1).max(600),
          author_name: z.string().min(1).max(120),
          author_title: z.string().max(120).optional(),
          author_photo_asset_id: UUID.optional(),
          star_rating: z.number().int().min(1).max(5).optional(),
          source_attribution: z.string().max(120).optional(),
        })
      )
      .min(3)
      .max(9),
    show_star_ratings: z.boolean(),
  })
  .strict();

/** B.4.4 — offer.value-stack. Hormozi-style with prices crossed out. */
export const OfferValueStackContentSchema = z
  .object({
    headline: z.string().max(120).optional(),
    subhead: z.string().max(240).optional(),
    items: z
      .array(
        z.object({
          name: z.string().min(1).max(120),
          description: z.string().max(240).optional(),
          value_amount: z.number().nonnegative(),
          currency: z.string().length(3),
        })
      )
      .min(3)
      .max(12),
    total_value_label: z.string().min(1).max(120),
    your_price_amount: z.number().nonnegative(),
    your_price_currency: z.string().length(3),
    savings_label: z.string().max(120).optional(),
    cta_id: UUID,
    disclaimer: z.string().max(600).optional(),
  })
  .strict();

/** B.5.1 — cta.button-single. */
export const CtaButtonSingleContentSchema = z
  .object({
    cta_id: UUID,
    alignment: z.enum(["left", "center", "right"]),
    microcopy_above: z.string().max(160).optional(),
    microcopy_below: z.string().max(160).optional(),
  })
  .strict();

/** B.6.2 — content.faq. */
export const ContentFaqContentSchema = z
  .object({
    headline: z.string().max(120).optional(),
    items: z
      .array(
        z.object({
          question: z.string().min(1).max(240),
          answer_markdown: z.string().min(1).max(4000),
        })
      )
      .min(3)
      .max(20),
    expand_first_by_default: z.boolean(),
    emit_schema_markup: z.boolean(),
  })
  .strict();

/** B.6.3 — content.video-embed. */
export const ContentVideoEmbedContentSchema = z
  .object({
    video_asset_id: UUID.optional(),
    /** External provider/url combo if not hosted as an Asset. */
    provider: z.enum(["youtube", "vimeo", "wistia", "loom", "self_hosted"]).optional(),
    external_url: URLSchema.optional(),
    poster_asset_id: UUID.optional(),
    autoplay_muted_loop: z.boolean().optional(),
    aspect_ratio: z.enum(["16:9", "9:16", "1:1", "4:5"]).default("16:9"),
    caption: z.string().max(240).optional(),
  })
  .strict()
  .refine(
    (v) => Boolean(v.video_asset_id) || Boolean(v.external_url),
    { message: "Either video_asset_id or external_url must be set" }
  );

/** B.9.1 — footer.minimal. */
export const FooterMinimalContentSchema = z
  .object({
    ai_disclosure_required: z.boolean(),
    /** Optional override of the canonical disclosure copy. Renderer falls back to the locale bundle. */
    ai_disclosure_text_override: z.string().max(600).optional(),
    links: z
      .array(
        z.object({
          label: z.string().min(1).max(60),
          url: URLSchema,
        })
      )
      .max(12),
    copyright_text: z.string().max(240).optional(),
  })
  .strict();

/**
 * Map of `BlockType` -> Zod schema for that block's `content`. Adding a new
 * block content schema is a one-liner here.
 */
export const BLOCK_CONTENT_SCHEMAS: Partial<Record<(typeof BLOCK_TYPES)[number], z.ZodTypeAny>> = {
  "hero.classic": HeroClassicContentSchema,
  "form.classic-3-field": FormClassic3FieldContentSchema,
  "proof.testimonial-grid": ProofTestimonialGridContentSchema,
  "offer.value-stack": OfferValueStackContentSchema,
  "cta.button-single": CtaButtonSingleContentSchema,
  "content.faq": ContentFaqContentSchema,
  "content.video-embed": ContentVideoEmbedContentSchema,
  "footer.minimal": FooterMinimalContentSchema,
};

// ---- Section / Page -----------------------------------------------------

export const SectionVariantSchema = z.object({
  id: UUID,
  label: z.string().max(60).optional(),
  weight: z.number().min(0).max(1),
  content: z.record(z.unknown()),
});

export const SectionSchema = z
  .object({
    id: UUID,
    type: BlockTypeSchema,
    variant: z.string().optional(),
    content: z.record(z.unknown()),
    style_overrides: StyleOverridesSchema.optional(),
    conditional_display: ConditionalDisplaySchema.optional(),
    variants: z.array(SectionVariantSchema).optional(),
  })
  .superRefine((section, ctx) => {
    // Block-specific content validation (only for the 8 typed blocks).
    const schema = BLOCK_CONTENT_SCHEMAS[section.type];
    if (schema) {
      const result = schema.safeParse(section.content);
      if (!result.success) {
        for (const issue of result.error.issues) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["content", ...issue.path],
            message: issue.message,
          });
        }
      }
    }
    // A/B variant weights must sum to ~1.0 (including the base content).
    if (section.variants && section.variants.length > 0) {
      // Base content carries an implicit weight of (1 - sum_of_variants).
      const sum = section.variants.reduce((acc, v) => acc + v.weight, 0);
      if (sum > 1.0001) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["variants"],
          message: `variant weights sum > 1 (got ${sum.toFixed(4)})`,
        });
      }
    }
  });

export const PageMetadataSchema = z
  .object({
    title: z.string().min(1).max(70).optional(),
    description: z.string().min(1).max(160).optional(),
    og_image: z.string().optional(),
    schema_markup: z.record(z.unknown()).optional(),
    canonical_url: URLSchema.optional(),
    robots: z
      .enum(["index,follow", "noindex,follow", "index,nofollow", "noindex,nofollow"])
      .optional(),
  })
  .strict();

export const PageTrackingPixelSchema = z.object({
  provider: z.enum([
    "meta",
    "google_ads",
    "google_analytics",
    "tiktok",
    "linkedin",
    "x",
    "pinterest",
    "custom",
  ]),
  id: z.string().min(1).max(64),
  events: z.array(z.string().max(64)).optional(),
});

export const PageTrackingSchema = z
  .object({
    pixels: z.array(PageTrackingPixelSchema).optional(),
    utm_passthrough: z.boolean().optional(),
    consent_required: z.boolean().optional(),
  })
  .strict();

export const PageSchema = z
  .object({
    id: UUID,
    name: z.string().max(120).optional(),
    type: z.enum([
      "landing",
      "thank-you",
      "checkout",
      "upsell",
      "downsell",
      "membership",
      "booking",
      "confirmation",
    ]),
    slug: Slug.optional(),
    sections: z.array(SectionSchema).min(1).max(80),
    page_metadata: PageMetadataSchema.optional(),
    tracking: PageTrackingSchema.optional(),
    redirect_after_submit_page_id: UUID.optional(),
  })
  .strict()
  .superRefine((page, ctx) => {
    if (page.type === "landing" && !page.page_metadata) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["page_metadata"],
        message: "page_metadata is required for landing pages",
      });
    }
  });

// ---- Top-level Funnel object ----------------------------------------------

export const FunnelMetadataSchema = z
  .object({
    id: UUID,
    workspace_id: UUID,
    name: z.string().min(1).max(120),
    slug: Slug,
    version: SemVer,
    status: z.enum(["draft", "in_review", "published", "archived", "blocked_by_compliance"]),
    language: BCP47,
    geography: z
      .object({
        country: ISO_COUNTRY.optional(),
        region: z.string().max(80).optional(),
        timezone: z.string().max(64).optional(),
      })
      .optional(),
    industry: z.string().max(64).optional(),
    voice_persona: z
      .object({
        tone: z
          .enum(["expert", "friendly", "urgent", "premium", "playful", "no-bs"])
          .optional(),
        reading_level: z.number().int().min(4).max(14).optional(),
        formality: z.enum(["formal", "neutral", "casual"]).optional(),
        voice_keywords: z.array(z.string()).max(12).optional(),
        do_not_use: z.array(z.string()).max(32).optional(),
        persona_slug: z.string().optional(),
      })
      .optional(),
    created_at: ISO8601,
    updated_at: ISO8601,
    created_by: UUID.optional(),
    tags: z.array(z.string().max(40)).max(24).optional(),
  })
  .strict();

export const AssetSchema = z
  .object({
    id: UUID,
    type: z.enum(["image", "video", "audio", "document"]),
    url: URLSchema,
    license_type: z.enum([
      "royalty_free",
      "creative_commons",
      "purchased",
      "user_uploaded",
      "ai_generated",
      "public_domain",
    ]),
    license_metadata: z
      .object({
        source: z.string().max(120).optional(),
        license_id: z.string().max(120).optional(),
        purchased_by: UUID.optional(),
        purchase_date: ISO8601.optional(),
        ai_model: z.string().max(64).optional(),
        ai_prompt_hash: z.string().max(64).optional(),
      })
      .optional(),
    license_attribution: z.string().max(240).optional(),
    alt_text: z.string().max(240).optional(),
    dimensions: z
      .object({
        width_px: z.number().int().positive().optional(),
        height_px: z.number().int().positive().optional(),
        duration_seconds: z.number().nonnegative().optional(),
      })
      .optional(),
    file_size_bytes: z.number().int().nonnegative().optional(),
    mime_type: z.string().max(80).optional(),
    checksum_sha256: SHA256_HEX.optional(),
  })
  .strict()
  .superRefine((asset, ctx) => {
    if ((asset.type === "image" || asset.type === "video") && !asset.alt_text) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["alt_text"],
        message: "alt_text is required for image and video assets",
      });
    }
  });

export const FormFieldSchema = z
  .object({
    id: UUID,
    type: z.enum([
      "text",
      "email",
      "tel",
      "number",
      "textarea",
      "select",
      "multiselect",
      "radio",
      "checkbox",
      "date",
      "time",
      "address",
      "hidden",
      "consent",
      "file",
    ]),
    label: z.string().min(1).max(80),
    name: z.string().regex(/^[a-z_][a-z0-9_]*$/).max(40),
    placeholder: z.string().max(80).optional(),
    help_text: z.string().max(200).optional(),
    required: z.boolean().optional(),
    default_value: z.string().max(240).optional(),
    options: z
      .array(
        z.object({
          value: z.string().max(120),
          label: z.string().max(120),
        })
      )
      .optional(),
    validation: z
      .object({
        min_length: z.number().int().nonnegative().optional(),
        max_length: z.number().int().positive().optional(),
        min: z.number().optional(),
        max: z.number().optional(),
        pattern: z.string().optional(),
        custom_message: z.string().max(200).optional(),
      })
      .optional(),
    pii_classification: z.enum(["none", "low", "medium", "high"]).default("medium"),
  })
  .strict();

export const FormSchema = z
  .object({
    id: UUID,
    name: z.string().max(80).optional(),
    fields: z.array(FormFieldSchema).min(1).max(24),
    submit_action: z
      .object({
        type: z.enum([
          "redirect_to_page",
          "redirect_to_url",
          "show_message",
          "trigger_download",
          "open_calendar",
          "start_checkout",
        ]),
        redirect_page_id: UUID.optional(),
        redirect_url: URLSchema.optional(),
        message_markdown: z.string().max(2000).optional(),
        download_asset_id: UUID.optional(),
        calendar_provider: z.enum(["calendly", "cal_com", "google", "native"]).optional(),
        checkout_offer_id: UUID.optional(),
      })
      .strict(),
    lead_routing_rules: z.array(z.unknown()).optional(),
    consent_capture: z
      .object({
        marketing_consent_required: z.boolean().optional(),
        marketing_consent_copy: z.string().max(600).optional(),
        tcpa_required: z.boolean().optional(),
        tcpa_copy: z.string().max(800).optional(),
        gdpr_required: z.boolean().optional(),
        data_processor_disclosure: z.string().max(800).optional(),
      })
      .optional(),
    success_state: z
      .object({
        headline: z.string().max(120).optional(),
        body_markdown: z.string().max(2000).optional(),
        next_step_cta_id: UUID.optional(),
      })
      .optional(),
    anti_spam: z
      .object({
        honeypot: z.boolean().optional(),
        rate_limit_per_ip_per_minute: z.number().int().nonnegative().optional(),
        captcha: z.enum(["none", "invisible_recaptcha_v3", "turnstile"]).optional(),
      })
      .optional(),
  })
  .strict();

export const CTASchema = z
  .object({
    id: UUID,
    label: z.string().min(1).max(60),
    sublabel: z.string().max(80).optional(),
    action: z
      .object({
        type: z.enum([
          "link",
          "form",
          "checkout",
          "booking",
          "phone-call",
          "scroll-to-section",
          "open-modal",
          "download",
        ]),
        link_url: URLSchema.optional(),
        form_id: UUID.optional(),
        offer_id: UUID.optional(),
        phone_e164: z.string().regex(/^\+[1-9][0-9]{6,14}$/).optional(),
        scroll_section_id: UUID.optional(),
        modal_section_id: UUID.optional(),
        download_asset_id: UUID.optional(),
      })
      .strict(),
    tracking_id: z.string().max(80).optional(),
    style: z
      .object({
        variant: z
          .enum(["primary", "secondary", "tertiary", "ghost", "destructive"])
          .optional(),
        size: z.enum(["sm", "md", "lg", "xl"]).optional(),
        full_width_on_mobile: z.boolean().optional(),
        icon_left: z.string().max(40).optional(),
        icon_right: z.string().max(40).optional(),
      })
      .optional(),
  })
  .strict();

export const IntegrationsSchema = z
  .object({
    crms: z.array(z.record(z.unknown())).optional(),
    email_esp: z.array(z.record(z.unknown())).optional(),
    sms: z.array(z.record(z.unknown())).optional(),
    payments: z.array(z.record(z.unknown())).optional(),
    analytics: z.array(z.record(z.unknown())).optional(),
    webhooks: z
      .array(
        z
          .object({
            id: UUID,
            url: URLSchema,
            events: z.array(z.string()).min(1),
            signing_secret_id: z.string().optional(),
            retry_policy: z
              .object({
                max_attempts: z.number().int().min(1).max(10).optional(),
                backoff: z.enum(["linear", "exponential"]).optional(),
              })
              .optional(),
          })
          .strict()
      )
      .optional(),
  })
  .strict();

export const FunnelComplianceStateSchema = z
  .object({
    ai_disclosure_visible: z.boolean(),
    publish_acknowledged_at: ISO8601.optional(),
    publish_acknowledged_by: UUID.optional(),
    regulated_vertical_flag: z.boolean(),
    compliance_agent_pass_at: ISO8601.optional(),
    compliance_agent_findings: z
      .array(
        z.object({
          severity: z.enum(["info", "warning", "blocker"]),
          rule_id: z.string().max(80),
          message: z.string().max(800),
          section_id: UUID.optional(),
        })
      )
      .optional(),
    fact_check_pass_at: ISO8601.optional(),
    fact_check_findings: z
      .array(
        z.object({
          claim_text: z.string().max(600).optional(),
          claim_status: z
            .enum(["verified", "needs_source", "unverifiable", "false"])
            .optional(),
          evidence_url: URLSchema.optional(),
          section_id: UUID.optional(),
        })
      )
      .optional(),
    content_hash: SHA256_HEX.optional(),
    audit_log_pointer: z.string().optional(),
    data_processor_addendum_signed_at: ISO8601.optional(),
  })
  .strict()
  .superRefine((c, ctx) => {
    if (c.regulated_vertical_flag && !c.fact_check_pass_at) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["fact_check_pass_at"],
        message: "fact_check_pass_at is required when regulated_vertical_flag is true",
      });
    }
  });

export const GenerationProvenanceSchema = z
  .object({
    generated_at: ISO8601,
    model_versions: z
      .array(
        z.object({
          role: z.enum([
            "planner",
            "writer",
            "designer",
            "compliance",
            "fact_check",
            "image",
            "video",
          ]),
          model: z.string().max(120),
        })
      )
      .min(1),
    kb_pack_version: SemVer,
    kb_snapshot_id: UUID.optional(),
    prompt_hash_per_section: z.record(SHA256_HEX).optional(),
    cost_usd: z
      .object({
        total: z.number().nonnegative().optional(),
        by_role: z.record(z.number().nonnegative()).optional(),
        currency: z.string().optional(),
      })
      .optional(),
    seed: z.number().int().optional(),
    regeneration_lineage: z
      .array(
        z.object({
          parent_funnel_id: UUID.optional(),
          regenerated_at: ISO8601.optional(),
          reason: z.string().max(200).optional(),
        })
      )
      .optional(),
  })
  .strict();

/** The full Funnel JSON. */
export const FunnelSchema = z
  .object({
    schema_version: SemVer,
    metadata: FunnelMetadataSchema,
    pages: z.array(PageSchema).min(1).max(12),
    assets: z.array(AssetSchema).optional(),
    forms: z.array(FormSchema).optional(),
    ctas: z.array(CTASchema).optional(),
    brand_tokens: FunnelBrandTokensSchema,
    integrations: IntegrationsSchema.optional(),
    compliance: FunnelComplianceStateSchema,
    provenance: GenerationProvenanceSchema,
  })
  .strict()
  .superRefine((funnel, ctx) => {
    // Cross-reference integrity: form_id / cta_id / asset_id references
    // mentioned anywhere in sections must resolve.
    const formIds = new Set((funnel.forms ?? []).map((f) => f.id));
    const ctaIds = new Set((funnel.ctas ?? []).map((c) => c.id));
    const assetIds = new Set((funnel.assets ?? []).map((a) => a.id));
    const pageIds = new Set(funnel.pages.map((p) => p.id));

    funnel.pages.forEach((page, pIdx) => {
      page.sections.forEach((section, sIdx) => {
        // Inspect well-known keys in content.
        const c = section.content;
        const refs: Array<[string, "form" | "cta" | "asset" | "page"]> = [
          ["form_id", "form"],
          ["primary_cta_id", "cta"],
          ["secondary_cta_id", "cta"],
          ["cta_id", "cta"],
          ["hero_asset_id", "asset"],
          ["video_asset_id", "asset"],
          ["poster_asset_id", "asset"],
          ["author_photo_asset_id", "asset"],
          ["before_asset_id", "asset"],
          ["after_asset_id", "asset"],
          ["redirect_page_id", "page"],
        ];
        for (const [key, kind] of refs) {
          const id = (c as Record<string, unknown>)[key];
          if (typeof id !== "string") continue;
          if (kind === "form" && !formIds.has(id)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["pages", pIdx, "sections", sIdx, "content", key],
              message: `${key} references unknown form ${id}`,
            });
          }
          if (kind === "cta" && !ctaIds.has(id)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["pages", pIdx, "sections", sIdx, "content", key],
              message: `${key} references unknown cta ${id}`,
            });
          }
          if (kind === "asset" && !assetIds.has(id)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["pages", pIdx, "sections", sIdx, "content", key],
              message: `${key} references unknown asset ${id}`,
            });
          }
          if (kind === "page" && !pageIds.has(id)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["pages", pIdx, "sections", sIdx, "content", key],
              message: `${key} references unknown page ${id}`,
            });
          }
        }
      });
    });
  });

/** Parsed Funnel type. Use this rather than the loose interface from `types/`. */
export type ParsedFunnel = z.output<typeof FunnelSchema>;

/**
 * Validate an unknown payload as a Funnel. Returns the parsed funnel on
 * success or throws a `ValidationError` (typed) on failure.
 */
export function parseFunnel(input: unknown): ParsedFunnel {
  return FunnelSchema.parse(input);
}

/**
 * Safe variant: returns a discriminated result rather than throwing.
 */
export function safeParseFunnel(
  input: unknown
): { ok: true; funnel: ParsedFunnel } | { ok: false; issues: z.ZodIssue[] } {
  const result = FunnelSchema.safeParse(input);
  if (result.success) return { ok: true, funnel: result.data };
  return { ok: false, issues: result.error.issues };
}
