/**
 * Auto-generated case study page (Doc 16 §3.4).
 *
 * Triggered by milestone_hit. Generates a draft page at
 * `gofunnelai.com/wins/<first-name>-<industry>-<tier>` with:
 *   - Hero (name + tier badge)
 *   - Stat block (revenue, time-to-milestone, leads, CR)
 *   - "What worked" extracted from funnel analytics
 *   - Anonymized funnel preview (separate renderer service consumes
 *     `clone_template_id` to deep-copy + scrub the funnel)
 *   - schema.org JSON-LD (Review + Product)
 *   - OG image at 1200×630
 *   - Customer must explicitly publish (default = draft)
 */

import type { AwardsStore } from "./store.js";
import type {
  Award,
  AwardWinner,
  CaseStudyPage,
  CaseStudyStatus,
} from "./types.js";

export interface FunnelAnalyticsSnapshot {
  leads_generated: number;
  conversion_rate_pct: number;
  /** Top hooks / offers / ad creatives extracted by the funnel analytics service. */
  top_hooks: string[];
}

export interface CaseStudyDeps {
  store: AwardsStore;
  newId: (entity: "request") => string;
  /** Anonymized template clone — returns the cloneable template_id for the page CTA. */
  cloneTemplate: (args: { funnel_id: string }) => Promise<{ template_id: string }>;
  /** OG image renderer — returns the public URL of the 1200×630 PNG. */
  renderOgImage: (args: {
    slug: string;
    tier: Award["tier"];
    name: string;
    amount_usd: number;
  }) => Promise<string>;
  /** Tier → industry lookup that produces the analytics snapshot. */
  getFunnelAnalytics: (funnel_id: string) => Promise<FunnelAnalyticsSnapshot>;
  /** Lookup user data the customer hasn't filled in yet. */
  getDefaultDisplayName: (workspace_id: string) => Promise<string>;
  clock?: { iso(): string };
  emit?: (
    name: "case_study_generated" | "case_study_published" | "case_study_taken_down",
    payload: Record<string, unknown>,
  ) => Promise<void>;
}

const defaultClock = { iso: () => new Date().toISOString() };

/**
 * Build a URL slug from (first name, industry, tier). Collisions → numeric suffix.
 */
export async function buildUniqueSlug(
  base: { display_name: string; industry: string; tier: Award["tier"] },
  store: AwardsStore,
): Promise<string> {
  const first = base.display_name
    .toLowerCase()
    .split(/\s+/)[0]
    ?.replace(/[^a-z0-9]/g, "") || "winner";
  const industry = base.industry
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "general";
  const root = `${first}-${industry}-${base.tier}`;
  if (!(await store.getCaseStudyBySlug(root))) return root;
  for (let i = 2; i < 100; i++) {
    const probe = `${root}-${i}`;
    if (!(await store.getCaseStudyBySlug(probe))) return probe;
  }
  throw new Error("could not allocate unique case study slug");
}

/** Generate the case study page (always starts as `draft`). */
export async function generateCaseStudy(
  args: { award: Award; winner: AwardWinner },
  deps: CaseStudyDeps,
): Promise<CaseStudyPage> {
  const clock = deps.clock ?? defaultClock;
  const display = args.winner.display_name ?? (await deps.getDefaultDisplayName(args.award.workspace_id));
  const industry = args.winner.industry ?? "general";

  const slug = await buildUniqueSlug(
    { display_name: display, industry, tier: args.award.tier },
    deps.store,
  );

  const analytics = await deps.getFunnelAnalytics(args.award.funnel_id);
  const clone = await deps.cloneTemplate({ funnel_id: args.award.funnel_id });
  const amount_usd = Math.round(args.award.revenue_at_milestone_cents / 100);
  const og = await deps.renderOgImage({ slug, tier: args.award.tier, name: display, amount_usd });

  const tierLabel = ({
    bronze: "Bronze ($10K)",
    silver: "Silver ($100K)",
    gold: "Gold ($1M)",
    platinum: "Platinum ($10M)",
    diamond: "Diamond ($100M)",
  } as const)[args.award.tier];

  const jsonld = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Review",
        itemReviewed: { "@type": "Product", name: "GoFunnelAI" },
        reviewRating: { "@type": "Rating", ratingValue: 5, bestRating: 5 },
        author: { "@type": "Person", name: display },
        reviewBody:
          args.winner.testimonial ??
          `Built a funnel with GoFunnelAI and crossed the ${tierLabel} milestone in ${args.award.time_to_milestone_days} days.`,
      },
      {
        "@type": "Product",
        name: "GoFunnelAI",
        review: {
          "@type": "Review",
          author: { "@type": "Person", name: display },
        },
      },
    ],
  });

  const page: CaseStudyPage = {
    id: deps.newId("request"),
    award_id: args.award.id,
    slug,
    status: "draft",
    hero_title: `${display} crossed ${formatUSD(amount_usd)} with GoFunnelAI`,
    hero_subtitle: `${tierLabel} · ${industry} · ${args.award.time_to_milestone_days} days`,
    stats: {
      revenue_cents: args.award.revenue_at_milestone_cents,
      leads_generated: analytics.leads_generated,
      conversion_rate_pct: analytics.conversion_rate_pct,
      time_to_milestone_days: args.award.time_to_milestone_days,
    },
    what_worked: analytics.top_hooks,
    testimonial: args.winner.testimonial ?? null,
    og_image_url: og,
    clone_template_id: clone.template_id,
    schema_org_jsonld: jsonld,
    created_at: clock.iso(),
    published_at: null,
    takedown_at: null,
  };
  const inserted = await deps.store.insertCaseStudy(page);
  if (deps.emit) {
    await deps.emit("case_study_generated", {
      funnel_id: args.award.funnel_id,
      case_study_slug: inserted.slug,
      status: inserted.status,
    });
  }
  return inserted;
}

/**
 * Flip status. Used for `Make public`, `Take down`, etc. Idempotent if the
 * target status already matches current.
 */
export async function setCaseStudyStatus(
  args: { case_study_id: string; status: CaseStudyStatus; actor_user_id: string },
  deps: CaseStudyDeps,
): Promise<CaseStudyPage> {
  const now = (deps.clock ?? defaultClock).iso();
  const next = await deps.store.updateCaseStudyStatus(args.case_study_id, args.status, now);
  if (deps.emit) {
    if (args.status === "public") {
      await deps.emit("case_study_published", {
        case_study_slug: next.slug,
        published_by: args.actor_user_id,
        published_at: now,
      });
    } else if (args.status === "taken_down") {
      await deps.emit("case_study_taken_down", {
        case_study_slug: next.slug,
        taken_down_by: args.actor_user_id,
        taken_down_at: now,
      });
    }
  }
  return next;
}

function formatUSD(amount: number): string {
  return `$${amount.toLocaleString()}`;
}
