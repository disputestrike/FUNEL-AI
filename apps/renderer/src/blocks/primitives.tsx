/**
 * Shared primitives for every block — CTA renderer, image renderer, form
 * placeholder. These look up the funnel's registries (forms/ctas/assets) by
 * ID and render the corresponding markup.
 */

import * as React from "react";

export interface FunnelRegistries {
  forms: Record<string, FunnelForm>;
  ctas: Record<string, FunnelCta>;
  assets: Record<string, FunnelAsset>;
  pages: Record<string, FunnelPage>;
  /** action target — where forms POST. Defaults to `/__form-submit`. */
  formActionPath: string;
  /** funnel-scope HMAC token used to bind form posts to the rendered HTML. */
  formActionToken: string;
}

export interface FunnelForm {
  id: string;
  name?: string;
  fields: Array<{
    id: string;
    type: string;
    name: string;
    label: string;
    placeholder?: string;
    help_text?: string;
    required?: boolean;
    options?: Array<{ value: string; label: string }>;
    default_value?: string;
  }>;
  submit_action?: { type: string; redirect_url?: string };
  consent_capture?: Record<string, unknown>;
  anti_spam?: { captcha?: string; honeypot?: boolean };
}

export interface FunnelCta {
  id: string;
  label: string;
  sublabel?: string;
  action: {
    type: string;
    link_url?: string;
    form_id?: string;
    scroll_section_id?: string;
    phone_e164?: string;
    download_asset_id?: string;
  };
  tracking_id?: string;
  style?: {
    variant?: "primary" | "secondary" | "tertiary" | "ghost" | "destructive";
    size?: "sm" | "md" | "lg" | "xl";
  };
}

export interface FunnelAsset {
  id: string;
  type: "image" | "video" | "audio" | "document";
  url: string;
  alt_text?: string;
  dimensions?: { width_px?: number; height_px?: number };
  mime_type?: string;
}

export interface FunnelPage {
  id: string;
  slug?: string;
  type: string;
}

export interface BlockContext {
  funnel_id: string;
  funnel_version_id: string;
  page_id: string;
  section_id: string;
  registries: FunnelRegistries;
  locale: string;
  free_tier: boolean;
}

// ---- CTA ----

const SIZE_CLASSES: Record<string, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-base",
  lg: "px-6 py-3 text-lg",
  xl: "px-8 py-4 text-xl",
};

const VARIANT_CLASSES: Record<string, string> = {
  primary:
    "bg-[var(--color-primary-500)] text-white hover:bg-[var(--color-primary-600)] shadow-[var(--shadow-md)]",
  secondary: "bg-[var(--color-secondary-500)] text-white hover:bg-[var(--color-secondary-600)]",
  tertiary:
    "bg-transparent text-[var(--color-primary-600)] border border-[var(--color-primary-500)] hover:bg-[var(--color-primary-50)]",
  ghost: "bg-transparent text-[var(--color-neutral-900)] hover:bg-[var(--color-neutral-100)]",
  destructive: "bg-[var(--color-semantic-error)] text-white hover:opacity-90",
};

export function CTA(props: {
  ctaId?: string;
  ctx: BlockContext;
  className?: string;
  sizeOverride?: "sm" | "md" | "lg" | "xl";
  variantOverride?: "primary" | "secondary" | "tertiary" | "ghost" | "destructive";
}): React.ReactElement | null {
  if (!props.ctaId) return null;
  const cta = props.ctx.registries.ctas[props.ctaId];
  if (!cta) return null;
  const variant = props.variantOverride ?? cta.style?.variant ?? "primary";
  const size = props.sizeOverride ?? cta.style?.size ?? "lg";
  const base =
    "inline-flex items-center justify-center font-semibold rounded-[var(--radius-md)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-500)] focus-visible:ring-offset-2";
  const cls = `${base} ${SIZE_CLASSES[size] ?? SIZE_CLASSES.lg} ${VARIANT_CLASSES[variant] ?? VARIANT_CLASSES.primary} ${props.className ?? ""}`;

  const trackAttrs = {
    "data-cta-id": cta.id,
    "data-cta-tracking-id": cta.tracking_id ?? cta.id,
  };

  const label = (
    <>
      <span>{cta.label}</span>
      {cta.sublabel && <span className="ml-2 text-xs opacity-80">{cta.sublabel}</span>}
    </>
  );

  switch (cta.action.type) {
    case "link":
      return (
        <a className={cls} href={cta.action.link_url ?? "#"} rel="noopener" {...trackAttrs}>
          {label}
        </a>
      );
    case "form":
      return (
        <a className={cls} href={`#form-${cta.action.form_id ?? ""}`} {...trackAttrs}>
          {label}
        </a>
      );
    case "scroll-to-section":
      return (
        <a className={cls} href={`#section-${cta.action.scroll_section_id ?? ""}`} {...trackAttrs}>
          {label}
        </a>
      );
    case "phone-call":
      return (
        <a className={cls} href={`tel:${cta.action.phone_e164 ?? ""}`} {...trackAttrs}>
          {label}
        </a>
      );
    case "download":
      return (
        <a
          className={cls}
          href={resolveAssetUrl(cta.action.download_asset_id, props.ctx) ?? "#"}
          download
          {...trackAttrs}
        >
          {label}
        </a>
      );
    case "open-modal":
      return (
        <button type="button" className={cls} data-modal-target={cta.action.form_id} {...trackAttrs}>
          {label}
        </button>
      );
    case "checkout":
    case "booking":
      return (
        <a className={cls} href={`#${cta.action.type}-${cta.id}`} {...trackAttrs}>
          {label}
        </a>
      );
    default:
      return (
        <button type="button" className={cls} {...trackAttrs}>
          {label}
        </button>
      );
  }
}

// ---- Image ----

export function resolveAssetUrl(assetId: string | undefined, ctx: BlockContext): string | undefined {
  if (!assetId) return undefined;
  const a = ctx.registries.assets[assetId];
  return a?.url;
}

export function Img(props: {
  assetId?: string;
  ctx: BlockContext;
  className?: string;
  priority?: boolean;
  loading?: "lazy" | "eager";
  aspectRatio?: string;
}): React.ReactElement | null {
  if (!props.assetId) return null;
  const a = props.ctx.registries.assets[props.assetId];
  if (!a) return null;
  return (
    <img
      src={a.url}
      alt={a.alt_text ?? ""}
      width={a.dimensions?.width_px}
      height={a.dimensions?.height_px}
      loading={props.priority ? "eager" : props.loading ?? "lazy"}
      decoding="async"
      className={props.className}
      style={props.aspectRatio ? { aspectRatio: props.aspectRatio } : undefined}
    />
  );
}

// ---- Form (renders fields; the wire-up is handled by the form-handler endpoint) ----

export function Form(props: {
  formId?: string;
  ctx: BlockContext;
  className?: string;
  fieldsOverride?: string[]; // restrict to a subset (multi-step)
  submitLabel?: string;
}): React.ReactElement | null {
  if (!props.formId) return null;
  const form = props.ctx.registries.forms[props.formId];
  if (!form) return null;
  const action = props.ctx.registries.formActionPath;
  const fields = props.fieldsOverride
    ? form.fields.filter((f) => props.fieldsOverride!.includes(f.id))
    : form.fields;
  return (
    <form
      method="POST"
      action={action}
      id={`form-${form.id}`}
      data-form-id={form.id}
      className={`space-y-4 ${props.className ?? ""}`}
      noValidate
    >
      <input type="hidden" name="_form_id" value={form.id} />
      <input type="hidden" name="_section_id" value={props.ctx.section_id} />
      <input type="hidden" name="_page_id" value={props.ctx.page_id} />
      <input type="hidden" name="_funnel_id" value={props.ctx.funnel_id} />
      <input type="hidden" name="_funnel_version_id" value={props.ctx.funnel_version_id} />
      <input type="hidden" name="_token" value={props.ctx.registries.formActionToken} />
      {/* Honeypot — must be empty when humans submit. */}
      <input
        type="text"
        name="_hp_company"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "-10000px",
          width: "1px",
          height: "1px",
          opacity: 0,
        }}
      />
      <input type="hidden" name="_loaded_at" value={Date.now().toString()} />
      {fields.map((f) => (
        <FormField key={f.id} field={f} />
      ))}
      {form.consent_capture && (
        <ConsentBlock consent={form.consent_capture} />
      )}
      {form.anti_spam?.captcha === "turnstile" && (
        <div className="cf-turnstile" data-sitekey="REPLACE_AT_DEPLOY" data-theme="light" />
      )}
      <button
        type="submit"
        className="w-full bg-[var(--color-primary-500)] text-white font-semibold py-3 px-6 rounded-[var(--radius-md)] hover:bg-[var(--color-primary-600)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-500)] focus-visible:ring-offset-2"
      >
        {props.submitLabel ?? "Submit"}
      </button>
    </form>
  );
}

function FormField(props: { field: FunnelForm["fields"][number] }): React.ReactElement {
  const f = props.field;
  const id = `f-${f.id}`;
  const labelEl = (
    <label htmlFor={id} className="block text-sm font-medium text-[var(--color-neutral-800)]">
      {f.label}
      {f.required && <span className="text-[var(--color-semantic-error)] ml-1" aria-hidden="true">*</span>}
    </label>
  );
  const helpEl = f.help_text ? (
    <p id={`${id}-help`} className="mt-1 text-xs text-[var(--color-neutral-600)]">
      {f.help_text}
    </p>
  ) : null;
  const commonProps = {
    id,
    name: f.name,
    required: !!f.required,
    placeholder: f.placeholder,
    defaultValue: f.default_value,
    "aria-required": !!f.required,
    "aria-describedby": f.help_text ? `${id}-help` : undefined,
    className:
      "block w-full rounded-[var(--radius-sm)] border border-[var(--color-neutral-300)] bg-white px-3 py-2 text-base focus:border-[var(--color-primary-500)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]/30",
  };

  switch (f.type) {
    case "textarea":
      return (
        <div>
          {labelEl}
          <textarea {...commonProps} rows={4} />
          {helpEl}
        </div>
      );
    case "select":
      return (
        <div>
          {labelEl}
          <select {...commonProps}>
            <option value="">{f.placeholder ?? "Select…"}</option>
            {(f.options ?? []).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {helpEl}
        </div>
      );
    case "checkbox":
      return (
        <div className="flex items-start gap-3">
          <input id={id} name={f.name} type="checkbox" required={!!f.required} className="mt-1" defaultChecked={f.default_value === "true"} />
          <label htmlFor={id} className="text-sm">{f.label}</label>
        </div>
      );
    case "radio":
      return (
        <fieldset>
          <legend className="text-sm font-medium">{f.label}</legend>
          <div className="mt-2 space-y-2">
            {(f.options ?? []).map((o) => (
              <label key={o.value} className="flex items-center gap-3 text-sm">
                <input type="radio" name={f.name} value={o.value} required={!!f.required} />
                {o.label}
              </label>
            ))}
          </div>
        </fieldset>
      );
    case "consent":
      return (
        <div className="flex items-start gap-3">
          <input id={id} name={f.name} type="checkbox" required={!!f.required} className="mt-1" />
          <label htmlFor={id} className="text-xs text-[var(--color-neutral-700)]">
            {f.label}
          </label>
        </div>
      );
    case "hidden":
      return <input type="hidden" name={f.name} defaultValue={f.default_value} />;
    case "tel":
      return (
        <div>
          {labelEl}
          <input type="tel" {...commonProps} autoComplete="tel" inputMode="tel" />
          {helpEl}
        </div>
      );
    case "email":
      return (
        <div>
          {labelEl}
          <input type="email" {...commonProps} autoComplete="email" inputMode="email" />
          {helpEl}
        </div>
      );
    case "number":
      return (
        <div>
          {labelEl}
          <input type="number" {...commonProps} inputMode="numeric" />
          {helpEl}
        </div>
      );
    case "date":
      return (
        <div>
          {labelEl}
          <input type="date" {...commonProps} />
          {helpEl}
        </div>
      );
    default:
      return (
        <div>
          {labelEl}
          <input type="text" {...commonProps} />
          {helpEl}
        </div>
      );
  }
}

function ConsentBlock(props: { consent: Record<string, unknown> }): React.ReactElement {
  const tcpa = props.consent.tcpa_required ? (props.consent.tcpa_copy as string) : null;
  const marketing = props.consent.marketing_consent_required
    ? (props.consent.marketing_consent_copy as string)
    : null;
  const gdpr = props.consent.gdpr_required ? (props.consent.data_processor_disclosure as string) : null;
  return (
    <div className="space-y-2 text-xs text-[var(--color-neutral-600)]">
      {marketing && (
        <label className="flex items-start gap-2">
          <input type="checkbox" name="consent_marketing" required />
          <span>{marketing}</span>
        </label>
      )}
      {tcpa && (
        <label className="flex items-start gap-2">
          <input type="checkbox" name="consent_tcpa" required />
          <span>{tcpa}</span>
        </label>
      )}
      {gdpr && <p>{gdpr}</p>}
    </div>
  );
}

// ---- Layout helpers ----

export const Section: React.FC<{
  id: string;
  type: string;
  className?: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}> = (props) => (
  <section
    id={`section-${props.id}`}
    data-section-id={props.id}
    data-section-type={props.type}
    className={props.className}
    style={props.style}
  >
    {props.children}
  </section>
);
