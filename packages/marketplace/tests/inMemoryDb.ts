import type { FunnelStub, MarketplaceDb } from "../src/port.js";
import type {
  CreatorPayout,
  CreatorPayoutAccount,
  FraudFlag,
  Purchase,
  Review,
  Template,
  TemplateStatus,
  TemplateVersion,
} from "../src/types.js";

export function makeInMemoryDb(seed: { funnels?: FunnelStub[] } = {}): MarketplaceDb & {
  templates: Map<string, Template>;
  versions: Map<string, TemplateVersion>;
  purchases: Map<string, Purchase>;
  reviews: Map<string, Review>;
  accounts: Map<string, CreatorPayoutAccount>;
  payouts: Map<string, CreatorPayout>;
  flags: Map<string, FraudFlag>;
  funnels: Map<string, FunnelStub>;
  clonedFunnels: { source_id: string; new_id: string; buyer_workspace: string }[];
} {
  const templates = new Map<string, Template>();
  const versions = new Map<string, TemplateVersion>();
  const purchases = new Map<string, Purchase>();
  const reviews = new Map<string, Review>();
  const accounts = new Map<string, CreatorPayoutAccount>();
  const payouts = new Map<string, CreatorPayout>();
  const flags = new Map<string, FraudFlag>();
  const funnels = new Map<string, FunnelStub>();
  const clonedFunnels: { source_id: string; new_id: string; buyer_workspace: string }[] = [];
  let cloneCounter = 0;
  for (const f of seed.funnels ?? []) funnels.set(f.id, f);

  return {
    templates,
    versions,
    purchases,
    reviews,
    accounts,
    payouts,
    flags,
    funnels,
    clonedFunnels,

    async getFunnel(id) {
      return funnels.get(id) ?? null;
    },
    async cloneFunnelInto(args) {
      cloneCounter++;
      const new_id = `fnl_clone_${cloneCounter}`;
      clonedFunnels.push({
        source_id: args.source_funnel.id,
        new_id,
        buyer_workspace: args.buyer_workspace_id,
      });
      return { new_funnel_id: new_id };
    },

    async insertTemplate(t) {
      templates.set(t.id, t);
      return t;
    },
    async updateTemplate(id, patch) {
      const t = templates.get(id);
      if (!t) throw new Error("missing template");
      const next = { ...t, ...patch } as Template;
      templates.set(id, next);
      return next;
    },
    async getTemplate(id) {
      return templates.get(id) ?? null;
    },
    async getTemplateBySlug(slug) {
      for (const t of templates.values()) if (t.slug === slug) return t;
      return null;
    },
    async listTemplates({ where, orderBy, cursor, limit }) {
      let rows = Array.from(templates.values()).filter((t) => !t.deleted_at);
      if (where.status) rows = rows.filter((t) => t.status === where.status);
      if (where.category) rows = rows.filter((t) => t.category === where.category);
      if (where.creator_id) rows = rows.filter((t) => t.creator_id === where.creator_id);
      if (where.free_only) rows = rows.filter((t) => t.price_usd_cents === 0);
      if (where.min_rating != null) rows = rows.filter((t) => t.avg_rating >= where.min_rating!);
      if (where.min_price_cents != null)
        rows = rows.filter((t) => t.price_usd_cents >= where.min_price_cents!);
      if (where.max_price_cents != null)
        rows = rows.filter((t) => t.price_usd_cents <= where.max_price_cents!);
      if (where.search) {
        const q = where.search.toLowerCase();
        rows = rows.filter((t) => t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q));
      }
      const cmp: Record<string, (a: Template, b: Template) => number> = {
        popularity: (a, b) => b.sales_count - a.sales_count,
        rating: (a, b) => b.avg_rating - a.avg_rating,
        recent: (a, b) => b.created_at.localeCompare(a.created_at),
        price_asc: (a, b) => a.price_usd_cents - b.price_usd_cents,
        price_desc: (a, b) => b.price_usd_cents - a.price_usd_cents,
      };
      rows.sort(cmp[orderBy]);
      const start = cursor ? Number(cursor) : 0;
      const slice = rows.slice(start, start + limit);
      const next = start + limit < rows.length ? String(start + limit) : null;
      return { rows: slice, next_cursor: next };
    },

    async insertTemplateVersion(v) {
      versions.set(v.id, v);
      return v;
    },
    async getTemplateVersion(id) {
      return versions.get(id) ?? null;
    },
    async latestPublishedVersion(template_id) {
      const all = Array.from(versions.values()).filter((v) => v.template_id === template_id);
      all.sort((a, b) => b.version_number - a.version_number);
      return all[0] ?? null;
    },

    async insertPurchase(p) {
      purchases.set(p.id, p);
      return p;
    },
    async updatePurchase(id, patch) {
      const p = purchases.get(id);
      if (!p) throw new Error("missing purchase");
      const next = { ...p, ...patch } as Purchase;
      purchases.set(id, next);
      return next;
    },
    async getPurchase(id) {
      return purchases.get(id) ?? null;
    },
    async getPurchaseByCheckoutSession(sid) {
      for (const p of purchases.values())
        if (p.stripe_checkout_session_id === sid) return p;
      return null;
    },
    async hasPaidPurchase(template_id, buyer_workspace_id) {
      for (const p of purchases.values()) {
        if (p.template_id === template_id && p.buyer_workspace_id === buyer_workspace_id) return p;
      }
      return null;
    },
    async listPurchasesForCreator(creator_id, period_start, period_end) {
      return Array.from(purchases.values()).filter(
        (p) =>
          p.creator_id === creator_id &&
          ((p.paid_at && p.paid_at >= period_start && p.paid_at <= period_end) ||
            (p.refunded_at && p.refunded_at >= period_start && p.refunded_at <= period_end)),
      );
    },

    async insertReview(r) {
      reviews.set(r.id, r);
      return r;
    },
    async updateReview(id, patch) {
      const r = reviews.get(id);
      if (!r) throw new Error("missing review");
      const next = { ...r, ...patch } as Review;
      reviews.set(id, next);
      return next;
    },
    async getReview(id) {
      return reviews.get(id) ?? null;
    },
    async getReviewByPurchase(pid) {
      for (const r of reviews.values()) if (r.purchase_id === pid) return r;
      return null;
    },
    async listReviewsForTemplate(template_id, limit, cursor) {
      const rows = Array.from(reviews.values())
        .filter((r) => r.template_id === template_id && r.status === "visible")
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
      const start = cursor ? Number(cursor) : 0;
      const slice = rows.slice(start, start + limit);
      const next = start + limit < rows.length ? String(start + limit) : null;
      return { rows: slice, next_cursor: next };
    },
    async recomputeTemplateRating(template_id) {
      const t = templates.get(template_id);
      if (!t) return { avg: 0, count: 0 };
      const rs = Array.from(reviews.values()).filter(
        (r) => r.template_id === template_id && r.status === "visible",
      );
      const avg = rs.length === 0 ? 0 : rs.reduce((s, r) => s + r.stars, 0) / rs.length;
      templates.set(template_id, { ...t, avg_rating: avg, review_count: rs.length });
      return { avg, count: rs.length };
    },

    async upsertPayoutAccount(a) {
      accounts.set(a.creator_id, a);
      return a;
    },
    async getPayoutAccount(id) {
      return accounts.get(id) ?? null;
    },
    async incrementPayoutLifetime(creator_id, delta) {
      const a = accounts.get(creator_id);
      if (!a) return a as unknown as CreatorPayoutAccount;
      const next = { ...a, lifetime_usd_cents: a.lifetime_usd_cents + delta };
      accounts.set(creator_id, next);
      return next;
    },
    async insertPayout(p) {
      payouts.set(p.id, p);
      return p;
    },
    async updatePayout(id, patch) {
      const p = payouts.get(id);
      if (!p) throw new Error("missing payout");
      const next = { ...p, ...patch } as CreatorPayout;
      payouts.set(id, next);
      return next;
    },

    async insertFraudFlag(f) {
      flags.set(f.id, f);
      return f;
    },
    async listOpenFraudFlags(t, id) {
      return Array.from(flags.values()).filter(
        (f) => f.subject_type === t && f.subject_id === id && !f.resolved_at,
      );
    },
    async resolveFraudFlag(id, ts) {
      const f = flags.get(id);
      if (!f) throw new Error("missing flag");
      const next = { ...f, resolved_at: ts };
      flags.set(id, next);
      return next;
    },

    async countReviewsFromSameNetworkAsCreator() {
      // Test stub — real DB does fingerprint cluster lookups.
      return 0;
    },
  } satisfies MarketplaceDb & Record<string, unknown> as never;
}

export function nowSeq(start = new Date("2026-05-26T12:00:00Z").getTime()): () => Date {
  let t = start;
  return () => new Date((t += 1000));
}

export function farFutureNow(daysFromStart = 30, start = new Date("2026-05-26T12:00:00Z").getTime()): () => Date {
  const t = start + daysFromStart * 86_400_000;
  return () => new Date(t);
}

export function makeFunnel(overrides: Partial<FunnelStub> = {}): FunnelStub {
  return {
    id: "fnl_test_1",
    workspace_id: "wsp_creator",
    created_by: "usr_creator",
    lifetime_revenue_usd_cents: 25_000_00,
    published_at: new Date("2026-01-01T00:00:00Z").toISOString(),
    unique_customer_count: 50,
    funnel_blob: { pages: [{ id: "p1", title: "Hello" }] },
    email_sequences_blob: [],
    sms_sequences_blob: [],
    voice_script_blob: { script: "Hello {{name}}" },
    ad_creative_blob: [],
    kb_pack_ref: "kb_real_estate_v3",
    ...overrides,
  };
}
