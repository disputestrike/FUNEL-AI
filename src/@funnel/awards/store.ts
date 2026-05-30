/**
 * Storage abstraction for the awards package.
 */

import type {
  Award,
  AwardTier,
  AwardWinner,
  CaseStudyPage,
  PhysicalDelivery,
} from "./types.js";

export interface AwardsStore {
  /* Awards */
  insertAward(a: Award): Promise<Award>;
  findAward(funnel_id: string, tier: AwardTier): Promise<Award | null>;
  listAwardsForFunnel(funnel_id: string): Promise<Award[]>;
  listAwardsByTier(tier: AwardTier): Promise<Award[]>;
  listPublicAwards(limit: number, since?: string): Promise<Award[]>;

  /* Winners */
  upsertWinner(w: AwardWinner): Promise<AwardWinner>;
  getWinner(award_id: string): Promise<AwardWinner | null>;

  /* Case studies */
  insertCaseStudy(c: CaseStudyPage): Promise<CaseStudyPage>;
  getCaseStudyBySlug(slug: string): Promise<CaseStudyPage | null>;
  getCaseStudyByAward(award_id: string): Promise<CaseStudyPage | null>;
  updateCaseStudyStatus(id: string, status: CaseStudyPage["status"], at: string): Promise<CaseStudyPage>;
  listPublishedCaseStudies(args: { tier?: AwardTier; industry?: string; limit: number }): Promise<CaseStudyPage[]>;

  /* Physical delivery */
  insertPhysicalDelivery(p: PhysicalDelivery): Promise<PhysicalDelivery>;
  getPhysicalDeliveryByAward(award_id: string): Promise<PhysicalDelivery | null>;
  updatePhysicalDelivery(id: string, patch: Partial<PhysicalDelivery>): Promise<PhysicalDelivery>;
}

export class InMemoryAwardsStore implements AwardsStore {
  private awards = new Map<string, Award>();
  private winners = new Map<string, AwardWinner>();
  private cases = new Map<string, CaseStudyPage>();
  private deliveries = new Map<string, PhysicalDelivery>();

  async insertAward(a: Award): Promise<Award> {
    this.awards.set(a.id, a);
    return a;
  }
  async findAward(funnel_id: string, tier: AwardTier): Promise<Award | null> {
    for (const a of this.awards.values()) if (a.funnel_id === funnel_id && a.tier === tier) return a;
    return null;
  }
  async listAwardsForFunnel(funnel_id: string): Promise<Award[]> {
    return [...this.awards.values()].filter((a) => a.funnel_id === funnel_id);
  }
  async listAwardsByTier(tier: AwardTier): Promise<Award[]> {
    return [...this.awards.values()].filter((a) => a.tier === tier);
  }
  async listPublicAwards(limit: number, since?: string): Promise<Award[]> {
    let rows = [...this.awards.values()];
    if (since) {
      const cutoff = new Date(since).valueOf();
      rows = rows.filter((a) => new Date(a.awarded_at).valueOf() >= cutoff);
    }
    rows.sort((a, b) => b.awarded_at.localeCompare(a.awarded_at));
    return rows.slice(0, limit);
  }

  async upsertWinner(w: AwardWinner): Promise<AwardWinner> {
    this.winners.set(w.award_id, w);
    return w;
  }
  async getWinner(award_id: string): Promise<AwardWinner | null> {
    return this.winners.get(award_id) ?? null;
  }

  async insertCaseStudy(c: CaseStudyPage): Promise<CaseStudyPage> {
    this.cases.set(c.slug, c);
    return c;
  }
  async getCaseStudyBySlug(slug: string): Promise<CaseStudyPage | null> {
    return this.cases.get(slug) ?? null;
  }
  async getCaseStudyByAward(award_id: string): Promise<CaseStudyPage | null> {
    for (const c of this.cases.values()) if (c.award_id === award_id) return c;
    return null;
  }
  async updateCaseStudyStatus(
    id: string,
    status: CaseStudyPage["status"],
    at: string,
  ): Promise<CaseStudyPage> {
    for (const c of this.cases.values()) {
      if (c.id === id) {
        const next: CaseStudyPage = {
          ...c,
          status,
          published_at: status === "public" ? at : c.published_at,
          takedown_at: status === "taken_down" ? at : c.takedown_at,
        };
        this.cases.set(c.slug, next);
        return next;
      }
    }
    throw new Error(`case study ${id} not found`);
  }
  async listPublishedCaseStudies(args: { tier?: any; industry?: string; limit: number }): Promise<CaseStudyPage[]> {
    return [...this.cases.values()]
      .filter((c) => c.status === "public")
      .slice(0, args.limit);
  }

  async insertPhysicalDelivery(p: PhysicalDelivery): Promise<PhysicalDelivery> {
    this.deliveries.set(p.id, p);
    return p;
  }
  async getPhysicalDeliveryByAward(award_id: string): Promise<PhysicalDelivery | null> {
    for (const p of this.deliveries.values()) if (p.award_id === award_id) return p;
    return null;
  }
  async updatePhysicalDelivery(id: string, patch: Partial<PhysicalDelivery>): Promise<PhysicalDelivery> {
    const cur = this.deliveries.get(id);
    if (!cur) throw new Error("not found");
    const next = { ...cur, ...patch, updated_at: new Date().toISOString() };
    this.deliveries.set(id, next);
    return next;
  }
}
