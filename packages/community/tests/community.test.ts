import { describe, expect, it } from "vitest";

import {
  buildHubCatalog,
  closeGame,
  createPost,
  dropThemedThread,
  enterGame,
  grantXp,
  InMemoryCommunityStore,
  levelForXp,
  scheduleGame,
  scoreMentor,
  stageHubForMrr,
  themedThreadXpMultiplier,
  validateXpGrant,
  XP_AMOUNTS,
  xpToNextLevel,
} from "../src/index.js";

let n = 0;
const newId = (e: string) => `${e}_${(n++).toString().padStart(6, "0")}`;

function freshStore() {
  return new InMemoryCommunityStore();
}

describe("hubs", () => {
  it("builds 30 industry + 5 stage hubs", () => {
    const hubs = buildHubCatalog();
    expect(hubs.filter((h) => h.kind === "industry").length).toBe(30);
    expect(hubs.filter((h) => h.kind === "stage").length).toBe(5);
  });

  it("maps MRR to stage", () => {
    expect(stageHubForMrr(0)).toBe("stage-pre-10k");
    expect(stageHubForMrr(50_000_00)).toBe("stage-10k-100k");
    expect(stageHubForMrr(500_000_00)).toBe("stage-100k-1m");
    expect(stageHubForMrr(50_000_000_00)).toBe("stage-10m-plus");
  });
});

describe("xp + levels", () => {
  it("levels are monotonic", () => {
    expect(levelForXp(0).level).toBe(1);
    expect(levelForXp(100).level).toBe(2);
    expect(levelForXp(20_000).level).toBe(10);
    expect(levelForXp(50_000).level).toBe(10);
    expect(xpToNextLevel(99)).toBe(1);
    expect(xpToNextLevel(20_000)).toBe(0);
  });

  it("grantXp applies daily cap on upvoted_answer", async () => {
    const store = freshStore();
    let levelup = 0;
    for (let i = 0; i < 30; i++) {
      await grantXp(
        { user_id: "u1", source: "upvoted_answer", source_id: `c${i}` },
        { store, newId, emit: async (n) => { if (n === "level_up") levelup++; } },
      );
    }
    const total = await store.totalXpForUser("u1");
    expect(total).toBeLessThanOrEqual(50);     // daily cap
  });

  it("emits level_up when crossing threshold", async () => {
    const store = freshStore();
    let levelup: any = null;
    await grantXp(
      { user_id: "u1", source: "win_challenge", source_id: "ch1" },     // 500 XP → L4
      { store, newId, emit: async (n, p) => { if (n === "level_up") levelup = p; } },
    );
    expect(levelup.to_level).toBe(4);
  });
});

describe("posts", () => {
  it("creates themed thread, pins for 24h, 2× XP multiplier", async () => {
    const store = freshStore();
    const post = await dropThemedThread(
      {
        hub_id: "hub_solar",
        bot_user_id: "bot",
        thread_type: "win_wed",
        title: "Win Wed",
        body: "Share a win",
      },
      { store, newId },
    );
    expect(post.is_themed).toBe(true);
    expect(post.pinned_until).not.toBeNull();
    expect(themedThreadXpMultiplier(post, post.created_at)).toBe(2);
  });
});

describe("anti-farming", () => {
  it("requires mentor match for mentor_mentee_first_lead", async () => {
    const store = freshStore();
    const r1 = await validateXpGrant(
      {
        user_id: "mentor",
        source: "mentor_mentee_first_lead",
        related_user_id: "mentee",
      },
      {
        store,
        getActiveMatchForMentee: async () => null,
      },
    );
    expect(r1.ok).toBe(false);

    const r2 = await validateXpGrant(
      {
        user_id: "mentor",
        source: "mentor_mentee_first_lead",
        related_user_id: "mentee",
      },
      {
        store,
        getActiveMatchForMentee: async () => ({ mentor_user_id: "mentor" }),
      },
    );
    expect(r2.ok).toBe(true);
  });

  it("blocks duplicate funnel_shipped XP for the same funnel", async () => {
    const store = freshStore();
    await grantXp(
      { user_id: "u", source: "funnel_shipped", source_id: "fn_1" },
      { store, newId },
    );
    const r = await validateXpGrant(
      { user_id: "u", source: "funnel_shipped", source_id: "fn_1" },
      { store, getActiveMatchForMentee: async () => null },
    );
    expect(r.ok).toBe(false);
  });
});

describe("mentor matching", () => {
  it("scores industry, geo, stage, load, freshness", () => {
    const breakdown = scoreMentor(
      {
        user_id: "m",
        status: "active",
        industry: "solar",
        country_iso2: "US",
        stage_level: "$100K–$1M MRR",
        active_mentees: 1,
        total_mentees_helped: 4,
        joined_at: new Date().toISOString(),
        last_active_match_at: null,
      },
      {
        user_id: "n",
        industry: "solar",
        country_iso2: "US",
        stage_level: "$10K–$100K MRR",
      },
      Date.now(),
    );
    expect(breakdown.industry_match).toBe(50);
    expect(breakdown.geo_match).toBe(20);
    expect(breakdown.stage_match).toBe(30);
    expect(breakdown.load_penalty).toBe(-10);
    expect(breakdown.total).toBe(90);
  });
});

describe("funnel games", () => {
  it("schedules + opens + closes a game with ranking", async () => {
    const store = freshStore();
    const game = await scheduleGame(
      {
        month_yyyy_mm: "2026-06",
        name: "June Funnel Games",
        theme: "Highest CR on a webinar funnel",
        rules: "30 days, ≥10 leads, must be live",
        pool_cents: 5_000_00,
        opens_at: new Date().toISOString(),
        closes_at: new Date().toISOString(),
        winners_announced_at: new Date().toISOString(),
      },
      { store, newId, userLevel: async () => ({ level: 5, xp_threshold: 1_000, unlocks: [] }) },
    );
    // Flip to open manually (real impl uses a cron).
    await store.insertGame({ ...game, status: "open" });

    await enterGame(
      { game_id: game.id, user_id: "u1", funnel_id: "fn1", metric_value: 12.4 },
      { store, newId, userLevel: async () => ({ level: 5, xp_threshold: 1_000, unlocks: [] }) },
    );
    await enterGame(
      { game_id: game.id, user_id: "u2", funnel_id: "fn2", metric_value: 9.1 },
      { store, newId, userLevel: async () => ({ level: 5, xp_threshold: 1_000, unlocks: [] }) },
    );
    const winners = await closeGame(game.id, {
      store,
      newId,
      userLevel: async () => ({ level: 5, xp_threshold: 1_000, unlocks: [] }),
    });
    expect(winners[0]?.user_id).toBe("u1");
    expect(winners[0]?.prize_amount_cents).toBe(2_500_00);
  });

  it("rejects entry below min level", async () => {
    const store = freshStore();
    const game = await scheduleGame(
      {
        month_yyyy_mm: "2026-06",
        name: "Test",
        theme: "Test",
        rules: "",
        pool_cents: 5_000_00,
        opens_at: new Date().toISOString(),
        closes_at: new Date().toISOString(),
        winners_announced_at: new Date().toISOString(),
      },
      { store, newId, userLevel: async () => ({ level: 5, xp_threshold: 1_000, unlocks: [] }) },
    );
    await store.insertGame({ ...game, status: "open" });
    await expect(
      enterGame(
        { game_id: game.id, user_id: "noob", funnel_id: "fn", metric_value: 1 },
        { store, newId, userLevel: async () => ({ level: 2, xp_threshold: 100, unlocks: [] }) },
      ),
    ).rejects.toThrow(/L4/);
  });
});
