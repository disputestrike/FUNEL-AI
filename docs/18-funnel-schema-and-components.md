# 18 â€” Funnel JSON Schema and 60-Block Component Library

**Status:** Canonical specification for FunelAI v1 (Day 90 launch)
**Owner:** Platform / Renderer / Generation Engine teams
**Last updated:** 2026-05-25
**Audience:** Engineering (renderer, generation, marketplace, importers), Design Systems, QA, Compliance Eng

This document is the source of truth for the Funnel JSON object. The AI generation engine outputs a `Funnel` object that conforms to the schema in Part A. The renderer reads only this schema. The marketplace serializes and deserializes this schema. Import adapters (ClickFunnels, GoHighLevel, Leadpages) target this schema. Export produces this schema.

If a behavior is not expressible in the schema, it does not exist in the product. The schema is the API contract between Generation, Rendering, Storage, and the Marketplace.

---

## Table of Contents

- [Part A â€” Funnel JSON Schema](#part-a--funnel-json-schema)
  - [A.1 Conceptual model](#a1-conceptual-model)
  - [A.2 Required vs optional fields summary](#a2-required-vs-optional-fields-summary)
  - [A.3 Full JSON Schema (draft 2020-12)](#a3-full-json-schema-draft-2020-12)
  - [A.4 Worked example: a 1-page solar-quote funnel](#a4-worked-example-a-1-page-solar-quote-funnel)
  - [A.5 Validation rules and invariants](#a5-validation-rules-and-invariants)
- [Part B â€” 60-Block Component Library](#part-b--60-block-component-library)
  - [B.0 Block specification format](#b0-block-specification-format)
  - [B.1 Hero blocks (6)](#b1-hero-blocks-6)
  - [B.2 Form blocks (8)](#b2-form-blocks-8)
  - [B.3 Proof blocks (8)](#b3-proof-blocks-8)
  - [B.4 Offer blocks (8)](#b4-offer-blocks-8)
  - [B.5 CTA blocks (4)](#b5-cta-blocks-4)
  - [B.6 Content blocks (8)](#b6-content-blocks-8)
  - [B.7 Trust signal blocks (6)](#b7-trust-signal-blocks-6)
  - [B.8 Interactive blocks (6)](#b8-interactive-blocks-6)
  - [B.9 Footer blocks (2)](#b9-footer-blocks-2)
  - [B.10 Specialty blocks (4)](#b10-specialty-blocks-4)
- [Part C â€” Design Tokens](#part-c--design-tokens)
- [Part D â€” Schema Versioning and Migration](#part-d--schema-versioning-and-migration)

---

# Part A â€” Funnel JSON Schema

## A.1 Conceptual model

A **Funnel** is the top-level object. It owns:

- **metadata** â€” identity, ownership, lifecycle, locale, brand identity tokens.
- **pages[]** â€” ordered list of pages. Most funnels are 1 page; multi-step funnels (opt-in â†’ thank-you â†’ upsell â†’ downsell â†’ confirmation) are up to 6 pages typically.
- **assets[]** â€” flat registry of every image / video / audio / document referenced anywhere in the funnel. Sections reference assets by `asset_id`, not by URL, so a single asset replacement updates every usage and the license audit is trivial.
- **forms[]** â€” flat registry of form definitions (referenced by Section blocks by `form_id`).
- **ctas[]** â€” flat registry of CTA definitions (referenced by Section blocks by `cta_id`). One CTA can appear in many sections and roll up tracking cleanly.
- **integrations** â€” webhook destinations, CRM connections, pixel IDs, payment processors.
- **compliance** â€” the immutable trust state needed to publish.
- **provenance** â€” generation metadata for replay, audit, and cost attribution.

Each **Page** owns:

- **sections[]** â€” ordered Section blocks. The renderer paints these top-to-bottom.
- **page_metadata** â€” `<head>` content (title, description, og_image, JSON-LD schema markup).
- **tracking** â€” page-scoped pixel and UTM rules.

Each **Section** is one of the 60 block types (Part B). Its `content` shape is union-typed by `type`. Sections support `style_overrides`, `conditional_display`, and `variants[]` for A/B tests.

The **Brand Tokens** object holds the design system values referenced throughout. Tokens live on the Funnel so a template can carry its own brand identity, and importing a template into a workspace can re-map tokens to the workspace brand.

The **Compliance State** object tracks the gates that must be green before publish. These are mutated only by trusted services (Compliance Agent, Fact-Check Agent, Publish Acknowledgment service). The client cannot directly write them.

The **Generation Provenance** object records exactly what produced this funnel â€” model versions, KB pack version, KB snapshot ID, prompt hashes per section, USD cost â€” so any funnel can be re-explained, re-generated, or attributed in incident review.

## A.2 Required vs optional fields summary

**Required at the top level:** `schema_version`, `metadata`, `pages`, `brand_tokens`, `compliance`, `provenance`.

**Optional at the top level:** `assets`, `forms`, `ctas`, `integrations` (each defaults to an empty array/object). A funnel with zero forms is legal (pure content / lead magnet bridge); a funnel with zero CTAs is legal but flagged by the Funnel Grader.

**Required on every Page:** `id`, `type`, `sections`. `name` defaults to the type. `page_metadata` is required for `landing` pages; optional for `thank-you` / `confirmation` pages that are not indexed.

**Required on every Section:** `id`, `type`, `content`. `style_overrides`, `conditional_display`, `variants` are optional.

**Required on every Asset:** `id`, `type`, `url`, `license_type`. `alt_text` is required for `image` and `video` types (accessibility gate).

**Required for publish (Compliance gate):** `compliance.ai_disclosure_visible = true`, `compliance.publish_acknowledged_at` set, `compliance.compliance_agent_pass_at` set, and if `regulated_vertical_flag = true`, then `compliance.fact_check_pass_at` set.

## A.3 Full JSON Schema (draft 2020-12)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://funelai.com/schemas/funnel/v1.0.0.json",
  "title": "Funnel",
  "type": "object",
  "required": ["schema_version", "metadata", "pages", "brand_tokens", "compliance", "provenance"],
  "additionalProperties": false,
  "properties": {
    "schema_version": {
      "type": "string",
      "pattern": "^\\d+\\.\\d+\\.\\d+$",
      "description": "SemVer of the funnel schema. Currently 1.0.0. See Part D."
    },
    "metadata":     { "$ref": "#/$defs/Metadata" },
    "pages":        { "type": "array", "minItems": 1, "maxItems": 12, "items": { "$ref": "#/$defs/Page" } },
    "assets":       { "type": "array", "items": { "$ref": "#/$defs/Asset" }, "default": [] },
    "forms":        { "type": "array", "items": { "$ref": "#/$defs/Form" },  "default": [] },
    "ctas":         { "type": "array", "items": { "$ref": "#/$defs/CTA" },   "default": [] },
    "brand_tokens": { "$ref": "#/$defs/BrandTokens" },
    "integrations": { "$ref": "#/$defs/Integrations" },
    "compliance":   { "$ref": "#/$defs/ComplianceState" },
    "provenance":   { "$ref": "#/$defs/GenerationProvenance" }
  },

  "$defs": {

    "UUID": {
      "type": "string",
      "pattern": "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
    },

    "Slug": {
      "type": "string",
      "pattern": "^[a-z0-9]+(?:-[a-z0-9]+)*$",
      "minLength": 1,
      "maxLength": 80
    },

    "URL": {
      "type": "string",
      "format": "uri",
      "maxLength": 2048
    },

    "ISO8601": {
      "type": "string",
      "format": "date-time"
    },

    "HexColor": {
      "type": "string",
      "pattern": "^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$"
    },

    "Metadata": {
      "type": "object",
      "required": ["id", "workspace_id", "name", "slug", "version", "status", "language", "created_at", "updated_at"],
      "additionalProperties": false,
      "properties": {
        "id":           { "$ref": "#/$defs/UUID" },
        "workspace_id": { "$ref": "#/$defs/UUID" },
        "name":         { "type": "string", "minLength": 1, "maxLength": 120 },
        "slug":         { "$ref": "#/$defs/Slug" },
        "version":      { "type": "string", "pattern": "^\\d+\\.\\d+\\.\\d+$", "description": "SemVer of THIS funnel, not the schema." },
        "status":       { "enum": ["draft", "in_review", "published", "archived", "blocked_by_compliance"] },
        "language":     { "type": "string", "pattern": "^[a-z]{2}(-[A-Z]{2})?$", "description": "BCP47, e.g. en, en-US, es-MX, hi-IN." },
        "geography":    {
          "type": "object",
          "properties": {
            "country":     { "type": "string", "pattern": "^[A-Z]{2}$" },
            "region":      { "type": "string", "maxLength": 80 },
            "timezone":    { "type": "string", "maxLength": 64 }
          }
        },
        "industry": {
          "type": "string",
          "description": "Industry slug from the KB pack catalog, e.g. solar, hvac, real-estate, coaching.",
          "maxLength": 64
        },
        "voice_persona": {
          "type": "object",
          "properties": {
            "tone":             { "enum": ["expert", "friendly", "urgent", "premium", "playful", "no-bs"] },
            "reading_level":    { "type": "integer", "minimum": 4, "maximum": 14, "description": "Target Flesch-Kincaid grade." },
            "formality":        { "enum": ["formal", "neutral", "casual"] },
            "voice_keywords":   { "type": "array", "items": { "type": "string" }, "maxItems": 12 },
            "do_not_use":       { "type": "array", "items": { "type": "string" }, "maxItems": 32 }
          }
        },
        "created_at":   { "$ref": "#/$defs/ISO8601" },
        "updated_at":   { "$ref": "#/$defs/ISO8601" },
        "created_by":   { "$ref": "#/$defs/UUID" },
        "tags":         { "type": "array", "items": { "type": "string", "maxLength": 40 }, "maxItems": 24 }
      }
    },

    "Page": {
      "type": "object",
      "required": ["id", "type", "sections"],
      "additionalProperties": false,
      "properties": {
        "id":   { "$ref": "#/$defs/UUID" },
        "name": { "type": "string", "maxLength": 120 },
        "type": { "enum": ["landing", "thank-you", "checkout", "upsell", "downsell", "membership", "booking", "confirmation"] },
        "slug": { "$ref": "#/$defs/Slug" },
        "sections": {
          "type": "array",
          "minItems": 1,
          "maxItems": 80,
          "items": { "$ref": "#/$defs/Section" }
        },
        "page_metadata": { "$ref": "#/$defs/PageMetadata" },
        "tracking":      { "$ref": "#/$defs/PageTracking" },
        "redirect_after_submit_page_id": { "$ref": "#/$defs/UUID" }
      },
      "allOf": [
        {
          "if":   { "properties": { "type": { "const": "landing" } } },
          "then": { "required": ["page_metadata"] }
        }
      ]
    },

    "PageMetadata": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "title":         { "type": "string", "minLength": 1, "maxLength": 70 },
        "description":   { "type": "string", "minLength": 1, "maxLength": 160 },
        "og_image":      { "type": "string", "description": "asset_id reference." },
        "schema_markup": { "type": "object", "description": "JSON-LD object emitted into <head>." },
        "canonical_url": { "$ref": "#/$defs/URL" },
        "robots":        { "enum": ["index,follow", "noindex,follow", "index,nofollow", "noindex,nofollow"] }
      }
    },

    "PageTracking": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "pixels": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["provider", "id"],
            "properties": {
              "provider": { "enum": ["meta", "google_ads", "google_analytics", "tiktok", "linkedin", "x", "pinterest", "custom"] },
              "id":       { "type": "string", "maxLength": 64 },
              "events":   { "type": "array", "items": { "type": "string", "maxLength": 64 } }
            }
          }
        },
        "utm_passthrough": { "type": "boolean", "default": true, "description": "Persist inbound UTM params on lead capture." },
        "consent_required": { "type": "boolean", "default": false, "description": "Defer pixel fire until consent." }
      }
    },

    "Section": {
      "type": "object",
      "required": ["id", "type", "content"],
      "additionalProperties": false,
      "properties": {
        "id":   { "$ref": "#/$defs/UUID" },
        "type": { "$ref": "#/$defs/BlockType" },
        "variant": { "type": "string", "description": "Block-specific variant slug, e.g. 'image-right' for hero.classic." },
        "content": { "type": "object", "description": "Shape is union-typed by `type`. See Part B." },
        "style_overrides": { "$ref": "#/$defs/StyleOverrides" },
        "conditional_display": { "$ref": "#/$defs/ConditionalDisplay" },
        "variants": {
          "type": "array",
          "description": "A/B test variants. Renderer picks one weighted by `weight`.",
          "items": {
            "type": "object",
            "required": ["id", "weight", "content"],
            "properties": {
              "id":      { "$ref": "#/$defs/UUID" },
              "label":   { "type": "string", "maxLength": 60 },
              "weight":  { "type": "number", "minimum": 0, "maximum": 1 },
              "content": { "type": "object" }
            }
          }
        }
      }
    },

    "BlockType": {
      "enum": [
        "hero.classic", "hero.video", "hero.split", "hero.minimal", "hero.benefit-driven", "hero.urgency",
        "form.inline-single-field", "form.classic-3-field", "form.long-7-field", "form.multi-step",
        "form.calculator", "form.quiz", "form.consultation-booking", "form.payment",
        "proof.testimonial-grid", "proof.testimonial-single-large", "proof.logo-bar", "proof.stat-row",
        "proof.before-after", "proof.case-study-summary", "proof.video-testimonial", "proof.review-snippet",
        "offer.feature-grid", "offer.benefit-list", "offer.comparison-table", "offer.value-stack",
        "offer.pricing-tiers", "offer.single-card", "offer.bundle-savings", "offer.limited-time",
        "cta.button-single", "cta.button-pair", "cta.banner", "cta.floating",
        "content.text-block", "content.faq", "content.video-embed", "content.image",
        "content.gallery", "content.code-snippet", "content.quote", "content.bullet-list",
        "trust.badge-row", "trust.guarantee", "trust.certification", "trust.team", "trust.history", "trust.compliance",
        "interactive.countdown-timer", "interactive.calculator", "interactive.product-finder",
        "interactive.live-chat-embed", "interactive.calendar-booking-embed", "interactive.video-with-cta-overlay",
        "footer.minimal", "footer.full",
        "specialty.lead-magnet-delivery", "specialty.webinar-registration",
        "specialty.contest-entry", "specialty.referral-program-signup"
      ]
    },

    "StyleOverrides": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "background":   { "$ref": "#/$defs/HexColor" },
        "text_color":   { "$ref": "#/$defs/HexColor" },
        "padding_y":    { "enum": ["none", "sm", "md", "lg", "xl"] },
        "max_width":    { "enum": ["narrow", "default", "wide", "full"] },
        "alignment":    { "enum": ["left", "center", "right"] },
        "border_top":   { "type": "boolean" },
        "border_bottom":{ "type": "boolean" }
      }
    },

    "ConditionalDisplay": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "device":      { "enum": ["all", "mobile_only", "desktop_only"] },
        "geo_allow":   { "type": "array", "items": { "type": "string", "pattern": "^[A-Z]{2}$" } },
        "geo_deny":    { "type": "array", "items": { "type": "string", "pattern": "^[A-Z]{2}$" } },
        "utm_match":   { "type": "object", "additionalProperties": { "type": "string" } },
        "schedule_start": { "$ref": "#/$defs/ISO8601" },
        "schedule_end":   { "$ref": "#/$defs/ISO8601" }
      }
    },

    "Asset": {
      "type": "object",
      "required": ["id", "type", "url", "license_type"],
      "additionalProperties": false,
      "properties": {
        "id":   { "$ref": "#/$defs/UUID" },
        "type": { "enum": ["image", "video", "audio", "document"] },
        "url":  { "$ref": "#/$defs/URL" },
        "license_type": { "enum": ["royalty_free", "creative_commons", "purchased", "user_uploaded", "ai_generated", "public_domain"] },
        "license_metadata": {
          "type": "object",
          "properties": {
            "source":       { "type": "string", "maxLength": 120 },
            "license_id":   { "type": "string", "maxLength": 120 },
            "purchased_by": { "$ref": "#/$defs/UUID" },
            "purchase_date":{ "$ref": "#/$defs/ISO8601" },
            "ai_model":     { "type": "string", "maxLength": 64 },
            "ai_prompt_hash": { "type": "string", "maxLength": 64 }
          }
        },
        "license_attribution": { "type": "string", "maxLength": 240, "description": "Visible attribution text if license requires it." },
        "alt_text":  { "type": "string", "maxLength": 240 },
        "dimensions": {
          "type": "object",
          "properties": {
            "width_px":  { "type": "integer", "minimum": 1 },
            "height_px": { "type": "integer", "minimum": 1 },
            "duration_seconds": { "type": "number", "minimum": 0 }
          }
        },
        "file_size_bytes": { "type": "integer", "minimum": 0 },
        "mime_type":       { "type": "string", "maxLength": 80 },
        "checksum_sha256": { "type": "string", "pattern": "^[a-f0-9]{64}$" }
      },
      "allOf": [
        {
          "if":   { "properties": { "type": { "enum": ["image", "video"] } } },
          "then": { "required": ["alt_text"] }
        }
      ]
    },

    "Form": {
      "type": "object",
      "required": ["id", "fields", "submit_action"],
      "additionalProperties": false,
      "properties": {
        "id":   { "$ref": "#/$defs/UUID" },
        "name": { "type": "string", "maxLength": 80 },
        "fields": {
          "type": "array",
          "minItems": 1,
          "maxItems": 24,
          "items": { "$ref": "#/$defs/FormField" }
        },
        "submit_action":    { "$ref": "#/$defs/SubmitAction" },
        "lead_routing_rules": {
          "type": "array",
          "items": { "$ref": "#/$defs/RoutingRule" }
        },
        "consent_capture":  { "$ref": "#/$defs/ConsentCapture" },
        "success_state":    { "$ref": "#/$defs/SuccessState" },
        "anti_spam": {
          "type": "object",
          "properties": {
            "honeypot":  { "type": "boolean", "default": true },
            "rate_limit_per_ip_per_minute": { "type": "integer", "minimum": 0, "default": 3 },
            "captcha":   { "enum": ["none", "invisible_recaptcha_v3", "turnstile"], "default": "invisible_recaptcha_v3" }
          }
        }
      }
    },

    "FormField": {
      "type": "object",
      "required": ["id", "type", "label", "name"],
      "additionalProperties": false,
      "properties": {
        "id":    { "$ref": "#/$defs/UUID" },
        "type":  { "enum": ["text", "email", "tel", "number", "textarea", "select", "multiselect", "radio", "checkbox", "date", "time", "address", "hidden", "consent", "file"] },
        "label": { "type": "string", "minLength": 1, "maxLength": 80 },
        "name":  { "type": "string", "pattern": "^[a-z_][a-z0-9_]*$", "maxLength": 40 },
        "placeholder": { "type": "string", "maxLength": 80 },
        "help_text":   { "type": "string", "maxLength": 200 },
        "required":    { "type": "boolean", "default": false },
        "default_value": { "type": "string", "maxLength": 240 },
        "options": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["value", "label"],
            "properties": {
              "value": { "type": "string", "maxLength": 120 },
              "label": { "type": "string", "maxLength": 120 }
            }
          }
        },
        "validation": {
          "type": "object",
          "properties": {
            "min_length": { "type": "integer", "minimum": 0 },
            "max_length": { "type": "integer", "minimum": 1 },
            "min":        { "type": "number" },
            "max":        { "type": "number" },
            "pattern":    { "type": "string", "description": "ECMA-262 regex." },
            "custom_message": { "type": "string", "maxLength": 200 }
          }
        },
        "pii_classification": { "enum": ["none", "low", "medium", "high"], "default": "medium" }
      }
    },

    "SubmitAction": {
      "type": "object",
      "required": ["type"],
      "properties": {
        "type": { "enum": ["redirect_to_page", "redirect_to_url", "show_message", "trigger_download", "open_calendar", "start_checkout"] },
        "redirect_page_id": { "$ref": "#/$defs/UUID" },
        "redirect_url":     { "$ref": "#/$defs/URL" },
        "message_markdown": { "type": "string", "maxLength": 2000 },
        "download_asset_id":{ "$ref": "#/$defs/UUID" },
        "calendar_provider":{ "enum": ["calendly", "cal_com", "google", "native"] },
        "checkout_offer_id":{ "$ref": "#/$defs/UUID" }
      }
    },

    "RoutingRule": {
      "type": "object",
      "required": ["destination"],
      "properties": {
        "match": {
          "type": "object",
          "description": "Field-value predicates. e.g. { country: 'US', budget_band: 'high' }.",
          "additionalProperties": { "type": ["string", "number", "boolean", "array"] }
        },
        "destination": {
          "type": "object",
          "required": ["type"],
          "properties": {
            "type":           { "enum": ["webhook", "crm", "email", "sms", "queue"] },
            "webhook_url":    { "$ref": "#/$defs/URL" },
            "crm_connection_id": { "$ref": "#/$defs/UUID" },
            "email_to":       { "type": "string", "format": "email" },
            "sms_to":         { "type": "string" },
            "queue_name":     { "type": "string", "maxLength": 80 }
          }
        }
      }
    },

    "ConsentCapture": {
      "type": "object",
      "properties": {
        "marketing_consent_required": { "type": "boolean", "default": false },
        "marketing_consent_copy":     { "type": "string", "maxLength": 600 },
        "tcpa_required":              { "type": "boolean", "default": false },
        "tcpa_copy":                  { "type": "string", "maxLength": 800 },
        "gdpr_required":              { "type": "boolean", "default": false },
        "data_processor_disclosure":  { "type": "string", "maxLength": 800 }
      }
    },

    "SuccessState": {
      "type": "object",
      "properties": {
        "headline":       { "type": "string", "maxLength": 120 },
        "body_markdown":  { "type": "string", "maxLength": 2000 },
        "next_step_cta_id": { "$ref": "#/$defs/UUID" }
      }
    },

    "CTA": {
      "type": "object",
      "required": ["id", "label", "action"],
      "additionalProperties": false,
      "properties": {
        "id":    { "$ref": "#/$defs/UUID" },
        "label": { "type": "string", "minLength": 1, "maxLength": 60 },
        "sublabel": { "type": "string", "maxLength": 80, "description": "e.g. 'No card required'." },
        "action": {
          "type": "object",
          "required": ["type"],
          "properties": {
            "type":           { "enum": ["link", "form", "checkout", "booking", "phone-call", "scroll-to-section", "open-modal", "download"] },
            "link_url":       { "$ref": "#/$defs/URL" },
            "form_id":        { "$ref": "#/$defs/UUID" },
            "offer_id":       { "$ref": "#/$defs/UUID" },
            "phone_e164":     { "type": "string", "pattern": "^\\+[1-9][0-9]{6,14}$" },
            "scroll_section_id": { "$ref": "#/$defs/UUID" },
            "modal_section_id":  { "$ref": "#/$defs/UUID" },
            "download_asset_id": { "$ref": "#/$defs/UUID" }
          }
        },
        "tracking_id":  { "type": "string", "maxLength": 80, "description": "Stable analytics ID, e.g. 'hero-primary-cta'." },
        "style": {
          "type": "object",
          "properties": {
            "variant": { "enum": ["primary", "secondary", "tertiary", "ghost", "destructive"] },
            "size":    { "enum": ["sm", "md", "lg", "xl"] },
            "full_width_on_mobile": { "type": "boolean", "default": true },
            "icon_left":  { "type": "string", "maxLength": 40 },
            "icon_right": { "type": "string", "maxLength": 40 }
          }
        }
      }
    },

    "BrandTokens": {
      "type": "object",
      "required": ["colors", "typography", "spacing", "border_radius", "shadows"],
      "additionalProperties": false,
      "properties": {
        "colors": {
          "type": "object",
          "required": ["primary", "secondary", "accent", "neutral", "semantic"],
          "properties": {
            "primary":   { "$ref": "#/$defs/ColorScale" },
            "secondary": { "$ref": "#/$defs/ColorScale" },
            "accent":    { "$ref": "#/$defs/ColorScale" },
            "neutral":   { "$ref": "#/$defs/ColorScale" },
            "semantic": {
              "type": "object",
              "properties": {
                "success": { "$ref": "#/$defs/HexColor" },
                "warning": { "$ref": "#/$defs/HexColor" },
                "error":   { "$ref": "#/$defs/HexColor" },
                "info":    { "$ref": "#/$defs/HexColor" }
              }
            }
          }
        },
        "typography": {
          "type": "object",
          "required": ["font_families", "font_sizes", "font_weights", "line_heights"],
          "properties": {
            "font_families": {
              "type": "object",
              "properties": {
                "heading_display": { "type": "string", "maxLength": 80, "description": "e.g. 'Inter Tight'." },
                "heading_text":    { "type": "string", "maxLength": 80 },
                "body":            { "type": "string", "maxLength": 80 },
                "mono":            { "type": "string", "maxLength": 80 }
              },
              "required": ["heading_display", "body"]
            },
            "font_sizes": {
              "type": "object",
              "properties": {
                "xs":   { "type": "string", "description": "e.g. '0.75rem'." },
                "sm":   { "type": "string" },
                "base": { "type": "string" },
                "lg":   { "type": "string" },
                "xl":   { "type": "string" },
                "h6":   { "type": "string" },
                "h5":   { "type": "string" },
                "h4":   { "type": "string" },
                "h3":   { "type": "string" },
                "h2":   { "type": "string" },
                "h1":   { "type": "string" },
                "display": { "type": "string" }
              }
            },
            "font_weights": {
              "type": "object",
              "properties": {
                "regular":  { "type": "integer", "minimum": 100, "maximum": 900 },
                "medium":   { "type": "integer", "minimum": 100, "maximum": 900 },
                "semibold": { "type": "integer", "minimum": 100, "maximum": 900 },
                "bold":     { "type": "integer", "minimum": 100, "maximum": 900 }
              }
            },
            "line_heights": {
              "type": "object",
              "properties": {
                "tight":   { "type": "number" },
                "snug":    { "type": "number" },
                "normal":  { "type": "number" },
                "relaxed": { "type": "number" },
                "loose":   { "type": "number" }
              }
            },
            "letter_spacings": {
              "type": "object",
              "properties": {
                "tighter": { "type": "string" },
                "tight":   { "type": "string" },
                "normal":  { "type": "string" },
                "wide":    { "type": "string" },
                "wider":   { "type": "string" }
              }
            }
          }
        },
        "spacing": {
          "type": "object",
          "description": "Maps token name to rem value. Token names: 0, 1, 2, 4, 6, 8, 12, 16, 24, 32, 48, 64, 96.",
          "additionalProperties": { "type": "string" }
        },
        "border_radius": {
          "type": "object",
          "properties": {
            "none": { "type": "string" },
            "sm":   { "type": "string" },
            "md":   { "type": "string" },
            "lg":   { "type": "string" },
            "xl":   { "type": "string" },
            "full": { "type": "string" }
          }
        },
        "shadows": {
          "type": "object",
          "properties": {
            "sm":   { "type": "string" },
            "md":   { "type": "string" },
            "lg":   { "type": "string" },
            "xl":   { "type": "string" },
            "glow": { "type": "string" }
          }
        },
        "motion": {
          "type": "object",
          "properties": {
            "durations": {
              "type": "object",
              "properties": {
                "fastest": { "type": "string", "default": "75ms" },
                "faster":  { "type": "string", "default": "100ms" },
                "fast":    { "type": "string", "default": "150ms" },
                "normal":  { "type": "string", "default": "250ms" },
                "slow":    { "type": "string", "default": "400ms" }
              }
            },
            "easings": {
              "type": "object",
              "properties": {
                "ease_out":    { "type": "string" },
                "ease_in_out": { "type": "string" },
                "bouncy":      { "type": "string" }
              }
            }
          }
        },
        "z_index": {
          "type": "object",
          "properties": {
            "base":     { "type": "integer", "default": 0 },
            "raised":   { "type": "integer", "default": 10 },
            "dropdown": { "type": "integer", "default": 100 },
            "sticky":   { "type": "integer", "default": 200 },
            "overlay":  { "type": "integer", "default": 300 },
            "modal":    { "type": "integer", "default": 400 },
            "popover":  { "type": "integer", "default": 500 },
            "toast":    { "type": "integer", "default": 600 }
          }
        }
      }
    },

    "ColorScale": {
      "type": "object",
      "required": ["500"],
      "properties": {
        "50":  { "$ref": "#/$defs/HexColor" },
        "100": { "$ref": "#/$defs/HexColor" },
        "200": { "$ref": "#/$defs/HexColor" },
        "300": { "$ref": "#/$defs/HexColor" },
        "400": { "$ref": "#/$defs/HexColor" },
        "500": { "$ref": "#/$defs/HexColor" },
        "600": { "$ref": "#/$defs/HexColor" },
        "700": { "$ref": "#/$defs/HexColor" },
        "800": { "$ref": "#/$defs/HexColor" },
        "900": { "$ref": "#/$defs/HexColor" }
      }
    },

    "Integrations": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "crms":      { "type": "array", "items": { "$ref": "#/$defs/IntegrationConnection" } },
        "email_esp": { "type": "array", "items": { "$ref": "#/$defs/IntegrationConnection" } },
        "sms":       { "type": "array", "items": { "$ref": "#/$defs/IntegrationConnection" } },
        "payments":  { "type": "array", "items": { "$ref": "#/$defs/IntegrationConnection" } },
        "analytics": { "type": "array", "items": { "$ref": "#/$defs/IntegrationConnection" } },
        "webhooks":  { "type": "array", "items": { "$ref": "#/$defs/WebhookConfig" } }
      }
    },

    "IntegrationConnection": {
      "type": "object",
      "required": ["id", "provider", "connection_id"],
      "properties": {
        "id":            { "$ref": "#/$defs/UUID" },
        "provider":      { "type": "string", "maxLength": 64 },
        "connection_id": { "type": "string", "description": "Reference into workspace credential vault â€” never the secret itself.", "maxLength": 120 },
        "field_mapping": { "type": "object", "additionalProperties": { "type": "string" } },
        "enabled":       { "type": "boolean", "default": true }
      }
    },

    "WebhookConfig": {
      "type": "object",
      "required": ["id", "url", "events"],
      "properties": {
        "id":     { "$ref": "#/$defs/UUID" },
        "url":    { "$ref": "#/$defs/URL" },
        "events": { "type": "array", "items": { "type": "string" }, "minItems": 1 },
        "signing_secret_id": { "type": "string", "description": "Reference into credential vault." },
        "retry_policy": {
          "type": "object",
          "properties": {
            "max_attempts": { "type": "integer", "minimum": 1, "maximum": 10, "default": 5 },
            "backoff":      { "enum": ["linear", "exponential"], "default": "exponential" }
          }
        }
      }
    },

    "ComplianceState": {
      "type": "object",
      "required": ["ai_disclosure_visible", "regulated_vertical_flag"],
      "additionalProperties": false,
      "properties": {
        "ai_disclosure_visible":   { "type": "boolean", "default": true, "description": "False blocks publish. Surfaced in footer.minimal/full." },
        "publish_acknowledged_at": { "$ref": "#/$defs/ISO8601", "description": "User clicked Publish Acknowledgment (doc 05e)." },
        "publish_acknowledged_by": { "$ref": "#/$defs/UUID" },
        "regulated_vertical_flag": { "type": "boolean", "default": false, "description": "True for health, finance, legal, gambling, crypto, supplements, weight-loss, multi-level marketing." },
        "compliance_agent_pass_at":{ "$ref": "#/$defs/ISO8601", "description": "Set by Compliance Agent on green." },
        "compliance_agent_findings": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["severity", "rule_id", "message"],
            "properties": {
              "severity": { "enum": ["info", "warning", "blocker"] },
              "rule_id":  { "type": "string", "maxLength": 80 },
              "message":  { "type": "string", "maxLength": 800 },
              "section_id": { "$ref": "#/$defs/UUID" }
            }
          }
        },
        "fact_check_pass_at":  { "$ref": "#/$defs/ISO8601" },
        "fact_check_findings": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "claim_text":     { "type": "string", "maxLength": 600 },
              "claim_status":   { "enum": ["verified", "needs_source", "unverifiable", "false"] },
              "evidence_url":   { "$ref": "#/$defs/URL" },
              "section_id":     { "$ref": "#/$defs/UUID" }
            }
          }
        },
        "content_hash":      { "type": "string", "pattern": "^[a-f0-9]{64}$", "description": "SHA-256 over the canonicalized content snapshot used for the last compliance pass. Drift triggers re-pass." },
        "audit_log_pointer": { "type": "string", "description": "Append-only log key for this funnel's compliance events." },
        "data_processor_addendum_signed_at": { "$ref": "#/$defs/ISO8601" }
      },
      "allOf": [
        {
          "if":   { "properties": { "regulated_vertical_flag": { "const": true } } },
          "then": { "required": ["fact_check_pass_at"] }
        }
      ]
    },

    "GenerationProvenance": {
      "type": "object",
      "required": ["generated_at", "model_versions", "kb_pack_version"],
      "additionalProperties": false,
      "properties": {
        "generated_at":  { "$ref": "#/$defs/ISO8601" },
        "model_versions": {
          "type": "array",
          "minItems": 1,
          "items": {
            "type": "object",
            "required": ["role", "model"],
            "properties": {
              "role":  { "enum": ["planner", "writer", "designer", "compliance", "fact_check", "image", "video"] },
              "model": { "type": "string", "maxLength": 120 }
            }
          }
        },
        "kb_pack_version": { "type": "string", "pattern": "^\\d+\\.\\d+\\.\\d+$" },
        "kb_snapshot_id":  { "$ref": "#/$defs/UUID" },
        "prompt_hash_per_section": {
          "type": "object",
          "description": "Map of section_id -> SHA-256 of the prompt used to generate that section.",
          "additionalProperties": { "type": "string", "pattern": "^[a-f0-9]{64}$" }
        },
        "cost_usd": {
          "type": "object",
          "properties": {
            "total":       { "type": "number", "minimum": 0 },
            "by_role":     { "type": "object", "additionalProperties": { "type": "number", "minimum": 0 } },
            "currency":    { "type": "string", "default": "USD" }
          }
        },
        "seed":  { "type": "integer", "description": "Random seed used for deterministic regeneration." },
        "regeneration_lineage": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "parent_funnel_id": { "$ref": "#/$defs/UUID" },
              "regenerated_at":   { "$ref": "#/$defs/ISO8601" },
              "reason":           { "type": "string", "maxLength": 200 }
            }
          }
        }
      }
    }
  }
}
```

## A.4 Worked example: a 1-page solar-quote funnel

```json
{
  "schema_version": "1.0.0",
  "metadata": {
    "id": "11111111-1111-1111-1111-111111111111",
    "workspace_id": "22222222-2222-2222-2222-222222222222",
    "name": "Texas Solar Quote â€” Summer 2026",
    "slug": "tx-solar-summer-2026",
    "version": "1.0.0",
    "status": "draft",
    "language": "en-US",
    "geography": { "country": "US", "region": "TX", "timezone": "America/Chicago" },
    "industry": "solar",
    "voice_persona": { "tone": "no-bs", "reading_level": 7, "formality": "casual" },
    "created_at": "2026-05-25T15:00:00Z",
    "updated_at": "2026-05-25T15:00:00Z"
  },
  "pages": [{
    "id": "33333333-3333-3333-3333-333333333333",
    "type": "landing",
    "name": "Solar quote LP",
    "page_metadata": {
      "title": "Texas Solar Quote â€” Free in 60 Seconds",
      "description": "See your custom Texas solar savings in under a minute. No phone calls until you're ready.",
      "robots": "index,follow"
    },
    "sections": [
      { "id": "a1...", "type": "hero.benefit-driven", "content": { "headline": "Cut your Texas electric bill by up to $182/month", "subhead": "See your custom solar plan in 60 seconds. Free, no obligations.", "benefit_pillars": [{ "label": "Custom roof analysis" }, { "label": "Texas-specific incentives" }, { "label": "No high-pressure calls" }], "primary_cta_id": "c1..." } },
      { "id": "a2...", "type": "form.multi-step", "content": { "form_id": "f1...", "step_titles": ["Your home", "Your bill", "Your contact info"] } },
      { "id": "a3...", "type": "proof.stat-row", "content": { "stats": [{ "value": "12,400", "label": "Texas homes powered" }, { "value": "$2.1M", "label": "Saved on electric bills" }, { "value": "4.9", "label": "Google rating" }] } },
      { "id": "a4...", "type": "trust.guarantee", "content": { "headline": "25-year power production guarantee", "body": "If your system produces less than promised, we write you the check." } },
      { "id": "a5...", "type": "footer.minimal", "content": { "ai_disclosure_required": true, "links": [{ "label": "Privacy", "url": "/privacy" }, { "label": "Terms", "url": "/terms" }] } }
    ]
  }],
  "brand_tokens": { "colors": { "primary": { "500": "#FFB400" }, "neutral": { "500": "#737373" }, "secondary": { "500": "#1A1A1A" }, "accent": { "500": "#00A86B" }, "semantic": { "success": "#16a34a", "warning": "#f59e0b", "error": "#dc2626", "info": "#2563eb" } }, "typography": { "font_families": { "heading_display": "Inter Tight", "body": "Inter" }, "font_sizes": {}, "font_weights": {}, "line_heights": {} }, "spacing": {}, "border_radius": {}, "shadows": {} },
  "compliance": {
    "ai_disclosure_visible": true,
    "regulated_vertical_flag": false
  },
  "provenance": {
    "generated_at": "2026-05-25T15:00:00Z",
    "model_versions": [{ "role": "writer", "model": "claude-opus-4-7" }, { "role": "designer", "model": "claude-opus-4-7" }],
    "kb_pack_version": "1.4.0",
    "kb_snapshot_id": "44444444-4444-4444-4444-444444444444"
  }
}
```

## A.5 Validation rules and invariants

These run in the validator service (not just in JSON Schema):

1. **Reference integrity.** Every `form_id`, `cta_id`, `asset_id`, `redirect_page_id`, `download_asset_id`, `scroll_section_id`, `modal_section_id` that appears in any Section must resolve to an entry in the corresponding top-level array. Dangling references = validation error.
2. **Asset license required for publish.** No section may reference an asset whose `license_type` is missing or whose `license_metadata` is incomplete for non-`user_uploaded` types.
3. **At-least-one CTA on landing pages.** Every Page of `type: landing` must contain at least one Section with a CTA reference or a form. Funnel Grader downgrades pages that violate this.
4. **AI disclosure presence.** If `compliance.ai_disclosure_visible = true`, every published Page must contain a `footer.minimal` or `footer.full` Section, and that Section's content must include the AI disclosure copy (renderer enforces â€” the copy lives in the renderer's locale bundle, not in the funnel JSON).
5. **Regulated-vertical fact-check requirement.** If `metadata.industry` is in the regulated list (health, finance, legal, gambling, crypto, supplements, weight_loss, mlm) the validator auto-sets `compliance.regulated_vertical_flag = true` and refuses to publish without `fact_check_pass_at`.
6. **Content-hash drift.** Any edit to a Section that has been compliance-passed re-computes `content_hash`. If the new hash differs from the stored hash, `compliance_agent_pass_at` and `fact_check_pass_at` are cleared automatically. This prevents the "edit-after-approval" bypass.
7. **A/B variant weight sum.** For any Section with `variants[]`, the sum of `weight` values across the base + variants must equal 1.0 (Â±0.0001 for FP).
8. **Unique slugs.** `metadata.slug` is unique within a workspace. Page `slug` is unique within a funnel.
9. **PII consent requirement.** If any FormField has `pii_classification: high` (e.g. SSN, date-of-birth, government ID, health condition), the parent Form must have a matching `consent_capture` block with the appropriate flag set.
10. **Phone-call CTAs require TCPA disclosure** in US/CA geographies if the action collects the user's phone number.

---

# Part B â€” 60-Block Component Library

## B.0 Block specification format

Each of the 60 blocks below follows the same shape so engineers can scaffold them mechanically.

For every block we specify:

- **Block ID** â€” the `Section.type` enum value.
- **TypeScript interface** â€” the shape of `Section.content` for this block.
- **Variants** â€” the values legal for `Section.variant` for this block.
- **Tailwind class strategy** â€” the HTML skeleton with utility classes. Brand-token-driven values use CSS custom properties (`var(--color-primary-500)`) injected by the renderer at the funnel root; static layout uses Tailwind utilities directly. The strategy is illustrative; engineering owns the final markup.
- **Brand token usage** â€” which tokens the block reads.
- **Accessibility** â€” ARIA, semantic tags, contrast, focus, motion.
- **Mobile responsive behavior** â€” stacking, type-scale, image strategy.
- **A/B testable elements** â€” fields safe to vary inside `variants[]`.

Shared conventions across all blocks:

- Every Section renders inside a `<section data-section-id={id} data-section-type={type}>` wrapper. This is non-negotiable so the analytics layer and the in-app editor can target by ID.
- All interactive elements have visible focus rings using `focus-visible:ring-2 focus-visible:ring-[var(--color-primary-500)] focus-visible:ring-offset-2`.
- All blocks honor `prefers-reduced-motion: reduce` â€” animations downgrade to instantaneous or fade-only.
- Color combinations are validated at generation time for WCAG AA contrast (4.5:1 body text, 3:1 large text). The renderer also runs a runtime contrast assertion in development mode.
- Mobile-first: classes without prefix are mobile; `md:` and `lg:` add desktop layout. We do not use `sm:` (we treat 640â€“768 as mobile-large).
- Heading levels are semantically correct: only one `<h1>` per page (the hero headline). Subsequent block headlines are `<h2>`. Within a block, internal headings step down (h3, h4).

## B.1 Hero blocks (6)

### B.1.1 `hero.classic`

Headline + subhead + CTA + hero image, paired left-right.

```ts
interface HeroClassicContent {
  eyebrow?: string;              // small label above headline, max 40 chars
  headline: string;              // h1, max 120 chars
  subhead?: string;              // max 240 chars
  primary_cta_id: string;        // CTA reference
  secondary_cta_id?: string;     // optional second CTA
  hero_asset_id: string;         // image asset
  trust_strip?: { label: string; asset_id?: string }[]; // small logo/badge strip under CTA
}
```

**Variants:** `image-right` (default), `image-left`, `image-background` (full-bleed hero with text overlay; requires darker overlay for contrast).

**Tailwind class strategy (image-right):**

```html
<section class="relative overflow-hidden bg-[var(--color-neutral-50)] py-16 md:py-24">
  <div class="mx-auto grid max-w-7xl grid-cols-1 items-center gap-10 px-6 md:grid-cols-2 md:gap-16">
    <div class="space-y-6">
      <span class="inline-block text-sm font-medium uppercase tracking-wider text-[var(--color-primary-600)]">{eyebrow}</span>
      <h1 class="font-display text-4xl font-bold leading-tight text-[var(--color-neutral-900)] md:text-6xl">{headline}</h1>
      <p class="text-lg leading-relaxed text-[var(--color-neutral-700)] md:text-xl">{subhead}</p>
      <div class="flex flex-col gap-3 sm:flex-row sm:gap-4">
        <CTA id={primary_cta_id} size="lg" />
        <CTA id={secondary_cta_id} size="lg" variant="ghost" />
      </div>
      <TrustStrip items={trust_strip} />
    </div>
    <div class="relative aspect-[4/3] overflow-hidden rounded-[var(--radius-xl)] shadow-[var(--shadow-xl)]">
      <Image asset_id={hero_asset_id} class="h-full w-full object-cover" priority />
    </div>
  </div>
</section>
```

**Brand tokens used:** `colors.primary.{600}`, `colors.neutral.{50,700,900}`, `typography.font_families.heading_display`, `border_radius.xl`, `shadows.xl`, `spacing` scale via padding.

**Accessibility:** `<h1>` is the page-singular h1. Image carries `alt_text` from the asset. CTAs are real `<a>` or `<button>` with visible focus. Image-background variant gets an `aria-hidden="true"` decorative overlay and requires text-on-image contrast 4.5:1; renderer adds an automatic dark gradient if contrast fails.

**Mobile:** Single-column stack; image renders below text. Headline drops from `text-6xl` to `text-4xl`. CTAs go full-width.

**A/B testable elements:** `headline`, `subhead`, `primary_cta_id` (different CTA labels), `hero_asset_id`, `variant` (layout flip).

---

### B.1.2 `hero.video`

Headline + subhead + CTA above the fold, video below.

```ts
interface HeroVideoContent {
  eyebrow?: string;
  headline: string;
  subhead?: string;
  primary_cta_id: string;
  video_asset_id: string;        // type=video
  poster_asset_id?: string;      // poster image
  autoplay_muted_loop: boolean;  // default false
  show_play_count?: number;
}
```

**Variants:** `video-below` (default), `video-side`, `video-modal-trigger` (image-only above fold; click opens modal).

**Tailwind class strategy:**

```html
<section class="bg-[var(--color-neutral-50)] py-16 md:py-24">
  <div class="mx-auto max-w-5xl px-6 text-center">
    <h1 class="mx-auto max-w-3xl font-display text-4xl font-bold leading-tight text-[var(--color-neutral-900)] md:text-6xl">{headline}</h1>
    <p class="mx-auto mt-6 max-w-2xl text-lg text-[var(--color-neutral-700)]">{subhead}</p>
    <div class="mt-8 flex justify-center"><CTA id={primary_cta_id} size="xl" /></div>
    <div class="mt-12 overflow-hidden rounded-[var(--radius-xl)] shadow-[var(--shadow-xl)]">
      <Video asset_id={video_asset_id} poster_asset_id={poster_asset_id} controls preload="metadata" />
    </div>
  </div>
</section>
```

**Accessibility:** Video requires captions track (validator enforces). Autoplay must be muted. `prefers-reduced-motion` disables autoplay. Play/pause button is keyboard-accessible.

**Mobile:** Video stays full-width with aspect-ratio box; no autoplay on cellular if respect-data-saver is detected.

**A/B testable:** Headline, CTA label, poster image, autoplay on/off.

---

### B.1.3 `hero.split`

Text left, image right, with inline CTA (no big above-fold button â€” the form is the CTA).

```ts
interface HeroSplitContent {
  headline: string;
  subhead?: string;
  bullet_points?: string[];      // up to 4
  form_id?: string;              // inline form right side
  inline_cta_id?: string;        // alt: inline link CTA
  hero_asset_id?: string;        // optional if form_id is present
}
```

**Variants:** `text-left-form-right`, `text-left-image-right`, `text-right-image-left`.

**Tailwind class strategy (text-left-form-right):**

```html
<section class="bg-gradient-to-br from-[var(--color-primary-50)] to-[var(--color-neutral-50)] py-16 md:py-24">
  <div class="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-6 md:grid-cols-[1.2fr_1fr] md:gap-16">
    <div class="space-y-6">
      <h1 class="font-display text-4xl font-bold md:text-5xl">{headline}</h1>
      <p class="text-lg text-[var(--color-neutral-700)]">{subhead}</p>
      <ul class="space-y-3">{bullet_points.map(b => <li class="flex gap-3"><CheckIcon class="text-[var(--color-accent-500)]" />{b}</li>)}</ul>
    </div>
    <div class="rounded-[var(--radius-xl)] bg-white p-8 shadow-[var(--shadow-lg)]"><Form id={form_id} /></div>
  </div>
</section>
```

**Accessibility:** Bullets are a real `<ul>`. Form fields have labels and `aria-describedby` for help text. Color gradient maintains AA on text.

**Mobile:** Form stacks below text; image variant stacks image below.

**A/B testable:** Headline, bullet copy, form field count, form_id swap.

---

### B.1.4 `hero.minimal`

Headline only + single CTA, lots of whitespace. Used for premium/luxury offers and dev-tooling.

```ts
interface HeroMinimalContent {
  headline: string;
  primary_cta_id: string;
  background_treatment?: "white" | "gradient" | "dark";
}
```

**Variants:** `centered` (default), `left-aligned`, `dark-mode`.

**Tailwind:**

```html
<section class="bg-[var(--color-neutral-50)] py-32 md:py-48">
  <div class="mx-auto max-w-3xl px-6 text-center">
    <h1 class="font-display text-5xl font-bold leading-[1.05] tracking-tight text-[var(--color-neutral-900)] md:text-7xl">{headline}</h1>
    <div class="mt-10"><CTA id={primary_cta_id} size="xl" /></div>
  </div>
</section>
```

**Accessibility:** Heading is the only landmark; `<main>` wraps it. Dark-mode variant requires explicit color-scheme handling.

**Mobile:** Type scales from `text-7xl` down to `text-5xl`. Padding reduces.

**A/B testable:** Headline, CTA label, background treatment.

---

### B.1.5 `hero.benefit-driven`

Headline + 3 benefit pillars + CTA. The pillars sit below the headline as a 3-column grid.

```ts
interface HeroBenefitDrivenContent {
  headline: string;
  subhead?: string;
  benefit_pillars: { icon?: string; label: string; description?: string }[]; // exactly 3
  primary_cta_id: string;
  hero_asset_id?: string;
}
```

**Variants:** `pillars-below` (default), `pillars-side`.

**Tailwind:**

```html
<section class="bg-[var(--color-neutral-50)] py-16 md:py-24">
  <div class="mx-auto max-w-6xl px-6 text-center">
    <h1 class="font-display text-4xl font-bold md:text-6xl">{headline}</h1>
    <p class="mx-auto mt-6 max-w-2xl text-lg text-[var(--color-neutral-700)]">{subhead}</p>
    <div class="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-8">
      {benefit_pillars.map(p => (
        <div class="rounded-[var(--radius-lg)] bg-white p-6 shadow-[var(--shadow-sm)]">
          <Icon name={p.icon} class="mx-auto h-10 w-10 text-[var(--color-primary-500)]" />
          <h3 class="mt-4 text-lg font-semibold">{p.label}</h3>
          <p class="mt-2 text-sm text-[var(--color-neutral-700)]">{p.description}</p>
        </div>
      ))}
    </div>
    <div class="mt-12"><CTA id={primary_cta_id} size="lg" /></div>
  </div>
</section>
```

**Accessibility:** Pillars use semantic `<h3>` headings. Icon SVGs are `aria-hidden="true"` with label text doing the work.

**Mobile:** Pillars stack single-column; icons stay sized at h-10.

**A/B testable:** Pillar copy, pillar order, headline, CTA label.

---

### B.1.6 `hero.urgency`

Countdown + headline + CTA. Use with care â€” Compliance Agent flags fake countdowns.

```ts
interface HeroUrgencyContent {
  headline: string;
  subhead?: string;
  countdown: {
    target_iso8601: string;      // must be in the future at render time
    show_days: boolean;
    label_text?: string;         // e.g. "Offer ends in"
    behavior_on_expiry: "hide_block" | "show_expired_message" | "evergreen_reset_per_visitor";
  };
  primary_cta_id: string;
}
```

**Variants:** `centered` (default), `banner-style`.

**Tailwind:**

```html
<section class="bg-gradient-to-r from-[var(--color-primary-600)] to-[var(--color-primary-500)] py-12 text-white md:py-16">
  <div class="mx-auto max-w-4xl px-6 text-center">
    <p class="text-sm font-medium uppercase tracking-wider">{countdown.label_text}</p>
    <CountdownTimer config={countdown} class="mt-4" />
    <h2 class="mt-6 font-display text-3xl font-bold md:text-5xl">{headline}</h2>
    <p class="mt-4 text-lg opacity-90">{subhead}</p>
    <div class="mt-8"><CTA id={primary_cta_id} size="lg" variant="secondary" /></div>
  </div>
</section>
```

**Accessibility:** Countdown announces remaining time via `aria-live="polite"` once per minute (not per second â€” that's overload). Background gradient color is brand-token-driven and contrast-tested.

**Mobile:** Countdown digits remain large enough to read; days/hours/minutes/seconds row stacks to two rows if needed.

**A/B testable:** Headline, label text, countdown target (per offer), urgency variant.

**Compliance:** `behavior_on_expiry = evergreen_reset_per_visitor` requires explicit disclosure in the section copy and is auto-flagged by the Compliance Agent for review in regulated verticals.

---

## B.2 Form blocks (8)

### B.2.1 `form.inline-single-field`

Just email â€” list building. Pairs well after a content block.

```ts
interface FormInlineSingleFieldContent {
  form_id: string;                // references a Form with exactly 1 field of type=email
  headline?: string;
  microcopy?: string;             // e.g. "We send one email a week. Unsubscribe in one click."
  cta_label_override?: string;
}
```

**Variants:** `horizontal-pill` (default), `stacked`, `inline-with-text`.

**Tailwind (horizontal-pill):**

```html
<section class="bg-[var(--color-neutral-100)] py-12">
  <div class="mx-auto max-w-2xl px-6 text-center">
    <h2 class="font-display text-2xl font-bold md:text-3xl">{headline}</h2>
    <form class="mt-6 flex flex-col gap-3 sm:flex-row">
      <input type="email" class="flex-1 rounded-[var(--radius-full)] border border-[var(--color-neutral-300)] bg-white px-5 py-3 focus-visible:ring-2 focus-visible:ring-[var(--color-primary-500)]" />
      <button class="rounded-[var(--radius-full)] bg-[var(--color-primary-500)] px-6 py-3 font-semibold text-white">{cta_label_override}</button>
    </form>
    <p class="mt-3 text-xs text-[var(--color-neutral-600)]">{microcopy}</p>
  </div>
</section>
```

**Accessibility:** `<label class="sr-only">` for the input. `type="email"` triggers correct mobile keyboard. Microcopy referenced via `aria-describedby`.

**Mobile:** Stacks input above button.

**A/B testable:** Headline, microcopy, CTA label, variant.

---

### B.2.2 `form.classic-3-field`

Name + email + phone. The workhorse.

```ts
interface FormClassic3FieldContent {
  form_id: string;                // Form with 3 fields
  headline?: string;
  subhead?: string;
  consent_copy_override?: string;
  show_phone_optional?: boolean;
}
```

**Variants:** `card-floating` (default â€” sits on a card with shadow over a colored background), `inline`, `dark-on-light`, `light-on-dark`.

**Tailwind (card-floating):**

```html
<section class="bg-[var(--color-primary-50)] py-16">
  <div class="mx-auto max-w-md rounded-[var(--radius-xl)] bg-white p-8 shadow-[var(--shadow-lg)]">
    <h2 class="font-display text-2xl font-bold">{headline}</h2>
    <p class="mt-2 text-sm text-[var(--color-neutral-700)]">{subhead}</p>
    <Form id={form_id} class="mt-6 space-y-4" />
  </div>
</section>
```

**Accessibility:** Each field has visible label (not just placeholder). `aria-invalid` on validation error with error message via `aria-describedby`.

**Mobile:** Card spans full width minus side padding.

**A/B testable:** Headline, field order, phone-required, CTA label.

---

### B.2.3 `form.long-7-field`

Full qualifying form for high-ticket B2B/contracting/home-services.

```ts
interface FormLong7FieldContent {
  form_id: string;
  headline?: string;
  subhead?: string;
  progress_indicator?: boolean;   // shows "Step 1 of 7" if true (this is still single-page; just a visual progress bar)
  trust_microcopy?: string;       // e.g. "256-bit SSL Â· We never share your info"
}
```

**Variants:** `two-column` (default â€” first 3 fields and last 4 in two columns), `single-column`, `sectioned` (groups fields under sub-headings).

**Accessibility:** Two-column variant collapses to single-column on mobile; tab order remains semantic. Required indicators (`*`) are read by screen readers via `aria-required="true"`.

**A/B testable:** Field order, two-column vs single-column, trust microcopy.

---

### B.2.4 `form.multi-step`

3-step wizard. Higher completion than long single-page forms for the same field count.

```ts
interface FormMultiStepContent {
  form_id: string;
  step_titles: string[];          // min 2, max 6
  step_field_groups: string[][];  // array of arrays of FormField IDs, one inner array per step
  progress_style: "bar" | "dots" | "numbered_steps";
  allow_back_navigation: boolean;
  per_step_cta_label?: string[];  // e.g. ["Next", "Next", "Get my quote"]
}
```

**Variants:** `progress-bar-top` (default), `step-tabs-top`, `card-deck` (each step is its own card).

**Tailwind sketch:**

```html
<section class="bg-[var(--color-neutral-50)] py-16">
  <div class="mx-auto max-w-2xl px-6">
    <ProgressIndicator style={progress_style} current={currentStep} total={step_titles.length} />
    <div class="mt-8 rounded-[var(--radius-xl)] bg-white p-8 shadow-[var(--shadow-md)]">
      <h2 class="font-display text-2xl font-bold">{step_titles[currentStep]}</h2>
      <Form id={form_id} step_fields={step_field_groups[currentStep]} />
      <div class="mt-6 flex justify-between">
        {allow_back_navigation && <button>Back</button>}
        <button class="bg-[var(--color-primary-500)] text-white">{per_step_cta_label?.[currentStep] ?? "Next"}</button>
      </div>
    </div>
  </div>
</section>
```

**Accessibility:** Step changes announce via `aria-live="polite"`. Focus moves to step heading on each transition. Validation prevents advance with non-blocking inline errors.

**Mobile:** Progress collapses to "1 of 3" text on narrow viewports.

**A/B testable:** Step grouping, step titles, per-step CTA labels, progress style.

---

### B.2.5 `form.calculator`

Inputs produce a dynamic estimate. The estimate is the bait; the email capture is the hook.

```ts
interface FormCalculatorContent {
  form_id: string;
  headline?: string;
  inputs: { field_id: string; min: number; max: number; step: number; unit?: string }[];
  estimate_formula: {
    expression: string;           // safe-evaluated formula, e.g. "monthly_bill * 0.7 * 12 * 25"
    rounding: "none" | "nearest_10" | "nearest_100" | "nearest_1000";
    currency_symbol?: string;     // e.g. "$"
    disclaimer: string;           // required â€” Compliance Agent enforces
  };
  reveal_strategy: "always_visible" | "after_email";
}
```

**Variants:** `live-calculation` (default), `submit-to-reveal`.

**Accessibility:** Sliders use real `<input type="range">` with `aria-valuetext` describing the human-readable value. Estimate updates announce via `aria-live="polite"` with debouncing (1s).

**Compliance:** `estimate_formula.disclaimer` is mandatory and must be visible adjacent to the estimate. The Compliance Agent blocks publish if missing.

**A/B testable:** Input ranges/defaults, estimate visibility before/after email, disclaimer placement.

---

### B.2.6 `form.quiz`

Question-by-question, high engagement.

```ts
interface FormQuizContent {
  form_id: string;
  questions: {
    id: string;
    prompt: string;
    answer_type: "single_select" | "multi_select" | "slider" | "yes_no";
    options?: { value: string; label: string; icon_asset_id?: string; image_asset_id?: string }[];
    branching_rules?: { if_answer: string; goto_question_id: string }[];
  }[];
  result_strategy: "scored_segment" | "personalized_offer" | "lead_capture_only";
  result_screen_section_id?: string;
}
```

**Variants:** `card-deck` (default), `full-screen-takeover`, `chat-style`.

**Accessibility:** Each question is its own `aria-live` region. Keyboard nav: arrow keys move between options, Enter selects, Tab advances.

**Mobile:** Card-deck variant uses full viewport on mobile for tap-friendly options.

**A/B testable:** Question order, option labels, image presence, result framing.

---

### B.2.7 `form.consultation-booking`

Form + calendar embed combo. Lead-qualifies then offers a time.

```ts
interface FormConsultationBookingContent {
  form_id: string;
  calendar_provider: "calendly" | "cal_com" | "google" | "native";
  calendar_url_or_id: string;
  headline?: string;
  subhead?: string;
  qualifying_rules?: { field_name: string; operator: "eq" | "neq" | "gte" | "lte" | "in"; value: string | string[] }[];
  unqualified_redirect_url?: string;
}
```

**Variants:** `form-then-calendar` (default â€” calendar appears after form submit), `form-and-calendar-side-by-side`, `calendar-only`.

**Accessibility:** Calendar embed wrappers carry `aria-label="Booking calendar"`. iframe focus is reachable.

**A/B testable:** Field count, qualifying rules, layout variant.

---

### B.2.8 `form.payment`

Checkout block â€” Stripe Elements, PayPal, Apple/Google Pay.

```ts
interface FormPaymentContent {
  offer_id: string;                // references a top-level offer (price, currency, recurring)
  processor: "stripe" | "paypal" | "stripe_with_apple_pay_google_pay";
  collect_billing_address: boolean;
  collect_shipping_address: boolean;
  enable_order_bumps: { offer_id: string; default_checked: boolean }[];
  enable_one_click_upsell_after: boolean;
  trust_badges_asset_ids?: string[];
  guarantee_copy?: string;
}
```

**Variants:** `card-only` (default), `card-plus-paypal`, `wallets-first` (Apple/Google Pay buttons primary).

**Accessibility:** Stripe Elements iframe carries documented accessibility. Card brand icons have `aria-hidden`. Errors surface via inline `role="alert"` regions adjacent to fields.

**Compliance:** PCI-DSS scope minimization â€” we never touch PAN. Validator blocks publish if processor is not configured for the workspace.

**A/B testable:** Order-bump default-checked, trust badges placement, guarantee copy, wallets-first vs card-first.

---

## B.3 Proof blocks (8)

### B.3.1 `proof.testimonial-grid`

3-column grid of short testimonials.

```ts
interface ProofTestimonialGridContent {
  headline?: string;
  testimonials: {
    id: string;
    quote: string;
    author_name: string;
    author_title?: string;
    author_photo_asset_id?: string;
    star_rating?: 1 | 2 | 3 | 4 | 5;
    source_attribution?: string;   // e.g. "Verified Google review"
  }[];                              // min 3, max 9
  show_star_ratings: boolean;
}
```

**Variants:** `grid-3-col` (default), `grid-2-col-larger-quotes`, `masonry`.

**Tailwind:**

```html
<section class="bg-[var(--color-neutral-50)] py-16 md:py-24">
  <div class="mx-auto max-w-7xl px-6">
    <h2 class="text-center font-display text-3xl font-bold md:text-4xl">{headline}</h2>
    <div class="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
      {testimonials.map(t => (
        <figure class="rounded-[var(--radius-lg)] bg-white p-6 shadow-[var(--shadow-sm)]">
          <StarRating value={t.star_rating} />
          <blockquote class="mt-4 text-[var(--color-neutral-800)]">{t.quote}</blockquote>
          <figcaption class="mt-6 flex items-center gap-3">
            <Image asset_id={t.author_photo_asset_id} class="h-10 w-10 rounded-full" />
            <div><div class="font-semibold">{t.author_name}</div><div class="text-sm text-[var(--color-neutral-600)]">{t.author_title}</div></div>
          </figcaption>
        </figure>
      ))}
    </div>
  </div>
</section>
```

**Accessibility:** Real `<blockquote>` and `<figure>/<figcaption>` semantics. Star ratings expose `aria-label="4 out of 5 stars"`.

**Compliance:** Testimonials must include `source_attribution` for the FTC. Compliance Agent flags missing.

**A/B testable:** Testimonial selection (which 3 from a pool), order, with/without photos.

---

### B.3.2 `proof.testimonial-single-large`

One big testimonial with photo + name + measurable result.

```ts
interface ProofTestimonialSingleLargeContent {
  quote: string;
  author_name: string;
  author_title?: string;
  author_photo_asset_id: string;
  result_metric?: { value: string; label: string }; // e.g. value: "+184%", label: "lead growth in 90 days"
  source_attribution?: string;
}
```

**Variants:** `photo-left` (default), `photo-right`, `photo-background`.

**Accessibility:** Quote uses real `<blockquote>` with `cite` attribute pointing to source if available.

**A/B testable:** Quote selection, metric framing, layout variant.

---

### B.3.3 `proof.logo-bar`

"As seen in" / "Trusted by" logo strip.

```ts
interface ProofLogoBarContent {
  headline?: string;              // e.g. "Trusted by 12,000+ Texas homeowners"
  logos: { asset_id: string; name: string; link_url?: string }[]; // min 4, max 12
  grayscale: boolean;
}
```

**Variants:** `static-row` (default), `marquee-scroll`, `2-row-grid`.

**Accessibility:** Each logo has `alt={name}`. Marquee respects `prefers-reduced-motion: reduce` (becomes static).

**A/B testable:** Logo order, grayscale on/off, marquee vs static.

---

### B.3.4 `proof.stat-row`

3-4 big numbers.

```ts
interface ProofStatRowContent {
  headline?: string;
  stats: { value: string; label: string; sublabel?: string }[]; // min 2, max 4
  animate_count_up: boolean;
}
```

**Variants:** `equal-columns` (default), `featured-first-large`.

**Accessibility:** Count-up animation respects reduced-motion (final value displayed immediately if user prefers). Each stat is in a `<dl><dt><dd>` structure for screen readers.

**A/B testable:** Stat selection, order, animation on/off.

---

### B.3.5 `proof.before-after`

Image comparison.

```ts
interface ProofBeforeAfterContent {
  before_asset_id: string;
  after_asset_id: string;
  before_label: string;
  after_label: string;
  interaction_mode: "slider_drag" | "side_by_side" | "tap_to_toggle";
  caption?: string;
  result_metric?: { value: string; label: string };
}
```

**Variants:** Three modes above; all responsive.

**Accessibility:** Slider mode has keyboard support (arrow keys move slider). Both images have full `alt_text`. Mode is announced.

**A/B testable:** Image pair, interaction mode, caption copy.

---

### B.3.6 `proof.case-study-summary`

One card: photo + 3 metrics + read-more link.

```ts
interface ProofCaseStudySummaryContent {
  client_name: string;
  client_logo_asset_id?: string;
  hero_asset_id?: string;
  summary: string;                // 1-2 sentence narrative
  metrics: { value: string; label: string }[]; // min 1, max 4
  read_more_cta_id?: string;
}
```

**Variants:** `horizontal-card` (default), `vertical-card`.

**A/B testable:** Metrics selection, summary copy, CTA label.

---

### B.3.7 `proof.video-testimonial`

Embedded video testimonial with author meta.

```ts
interface ProofVideoTestimonialContent {
  video_asset_id: string;
  poster_asset_id?: string;
  author_name: string;
  author_title?: string;
  result_metric?: { value: string; label: string };
  transcript_text?: string;       // required for accessibility â€” full transcript available
}
```

**Variants:** `video-left-text-right` (default), `video-only-large`.

**Accessibility:** Captions required (validator enforces). Full transcript collapsible via `<details>`.

**A/B testable:** Video selection, framing copy, layout.

---

### B.3.8 `proof.review-snippet`

Star rating + review count + source attribution.

```ts
interface ProofReviewSnippetContent {
  source: "google" | "trustpilot" | "yelp" | "facebook" | "g2" | "capterra" | "custom";
  source_logo_asset_id?: string;
  average_rating: number;          // 0-5
  review_count: number;
  link_url?: string;               // optional deep link to public reviews
  sample_review_quotes?: { quote: string; author_name?: string }[]; // up to 3
}
```

**Variants:** `compact-strip` (default), `featured-large`, `with-sample-quotes`.

**Compliance:** Rating values must match the linked source. Misrepresentation is a Compliance Agent blocker.

**A/B testable:** Source platform shown, sample quotes shown, layout.

---

## B.4 Offer blocks (8)

### B.4.1 `offer.feature-grid`

3 columns of features.

```ts
interface OfferFeatureGridContent {
  headline?: string;
  subhead?: string;
  features: { icon?: string; title: string; description: string }[]; // min 3, max 9
  cta_id?: string;
}
```

**Variants:** `3-col` (default), `4-col`, `alternating-rows`.

**A/B testable:** Feature order, icons, headline.

---

### B.4.2 `offer.benefit-list`

Vertical list with icons and longer descriptions. "Features tell, benefits sell."

```ts
interface OfferBenefitListContent {
  headline?: string;
  benefits: { icon?: string; title: string; description: string; image_asset_id?: string }[]; // min 3, max 8
  cta_id?: string;
}
```

**Variants:** `icons-left` (default), `alternating-image-side`, `numbered`.

**A/B testable:** Benefit copy, order, with/without supporting images.

---

### B.4.3 `offer.comparison-table`

Us vs competitor vs DIY.

```ts
interface OfferComparisonTableContent {
  headline?: string;
  columns: { label: string; is_us: boolean; subtext?: string }[]; // min 2, max 4
  rows: {
    feature: string;
    values: ("yes" | "no" | "partial" | "custom")[]; // length must match columns
    custom_values?: string[];                          // when value is "custom"
  }[];
  footer_cta_id?: string;
}
```

**Variants:** `static-table` (default), `sticky-us-column`.

**Accessibility:** Real `<table>` with `<th scope="col">` and `<th scope="row">`. Yes/no glyphs have `aria-label`.

**Compliance:** Comparison rows that name competitors are flagged for human review; truthfulness is a Compliance Agent rule.

**A/B testable:** Row inclusion/order, framing of "us" column.

---

### B.4.4 `offer.value-stack`

Hormozi-style value stack with prices crossed out.

```ts
interface OfferValueStackContent {
  headline?: string;
  subhead?: string;
  items: { name: string; description?: string; value_amount: number; currency: string }[]; // min 3, max 12
  total_value_label: string;
  your_price_amount: number;
  your_price_currency: string;
  savings_label?: string;
  cta_id: string;
  disclaimer?: string;
}
```

**Variants:** `card` (default), `receipt-style`, `dark-mode-glow`.

**Compliance:** "Value" claims that aren't backed up by actual product/service deliverables are flagged. The Compliance Agent reads the items list against the offer description for plausibility.

**A/B testable:** Item ordering, item count, total-value framing, disclaimer copy.

---

### B.4.5 `offer.pricing-tiers`

3-tier pricing card grid.

```ts
interface OfferPricingTiersContent {
  headline?: string;
  billing_toggle?: "monthly_annual" | "none";
  tiers: {
    id: string;
    name: string;
    description?: string;
    price_monthly?: { amount: number; currency: string };
    price_annual?: { amount: number; currency: string };
    is_featured: boolean;
    feature_list: { label: string; included: boolean }[];
    cta_id: string;
  }[];                              // min 2, max 4
  show_savings_annual?: boolean;
}
```

**Variants:** `3-col-equal` (default), `featured-elevated` (middle card lifted with primary color border), `compact-list`.

**Accessibility:** Toggle is a real `<button role="switch" aria-checked>`. Currency formatting respects `metadata.language`.

**A/B testable:** Tier ordering, featured-tier selection, monthly-vs-annual default.

---

### B.4.6 `offer.single-card`

One offer card with everything.

```ts
interface OfferSingleCardContent {
  name: string;
  description: string;
  price?: { amount: number; currency: string; recurring?: "month" | "year" | "one_time" };
  bullet_features: string[];
  hero_asset_id?: string;
  cta_id: string;
  trust_micro_copy?: string;
}
```

**Variants:** `card-with-image-top` (default), `card-with-image-side`, `card-text-only`.

**A/B testable:** Bullet ordering, price framing (monthly vs yearly).

---

### B.4.7 `offer.bundle-savings`

Calculate value, show savings.

```ts
interface OfferBundleSavingsContent {
  headline?: string;
  bundle_items: { name: string; standalone_price: number; included: boolean }[];
  bundle_price: number;
  currency: string;
  savings_display: "amount_and_percent" | "amount_only" | "percent_only";
  cta_id: string;
  disclaimer?: string;
}
```

**Variants:** `card` (default), `inline-strip`.

**A/B testable:** Bundle composition, savings display style, disclaimer.

---

### B.4.8 `offer.limited-time`

Timer + scarcity.

```ts
interface OfferLimitedTimeContent {
  headline: string;
  countdown: { target_iso8601: string; behavior_on_expiry: "hide" | "show_expired" | "evergreen_per_visitor" };
  scarcity?: { remaining: number; total: number; label: string }; // e.g. "7 of 50 spots remaining"
  cta_id: string;
  disclaimer?: string;
}
```

**Variants:** `centered-card` (default), `full-banner`, `corner-floating`.

**Compliance:** Scarcity numbers must reflect reality. Evergreen scarcity is flagged. The Compliance Agent compares scarcity claims against any connected inventory source if present.

**A/B testable:** Headline urgency, scarcity vs no scarcity, timer length.

---

## B.5 CTA blocks (4)

### B.5.1 `cta.button-single`

Primary button, alone in its own block, used between content sections.

```ts
interface CtaButtonSingleContent {
  cta_id: string;
  alignment: "left" | "center" | "right";
  microcopy_above?: string;
  microcopy_below?: string;
}
```

**Variants:** `pill` (default), `square`, `gradient-fill`.

**A/B testable:** CTA label (via swapping cta_id), microcopy, alignment.

---

### B.5.2 `cta.button-pair`

Primary + secondary.

```ts
interface CtaButtonPairContent {
  primary_cta_id: string;
  secondary_cta_id: string;
  alignment: "left" | "center" | "right";
  layout: "side-by-side" | "stacked";
}
```

**Variants:** `side-by-side` (default), `stacked-mobile-only`.

**Accessibility:** Tab order: primary first.

**A/B testable:** Both CTA labels, layout.

---

### B.5.3 `cta.banner`

Full-width band with text + button.

```ts
interface CtaBannerContent {
  headline: string;
  subhead?: string;
  cta_id: string;
  background_treatment: "solid_primary" | "gradient" | "dark" | "image";
  background_asset_id?: string;
}
```

**Variants:** Three treatments above plus `centered` vs `text-left-cta-right`.

**A/B testable:** Headline, treatment, CTA label.

---

### B.5.4 `cta.floating`

Sticky bottom (mobile) or side (desktop) button.

```ts
interface CtaFloatingContent {
  cta_id: string;
  position: "bottom_mobile_side_desktop" | "bottom_always" | "side_always";
  hide_after_section_id?: string;  // e.g. after the form section, hide the floating CTA
  dismissible: boolean;
}
```

**Variants:** Position values above.

**Accessibility:** Sticky element is `role="region" aria-label="Quick action"`. Dismissible variant has a real close button with `aria-label="Close call to action"`. The floating CTA does not cover form submit buttons (renderer detects overlap and offsets).

**A/B testable:** Position, dismissibility, CTA label, when to hide.

---

## B.6 Content blocks (8)

### B.6.1 `content.text-block`

Paragraph(s) of body copy.

```ts
interface ContentTextBlockContent {
  headline?: string;
  body_markdown: string;          // safe-rendered subset: bold, italic, links, lists, blockquote
  alignment: "left" | "center";
  max_width: "narrow" | "default" | "wide";
}
```

**Variants:** `prose` (default â€” semantic typography), `condensed`, `lead` (larger).

**Accessibility:** Markdown renderer strips unsafe tags; links have `rel="noopener"` when external.

**A/B testable:** Headline, body, alignment.

---

### B.6.2 `content.faq`

Accordion FAQ.

```ts
interface ContentFaqContent {
  headline?: string;
  items: { question: string; answer_markdown: string }[]; // min 3, max 20
  expand_first_by_default: boolean;
  emit_schema_markup: boolean;     // emits FAQ JSON-LD into page <head>
}
```

**Variants:** `accordion` (default), `always-open`, `two-column`.

**Accessibility:** Real `<details><summary>` or button-based disclosure with `aria-expanded`. Keyboard: Enter/Space toggles.

**A/B testable:** Question order, expand-first default.

---

### B.6.3 `content.video-embed`

Embedded video (not a hero â€” just a content section).

```ts
interface ContentVideoEmbedContent {
  video_asset_id: string;
  poster_asset_id?: string;
  caption?: string;
  aspect_ratio: "16:9" | "9:16" | "1:1" | "4:5";
  autoplay_muted_loop: boolean;
}
```

**Variants:** `centered` (default), `full-bleed`.

**Accessibility:** Captions required. Reduced-motion disables autoplay.

**A/B testable:** Video asset, caption.

---

### B.6.4 `content.image`

Single large image.

```ts
interface ContentImageContent {
  asset_id: string;
  caption?: string;
  link_url?: string;
  max_width: "narrow" | "default" | "wide" | "full";
}
```

**Variants:** Layout variants above.

**Accessibility:** `alt_text` required (from asset). If `link_url` set, image is wrapped in `<a>`.

**A/B testable:** Asset, caption, max_width.

---

### B.6.5 `content.gallery`

Multi-image gallery.

```ts
interface ContentGalleryContent {
  headline?: string;
  images: { asset_id: string; caption?: string }[]; // min 2, max 24
  layout: "grid_3col" | "grid_4col" | "carousel" | "masonry";
  enable_lightbox: boolean;
}
```

**Variants:** Layout above.

**Accessibility:** Carousel has prev/next buttons and `aria-roledescription="carousel"`; respects reduced-motion. Lightbox traps focus and restores on close.

**A/B testable:** Layout, image order, image selection.

---

### B.6.6 `content.code-snippet`

For B2B / developer-focused funnels.

```ts
interface ContentCodeSnippetContent {
  headline?: string;
  language: "javascript" | "typescript" | "python" | "ruby" | "go" | "bash" | "json" | "html" | "css" | "sql" | "rust" | "java" | "csharp" | "swift" | "kotlin" | "other";
  code: string;
  show_copy_button: boolean;
  filename?: string;
  highlight_lines?: number[];
}
```

**Variants:** `dark-default` (default), `light`, `terminal-frame`.

**Accessibility:** Copy button has visible label; success announces via `aria-live="polite"`. Syntax highlighting must maintain AA contrast.

**A/B testable:** Theme variant, with/without filename badge.

---

### B.6.7 `content.quote`

Large pull-quote (not a testimonial â€” could be a quote from the founder, a study, or a book).

```ts
interface ContentQuoteContent {
  quote: string;
  attribution?: string;
  source_url?: string;
  treatment: "large_quotes" | "minimal" | "card";
}
```

**Variants:** Treatments above.

**Accessibility:** Real `<blockquote>` with `cite` attribute.

**A/B testable:** Quote text, attribution, treatment.

---

### B.6.8 `content.bullet-list`

Standalone bullet list, possibly with icons.

```ts
interface ContentBulletListContent {
  headline?: string;
  items: { icon?: string; text: string }[];
  alignment: "left" | "center";
  columns: 1 | 2 | 3;
}
```

**Variants:** Column counts above plus icon styles.

**A/B testable:** Item order, columns, icons.

---

## B.7 Trust signal blocks (6)

### B.7.1 `trust.badge-row`

Security badges (SSL, BBB, etc.).

```ts
interface TrustBadgeRowContent {
  badges: { asset_id: string; name: string; link_url?: string }[]; // min 2, max 8
  alignment: "left" | "center" | "right";
  grayscale: boolean;
}
```

**Variants:** `inline-row` (default), `compact-strip`.

**Compliance:** Each badge must correspond to a real certification the workspace holds. The Compliance Agent flags suspected fake badges.

**A/B testable:** Badge selection, grayscale, alignment.

---

### B.7.2 `trust.guarantee`

Money-back / satisfaction.

```ts
interface TrustGuaranteeContent {
  headline: string;                // e.g. "30-day money-back guarantee"
  body: string;
  seal_asset_id?: string;
  fine_print?: string;
}
```

**Variants:** `seal-left` (default), `seal-top`, `text-only`.

**Compliance:** Guarantee terms must be honored by the workspace; the body and fine print are required.

**A/B testable:** Headline framing, seal vs no seal.

---

### B.7.3 `trust.certification`

Industry certifications (NABCEP, NATE, AICPA, etc.).

```ts
interface TrustCertificationContent {
  headline?: string;
  certifications: { asset_id: string; name: string; issuing_body: string; verification_url?: string }[];
}
```

**Variants:** `grid` (default), `inline-row`.

**Compliance:** Verification URL recommended; faked credentials are a Compliance Agent blocker.

**A/B testable:** Certification selection, headline copy.

---

### B.7.4 `trust.team`

Meet the team.

```ts
interface TrustTeamContent {
  headline?: string;
  members: { name: string; title: string; photo_asset_id?: string; bio_short?: string; linkedin_url?: string }[];
  layout: "grid_3col" | "grid_4col" | "carousel";
}
```

**Variants:** Layouts above.

**Accessibility:** Member photos have `alt_text` with name and title. LinkedIn icons have visible labels.

**A/B testable:** Member order, with/without photos.

---

### B.7.5 `trust.history`

Years in business, customers served.

```ts
interface TrustHistoryContent {
  headline?: string;
  facts: { label: string; value: string }[]; // e.g. { label: "Founded", value: "2012" }
  body?: string;
}
```

**Variants:** `stat-row` (default), `narrative-paragraph`.

**A/B testable:** Fact selection, framing.

---

### B.7.6 `trust.compliance`

HIPAA / SOC 2 / GDPR badges.

```ts
interface TrustComplianceContent {
  compliance_items: {
    framework: "HIPAA" | "SOC_2_TYPE_2" | "GDPR" | "CCPA" | "PCI_DSS" | "ISO_27001" | "FERPA" | "FedRAMP";
    badge_asset_id?: string;
    summary?: string;
    attestation_url?: string;
  }[];
}
```

**Variants:** `badge-row` (default), `text-with-badges`.

**Compliance:** Misrepresenting compliance posture is a Compliance Agent hard blocker â€” the validator cross-checks against the workspace's connected attestations.

**A/B testable:** Framework selection (only those actually held), layout.

---

## B.8 Interactive blocks (6)

### B.8.1 `interactive.countdown-timer`

Standalone countdown (not embedded in a hero or offer).

```ts
interface InteractiveCountdownTimerContent {
  target_iso8601: string;
  label_text?: string;
  show_days: boolean;
  behavior_on_expiry: "hide" | "show_expired" | "evergreen_per_visitor";
  size: "sm" | "md" | "lg" | "xl";
  cta_id?: string;                 // optional CTA below
}
```

**Accessibility:** As `hero.urgency` â€” `aria-live` once per minute, reduced-motion-safe.

**Compliance:** Evergreen variants are flagged.

---

### B.8.2 `interactive.calculator`

Loan / savings / ROI calculator (similar to `form.calculator` but without lead capture as primary).

```ts
interface InteractiveCalculatorContent {
  inputs: { id: string; label: string; type: "number" | "slider" | "select"; min?: number; max?: number; step?: number; options?: { value: string; label: string }[]; default?: number | string; unit?: string }[];
  formula_expression: string;       // safe-eval
  outputs: { id: string; label: string; formula: string; format: "currency" | "percent" | "number"; currency_symbol?: string }[];
  cta_id?: string;
  disclaimer: string;               // required
}
```

**Accessibility:** Sliders use real `<input type="range">`. Output updates announce via `aria-live`.

**Compliance:** Disclaimer required and visible. ROI claims flagged for fact-check in regulated verticals.

**A/B testable:** Input defaults, output framing, disclaimer copy.

---

### B.8.3 `interactive.product-finder`

Quiz-based recommendation engine.

```ts
interface InteractiveProductFinderContent {
  questions: {
    id: string;
    prompt: string;
    options: { value: string; label: string; image_asset_id?: string }[];
  }[];
  recommendation_rules: {
    if_answers: Record<string, string>; // map question_id -> answer_value
    recommend: { offer_id?: string; cta_id?: string; copy: string };
  }[];
  fallback_recommendation: { offer_id?: string; cta_id?: string; copy: string };
}
```

**Variants:** `card-style` (default), `chat-style`.

**A/B testable:** Question order, recommendation copy, fallback.

---

### B.8.4 `interactive.live-chat-embed`

Embeds a chat provider.

```ts
interface InteractiveLiveChatEmbedContent {
  provider: "intercom" | "drift" | "crisp" | "tawk_to" | "native";
  connection_id: string;            // workspace credential vault reference
  launcher_position: "bottom_right" | "bottom_left";
  proactive_message?: { trigger: "on_load" | "on_scroll_50" | "on_idle_30s"; text: string };
}
```

**Accessibility:** Provider widgets are reviewed for AA conformance; if not, a warning is shown in the editor. Launcher carries `aria-label="Open chat"`.

**A/B testable:** Proactive message text, launcher position.

---

### B.8.5 `interactive.calendar-booking-embed`

Calendar without a preceding form.

```ts
interface InteractiveCalendarBookingEmbedContent {
  provider: "calendly" | "cal_com" | "google" | "native";
  calendar_url_or_id: string;
  headline?: string;
  subhead?: string;
  pre_fill_from_query_params: boolean;
}
```

**Accessibility:** Embed wrappers have descriptive labels. Direct-link fallback shown if iframe blocked.

**A/B testable:** Headline, prefill behavior.

---

### B.8.6 `interactive.video-with-cta-overlay`

Video that pauses to surface a CTA at a timestamp.

```ts
interface InteractiveVideoWithCtaOverlayContent {
  video_asset_id: string;
  poster_asset_id?: string;
  cta_overlays: { at_seconds: number; cta_id: string; pause_video: boolean; persist: boolean }[];
}
```

**Accessibility:** Captions required. CTA overlay is keyboard-focusable when it appears; focus returns to video on dismiss.

**A/B testable:** Overlay timestamps, CTA labels.

---

## B.9 Footer blocks (2)

### B.9.1 `footer.minimal`

Logo + 3-5 links + AI disclosure. The default footer for single-purpose landing pages.

```ts
interface FooterMinimalContent {
  logo_asset_id?: string;
  business_name: string;
  links: { label: string; url: string }[]; // min 1, max 6
  copyright_year?: number;          // defaults to current year
  ai_disclosure_required: true;     // must be true on every published page; renderer injects standard copy
}
```

**Variants:** `single-row` (default), `stacked`.

**Compliance:** AI disclosure copy is sourced from the renderer's locale bundle (per language). It is never edited by users; only its presence and visibility are controlled here. If `compliance.ai_disclosure_visible = false`, publish is blocked at the validator layer.

**Accessibility:** `<footer role="contentinfo">`. Links are real anchors.

**A/B testable:** None â€” footers are not A/B-tested. (Variant flips are allowed but inadvisable.)

---

### B.9.2 `footer.full`

Multi-column site map style.

```ts
interface FooterFullContent {
  logo_asset_id?: string;
  business_name: string;
  description?: string;
  link_columns: { heading: string; links: { label: string; url: string }[] }[]; // min 2, max 5
  social_links?: { platform: "facebook" | "instagram" | "x" | "linkedin" | "youtube" | "tiktok" | "pinterest"; url: string }[];
  legal_links: { label: string; url: string }[]; // privacy, terms, etc.
  contact?: { address?: string; email?: string; phone?: string };
  newsletter_form_id?: string;
  ai_disclosure_required: true;
}
```

**Variants:** `4-column` (default), `3-column`, `mega-footer`.

**Accessibility:** Each column has an `<h2>` (visually styled smaller) for screen-reader navigation. Social icons have `aria-label`.

**A/B testable:** None.

---

## B.10 Specialty blocks (4)

### B.10.1 `specialty.lead-magnet-delivery`

Thank-you-with-download. Sits on a thank-you page.

```ts
interface SpecialtyLeadMagnetDeliveryContent {
  headline: string;
  body: string;
  download_asset_id: string;        // document/audio/video
  alternative_delivery: { method: "email" | "sms"; copy?: string }[];
  next_step_cta_id?: string;        // upsell or book-a-call
}
```

**Variants:** `centered-card` (default), `split-with-image`.

**Accessibility:** Download button has visible filename + size; `aria-describedby` carries delivery info.

**A/B testable:** Headline, next-step CTA, alternative-delivery method.

---

### B.10.2 `specialty.webinar-registration`

Webinar registration with date/time/host info.

```ts
interface SpecialtyWebinarRegistrationContent {
  headline: string;
  webinar: { title: string; host_name: string; host_title?: string; host_photo_asset_id?: string; date_iso8601: string; duration_minutes: number; timezone: string };
  bullet_takeaways: string[];       // "You'll learn..." â€” min 3, max 6
  form_id: string;
  add_to_calendar_options?: ("google" | "outlook" | "apple" | "ics")[];
  recording_offered: boolean;       // if can't attend live
}
```

**Variants:** `split-form-right` (default), `centered`, `replay-style` (post-live).

**Accessibility:** Date/time formatted per user locale; timezone always disclosed.

**Compliance:** If the host promises specific outcomes, the Fact-Check Agent reviews in regulated verticals.

**A/B testable:** Takeaway copy, host framing, time/date display.

---

### B.10.3 `specialty.contest-entry`

Giveaway / contest entry.

```ts
interface SpecialtyContestEntryContent {
  headline: string;
  prize_description: string;
  prize_image_asset_id?: string;
  entry_form_id: string;
  contest_rules_url: string;        // required
  end_date_iso8601: string;
  bonus_entries?: { action: "share_facebook" | "share_x" | "refer_friend" | "follow_instagram"; entries_awarded: number }[];
  sweepstakes_disclosure: string;   // required
}
```

**Variants:** `centered` (default), `split`.

**Compliance:** Sweepstakes are heavily regulated â€” `contest_rules_url` and `sweepstakes_disclosure` are validator-required. The Compliance Agent additionally checks for "no purchase necessary" language in US geographies.

**A/B testable:** Prize framing, bonus-entry mix.

---

### B.10.4 `specialty.referral-program-signup`

Refer-a-friend signup.

```ts
interface SpecialtyReferralProgramSignupContent {
  headline: string;
  body?: string;
  reward_description: string;        // e.g. "Get $25 for each friend who signs up"
  form_id: string;                   // captures referrer's contact
  share_methods: ("email" | "sms" | "facebook" | "x" | "whatsapp" | "copy_link")[];
  referral_tracking_provider: "native" | "rewardful" | "referralcandy" | "friendbuy";
  terms_url?: string;
}
```

**Variants:** `centered-card` (default), `split-with-illustration`.

**Compliance:** Rewards-related claims must be plain about terms â€” terms link required for non-trivial rewards.

**A/B testable:** Reward framing, share-method ordering.

---

# Part C â€” Design Tokens

The Brand Tokens object in the Funnel JSON references the values below. Engineering implements these as Tailwind `theme.extend` plus a CSS-custom-properties layer the renderer injects at the funnel root. This lets the same Tailwind classes render any funnel with any brand identity without rebuilding the CSS.

## C.1 Color tokens

Each scale has 10 stops (50, 100, 200, 300, 400, 500, 600, 700, 800, 900). The 500 stop is the canonical reference for the color (e.g. `primary-500` is "the primary color").

| Scale name | Purpose | 500 example |
|---|---|---|
| `primary` | Brand color used for primary CTAs, links, accents | `#0F5BFF` |
| `secondary` | Supporting brand color; alt CTAs, secondary actions | `#1A1A1A` |
| `accent` | Tertiary/highlight color; badges, surprise pops | `#00A86B` |
| `neutral` | Grays for text, borders, surfaces | `#737373` |

Semantic colors live outside the scales (single hex each):

| Token | Default |
|---|---|
| `semantic.success` | `#16A34A` |
| `semantic.warning` | `#F59E0B` |
| `semantic.error` | `#DC2626` |
| `semantic.info` | `#2563EB` |

Tailwind config exposes these as `text-primary-500`, `bg-secondary-100`, etc., backed by CSS variables `--color-primary-500`, etc. The renderer overwrites the CSS variables at the funnel root so templates and workspaces theme themselves without a rebuild.

Contrast invariants enforced at generation and validation time:
- Text on backgrounds: â‰¥ 4.5:1 (body) or â‰¥ 3:1 (large text 18pt+/14pt bold+).
- Focus rings: visible against all background tokens.
- Disabled state: â‰¥ 3:1 against its surface.

## C.2 Typography tokens

Four font families:

| Token | Role | Example |
|---|---|---|
| `font_families.heading_display` | Display headings (h1, hero) | Inter Tight, Space Grotesk |
| `font_families.heading_text` | In-content headings (h2â€“h6) â€” optional; falls back to display | Inter, SÃ¶hne |
| `font_families.body` | Body, form fields, labels | Inter, SÃ¶hne |
| `font_families.mono` | Code snippets, technical metadata | JetBrains Mono, IBM Plex Mono |

Type scale (rem-based, modular):

| Token | Default | Use |
|---|---|---|
| `xs` | `0.75rem` (12px) | Micro labels |
| `sm` | `0.875rem` (14px) | Help text |
| `base` | `1rem` (16px) | Body |
| `lg` | `1.125rem` (18px) | Lead paragraph |
| `xl` | `1.25rem` (20px) | Section lead-ins |
| `h6` | `1rem` | â€” |
| `h5` | `1.125rem` | â€” |
| `h4` | `1.25rem` | â€” |
| `h3` | `1.5rem` | â€” |
| `h2` | `2.25rem` | â€” |
| `h1` | `3rem` | â€” |
| `display` | `4.5rem` | Hero headlines on desktop |

Font weights: `regular: 400`, `medium: 500`, `semibold: 600`, `bold: 700`.

Line heights: `tight: 1.1`, `snug: 1.2`, `normal: 1.5`, `relaxed: 1.625`, `loose: 1.75`.

Letter spacings: `tighter: -0.02em`, `tight: -0.01em`, `normal: 0`, `wide: 0.01em`, `wider: 0.05em`.

## C.3 Spacing tokens

Single scale used for padding, margin, gap (rem-based):

| Token | Value |
|---|---|
| `0` | `0` |
| `1` | `0.25rem` (4px) |
| `2` | `0.5rem` (8px) |
| `4` | `1rem` (16px) |
| `6` | `1.5rem` (24px) |
| `8` | `2rem` (32px) |
| `12` | `3rem` (48px) |
| `16` | `4rem` (64px) |
| `24` | `6rem` (96px) |
| `32` | `8rem` (128px) |
| `48` | `12rem` (192px) |
| `64` | `16rem` (256px) |
| `96` | `24rem` (384px) |

Tailwind utilities map directly: `p-6`, `gap-8`, `space-y-12`, etc.

## C.4 Border radius

| Token | Default | Use |
|---|---|---|
| `none` | `0` | Code blocks, full-bleed elements |
| `sm` | `0.25rem` | Form inputs |
| `md` | `0.5rem` | Cards |
| `lg` | `0.75rem` | Featured cards, modals |
| `xl` | `1.25rem` | Hero images, large media |
| `full` | `9999px` | Pills, avatars |

## C.5 Shadows

| Token | Default |
|---|---|
| `sm` | `0 1px 2px 0 rgb(0 0 0 / 0.05)` |
| `md` | `0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)` |
| `lg` | `0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)` |
| `xl` | `0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)` |
| `glow` | `0 0 0 4px var(--color-primary-200)` â€” for focus emphasis |

## C.6 Motion

Durations:

| Token | Default | Use |
|---|---|---|
| `fastest` | `75ms` | Hover state color change |
| `faster` | `100ms` | Small UI affordances |
| `fast` | `150ms` | Button press, dropdowns |
| `normal` | `250ms` | Modals, accordions |
| `slow` | `400ms` | Page-level transitions |

Easings:

| Token | Cubic-bezier |
|---|---|
| `ease_out` | `cubic-bezier(0.16, 1, 0.3, 1)` |
| `ease_in_out` | `cubic-bezier(0.65, 0, 0.35, 1)` |
| `bouncy` | `cubic-bezier(0.34, 1.56, 0.64, 1)` |

All motion respects `prefers-reduced-motion: reduce` â€” duration drops to `0ms` for animations and opacity-only fades remain at half-duration.

## C.7 Z-index scale

| Token | Default |
|---|---|
| `base` | `0` |
| `raised` | `10` |
| `dropdown` | `100` |
| `sticky` | `200` |
| `overlay` | `300` |
| `modal` | `400` |
| `popover` | `500` |
| `toast` | `600` |

Floating CTAs use `sticky` (200). Modals use `modal` (400). Toasts always win.

---

# Part D â€” Schema Versioning and Migration

## D.1 Schema version field

The top-level `schema_version` is the semver of **the Funnel JSON Schema itself**, not the user's funnel. This is distinct from `metadata.version`, which is the user's funnel version.

| Field | Purpose |
|---|---|
| `schema_version` | "What rules does this document follow?" Drives migrations. |
| `metadata.version` | "What version of this funnel is this?" Drives end-user history. |

Current: `schema_version = "1.0.0"`.

## D.2 Semantic versioning rules for the schema

- **Patch (1.0.x):** Documentation only, internal-validator improvements, no JSON shape changes. Funnels at any 1.0.x level remain valid against any newer 1.0.x validator. No migration ever needed.
- **Minor (1.x.0):** Additive, backward-compatible. New optional fields, new enum values, new block types. Older funnels remain valid; older renderers ignore unknown additive fields (they have a fallback). Migration is a no-op.
- **Major (x.0.0):** Breaking. Renamed fields, removed enums, restructured nesting. Requires a migration script; old renderers refuse to render the new schema and vice versa.

Renderer compatibility:
- Renderer at schema `M.x.y` MUST render funnels at any `M.X.Y` where `X â‰¤ x`.
- Renderer MUST refuse funnels with `schema_version` major > its own (with a clear error).
- Renderer MAY render funnels with `schema_version` major < its own only if a migration adapter is available.

## D.3 Forward and backward compatibility rules

Forward compatibility (older renderer, newer funnel JSON at same major):

- Unknown additive fields are ignored.
- Unknown block types fall back to a degraded `content.text-block`-style render with a small "Block type unsupported in this renderer; please update" notice (only shown to workspace authors in preview mode; suppressed in production rendering â€” production rendering blocks the publish at the validator level instead).
- Unknown enum values for `style_overrides.padding_y`, etc., fall back to the schema-defined default.

Backward compatibility (newer renderer, older funnel JSON):

- The renderer applies migration adapters at load time (in-memory, non-destructive) to upgrade `schema_version` for the duration of the render.
- The persisted JSON is left untouched until the workspace explicitly publishes â€” at which point the migration is run, the new shape is saved, `schema_version` is bumped, and a `provenance.regeneration_lineage` entry is appended.

## D.4 Migration scripts

Migrations live in `/services/schema/migrations/` as pure functions:

```ts
type Migration = {
  from_version: string; // e.g. "1.4.0"
  to_version: string;   // e.g. "2.0.0"
  migrate: (input: unknown) => unknown;       // returns the upgraded Funnel JSON
  downgrade?: (input: unknown) => unknown;    // optional reverse for templates
  notes: string;
  test_fixtures: string[];                    // paths to before/after snapshots in /fixtures/migrations
};
```

Rules:

- Every major schema change ships with a `Migration` and at minimum 5 test fixtures (across diverse industries) showing before/after.
- The migration runner is **idempotent**: running it twice produces the same result.
- Migrations never delete data. Removed fields are preserved into a `_legacy.{fieldName}` namespace on the parent object until a subsequent major version explicitly drops them.
- Migration logs are appended to the funnel's `compliance.audit_log_pointer`. The user sees a "Migrated to schema v2.0.0 on 2026-12-15" entry in their funnel history.

Example: v1.0 â†’ v2.0 (hypothetical) where `hero.classic.hero_image_url` (string URL) becomes `hero.classic.hero_asset_id` (UUID into the assets registry):

```ts
const m_1_0_0_to_2_0_0: Migration = {
  from_version: "1.0.0",
  to_version: "2.0.0",
  migrate: (funnel) => {
    for (const page of funnel.pages) {
      for (const section of page.sections) {
        if (section.type === "hero.classic" && typeof section.content.hero_image_url === "string") {
          const assetId = crypto.randomUUID();
          funnel.assets ??= [];
          funnel.assets.push({
            id: assetId,
            type: "image",
            url: section.content.hero_image_url,
            license_type: "user_uploaded",
            alt_text: section.content.hero_image_alt ?? "",
          });
          section.content._legacy = { hero_image_url: section.content.hero_image_url };
          delete section.content.hero_image_url;
          section.content.hero_asset_id = assetId;
        }
      }
    }
    funnel.schema_version = "2.0.0";
    return funnel;
  },
  notes: "Hoist inline image URLs into the assets registry.",
  test_fixtures: ["1.0.0-to-2.0.0/solar.json", "1.0.0-to-2.0.0/hvac.json", "1.0.0-to-2.0.0/real-estate.json", "1.0.0-to-2.0.0/coaching.json", "1.0.0-to-2.0.0/saas.json"],
};
```

## D.5 Marketplace template version compatibility

Templates in the marketplace declare a `min_schema_version` and `max_schema_version` (inclusive). The marketplace UI hides templates incompatible with the buyer's current renderer.

When a buyer imports a template:

1. Marketplace serves the template JSON at its declared `schema_version`.
2. The importer runs all required migrations to bring it to the buyer's workspace `schema_version`.
3. Brand tokens are remapped: the buyer chooses "use template tokens" or "apply workspace tokens." If "apply workspace tokens," the importer walks every `style_overrides.background`/`text_color` field and translates any value that matches the template's brand tokens to the buyer's tokens.
4. Assets are duplicated into the buyer's asset registry (templates ship with `license_type: royalty_free` and `creative_commons` only).
5. Compliance state is reset â€” the imported funnel must pass the buyer's Compliance Agent before publish.

## D.6 Import compatibility from CF / GHL / Leadpages

We ship adapters mapping common third-party funnel structures into our block types. Adapters are best-effort; users review and complete the imported funnel.

**ClickFunnels (CF) 2.0 mapping:**

| CF Element | Our Block | Notes |
|---|---|---|
| `headline_element` (top section) | `hero.classic` | First headline becomes the h1; subsequent headlines become `content.text-block` with prominent heading. |
| `video_element` (above fold) | `hero.video` | Video URL hoisted into asset registry. |
| `optin_form_2_step` | `form.multi-step` (2 steps) | Two-step popups collapse into a 2-step inline form. |
| `optin_form_basic` | `form.classic-3-field` or `form.long-7-field` | Decided by field count. |
| `testimonial_carousel` | `proof.testimonial-grid` with `variant: grid-3-col` | Carousel becomes grid (better defaults). |
| `pricing_table` | `offer.pricing-tiers` | |
| `countdown` (fixed-end) | `interactive.countdown-timer` with `behavior_on_expiry: hide` | Evergreen versions are flagged and not auto-imported; user must explicitly enable. |
| `order_form_element` | `form.payment` | Stripe connection must be re-authorized in our workspace. |
| `image_element` | `content.image` | |
| `video_element` (mid-page) | `content.video-embed` | |
| `text_element` | `content.text-block` | |
| `bullet_list_element` | `content.bullet-list` | |
| `faq_element` | `content.faq` | |
| `social_proof_popup` | Not imported | Pattern is not on our roadmap; user is notified. |

**GoHighLevel (GHL) mapping:**

| GHL Section | Our Block | Notes |
|---|---|---|
| Hero with form right | `hero.split` with `variant: text-left-form-right` | |
| Calendar widget | `interactive.calendar-booking-embed` or `form.consultation-booking` | If preceded by form fields, becomes booking; otherwise standalone. |
| Survey funnel step | `form.quiz` | |
| Three-column features | `offer.feature-grid` | |
| Testimonials section | `proof.testimonial-grid` | |
| Pricing comparison | `offer.pricing-tiers` or `offer.comparison-table` | Comparison if features differ by column; pricing if only price. |
| Footer | `footer.full` or `footer.minimal` | Decided by link-column count. |
| GHL workflow webhooks | `integrations.webhooks` entries | Workflow ID becomes a tag; user re-points destinations. |

**Leadpages mapping:**

| Leadpages Widget | Our Block | Notes |
|---|---|---|
| Headline widget | `content.text-block` with prominent heading or `hero.minimal` | First-on-page becomes hero; subsequent becomes text-block. |
| Image widget | `content.image` | |
| Button widget | `cta.button-single` | |
| Form widget | `form.classic-3-field` / `form.long-7-field` | |
| Countdown widget | `interactive.countdown-timer` | |
| Calendly embed | `interactive.calendar-booking-embed` | |
| Video widget | `content.video-embed` | |
| HTML widget | Not imported automatically | Pasted into a `content.text-block` as preformatted text with a warning; user must rebuild. |
| Custom widget / 3rd-party embed | Not imported | User notified per element. |

Adapter responsibilities:

- Run validator after import. Anything that fails validation is flagged in the editor with a "needs attention" badge on the affected section.
- Compliance state is **never** carried over from the source platform. The imported funnel starts at `compliance_agent_pass_at: null` and must pass our gates before publish, regardless of its status on the source platform.
- Provenance for imported funnels is set with `provenance.model_versions: []`, `provenance.regeneration_lineage[0].reason: "imported_from_clickfunnels_2_0"` (or equivalent).
- Asset URLs from the source platform are mirrored into our asset storage on import (we do not hot-link). License type defaults to `user_uploaded` with a "verify license" task added to the editor.

## D.7 Versioning the 60-block library

The 60 blocks are part of the schema's `BlockType` enum. Adding a block is a minor version bump (1.x.0). Removing a block is a major bump (x.0.0). Renaming a block is treated as remove + add and is therefore major.

If we ship a backward-incompatible content shape change to an existing block (e.g. renaming `hero.classic.hero_image_url` to `hero.classic.hero_asset_id` as in the D.4 example), that is also a major bump. Otherwise, additive content fields are minor.

The marketplace gates templates by both `min_schema_version`/`max_schema_version` AND `required_block_types[]` â€” so a template that uses `interactive.product-finder` won't surface to a buyer on a renderer that doesn't yet support it.

## D.8 Operational rollout

- Schema changes ship behind a feature flag on the renderer and the generation engine simultaneously.
- The validator service runs both versions in parallel for 14 days after rollout. Any funnel that validates under the old but not the new schema raises a Sev-2 alert for the schema owner to triage.
- Migrations are exercised in CI on every PR with a fixture corpus of 500+ real funnels (anonymized) representing the full industry distribution.
- After every major bump, we publish a `MIGRATION_NOTES.md` and a video walkthrough for partners and agency users.

---

**End of document.** Engineering can scaffold the renderer's block registry, the generation engine's prompt-per-block templates, the marketplace serializer, and the import adapters directly from this spec. Anything ambiguous escalates to the Schema Owner (Platform Eng lead) â€” but ideally nothing is ambiguous, because that is the whole point of this document.
