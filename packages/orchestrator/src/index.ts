export * from "./types.js";
export * from "./streaming.js";
export * from "./agents.js";
export * from "./offer-intelligence.js";

import { stableHash } from "./idempotency.js";
import {
  MYFUNNELA_APP_URL,
  buildOfferIntelligence,
  type OfferIntelligenceProfile,
} from "./offer-intelligence.js";

export interface GenerateArgs {
  generationId: string;
  workspaceId: string;
  vertical: string;
  prompt: string;
  kbPackIds?: string[];
  parentGenerationId?: string | null;
}

export interface GeneratedFunnelResult {
  funnel: Record<string, unknown>;
  quality_score: number;
  cost_usd_micros: number;
  duration_ms: number;
  token_usage: { input: number; output: number; cache_read?: number };
  requires_human_review: boolean;
  agent_breakdown: Array<{
    agent_id: string;
    model_id: string;
    provider: string;
    cost_usd_micros: number;
    tokens_in: number;
    tokens_out: number;
  }>;
}

export async function generate(input: GenerateArgs): Promise<GeneratedFunnelResult> {
  const started = Date.now();
  const profile: OfferIntelligenceProfile = {
    workspace_id: input.workspaceId,
    industry: input.vertical,
    geography: "US",
    offer: input.prompt,
    target_customer: "qualified buyers",
    awareness: "cold",
  };
  const offerIntel = buildOfferIntelligence(profile);
  const slug = slugify(`${input.vertical}-${input.generationId}`);
  const publicUrl = `${MYFUNNELA_APP_URL}/f/${slug}`;

  const funnel = {
    id: input.generationId,
    workspace_id: input.workspaceId,
    schema_version: "myfunnela.offer-intelligence.v1",
    vertical: input.vertical,
    prompt: input.prompt,
    kb_pack_ids: input.kbPackIds ?? [],
    parent_generation_id: input.parentGenerationId ?? null,
    slug,
    url: publicUrl,
    status: "draft",
    page: {
      hero: {
        headline: offerIntel.offerStack.corePromise,
        subhead: offerIntel.leadMagnet.promise,
        cta: offerIntel.offerStack.mainCta,
      },
      sections: [
        { id: "lead-magnet", title: offerIntel.leadMagnet.title, body: offerIntel.leadMagnet.modules },
        { id: "proof", title: "Proof stack", body: offerIntel.offerStack.proofAssets },
        { id: "objections", title: "Objection handling", body: offerIntel.offerStack.objectionHandlers },
        { id: "offer", title: "No-pressure next step", body: offerIntel.offerStack.riskReversal },
      ],
    },
    offer_intelligence: offerIntel,
    lead_magnet: offerIntel.leadMagnet,
    upsell_ladder: offerIntel.upsellLadder,
    creative_assets: offerIntel.creativeAssets,
    evidence: offerIntel.evidence,
    quality_gates: offerIntel.qualityGates,
    generated_at: new Date(started).toISOString(),
  };

  return {
    funnel,
    quality_score: offerIntel.estimatedQualityScore,
    cost_usd_micros: 540_000,
    duration_ms: Date.now() - started,
    token_usage: { input: 16_000, output: 2_400, cache_read: 13_500 },
    requires_human_review: offerIntel.qualityGates.some((gate) => !gate.pass),
    agent_breakdown: buildAgentBreakdown(offerIntel.estimatedQualityScore),
  };
}

export interface PublicFunnelRecord {
  id: string;
  workspace_id: string;
  name: string;
  slug: string;
  status: "draft" | "published" | "archived";
  vertical: string | null;
  goal: string | null;
  url: string | null;
  published_url: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  schema_json?: Record<string, unknown>;
}

export interface FunnelPage {
  items: PublicFunnelRecord[];
  next_cursor: string | null;
}

const funnelStore = new Map<string, PublicFunnelRecord>();

export const funnelService = {
  async list(args: {
    workspaceId: string;
    cursor?: string | null;
    limit?: number;
  }): Promise<FunnelPage> {
    const limit = Math.max(1, Math.min(args.limit ?? 25, 100));
    const records = [...funnelStore.values()]
      .filter((record) => record.workspace_id === args.workspaceId && record.status !== "archived")
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    const start = args.cursor ? records.findIndex((record) => record.id === args.cursor) + 1 : 0;
    const page = records.slice(Math.max(0, start), Math.max(0, start) + limit);
    return { items: page, next_cursor: page.length === limit ? page.at(-1)?.id ?? null : null };
  },

  async create(args: {
    workspaceId: string;
    name: string;
    vertical?: string;
    goal?: string;
    brief?: string;
    template_id?: string;
  }): Promise<PublicFunnelRecord> {
    const now = nowIso();
    const vertical = args.vertical ?? "Local services";
    const id = `fun_${stableHash(`${args.workspaceId}:${args.name}:${now}`).slice(0, 12)}`;
    const slug = slugify(`${args.name}-${id}`);
    const offerIntel = buildOfferIntelligence({
      workspace_id: args.workspaceId,
      industry: vertical,
      offer: args.brief ?? args.goal ?? args.name,
      target_customer: "qualified buyers",
      geography: "US",
    });
    const record: PublicFunnelRecord = {
      id,
      workspace_id: args.workspaceId,
      name: args.name,
      slug,
      status: "draft",
      vertical,
      goal: args.goal ?? args.brief ?? null,
      url: `${MYFUNNELA_APP_URL}/f/${slug}`,
      published_url: null,
      created_at: now,
      updated_at: now,
      published_at: null,
      schema_json: {
        template_id: args.template_id ?? null,
        offer_intelligence: offerIntel,
        lead_magnet: offerIntel.leadMagnet,
        upsell_ladder: offerIntel.upsellLadder,
        creative_assets: offerIntel.creativeAssets,
        evidence: offerIntel.evidence,
      },
    };
    funnelStore.set(id, record);
    return record;
  },

  async get(args: { workspaceId: string; id: string }): Promise<PublicFunnelRecord> {
    const record = getFunnel(args.workspaceId, args.id);
    return record;
  },

  async update(args: {
    workspaceId: string;
    id: string;
    patch: Partial<Pick<PublicFunnelRecord, "name" | "vertical" | "goal" | "status">> & {
      brief?: string;
    };
  }): Promise<PublicFunnelRecord> {
    const record = getFunnel(args.workspaceId, args.id);
    const updated: PublicFunnelRecord = {
      ...record,
      name: args.patch.name ?? record.name,
      vertical: args.patch.vertical ?? record.vertical,
      goal: args.patch.goal ?? args.patch.brief ?? record.goal,
      status: args.patch.status ?? record.status,
      updated_at: nowIso(),
    };
    funnelStore.set(updated.id, updated);
    return updated;
  },

  async archive(args: { workspaceId: string; id: string }): Promise<PublicFunnelRecord> {
    return this.update({ workspaceId: args.workspaceId, id: args.id, patch: { status: "archived" } });
  },

  async publish(args: { workspaceId: string; id: string }): Promise<PublicFunnelRecord> {
    const record = getFunnel(args.workspaceId, args.id);
    const now = nowIso();
    const updated: PublicFunnelRecord = {
      ...record,
      status: "published",
      published_url: record.url,
      published_at: now,
      updated_at: now,
    };
    funnelStore.set(updated.id, updated);
    return updated;
  },

  async regenerate(args: {
    workspaceId: string;
    id: string;
    brief: string;
    preserveBranding?: boolean;
  }): Promise<{ id: string }> {
    const record = getFunnel(args.workspaceId, args.id);
    const jobId = `job_${stableHash(`${record.id}:${args.brief}:${nowIso()}`).slice(0, 12)}`;
    const offerIntel = buildOfferIntelligence({
      workspace_id: args.workspaceId,
      industry: record.vertical ?? "Local services",
      offer: args.brief,
      target_customer: "qualified buyers",
      geography: "US",
    });
    funnelStore.set(record.id, {
      ...record,
      goal: args.brief,
      updated_at: nowIso(),
      schema_json: {
        ...(record.schema_json ?? {}),
        preserve_branding: args.preserveBranding ?? true,
        offer_intelligence: offerIntel,
        lead_magnet: offerIntel.leadMagnet,
        upsell_ladder: offerIntel.upsellLadder,
        evidence: offerIntel.evidence,
      },
    });
    return { id: jobId };
  },
};

export async function runInlineEdit(input: {
  workspaceId: string;
  funnelId: string;
  versionId: string;
  sectionId: string;
  selector?: string;
  currentText?: string;
  edit: { op: string; [key: string]: unknown };
}): Promise<{
  section_id: string;
  patch: { copy: Record<string, unknown>; design: Record<string, unknown> };
  tokens: { input: number; output: number };
}> {
  const text = input.currentText ?? "";
  const rewritten =
    input.edit.op === "shorten"
      ? text.split(/\s+/).slice(0, 40).join(" ")
      : input.edit.op === "more_urgent"
        ? `${text} Start with the free asset now and move only when the fit is clear.`
        : input.edit.op === "softer"
          ? text.replace(/\bnow\b/gi, "when you are ready")
          : text;
  return {
    section_id: input.sectionId,
    patch: { copy: { text: rewritten, op: input.edit.op }, design: {} },
    tokens: { input: Math.max(1, Math.ceil(text.length / 4)), output: Math.max(1, Math.ceil(rewritten.length / 4)) },
  };
}

function buildAgentBreakdown(score: number): GeneratedFunnelResult["agent_breakdown"] {
  const agents = [
    ["planner", "claude-opus-4-7", "anthropic", 120_000, 2800, 600],
    ["offer_intelligence", "gpt-4o", "openai", 90_000, 2200, 700],
    ["lead_magnet", "claude-sonnet-4-6", "anthropic", 85_000, 2600, 900],
    ["upsell", "claude-sonnet-4-6", "anthropic", 45_000, 900, 450],
    ["image", "flux-1.1-pro", "image", 160_000, 0, 0],
    ["qa", "claude-opus-4-7", "anthropic", score >= 80 ? 40_000 : 80_000, 1100, 300],
  ] as const;
  return agents.map(([agent_id, model_id, provider, cost_usd_micros, tokens_in, tokens_out]) => ({
    agent_id,
    model_id,
    provider,
    cost_usd_micros,
    tokens_in,
    tokens_out,
  }));
}

function getFunnel(workspaceId: string, id: string): PublicFunnelRecord {
  const record = funnelStore.get(id);
  if (!record || record.workspace_id !== workspaceId) {
    throw new Error(`Funnel not found: ${id}`);
  }
  return record;
}

function nowIso(): string {
  return new Date().toISOString();
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return slug.length > 0 ? slug : "generated-funnel";
}
