import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import type { AutomatedFunnel } from "@funnel/orchestrator";

export type CapturedFunnelLead = {
  id: string;
  funnel_id: string;
  slug: string;
  received_at: string;
  fields: Record<string, string>;
  next_path: string;
  routing: {
    email: boolean;
    sms: boolean;
    voice: boolean;
    checkout: boolean;
  };
};

const globalForFunnels = globalThis as typeof globalThis & {
  __gofunnel_generated_funnels?: Map<string, AutomatedFunnel>;
  __gofunnel_generated_leads?: CapturedFunnelLead[];
  __gofunnel_generated_store_loaded?: boolean;
};

function funnels() {
  globalForFunnels.__gofunnel_generated_funnels ??= new Map<string, AutomatedFunnel>();
  hydrateStore();
  return globalForFunnels.__gofunnel_generated_funnels;
}

function leads() {
  globalForFunnels.__gofunnel_generated_leads ??= [];
  hydrateStore();
  return globalForFunnels.__gofunnel_generated_leads;
}

export function saveGeneratedFunnel(funnel: AutomatedFunnel) {
  funnels().set(funnel.slug, funnel);
  persistStore();
  return funnel;
}

export function getGeneratedFunnel(slug: string) {
  return funnels().get(slug) ?? null;
}

export function listGeneratedFunnels() {
  return [...funnels().values()].sort((a, b) => b.generated_at.localeCompare(a.generated_at));
}

export function captureGeneratedFunnelLead(args: {
  slug: string;
  fields: Record<string, string>;
}) {
  const funnel = getGeneratedFunnel(args.slug);
  if (!funnel) return null;

  const lead: CapturedFunnelLead = {
    id: `lead_${Date.now().toString(36)}`,
    funnel_id: funnel.id,
    slug: funnel.slug,
    received_at: new Date().toISOString(),
    fields: args.fields,
    next_path: funnel.pages.find((page) => page.id === "thank_you")?.path ?? `/f/${funnel.slug}`,
    routing: {
      email: funnel.provider_readiness.resend,
      sms: funnel.provider_readiness.signalwire,
      voice: funnel.provider_readiness.signalwire,
      checkout: funnel.provider_readiness.stripe || funnel.provider_readiness.paypal,
    },
  };
  leads().push(lead);
  persistStore();
  return lead;
}

export function listGeneratedFunnelLeads(slug?: string) {
  return leads().filter((lead) => (slug ? lead.slug === slug : true));
}

function hydrateStore() {
  if (globalForFunnels.__gofunnel_generated_store_loaded) return;
  globalForFunnels.__gofunnel_generated_store_loaded = true;

  const file = storeFile();
  if (!existsSync(file)) return;

  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as {
      funnels?: AutomatedFunnel[];
      leads?: CapturedFunnelLead[];
    };
    globalForFunnels.__gofunnel_generated_funnels = new Map(
      (parsed.funnels ?? []).map((funnel) => [funnel.slug, funnel]),
    );
    globalForFunnels.__gofunnel_generated_leads = parsed.leads ?? [];
  } catch {
    globalForFunnels.__gofunnel_generated_funnels ??= new Map<string, AutomatedFunnel>();
    globalForFunnels.__gofunnel_generated_leads ??= [];
  }
}

function persistStore() {
  const file = storeFile();
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(
    file,
    JSON.stringify(
      {
        funnels: [...(globalForFunnels.__gofunnel_generated_funnels ?? new Map()).values()],
        leads: globalForFunnels.__gofunnel_generated_leads ?? [],
      },
      null,
      2,
    ),
    "utf8",
  );
}

function storeFile() {
  const baseDir = process.env.RAILWAY_VOLUME_MOUNT_PATH
    ?? process.env.GOFUNNELAI_DATA_DIR
    ?? join(process.cwd(), ".gofunnelai-data");
  return join(baseDir, "generated-funnels.json");
}
