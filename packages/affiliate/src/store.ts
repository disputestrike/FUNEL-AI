/**
 * Storage abstraction.
 *
 * The package does NOT take a hard dependency on @funnel/db's concrete client.
 * Consumers wire an `AffiliateStore` that talks to whatever persistence layer
 * the app uses (Postgres, KV, in-memory test). All functions are async + idempotent.
 */

import type {
  Affiliate,
  AffiliateLink,
  Commission,
  DreamCarSnapshot,
  FraudFlag,
  LeaderboardRow,
  Payout,
  Referral,
} from "./types.js";

export interface AffiliateStore {
  /* Affiliate */
  getAffiliateByUserId(user_id: string): Promise<Affiliate | null>;
  getAffiliateById(id: string): Promise<Affiliate | null>;
  getAffiliateByReferralCode(code: string): Promise<Affiliate | null>;
  insertAffiliate(a: Affiliate): Promise<Affiliate>;
  updateAffiliate(id: string, patch: Partial<Affiliate>): Promise<Affiliate>;

  /* Links */
  insertLink(l: AffiliateLink): Promise<AffiliateLink>;
  getLinkByCode(code: string): Promise<AffiliateLink | null>;
  listLinksForAffiliate(affiliate_id: string): Promise<AffiliateLink[]>;

  /* Referrals */
  insertReferral(r: Referral): Promise<Referral>;
  getReferralById(id: string): Promise<Referral | null>;
  findActiveCookieReferral(args: {
    prospect_id?: string | null;
    user_id?: string | null;
    ip_hash?: string | null;
    device_fp_hash?: string | null;
    asOf: string;
  }): Promise<Referral | null>;
  attachSignupToReferral(args: {
    referral_id: string;
    referred_user_id: string;
    signup_at: string;
  }): Promise<Referral>;
  getReferralForUser(referred_user_id: string): Promise<Referral | null>;
  /** Count signups in the last 24h for fraud detection. */
  countSignupsLast24h(affiliate_id: string, asOf: string): Promise<number>;
  /** All referrals for an affiliate in a window (for cluster fraud). */
  listReferralsForAffiliateSince(affiliate_id: string, since: string): Promise<Referral[]>;

  /* Commissions */
  insertCommission(c: Commission): Promise<Commission>;
  findCommissionByIdempotency(args: {
    affiliate_id: string;
    referral_id: string;
    period_yyyy_mm: string;
    type: Commission["type"];
    source_invoice_id: string | null;
  }): Promise<Commission | null>;
  listCommissionsInPeriod(affiliate_id: string, period_start: string, period_end: string): Promise<Commission[]>;
  listEarnedCommissionsForAffiliate(affiliate_id: string): Promise<Commission[]>;
  markCommissionPaid(commission_id: string, payout_id: string): Promise<void>;
  insertClawback(args: { original_id: string; amount_cents_negative: number; reason: string }): Promise<Commission>;

  /* Payouts */
  insertPayout(p: Payout): Promise<Payout>;
  updatePayoutStatus(id: string, status: Payout["status"], extra?: Partial<Payout>): Promise<Payout>;
  listPendingPayouts(): Promise<Payout[]>;
  listPayoutsForAffiliate(affiliate_id: string): Promise<Payout[]>;

  /* Fraud */
  insertFraudFlag(f: FraudFlag): Promise<FraudFlag>;
  listOpenFraudFlags(affiliate_id: string): Promise<FraudFlag[]>;

  /* Dream Car */
  insertDreamCarSnapshot(s: DreamCarSnapshot): Promise<DreamCarSnapshot>;
  listDreamCarSnapshots(affiliate_id: string, since: string): Promise<DreamCarSnapshot[]>;

  /* Leaderboard */
  refreshLeaderboardMaterialized(now: string): Promise<LeaderboardRow[]>;
  getLeaderboard(top_n: number): Promise<LeaderboardRow[]>;
}

/* ---------------------------------------------------------------- */
/* In-memory implementation — test + dev only                        */
/* ---------------------------------------------------------------- */

export class InMemoryAffiliateStore implements AffiliateStore {
  private affiliates = new Map<string, Affiliate>();
  private links = new Map<string, AffiliateLink>();              // by code
  private referrals = new Map<string, Referral>();
  private referralByUser = new Map<string, string>();
  private commissions = new Map<string, Commission>();
  private payouts = new Map<string, Payout>();
  private flags = new Map<string, FraudFlag>();
  private dreamCar = new Map<string, DreamCarSnapshot>();
  private leaderboard: LeaderboardRow[] = [];

  async getAffiliateByUserId(user_id: string): Promise<Affiliate | null> {
    for (const a of this.affiliates.values()) if (a.user_id === user_id) return a;
    return null;
  }
  async getAffiliateById(id: string): Promise<Affiliate | null> {
    return this.affiliates.get(id) ?? null;
  }
  async getAffiliateByReferralCode(code: string): Promise<Affiliate | null> {
    for (const a of this.affiliates.values()) if (a.referral_code === code) return a;
    return null;
  }
  async insertAffiliate(a: Affiliate): Promise<Affiliate> {
    this.affiliates.set(a.id, a);
    return a;
  }
  async updateAffiliate(id: string, patch: Partial<Affiliate>): Promise<Affiliate> {
    const cur = this.affiliates.get(id);
    if (!cur) throw new Error(`affiliate ${id} not found`);
    const next = { ...cur, ...patch, updated_at: new Date().toISOString() };
    this.affiliates.set(id, next);
    return next;
  }

  async insertLink(l: AffiliateLink): Promise<AffiliateLink> {
    this.links.set(l.code, l);
    return l;
  }
  async getLinkByCode(code: string): Promise<AffiliateLink | null> {
    return this.links.get(code) ?? null;
  }
  async listLinksForAffiliate(affiliate_id: string): Promise<AffiliateLink[]> {
    return [...this.links.values()].filter((l) => l.affiliate_id === affiliate_id);
  }

  async insertReferral(r: Referral): Promise<Referral> {
    this.referrals.set(r.id, r);
    if (r.referred_user_id) this.referralByUser.set(r.referred_user_id, r.id);
    return r;
  }
  async getReferralById(id: string): Promise<Referral | null> {
    return this.referrals.get(id) ?? null;
  }
  async findActiveCookieReferral(args: {
    prospect_id?: string | null;
    user_id?: string | null;
    ip_hash?: string | null;
    device_fp_hash?: string | null;
    asOf: string;
  }): Promise<Referral | null> {
    const now = new Date(args.asOf).valueOf();
    let best: Referral | null = null;
    for (const r of this.referrals.values()) {
      if (new Date(r.cookie_expires_at).valueOf() < now) continue;
      if (r.fraud_flagged || r.rejected_self_referral) continue;
      const match =
        (args.prospect_id && r.prospect_id === args.prospect_id) ||
        (args.user_id && r.referred_user_id === args.user_id) ||
        (args.ip_hash && r.ip_hash === args.ip_hash) ||
        (args.device_fp_hash && r.device_fp_hash === args.device_fp_hash);
      if (!match) continue;
      // First-click wins by default → keep the earliest.
      if (!best || r.click_at < best.click_at) best = r;
    }
    return best;
  }
  async attachSignupToReferral(args: {
    referral_id: string;
    referred_user_id: string;
    signup_at: string;
  }): Promise<Referral> {
    const r = this.referrals.get(args.referral_id);
    if (!r) throw new Error("referral not found");
    const next: Referral = {
      ...r,
      referred_user_id: args.referred_user_id,
      signup_at: args.signup_at,
    };
    this.referrals.set(r.id, next);
    this.referralByUser.set(args.referred_user_id, r.id);
    return next;
  }
  async getReferralForUser(referred_user_id: string): Promise<Referral | null> {
    const id = this.referralByUser.get(referred_user_id);
    return id ? this.referrals.get(id) ?? null : null;
  }
  async countSignupsLast24h(affiliate_id: string, asOf: string): Promise<number> {
    const cutoff = new Date(asOf).valueOf() - 24 * 3600 * 1000;
    let n = 0;
    for (const r of this.referrals.values()) {
      if (r.affiliate_id !== affiliate_id) continue;
      if (!r.signup_at) continue;
      if (new Date(r.signup_at).valueOf() < cutoff) continue;
      n++;
    }
    return n;
  }
  async listReferralsForAffiliateSince(affiliate_id: string, since: string): Promise<Referral[]> {
    const cutoff = new Date(since).valueOf();
    return [...this.referrals.values()].filter(
      (r) => r.affiliate_id === affiliate_id && new Date(r.click_at).valueOf() >= cutoff,
    );
  }

  async insertCommission(c: Commission): Promise<Commission> {
    this.commissions.set(c.id, c);
    return c;
  }
  async findCommissionByIdempotency(args: {
    affiliate_id: string;
    referral_id: string;
    period_yyyy_mm: string;
    type: Commission["type"];
    source_invoice_id: string | null;
  }): Promise<Commission | null> {
    for (const c of this.commissions.values()) {
      if (
        c.affiliate_id === args.affiliate_id &&
        c.referral_id === args.referral_id &&
        c.period_yyyy_mm === args.period_yyyy_mm &&
        c.type === args.type &&
        c.source_invoice_id === args.source_invoice_id
      ) {
        return c;
      }
    }
    return null;
  }
  async listCommissionsInPeriod(
    affiliate_id: string,
    period_start: string,
    period_end: string,
  ): Promise<Commission[]> {
    const s = new Date(period_start).valueOf();
    const e = new Date(period_end).valueOf();
    return [...this.commissions.values()].filter((c) => {
      const t = new Date(c.created_at).valueOf();
      return c.affiliate_id === affiliate_id && t >= s && t < e;
    });
  }
  async listEarnedCommissionsForAffiliate(affiliate_id: string): Promise<Commission[]> {
    return [...this.commissions.values()].filter(
      (c) => c.affiliate_id === affiliate_id && c.status === "earned",
    );
  }
  async markCommissionPaid(commission_id: string, payout_id: string): Promise<void> {
    const c = this.commissions.get(commission_id);
    if (!c) return;
    this.commissions.set(commission_id, { ...c, status: "paid", paid_in_payout_id: payout_id });
  }
  async insertClawback(args: {
    original_id: string;
    amount_cents_negative: number;
    reason: string;
  }): Promise<Commission> {
    const original = this.commissions.get(args.original_id);
    if (!original) throw new Error("original commission not found");
    const cb: Commission = {
      ...original,
      id: `${original.id}_cb`,
      amount_cents: -Math.abs(args.amount_cents_negative),
      status: "clawed_back",
      paid_in_payout_id: null,
      ledger_entry_id: null,
      created_at: new Date().toISOString(),
    };
    this.commissions.set(cb.id, cb);
    this.commissions.set(original.id, { ...original, status: "clawed_back" });
    return cb;
  }

  async insertPayout(p: Payout): Promise<Payout> {
    this.payouts.set(p.id, p);
    return p;
  }
  async updatePayoutStatus(id: string, status: Payout["status"], extra: Partial<Payout> = {}): Promise<Payout> {
    const cur = this.payouts.get(id);
    if (!cur) throw new Error("payout not found");
    const next = { ...cur, ...extra, status };
    this.payouts.set(id, next);
    return next;
  }
  async listPendingPayouts(): Promise<Payout[]> {
    return [...this.payouts.values()].filter((p) => p.status === "pending");
  }
  async listPayoutsForAffiliate(affiliate_id: string): Promise<Payout[]> {
    return [...this.payouts.values()].filter((p) => p.affiliate_id === affiliate_id);
  }

  async insertFraudFlag(f: FraudFlag): Promise<FraudFlag> {
    this.flags.set(f.id, f);
    return f;
  }
  async listOpenFraudFlags(affiliate_id: string): Promise<FraudFlag[]> {
    return [...this.flags.values()].filter(
      (f) => f.affiliate_id === affiliate_id && f.status === "open",
    );
  }

  async insertDreamCarSnapshot(s: DreamCarSnapshot): Promise<DreamCarSnapshot> {
    this.dreamCar.set(s.id, s);
    return s;
  }
  async listDreamCarSnapshots(affiliate_id: string, since: string): Promise<DreamCarSnapshot[]> {
    const cutoff = new Date(since).valueOf();
    return [...this.dreamCar.values()].filter(
      (s) => s.affiliate_id === affiliate_id && new Date(s.created_at).valueOf() >= cutoff,
    );
  }

  async refreshLeaderboardMaterialized(_now: string): Promise<LeaderboardRow[]> {
    // Aggregate trailing-30d commission per affiliate.
    const now = Date.now();
    const cutoff = now - 30 * 24 * 3600 * 1000;
    const agg = new Map<string, { t30: number; lifetime: number; active: number }>();
    for (const c of this.commissions.values()) {
      if (c.amount_cents <= 0) continue;
      const cur = agg.get(c.affiliate_id) ?? { t30: 0, lifetime: 0, active: 0 };
      cur.lifetime += c.amount_cents;
      if (new Date(c.created_at).valueOf() >= cutoff) cur.t30 += c.amount_cents;
      agg.set(c.affiliate_id, cur);
    }
    for (const r of this.referrals.values()) {
      if (!r.referred_user_id || r.fraud_flagged) continue;
      const cur = agg.get(r.affiliate_id) ?? { t30: 0, lifetime: 0, active: 0 };
      cur.active++;
      agg.set(r.affiliate_id, cur);
    }
    const rows: LeaderboardRow[] = [];
    let rank = 1;
    for (const [aff_id, v] of [...agg.entries()].sort((a, b) => b[1].t30 - a[1].t30)) {
      const aff = this.affiliates.get(aff_id);
      if (!aff || !aff.leaderboard_visible || aff.status !== "active") continue;
      rows.push({
        rank,
        affiliate_id: aff_id,
        display_name: aff.display_name ?? `Affiliate ${aff_id.slice(-4).toUpperCase()}`,
        country_iso2: aff.country_iso2,
        trailing_30_commission_cents: v.t30,
        lifetime_commission_cents: v.lifetime,
        active_referrals: v.active,
        rank_delta_vs_last_week: 0,
      });
      rank++;
    }
    this.leaderboard = rows;
    return rows;
  }
  async getLeaderboard(top_n: number): Promise<LeaderboardRow[]> {
    return this.leaderboard.slice(0, top_n);
  }
}
