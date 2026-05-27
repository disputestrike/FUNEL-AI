/**
 * Shared types for the 60-block library.
 *
 * Mirrors the schema definitions in doc 18 (Part A). For the canonical Zod
 * schemas, see `@funnel/shared/funnel-schema` — this file is the renderer-side
 * subset that funnel blocks need to type their `content` shapes.
 */

export type UUID = string;
export type AssetId = string;
export type FormId = string;
export type CTAId = string;
export type SectionId = string;

/** Section-level styling overrides applied as inline classes on the <section>. */
export interface StyleOverrides {
  background?: string;            // HEX
  text_color?: string;            // HEX
  padding_y?: "none" | "sm" | "md" | "lg" | "xl";
  max_width?: "narrow" | "default" | "wide" | "full";
  alignment?: "left" | "center" | "right";
  border_top?: boolean;
  border_bottom?: boolean;
}

/** Conditional display predicates. Evaluated by the renderer at runtime. */
export interface ConditionalDisplay {
  device?: "all" | "mobile_only" | "desktop_only";
  geo_allow?: string[];
  geo_deny?: string[];
  utm_match?: Record<string, string>;
  schedule_start?: string;
  schedule_end?: string;
}

/** Common props passed by FunnelRenderer to every block. */
export interface BlockBaseProps {
  /** UUID for this section — emitted on the <section> as `data-section-id`. */
  sectionId: SectionId;
  /** Variant slug if any. */
  variant?: string;
  /** Style overrides. */
  styleOverrides?: StyleOverrides;
  /** Reference resolvers — the renderer injects these so blocks don't have to
   * import the whole funnel. Implementations look up assets/forms/CTAs in the
   * registries on the parent Funnel JSON. */
  resolveAsset?: (id: AssetId) => ResolvedAsset | undefined;
  resolveForm?: (id: FormId) => ResolvedForm | undefined;
  resolveCTA?: (id: CTAId) => ResolvedCTA | undefined;
  /** Locale / language. BCP47. */
  locale?: string;
  /** A/B variant key when this section is part of a test bucket. */
  abVariantKey?: string;
}

export interface ResolvedAsset {
  id: AssetId;
  type: "image" | "video" | "audio" | "document";
  url: string;
  alt_text?: string;
  width_px?: number;
  height_px?: number;
}

export interface ResolvedForm {
  id: FormId;
  fields: ResolvedFormField[];
  submit_action: ResolvedSubmitAction;
  consent_capture?: {
    marketing_consent_required?: boolean;
    marketing_consent_copy?: string;
    tcpa_required?: boolean;
    tcpa_copy?: string;
    gdpr_required?: boolean;
    data_processor_disclosure?: string;
  };
  success_state?: {
    headline?: string;
    body_markdown?: string;
    next_step_cta_id?: CTAId;
  };
}

export interface ResolvedFormField {
  id: UUID;
  type:
    | "text"
    | "email"
    | "tel"
    | "number"
    | "textarea"
    | "select"
    | "multiselect"
    | "radio"
    | "checkbox"
    | "date"
    | "time"
    | "address"
    | "hidden"
    | "consent"
    | "file";
  label: string;
  name: string;
  placeholder?: string;
  help_text?: string;
  required?: boolean;
  default_value?: string;
  options?: { value: string; label: string }[];
  validation?: {
    min_length?: number;
    max_length?: number;
    min?: number;
    max?: number;
    pattern?: string;
    custom_message?: string;
  };
  pii_classification?: "none" | "low" | "medium" | "high";
}

export interface ResolvedSubmitAction {
  type:
    | "redirect_to_page"
    | "redirect_to_url"
    | "show_message"
    | "trigger_download"
    | "open_calendar"
    | "start_checkout";
  redirect_page_id?: UUID;
  redirect_url?: string;
  message_markdown?: string;
  download_asset_id?: AssetId;
  calendar_provider?: "calendly" | "cal_com" | "google" | "native";
  checkout_offer_id?: UUID;
}

export interface ResolvedCTA {
  id: CTAId;
  label: string;
  sublabel?: string;
  action: {
    type:
      | "link"
      | "form"
      | "checkout"
      | "booking"
      | "phone-call"
      | "scroll-to-section"
      | "open-modal"
      | "download";
    link_url?: string;
    form_id?: FormId;
    offer_id?: UUID;
    phone_e164?: string;
    scroll_section_id?: SectionId;
    modal_section_id?: SectionId;
    download_asset_id?: AssetId;
  };
  tracking_id?: string;
  style?: {
    variant?: "primary" | "secondary" | "tertiary" | "ghost" | "destructive";
    size?: "sm" | "md" | "lg" | "xl";
    full_width_on_mobile?: boolean;
    icon_left?: string;
    icon_right?: string;
  };
}

/**
 * Mark used to identify A/B-testable elements in the rendered DOM. Analytics
 * scripts pick these up by `data-ab-key`. Every block emits at least the
 * primary headline and primary CTA with stable keys.
 */
export const AB = (key: string): Record<string, string> => ({ "data-ab-key": key });
