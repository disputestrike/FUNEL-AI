/**
 * Adapter: maps the legacy `AutomatedFunnel` shape (returned by
 * `buildAutomatedFunnel`) into the canonical Funnel-renderer shape consumed
 * by `<FunnelPreviewRenderer />`.
 *
 * The renderer wants the doc-18 Funnel JSON layout (pages -> sections with a
 * `type` from BLOCK_TYPES, plus resolvable assets/forms/ctas). The legacy
 * AutomatedFunnel uses a smaller set of section types (hero, lead_magnet,
 * proof_stack, etc.) — this adapter projects those onto real block types so
 * the renderer can show them with full visual quality.
 */

import type {
  AutomatedFunnel,
  AutomatedFunnelPage,
  AutomatedFunnelSection,
  FunnelCta,
} from "@funnel/orchestrator";
import type { RendererFunnel } from "@funnel/ui";

// We don't bring in the full ParsedFunnel here — the renderer accepts a
// RendererFunnel which has loose typing for streaming/partial scenarios.

let uuidCounter = 0;
function uuid(prefix: string): string {
  // Deterministic-ish synthetic UUIDs (good enough for in-memory rendering).
  uuidCounter += 1;
  const time = Date.now().toString(16).padStart(12, "0").slice(-12);
  const n = uuidCounter.toString(16).padStart(4, "0").slice(-4);
  return `${prefix.padEnd(8, "0").slice(0, 8)}-${n}-4000-8000-${time}`;
}

function mkCta(label: string, action: FunnelCta["action"] | undefined, target?: string): { id: string; cta: any } {
  const id = uuid("cta");
  return {
    id,
    cta: {
      id,
      label,
      action: {
        type: action === "book_call" ? "booking" : action === "buy" ? "checkout" : action === "next_page" ? "link" : "form",
        link_url: target,
      },
      style: { variant: "primary", size: "lg" },
    },
  };
}

function mkForm(fields: AutomatedFunnelSection["fields"]): { id: string; form: any } {
  const id = uuid("form");
  return {
    id,
    form: {
      id,
      fields:
        (fields ?? []).map((f) => ({
          id: uuid("fld"),
          type: f.type === "select" ? "select" : (f.type as "text" | "email" | "tel" | "number"),
          label: f.label,
          name: f.id,
          placeholder: f.placeholder,
          required: f.required,
          options: f.options?.map((opt) => ({ value: opt, label: opt })),
          pii_classification: f.type === "email" || f.type === "tel" ? "high" : "medium",
        })),
      submit_action: { type: "redirect_to_page" },
      consent_capture: {
        marketing_consent_required: true,
        marketing_consent_copy: "By submitting you agree to receive helpful updates. Reply STOP to opt out.",
      },
    },
  };
}

function mkAsset(id: string, url: string, alt: string): any {
  return {
    id,
    type: "image",
    url,
    license_type: "ai_generated",
    alt_text: alt,
    dimensions: { width_px: 1280, height_px: 800 },
  };
}

interface MappingCtx {
  assets: any[];
  forms: any[];
  ctas: any[];
  assetsById: Map<string, any>;
}

function findAssetUrl(ctx: MappingCtx, assetId: string | undefined, fallbackAlt: string): string | undefined {
  if (!assetId) return undefined;
  const hit = ctx.assetsById.get(assetId);
  return hit?.url;
}

function mapSection(s: AutomatedFunnelSection, ctx: MappingCtx, isFirst: boolean): any {
  const sectionId = uuid("sec");

  // Resolve the optional hero/cover image asset reference.
  const heroAssetUrl = findAssetUrl(ctx, s.assetId, s.title);
  const heroAssetId = s.assetId ? ctx.assetsById.get(s.assetId)?.id : undefined;

  // Build the section CTA when present.
  let ctaId: string | undefined;
  if (s.cta) {
    const { id, cta } = mkCta(s.cta.label, s.cta.action, s.cta.target);
    ctx.ctas.push(cta);
    ctaId = id;
  }

  switch (s.type) {
    case "hero":
      return {
        id: sectionId,
        type: isFirst ? "hero.classic" : "hero.minimal",
        content: {
          eyebrow: s.eyebrow,
          headline: s.title,
          subhead: s.body,
          primary_cta_id: ctaId,
          hero_asset_id: heroAssetId,
          trust_strip: (s.bullets ?? []).slice(0, 4).map((b) => ({ label: b })),
        },
      };

    case "logo_proof":
      return {
        id: sectionId,
        type: "proof.logo-bar",
        content: {
          headline: s.title,
          logos: (s.bullets ?? []).slice(0, 6).map((b) => ({ label: b })),
        },
      };

    case "lead_magnet":
      return {
        id: sectionId,
        type: "specialty.lead-magnet-delivery",
        content: {
          headline: s.title,
          subhead: s.body,
          cover_asset_id: heroAssetId,
          download_cta_id: ctaId,
          what_you_get: s.bullets,
        },
      };

    case "problem_story":
      return {
        id: sectionId,
        type: "content.text-block",
        content: {
          headline: s.title,
          body_markdown: s.body,
        },
      };

    case "proof_stack":
      return {
        id: sectionId,
        type: "proof.testimonial-grid",
        content: {
          headline: s.title,
          show_star_ratings: true,
          testimonials:
            (s.cards ?? []).slice(0, 6).map((c, i) => ({
              id: `t${i}`,
              quote: c.body,
              author_name: c.title,
              author_title: "Verified result",
              star_rating: 5,
            })),
        },
      };

    case "qualification_form": {
      const { id: formId, form } = mkForm(s.fields);
      ctx.forms.push(form);
      return {
        id: sectionId,
        type: "form.classic-3-field",
        content: {
          form_id: formId,
          headline: s.title,
          subhead: s.body,
        },
      };
    }

    case "offer_stack":
      return {
        id: sectionId,
        type: "offer.benefit-list",
        content: {
          headline: s.title,
          subhead: s.body,
          benefits: (s.bullets ?? []).map((b) => ({ title: b })),
        },
      };

    case "upsell_ladder":
      return {
        id: sectionId,
        type: "offer.pricing-tiers",
        content: {
          headline: s.title,
          subhead: s.body,
          tiers: (s.cards ?? []).slice(0, 3).map((c) => {
            const priceMatch = c.meta?.match(/\$([\d,]+)/);
            const amount = priceMatch ? Number(priceMatch[1].replace(/,/g, "")) : 0;
            return {
              name: c.title,
              price_amount: amount,
              price_currency: "USD",
              description: c.body,
              features: c.meta ? [c.meta] : [],
              featured: false,
            };
          }),
        },
      };

    case "faq":
      return {
        id: sectionId,
        type: "content.faq",
        content: {
          headline: s.title,
          expand_first_by_default: true,
          emit_schema_markup: false,
          items:
            (s.cards ?? []).map((c) => ({
              question: c.title,
              answer_markdown: c.body,
            })),
        },
      };

    case "final_cta":
      return {
        id: sectionId,
        type: "cta.button-single",
        content: {
          cta_id: ctaId,
          alignment: "center",
          microcopy_above: s.eyebrow,
          microcopy_below: s.body,
        },
      };

    case "thank_you":
      return {
        id: sectionId,
        type: "hero.minimal",
        content: {
          eyebrow: s.eyebrow,
          headline: s.title,
          subhead: s.body,
          primary_cta_id: ctaId,
        },
      };

    case "upsell_offer":
      return {
        id: sectionId,
        type: "offer.single-card",
        content: {
          headline: s.eyebrow,
          product_name: s.title,
          price_amount: 0,
          price_currency: "USD",
          description: s.body,
          features: s.bullets,
          image_asset_id: heroAssetId,
          cta_id: ctaId,
        },
      };

    default:
      return {
        id: sectionId,
        type: "content.text-block",
        content: { headline: s.title, body_markdown: s.body },
      };
  }
}

function mapPage(p: AutomatedFunnelPage, ctx: MappingCtx): any {
  const sections = p.sections.map((s, i) => mapSection(s, ctx, i === 0));
  // Always close with a minimal footer.
  sections.push({
    id: uuid("sec"),
    type: "footer.minimal",
    content: {
      ai_disclosure_required: true,
      links: [
        { label: "Privacy", url: "/privacy" },
        { label: "Terms", url: "/terms" },
        { label: "Contact", url: "/contact" },
      ],
    },
  });
  return {
    id: uuid("pag"),
    name: p.title,
    type: p.id === "thank_you" ? "thank-you" : p.id === "upsell" ? "upsell" : "landing",
    slug: p.path.split("/").pop(),
    sections,
    page_metadata: { title: p.title, description: p.goal },
  };
}

export interface AutomatedToRendererResult {
  funnel: RendererFunnel;
  /** Map of page index -> renderer page id (for the page tabs). */
  pageIds: string[];
}

export function automatedFunnelToRenderer(af: AutomatedFunnel): AutomatedToRendererResult {
  const ctx: MappingCtx = {
    assets: [],
    forms: [],
    ctas: [],
    assetsById: new Map(),
  };

  // Map every legacy asset into a renderer Asset and index by legacy id.
  for (const a of af.assets) {
    const id = uuid("ast");
    const asset = mkAsset(id, a.url, a.alt);
    ctx.assets.push(asset);
    ctx.assetsById.set(a.id, asset);
  }

  const pages = af.pages.map((p) => mapPage(p, ctx));

  // Project the legacy styleGuide.palette onto brand_tokens.colors.primary.500.
  const brand_tokens: any = {
    colors: {
      primary: { "500": af.styleGuide.palette.primary, "600": af.styleGuide.palette.secondary },
      secondary: { "500": af.styleGuide.palette.secondary },
      accent: { "500": af.styleGuide.palette.accent },
      neutral: { "500": "#64748b" },
      semantic: { success: "#16a34a", warning: "#f59e0b", error: "#ef4444", info: "#0ea5e9" },
    },
    typography: {
      font_families: {
        heading_display: af.styleGuide.typography.heading,
        body: af.styleGuide.typography.body,
      },
      font_sizes: {},
      font_weights: { regular: 400, medium: 500, semibold: 600, bold: 700 },
      line_heights: {},
    },
    spacing: {},
    border_radius: { md: af.styleGuide.radius },
    shadows: { md: af.styleGuide.shadow },
  };

  const funnel: RendererFunnel = {
    schema_version: "1.0.0",
    metadata: {
      id: af.id,
      name: af.industry,
      slug: af.slug,
      language: "en",
    },
    pages,
    assets: ctx.assets,
    forms: ctx.forms,
    ctas: ctx.ctas,
    brand_tokens,
  };

  return { funnel, pageIds: pages.map((p) => p.id) };
}
