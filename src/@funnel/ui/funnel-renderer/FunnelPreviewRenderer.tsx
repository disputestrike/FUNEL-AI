"use client";

import * as React from "react";
import { ImagePlus, RefreshCw, Scissors, Sparkles, Type } from "lucide-react";
import { cn } from "../lib/cn";
import type {
  Asset,
  CTA,
  Form,
  FunnelBrandTokens,
  Page,
  Section,
} from "@funnel/shared";
import type { ResolvedAsset, ResolvedCTA, ResolvedForm } from "../funnel-blocks/types";
import { BlockRegistry } from "./BlockRegistry";

/**
 * Loose Funnel shape consumed by the renderer. The full ParsedFunnel from
 * `@funnel/shared/funnel-schema` is assignable. Sub-fields the renderer
 * doesn't touch (compliance, provenance, integrations) are left untyped here
 * for forward-compatibility with partial / streaming payloads.
 */
export interface RendererFunnel {
  schema_version?: string;
  metadata?: { id: string; name: string; slug?: string; language?: string };
  pages: Page[];
  assets?: Asset[];
  forms?: Form[];
  ctas?: CTA[];
  brand_tokens?: FunnelBrandTokens;
}

export type FunnelRendererMode = "preview" | "live" | "edit";

export interface FunnelPreviewRendererProps {
  funnel: RendererFunnel;
  mode?: FunnelRendererMode;
  /** Which page slug or id to show. Defaults to the first page. */
  activePageId?: string;
  /** Edit affordance callback (only when mode === "edit"). */
  onEditSection?: (sectionId: string, action: EditAction) => void;
  /** Brand tokens — when present, applied as CSS variables to the root. */
  brandTokens?: FunnelBrandTokens;
  /** Wrap content in a phone-frame viewport (~375px wide). */
  mobileFrame?: boolean;
  className?: string;
}

export type EditAction =
  | "regenerate"
  | "edit-copy"
  | "swap-image"
  | "make-shorter"
  | "open";

/** Maps assets/forms/ctas onto the simpler Resolved* shapes blocks consume. */
function buildResolvers(funnel: RendererFunnel) {
  const assetMap = new Map<string, ResolvedAsset>();
  for (const a of funnel.assets ?? []) {
    assetMap.set(a.id, {
      id: a.id,
      type: a.type,
      url: a.url,
      alt_text: a.alt_text,
      width_px: a.dimensions?.width_px,
      height_px: a.dimensions?.height_px,
    });
  }
  const formMap = new Map<string, ResolvedForm>();
  for (const f of funnel.forms ?? []) {
    formMap.set(f.id, {
      id: f.id,
      fields: f.fields.map((field) => ({
        id: field.id,
        type: field.type,
        label: field.label,
        name: field.name,
        placeholder: field.placeholder,
        help_text: field.help_text,
        required: field.required,
        default_value: field.default_value,
        options: field.options,
        validation: field.validation,
        pii_classification: field.pii_classification,
      })),
      submit_action: {
        type: f.submit_action.type,
        redirect_page_id: f.submit_action.redirect_page_id,
        redirect_url: f.submit_action.redirect_url,
        message_markdown: f.submit_action.message_markdown,
        download_asset_id: f.submit_action.download_asset_id,
        calendar_provider: f.submit_action.calendar_provider,
        checkout_offer_id: f.submit_action.checkout_offer_id,
      },
      consent_capture: f.consent_capture,
      success_state: f.success_state,
    });
  }
  const ctaMap = new Map<string, ResolvedCTA>();
  for (const c of funnel.ctas ?? []) {
    ctaMap.set(c.id, {
      id: c.id,
      label: c.label,
      sublabel: c.sublabel,
      action: c.action,
      tracking_id: c.tracking_id,
      style: c.style,
    });
  }
  return {
    resolveAsset: (id: string) => assetMap.get(id),
    resolveForm: (id: string) => formMap.get(id),
    resolveCTA: (id: string) => ctaMap.get(id),
  };
}

/** Map brand tokens onto CSS variables. The block components don't read these
 *  directly today, but exposing them via inline style lets generated funnels
 *  override the default GoFunnelAI signal/ember palette without rebuilding
 *  Tailwind. */
function brandStyle(b: FunnelBrandTokens | undefined): React.CSSProperties {
  if (!b) return {};
  const style: Record<string, string> = {};
  const primary = b.colors?.primary as unknown as Record<string, string | undefined> | undefined;
  const accent = b.colors?.accent as unknown as Record<string, string | undefined> | undefined;
  if (primary?.["500"]) style["--brand-primary"] = primary["500"];
  if (primary?.["600"]) style["--brand-primary-hover"] = primary["600"];
  if (accent?.["500"]) style["--brand-accent"] = accent["500"];
  const heading = b.typography?.font_families?.heading_display;
  const body = b.typography?.font_families?.body;
  if (heading) style["--brand-font-heading"] = heading;
  if (body) style["--brand-font-body"] = body;
  return style as React.CSSProperties;
}

/**
 * Wraps a single rendered section. In "edit" mode, overlays the section with
 * an action toolbar (regenerate / edit copy / swap image / shorten).
 */
function SectionWrapper({
  section,
  mode,
  onEditSection,
  children,
}: {
  section: Section;
  mode: FunnelRendererMode;
  onEditSection?: FunnelPreviewRendererProps["onEditSection"];
  children: React.ReactNode;
}): JSX.Element {
  if (mode !== "edit") return <>{children}</>;
  return (
    <div className="group relative">
      <div className="pointer-events-none absolute inset-0 z-10 ring-2 ring-transparent transition-all duration-150 group-hover:ring-signal-400/60" />
      <div className="pointer-events-none absolute right-3 top-3 z-20 flex flex-wrap items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
        <EditButton icon={<RefreshCw className="h-3.5 w-3.5" />} label="Regenerate" onClick={() => onEditSection?.(section.id, "regenerate")} />
        <EditButton icon={<Type className="h-3.5 w-3.5" />} label="Edit copy" onClick={() => onEditSection?.(section.id, "edit-copy")} />
        <EditButton icon={<ImagePlus className="h-3.5 w-3.5" />} label="Swap image" onClick={() => onEditSection?.(section.id, "swap-image")} />
        <EditButton icon={<Scissors className="h-3.5 w-3.5" />} label="Shorter" onClick={() => onEditSection?.(section.id, "make-shorter")} />
        <EditButton icon={<Sparkles className="h-3.5 w-3.5" />} label="Ask AI" primary onClick={() => onEditSection?.(section.id, "open")} />
      </div>
      <button
        type="button"
        aria-label={`Edit ${section.type}`}
        onClick={() => onEditSection?.(section.id, "open")}
        className="absolute inset-0 z-10 cursor-pointer bg-transparent opacity-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-signal-500"
      />
      {children}
    </div>
  );
}

function EditButton({
  icon,
  label,
  onClick,
  primary = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  primary?: boolean;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "pointer-events-auto inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-caption font-semibold shadow-md transition-all",
        primary
          ? "bg-signal-600 text-white hover:bg-signal-700"
          : "bg-white/95 text-slate-900 backdrop-blur-sm hover:bg-white",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

/**
 * Renders one page worth of sections.
 */
export function FunnelPage({
  page,
  mode,
  onEditSection,
  resolvers,
  locale,
}: {
  page: Page;
  mode: FunnelRendererMode;
  onEditSection?: FunnelPreviewRendererProps["onEditSection"];
  resolvers: ReturnType<typeof buildResolvers>;
  locale?: string;
}): JSX.Element {
  return (
    <div className="funnel-page" data-page-id={page.id} data-page-type={page.type}>
      {page.sections.map((section) => {
        const Component = BlockRegistry[section.type];
        if (!Component) {
          return (
            <div
              key={section.id}
              data-section-id={section.id}
              data-section-type={section.type}
              className="border border-dashed border-ember-300 bg-ember-50/40 p-6 text-center text-caption text-ember-800"
            >
              Unknown block type: <code className="font-mono font-bold">{section.type}</code>
            </div>
          );
        }
        return (
          <SectionWrapper key={section.id} section={section} mode={mode} onEditSection={onEditSection}>
            <Component
              sectionId={section.id}
              variant={section.variant}
              content={section.content as any}
              styleOverrides={section.style_overrides}
              resolveAsset={resolvers.resolveAsset}
              resolveForm={resolvers.resolveForm}
              resolveCTA={resolvers.resolveCTA}
              locale={locale}
            />
          </SectionWrapper>
        );
      })}
    </div>
  );
}

/**
 * Top-level visual renderer. Pass it a (possibly partial) Funnel JSON and it
 * returns the rendered HTML page. In "edit" mode each section gets a hover
 * toolbar that surfaces AI-edit actions.
 */
export function FunnelPreviewRenderer({
  funnel,
  mode = "preview",
  activePageId,
  onEditSection,
  brandTokens,
  mobileFrame = false,
  className,
}: FunnelPreviewRendererProps): JSX.Element {
  const resolvers = React.useMemo(() => buildResolvers(funnel), [funnel]);
  const tokens = brandTokens ?? funnel.brand_tokens;
  const style = brandStyle(tokens);
  const locale = funnel.metadata?.language;

  const pages = funnel.pages ?? [];
  const activePage =
    (activePageId ? pages.find((p) => p.id === activePageId || p.slug === activePageId) : undefined) ?? pages[0];

  const inner = (
    <div
      className={cn("funnel-preview min-h-full bg-white text-slate-900", className)}
      data-mode={mode}
      data-funnel-id={funnel.metadata?.id}
      style={style}
    >
      {!activePage ? (
        <div className="flex h-96 items-center justify-center text-body-sm text-slate-500">
          No pages yet.
        </div>
      ) : (
        <FunnelPage
          page={activePage}
          mode={mode}
          onEditSection={onEditSection}
          resolvers={resolvers}
          locale={locale}
        />
      )}
    </div>
  );

  if (!mobileFrame) return inner;

  // Phone-frame viewport — 375px wide with rounded corners and a notch.
  return (
    <div className="flex justify-center py-6">
      <div className="relative w-[390px] overflow-hidden rounded-[40px] border-[12px] border-slate-900 bg-slate-900 shadow-2xl">
        <div className="absolute left-1/2 top-0 z-30 h-6 w-32 -translate-x-1/2 rounded-b-2xl bg-slate-900" aria-hidden="true" />
        <div className="h-[780px] w-full overflow-y-auto bg-white">{inner}</div>
      </div>
    </div>
  );
}
