import type {
  AutomatedFunnel,
  AutomatedFunnelPage,
  AutomatedFunnelSection,
  FunnelAsset,
} from "@funnel/orchestrator";
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  CreditCard,
  Mail,
  MessageSquareText,
  PhoneCall,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { Lockup } from "@/components/brand/Wordmark";

import { LeadCaptureForm } from "./LeadCaptureForm";

type RendererProps = {
  funnel: AutomatedFunnel;
  page: AutomatedFunnelPage;
  notice?: string | null;
};

export function AutomatedFunnelRenderer({ funnel, page, notice }: RendererProps) {
  const assets = new Map(funnel.assets.map((asset) => [asset.id, asset]));
  const palette = funnel.styleGuide.palette;

  return (
    <main
      className="min-h-screen overflow-hidden"
      style={{
        background: palette.background,
        color: palette.ink,
        fontFamily: funnel.styleGuide.typography.body,
      }}
    >
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
        <a href={`/f/${funnel.slug}`} className="flex shrink-0 items-center" aria-label="GoFunnelAI generated funnel">
          <Lockup height={30} />
        </a>
        <a
          href="#capture"
          className="hidden items-center gap-2 rounded-full px-4 py-2 text-sm font-black text-white shadow-sm sm:inline-flex"
          style={{ background: funnel.styleGuide.button.gradient }}
        >
          Start free
          <ArrowRight className="h-4 w-4" />
        </a>
      </header>

      {notice ? (
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
            {notice}
          </div>
        </div>
      ) : null}

      {page.sections.map((section) => (
        <SectionRenderer
          key={section.id}
          funnel={funnel}
          page={page}
          section={section}
          asset={section.assetId ? assets.get(section.assetId) : undefined}
        />
      ))}

      <footer className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-10 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <Lockup height={24} />
          <p style={{ color: palette.muted }}>Generated and hosted by GoFunnelAI.</p>
        </div>
        <div className="flex flex-wrap gap-3" style={{ color: palette.muted }}>
          <span>Lead capture active</span>
          <span>Offer ladder active</span>
          <span>Provider adapters ready</span>
        </div>
      </footer>
    </main>
  );
}

function SectionRenderer({
  funnel,
  page,
  section,
  asset,
}: {
  funnel: AutomatedFunnel;
  page: AutomatedFunnelPage;
  section: AutomatedFunnelSection;
  asset?: FunnelAsset;
}) {
  switch (section.type) {
    case "hero":
      return <HeroSection funnel={funnel} section={section} asset={asset} />;
    case "lead_magnet":
      return <LeadMagnetSection funnel={funnel} section={section} asset={asset} />;
    case "qualification_form":
      return <CaptureSection funnel={funnel} section={section} />;
    case "logo_proof":
      return <ProofStrip funnel={funnel} section={section} />;
    case "proof_stack":
    case "upsell_ladder":
    case "faq":
      return <CardGridSection funnel={funnel} section={section} />;
    case "thank_you":
      return <CenteredAction funnel={funnel} section={section} />;
    case "upsell_offer":
      return <UpsellOffer funnel={funnel} section={section} />;
    case "final_cta":
      return <FinalCta funnel={funnel} section={section} />;
    default:
      return <StorySection funnel={funnel} section={section} page={page} />;
  }
}

function HeroSection({
  funnel,
  section,
  asset,
}: {
  funnel: AutomatedFunnel;
  section: AutomatedFunnelSection;
  asset?: FunnelAsset;
}) {
  const palette = funnel.styleGuide.palette;
  return (
    <section className="mx-auto grid max-w-7xl items-center gap-10 px-4 pb-16 pt-8 sm:px-6 lg:grid-cols-[1.02fr_0.98fr] lg:px-8 lg:pb-24">
      <div>
        {section.eyebrow ? (
          <p className="text-sm font-black uppercase" style={{ color: palette.primary }}>
            {section.eyebrow}
          </p>
        ) : null}
        <h1
          className="mt-4 max-w-3xl text-5xl font-black leading-[1.04] sm:text-6xl"
          style={{ color: palette.ink, fontFamily: funnel.styleGuide.typography.heading }}
        >
          {section.title}
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8" style={{ color: palette.muted }}>
          {section.body}
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <a
            href="#capture"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-black text-white shadow-lg"
            style={{ background: funnel.styleGuide.button.gradient }}
          >
            {section.cta?.label ?? "Start free"}
            <ArrowRight className="h-4 w-4" />
          </a>
          <a
            href="#proof"
            className="inline-flex min-h-12 items-center justify-center rounded-full border px-6 py-3 text-sm font-black"
            style={{ borderColor: palette.primary, color: palette.ink, background: palette.surface }}
          >
            See proof
          </a>
        </div>
        <ul className="mt-8 grid gap-3 text-sm font-semibold" style={{ color: palette.ink }}>
          {(section.bullets ?? []).map((bullet) => (
            <li key={bullet} className="flex gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" style={{ color: palette.accent }} />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="relative">
        {asset ? (
          <img
            src={asset.url}
            alt={asset.alt}
            className="aspect-[1.16/1] w-full rounded-lg object-cover shadow-2xl"
          />
        ) : null}
        <div
          className="absolute -bottom-6 left-5 right-5 rounded-lg border bg-white p-4 shadow-xl"
          style={{ borderColor: `${palette.primary}33` }}
        >
          <div className="flex items-start gap-3">
            <ShieldCheck className="h-6 w-6 shrink-0" style={{ color: palette.primary }} />
            <div>
              <p className="text-sm font-black" style={{ color: palette.ink }}>
                No manual setup required
              </p>
              <p className="mt-1 text-sm" style={{ color: palette.muted }}>
                The free offer, proof, form, follow-up, and upsell are staged automatically.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ProofStrip({ funnel, section }: { funnel: AutomatedFunnel; section: AutomatedFunnelSection }) {
  const palette = funnel.styleGuide.palette;
  return (
    <section id={section.id} className="border-y bg-white/70 px-4 py-8 sm:px-6 lg:px-8" style={{ borderColor: `${palette.primary}1f` }}>
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <h2 className="text-2xl font-black" style={{ color: palette.ink }}>
            {section.title}
          </h2>
          <p className="mt-2 text-sm leading-6" style={{ color: palette.muted }}>
            {section.body}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {(section.bullets ?? []).slice(0, 3).map((bullet) => (
            <div key={bullet} className="rounded-lg border bg-white p-4 text-sm font-black" style={{ borderColor: `${palette.primary}24`, color: palette.ink }}>
              {bullet}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function LeadMagnetSection({
  funnel,
  section,
  asset,
}: {
  funnel: AutomatedFunnel;
  section: AutomatedFunnelSection;
  asset?: FunnelAsset;
}) {
  const palette = funnel.styleGuide.palette;
  return (
    <section className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[0.82fr_1.18fr] lg:px-8">
      {asset ? (
        <img src={asset.url} alt={asset.alt} className="aspect-[1.25/1] w-full rounded-lg object-cover shadow-xl" />
      ) : null}
      <div>
        <p className="text-sm font-black uppercase" style={{ color: palette.primary }}>
          {section.eyebrow}
        </p>
        <h2 className="mt-3 text-4xl font-black leading-tight" style={{ color: palette.ink }}>
          {section.title}
        </h2>
        <p className="mt-4 text-lg leading-8" style={{ color: palette.muted }}>
          {section.body}
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {(section.bullets ?? []).map((bullet) => (
            <div key={bullet} className="flex gap-3 rounded-lg border bg-white p-4" style={{ borderColor: `${palette.primary}20` }}>
              <Sparkles className="mt-0.5 h-5 w-5 shrink-0" style={{ color: palette.accent }} />
              <span className="text-sm font-semibold" style={{ color: palette.ink }}>
                {bullet}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function StorySection({
  funnel,
  section,
}: {
  funnel: AutomatedFunnel;
  page: AutomatedFunnelPage;
  section: AutomatedFunnelSection;
}) {
  const palette = funnel.styleGuide.palette;
  return (
    <section className="px-4 py-14 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <p className="text-sm font-black uppercase" style={{ color: palette.primary }}>
          {section.eyebrow}
        </p>
        <h2 className="mt-3 text-4xl font-black leading-tight" style={{ color: palette.ink }}>
          {section.title}
        </h2>
        <p className="mt-4 text-lg leading-8" style={{ color: palette.muted }}>
          {section.body}
        </p>
      </div>
    </section>
  );
}

function CardGridSection({ funnel, section }: { funnel: AutomatedFunnel; section: AutomatedFunnelSection }) {
  const palette = funnel.styleGuide.palette;
  return (
    <section id={section.id} className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <div className="max-w-3xl">
        <p className="text-sm font-black uppercase" style={{ color: palette.primary }}>
          {section.eyebrow}
        </p>
        <h2 className="mt-3 text-4xl font-black leading-tight" style={{ color: palette.ink }}>
          {section.title}
        </h2>
        <p className="mt-4 text-lg leading-8" style={{ color: palette.muted }}>
          {section.body}
        </p>
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {(section.cards ?? []).map((card) => (
          <article key={`${section.id}-${card.title}`} className="rounded-lg border bg-white p-5 shadow-sm" style={{ borderColor: `${palette.primary}22` }}>
            {card.meta ? (
              <p className="text-xs font-black uppercase" style={{ color: palette.primary }}>
                {card.meta}
              </p>
            ) : null}
            <h3 className="mt-2 text-lg font-black" style={{ color: palette.ink }}>
              {card.title}
            </h3>
            <p className="mt-3 text-sm leading-6" style={{ color: palette.muted }}>
              {card.body}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

function CaptureSection({ funnel, section }: { funnel: AutomatedFunnel; section: AutomatedFunnelSection }) {
  const palette = funnel.styleGuide.palette;
  return (
    <section id="capture" className="px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl items-start gap-8 rounded-lg p-6 shadow-2xl lg:grid-cols-[0.9fr_1.1fr] lg:p-10" style={{ background: palette.ink }}>
        <div>
          <p className="text-sm font-black uppercase" style={{ color: palette.accent }}>
            {section.eyebrow}
          </p>
          <h2 className="mt-3 text-4xl font-black leading-tight text-white">
            {section.title}
          </h2>
          <p className="mt-4 text-lg leading-8 text-white/75">{section.body}</p>
          <div className="mt-8 grid gap-4 text-sm text-white/80">
            <div className="flex gap-3">
              <Mail className="h-5 w-5" style={{ color: palette.accent }} />
              Lead magnet delivery activates through Resend when connected.
            </div>
            <div className="flex gap-3">
              <PhoneCall className="h-5 w-5" style={{ color: palette.accent }} />
              SignalWire call and SMS routing is ready for qualified leads.
            </div>
            <div className="flex gap-3">
              <CreditCard className="h-5 w-5" style={{ color: palette.accent }} />
              Checkout handoff is staged after the free value.
            </div>
          </div>
        </div>
        <LeadCaptureForm funnel={funnel} fields={section.fields ?? []} cta={section.cta?.label ?? "Get the free asset"} />
      </div>
    </section>
  );
}

function CenteredAction({ funnel, section }: { funnel: AutomatedFunnel; section: AutomatedFunnelSection }) {
  const palette = funnel.styleGuide.palette;
  return (
    <section className="mx-auto grid min-h-[72vh] max-w-4xl place-items-center px-4 py-20 text-center sm:px-6 lg:px-8">
      <div>
        <BadgeCheck className="mx-auto h-14 w-14" style={{ color: palette.primary }} />
        <p className="mt-6 text-sm font-black uppercase" style={{ color: palette.primary }}>
          {section.eyebrow}
        </p>
        <h1 className="mt-3 text-5xl font-black leading-tight" style={{ color: palette.ink }}>
          {section.title}
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg leading-8" style={{ color: palette.muted }}>
          {section.body}
        </p>
        <a
          href={section.cta?.target ?? `/f/${funnel.slug}`}
          className="mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-black text-white shadow-lg"
          style={{ background: funnel.styleGuide.button.gradient }}
        >
          {section.cta?.label ?? "Continue"}
          <ArrowRight className="h-4 w-4" />
        </a>
      </div>
    </section>
  );
}

function UpsellOffer({ funnel, section }: { funnel: AutomatedFunnel; section: AutomatedFunnelSection }) {
  const palette = funnel.styleGuide.palette;
  const stripeReady = funnel.provider_readiness.stripe;
  const paypalReady = funnel.provider_readiness.paypal;
  return (
    <section className="mx-auto grid min-h-[72vh] max-w-7xl items-center gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_0.86fr] lg:px-8">
      <div>
        <p className="text-sm font-black uppercase" style={{ color: palette.primary }}>
          {section.eyebrow}
        </p>
        <h1 className="mt-3 text-5xl font-black leading-tight" style={{ color: palette.ink }}>
          {section.title}
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-8" style={{ color: palette.muted }}>
          {section.body}
        </p>
        <ul className="mt-8 grid gap-3">
          {(section.bullets ?? []).map((bullet) => (
            <li key={bullet} className="flex gap-3 text-sm font-semibold" style={{ color: palette.ink }}>
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" style={{ color: palette.accent }} />
              {bullet}
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-lg border bg-white p-6 shadow-xl" style={{ borderColor: `${palette.primary}22` }}>
        <p className="text-sm font-black uppercase" style={{ color: palette.primary }}>
          Automated checkout
        </p>
        <h2 className="mt-2 text-2xl font-black" style={{ color: palette.ink }}>
          {section.cta?.label ?? "Continue"}
        </h2>
        <p className="mt-3 text-sm leading-6" style={{ color: palette.muted }}>
          Stripe Checkout is the primary handoff. PayPal is available as a backup. If credentials are missing, the route reports exactly which key is needed.
        </p>
        <div className="mt-6 grid gap-3">
          <a
            href={`/api/funnels/${funnel.slug}/checkout/stripe`}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-black text-white"
            style={{ background: funnel.styleGuide.button.gradient }}
          >
            {stripeReady ? "Pay with Stripe" : "Test Stripe handoff"}
            <ArrowRight className="h-4 w-4" />
          </a>
          <a
            href={`/api/funnels/${funnel.slug}/checkout/paypal`}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border px-5 py-3 text-sm font-black"
            style={{ borderColor: palette.primary, color: palette.ink }}
          >
            {paypalReady ? "Pay with PayPal" : "Test PayPal handoff"}
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </section>
  );
}

function FinalCta({ funnel, section }: { funnel: AutomatedFunnel; section: AutomatedFunnelSection }) {
  const palette = funnel.styleGuide.palette;
  return (
    <section className="px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl rounded-lg p-8 text-center text-white shadow-2xl" style={{ background: funnel.styleGuide.button.gradient }}>
        <MessageSquareText className="mx-auto h-10 w-10" />
        <h2 className="mt-4 text-4xl font-black leading-tight">{section.title}</h2>
        <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-white/85">{section.body}</p>
        <a
          href="#capture"
          className="mt-7 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-black shadow-lg"
          style={{ color: palette.ink }}
        >
          {section.cta?.label ?? "Start free"}
          <ArrowRight className="h-4 w-4" />
        </a>
      </div>
    </section>
  );
}
