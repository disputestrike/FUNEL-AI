/** B.7 Trust signal blocks — 6 components. */

import * as React from "react";
import { type BlockContext, Img, Section } from "./primitives.js";

type Props<T> = { id: string; content: T; ctx: BlockContext; variant?: string };

// B.7.1 — trust.badge-row
export interface TrustBadgeRowContent {
  badges: Array<{ asset_id: string; name: string; link_url?: string }>;
  alignment?: "left" | "center" | "right";
  grayscale?: boolean;
}
export function TrustBadgeRow(p: Props<TrustBadgeRowContent>): React.ReactElement {
  const justify = p.content.alignment === "left" ? "justify-start" : p.content.alignment === "right" ? "justify-end" : "justify-center";
  return (
    <Section id={p.id} type="trust.badge-row" className="bg-white py-8">
      <div className={`mx-auto max-w-5xl px-6 flex flex-wrap items-center gap-6 ${justify} ${p.content.grayscale ? "[&_img]:grayscale" : ""}`}>
        {p.content.badges.map((b, i) => {
          const img = <Img assetId={b.asset_id} ctx={p.ctx} className="h-10 w-auto opacity-80" />;
          return b.link_url ? (
            <a key={i} href={b.link_url} rel="noopener nofollow" target="_blank" aria-label={b.name}>{img}</a>
          ) : (
            <span key={i} aria-label={b.name}>{img}</span>
          );
        })}
      </div>
    </Section>
  );
}

// B.7.2 — trust.guarantee
export interface TrustGuaranteeContent {
  headline: string;
  body: string;
  seal_asset_id?: string;
  fine_print?: string;
}
export function TrustGuarantee(p: Props<TrustGuaranteeContent>): React.ReactElement {
  return (
    <Section id={p.id} type="trust.guarantee" className="bg-[var(--color-accent-500)]/5 py-16">
      <div className="mx-auto max-w-4xl px-6 grid md:grid-cols-[auto_1fr] gap-8 items-center">
        {p.content.seal_asset_id && <Img assetId={p.content.seal_asset_id} ctx={p.ctx} className="h-24 w-24 mx-auto" />}
        <div>
          <h2 className="font-display text-2xl font-bold">{p.content.headline}</h2>
          <p className="mt-2 text-[var(--color-neutral-700)]">{p.content.body}</p>
          {p.content.fine_print && <p className="mt-3 text-xs text-[var(--color-neutral-500)]">{p.content.fine_print}</p>}
        </div>
      </div>
    </Section>
  );
}

// B.7.3 — trust.certification
export interface TrustCertificationContent {
  headline?: string;
  certifications: Array<{ asset_id: string; name: string; issuing_body: string; verification_url?: string }>;
}
export function TrustCertification(p: Props<TrustCertificationContent>): React.ReactElement {
  return (
    <Section id={p.id} type="trust.certification" className="bg-white py-12">
      <div className="mx-auto max-w-5xl px-6">
        {p.content.headline && <h2 className="text-center font-display text-2xl font-semibold mb-8">{p.content.headline}</h2>}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {p.content.certifications.map((c, i) => (
            <div key={i} className="text-center">
              <Img assetId={c.asset_id} ctx={p.ctx} className="h-16 mx-auto" />
              <div className="mt-2 text-sm font-medium">{c.name}</div>
              <div className="text-xs text-[var(--color-neutral-600)]">{c.issuing_body}</div>
              {c.verification_url && <a href={c.verification_url} rel="noopener nofollow" target="_blank" className="text-xs underline">Verify</a>}
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

// B.7.4 — trust.team
export interface TrustTeamContent {
  headline?: string;
  members: Array<{ name: string; title: string; photo_asset_id?: string; bio_short?: string; linkedin_url?: string }>;
  layout?: "grid_3col" | "grid_4col" | "carousel";
}
export function TrustTeam(p: Props<TrustTeamContent>): React.ReactElement {
  const cols = p.content.layout === "grid_4col" ? "md:grid-cols-4" : "md:grid-cols-3";
  return (
    <Section id={p.id} type="trust.team" className="bg-white py-16">
      <div className="mx-auto max-w-7xl px-6">
        {p.content.headline && <h2 className="text-center font-display text-3xl font-bold mb-12">{p.content.headline}</h2>}
        <div className={`grid grid-cols-1 sm:grid-cols-2 gap-8 ${cols}`}>
          {p.content.members.map((m, i) => (
            <div key={i} className="text-center">
              {m.photo_asset_id && <Img assetId={m.photo_asset_id} ctx={p.ctx} className="w-32 h-32 mx-auto rounded-full object-cover" />}
              <h3 className="mt-4 font-semibold">{m.name}</h3>
              <p className="text-sm text-[var(--color-neutral-600)]">{m.title}</p>
              {m.bio_short && <p className="mt-2 text-sm text-[var(--color-neutral-700)]">{m.bio_short}</p>}
              {m.linkedin_url && (
                <a href={m.linkedin_url} rel="noopener nofollow" target="_blank" aria-label={`${m.name} on LinkedIn`} className="text-xs underline mt-2 inline-block">LinkedIn</a>
              )}
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

// B.7.5 — trust.history
export interface TrustHistoryContent {
  headline?: string;
  facts: Array<{ label: string; value: string }>;
  body?: string;
}
export function TrustHistory(p: Props<TrustHistoryContent>): React.ReactElement {
  return (
    <Section id={p.id} type="trust.history" className="bg-[var(--color-neutral-50)] py-12">
      <div className="mx-auto max-w-5xl px-6">
        {p.content.headline && <h2 className="text-center font-display text-2xl font-semibold mb-8">{p.content.headline}</h2>}
        <dl className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {p.content.facts.map((f, i) => (
            <div key={i}>
              <dd className="text-3xl font-bold text-[var(--color-primary-600)]">{f.value}</dd>
              <dt className="text-sm text-[var(--color-neutral-600)] mt-1">{f.label}</dt>
            </div>
          ))}
        </dl>
        {p.content.body && <p className="mt-8 text-center text-[var(--color-neutral-700)]">{p.content.body}</p>}
      </div>
    </Section>
  );
}

// B.7.6 — trust.compliance
export interface TrustComplianceContent {
  compliance_items: Array<{
    framework: "HIPAA" | "SOC_2_TYPE_2" | "GDPR" | "CCPA" | "PCI_DSS" | "ISO_27001" | "FERPA" | "FedRAMP";
    badge_asset_id?: string;
    summary?: string;
    attestation_url?: string;
  }>;
}
export function TrustCompliance(p: Props<TrustComplianceContent>): React.ReactElement {
  return (
    <Section id={p.id} type="trust.compliance" className="bg-white py-12">
      <div className="mx-auto max-w-6xl px-6 grid grid-cols-2 md:grid-cols-4 gap-6">
        {p.content.compliance_items.map((c, i) => (
          <div key={i} className="text-center p-4 border border-[var(--color-neutral-200)] rounded-[var(--radius-md)]">
            {c.badge_asset_id && <Img assetId={c.badge_asset_id} ctx={p.ctx} className="h-12 mx-auto" />}
            <div className="mt-2 font-semibold text-sm">{c.framework.replace(/_/g, " ")}</div>
            {c.summary && <p className="mt-1 text-xs text-[var(--color-neutral-600)]">{c.summary}</p>}
            {c.attestation_url && <a href={c.attestation_url} rel="noopener nofollow" target="_blank" className="text-xs underline mt-2 inline-block">View attestation</a>}
          </div>
        ))}
      </div>
    </Section>
  );
}
