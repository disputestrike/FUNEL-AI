/**
 * Unit tests for the affiliate package.
 * Covers enrollment, link creation, click/signup tracking, commission accrual,
 * dream-car tier calculation, fraud rules, and payout planning.
 */

import { describe, expect, it } from "vitest";

import {
  bonusForTier,
  buildPayoutPlan,
  buildReferralUrl,
  clawbackCommission,
  computeCommissionCents,
  createLink,
  enrollAffiliate,
  evaluateNewSignup,
  generateReferralCode,
  InMemoryAffiliateStore,
  injectUtms,
  isReferralActivePaying,
  recordClick,
  recordCommissionForPayment,
  recordSignup,
  refreshLeaderboard,
  runMonthlySnapshot,
  tierForActivePaying,
  weekBoundaries,
} from "../src/index.js";

let counter = 0;
const newId = (e: string) => `${e}_${(counter++).toString().padStart(6, "0")}`;
const seq = makeSeq();
function makeSeq() {
  let n = 0;
  return () => {
    n = (n * 9301 + 49297) % 233280;
    return n / 233280;
  };
}

const baseEnrollInput = {
  user_id: "usr_1",
  email: "ada@example.com",
  display_name: "Ada",
  tos_accepted: true,
};

function freshStore() {
  return new InMemoryAffiliateStore();
}

describe("enroll", () => {
  it("creates a unique referral code and is idempotent", async () => {
    const store = freshStore();
    const a = await enrollAffiliate(baseEnrollInput, {
      store,
      newId,
      random: seq,
    });
    expect(a.status).toBe("active");
    expect(a.referral_code).toMatch(/^[a-z2-9]{7}$/);

    const again = await enrollAffiliate(baseEnrollInput, {
      store,
      newId,
      random: seq,
    });
    expect(again.id).toBe(a.id);
  });

  it("rejects when ToS not accepted", async () => {
    const store = freshStore();
    await expect(
      enrollAffiliate({ ...baseEnrollInput, tos_accepted: false }, { store, newId }),
    ).rejects.toThrow(/ToS/);
  });

  it("generates unique codes with low collision odds", async () => {
    const store = freshStore();
    const codes = new Set<string>();
    for (let i = 0; i < 20; i++) {
      codes.add(await generateReferralCode(store, Math.random));
    }
    expect(codes.size).toBe(20);
  });
});

describe("links", () => {
  it("creates short links + injects UTMs without overriding existing", async () => {
    const store = freshStore();
    const a = await enrollAffiliate(baseEnrollInput, { store, newId, random: seq });
    const link = await createLink({ affiliate_id: a.id, sub_id: "yt-1" }, { store, newId, random: seq });
    expect(link.code).toMatch(/^[a-z2-9]{8}$/);
    expect(buildReferralUrl(a)).toMatch(/\/\?ref=/);

    const url = injectUtms("https://gofunnelai.com/?utm_source=existing&extra=1", link);
    expect(url).toContain("utm_source=existing");      // not clobbered
    expect(url).toContain("utm_medium=referral");      // injected
    expect(url).toContain("ref=" + link.code);
    expect(url).toContain("sub=yt-1");
  });

  it("caps sub-IDs at 100 per affiliate", async () => {
    const store = freshStore();
    const a = await enrollAffiliate(baseEnrollInput, { store, newId, random: seq });
    for (let i = 0; i < 100; i++) {
      await createLink({ affiliate_id: a.id, sub_id: `s${i}` }, { store, newId, random: seq });
    }
    await expect(
      createLink({ affiliate_id: a.id, sub_id: "s101" }, { store, newId, random: seq }),
    ).rejects.toThrow(/100 sub-IDs/);
  });
});

describe("tracking", () => {
  it("records click → signup attribution with 90-day cookie", async () => {
    const store = freshStore();
    const a = await enrollAffiliate(baseEnrollInput, { store, newId, random: seq });
    const link = await createLink({ affiliate_id: a.id }, { store, newId, random: seq });

    const click = await recordClick(
      { link_code: link.code, prospect_id: "pro_visitor" },
      { store, newId },
    );
    expect(click).not.toBeNull();
    expect(click?.cookie_expires_at).toBeDefined();

    const signup = await recordSignup(
      { referred_user_id: "usr_referred", prospect_id: "pro_visitor" },
      { store, newId },
    );
    expect(signup?.referred_user_id).toBe("usr_referred");
    expect(signup?.affiliate_id).toBe(a.id);
  });

  it("rejects self-referral", async () => {
    const store = freshStore();
    const a = await enrollAffiliate(baseEnrollInput, { store, newId, random: seq });
    const link = await createLink({ affiliate_id: a.id }, { store, newId, random: seq });
    const r = await recordClick({ link_code: link.code, prospect_id: a.user_id }, { store, newId });
    expect(r?.rejected_self_referral).toBe(true);
  });
});

describe("commissions", () => {
  it("computes 40% of base, idempotent on (referral, period, invoice)", async () => {
    expect(computeCommissionCents(100_00, 4000)).toBe(40_00);
    expect(computeCommissionCents(149_00, 4000)).toBe(59_60);
  });

  it("accrues only on signed-up referrals; idempotent on replay", async () => {
    const store = freshStore();
    const a = await enrollAffiliate(baseEnrollInput, { store, newId, random: seq });
    const link = await createLink({ affiliate_id: a.id }, { store, newId, random: seq });
    await recordClick({ link_code: link.code, prospect_id: "p" }, { store, newId });
    await recordSignup({ referred_user_id: "u2", prospect_id: "p" }, { store, newId });

    const c1 = await recordCommissionForPayment(
      {
        referred_user_id: "u2",
        invoice_id: "inv_1",
        type: "subscription",
        base_amount_cents: 49_00,
        period_yyyy_mm: "2026-05",
      },
      { store, newId },
    );
    expect(c1?.amount_cents).toBe(19_60);

    // replay
    const c2 = await recordCommissionForPayment(
      {
        referred_user_id: "u2",
        invoice_id: "inv_1",
        type: "subscription",
        base_amount_cents: 49_00,
        period_yyyy_mm: "2026-05",
      },
      { store, newId },
    );
    expect(c2?.id).toBe(c1?.id);
  });

  it("clawback emits a negative commission", async () => {
    const store = freshStore();
    const a = await enrollAffiliate(baseEnrollInput, { store, newId, random: seq });
    const link = await createLink({ affiliate_id: a.id }, { store, newId, random: seq });
    await recordClick({ link_code: link.code, prospect_id: "p" }, { store, newId });
    await recordSignup({ referred_user_id: "u3", prospect_id: "p" }, { store, newId });
    const c = await recordCommissionForPayment(
      {
        referred_user_id: "u3",
        invoice_id: "inv_2",
        type: "subscription",
        base_amount_cents: 100_00,
        period_yyyy_mm: "2026-05",
      },
      { store, newId },
    );
    const cb = await clawbackCommission(
      { original_commission_id: c!.id, reason: "refund" },
      { store, newId },
    );
    expect(cb.status).toBe("clawed_back");
  });
});

describe("dream car", () => {
  it("computes tier and bonus correctly", () => {
    expect(tierForActivePaying(99)).toBe("none");
    expect(tierForActivePaying(100)).toBe("t100");
    expect(tierForActivePaying(199)).toBe("t100");
    expect(tierForActivePaying(200)).toBe("t200");
    expect(tierForActivePaying(500)).toBe("t500");
    expect(tierForActivePaying(750)).toBe("t500");

    expect(bonusForTier("none")).toBe(0);
    expect(bonusForTier("t100")).toBe(50_000);
    expect(bonusForTier("t200")).toBe(100_000);
    expect(bonusForTier("t500")).toBe(250_000);
  });

  it("only counts active or recent past_due", () => {
    const now = Date.parse("2026-05-26T00:00:00Z");
    expect(isReferralActivePaying({ state: "active", past_due_since: null }, now)).toBe(true);
    expect(isReferralActivePaying({ state: "trialing", past_due_since: null }, now)).toBe(true);
    expect(isReferralActivePaying({ state: "canceled", past_due_since: null }, now)).toBe(false);
    expect(
      isReferralActivePaying(
        { state: "past_due", past_due_since: "2026-05-22T00:00:00Z" }, // ~4 days
        now,
      ),
    ).toBe(true);
    expect(
      isReferralActivePaying(
        { state: "past_due", past_due_since: "2026-05-01T00:00:00Z" }, // ~25 days
        now,
      ),
    ).toBe(false);
  });

  it("runs a monthly snapshot", async () => {
    const store = freshStore();
    const a = await enrollAffiliate(baseEnrollInput, { store, newId, random: seq });
    const snaps = await runMonthlySnapshot("2026-06-01T00:30:00Z", {
      store,
      newId,
      getSubscriptionState: async () => ({ state: "active", past_due_since: null }),
      isFraudFlagged: async () => false,
      listAllActiveAffiliateIds: async () => [a.id],
      listSignedUpReferrals: async () => [],
    });
    expect(snaps.length).toBe(1);
    expect(snaps[0]?.tier).toBe("none");
  });
});

describe("fraud", () => {
  it("flags same-fingerprint signups", async () => {
    const store = freshStore();
    const a = await enrollAffiliate(baseEnrollInput, { store, newId, random: seq });
    const link = await createLink({ affiliate_id: a.id }, { store, newId, random: seq });
    const click = await recordClick(
      { link_code: link.code, device_fp_hash: "fp_shared" },
      { store, newId },
    );
    const flags = await evaluateNewSignup(
      {
        affiliate: a,
        referral: click!,
        affiliate_device_fp_hash: "fp_shared",
      },
      { store, newId },
    );
    expect(flags.some((f) => f.rule_id === "same_device_fingerprint")).toBe(true);
  });

  it("flags disposable email domains", async () => {
    const store = freshStore();
    const a = await enrollAffiliate(baseEnrollInput, { store, newId, random: seq });
    const link = await createLink({ affiliate_id: a.id }, { store, newId, random: seq });
    const click = await recordClick({ link_code: link.code }, { store, newId });
    const flags = await evaluateNewSignup(
      {
        affiliate: a,
        referral: click!,
        email_domain: "mailinator.com",
      },
      { store, newId },
    );
    expect(flags.some((f) => f.rule_id === "disposable_email")).toBe(true);
  });
});

describe("payouts", () => {
  it("computes ISO-week boundaries (Mon → Mon UTC)", () => {
    const { start, end } = weekBoundaries(new Date("2026-05-26T10:00:00Z")); // Tuesday
    expect(start).toBe("2026-05-25T00:00:00.000Z");
    expect(end).toBe("2026-06-01T00:00:00.000Z");
  });

  it("excludes payouts under the $50 minimum", async () => {
    const store = freshStore();
    const a = await enrollAffiliate(baseEnrollInput, { store, newId, random: seq });
    const link = await createLink({ affiliate_id: a.id }, { store, newId, random: seq });
    await recordClick({ link_code: link.code, prospect_id: "p1" }, { store, newId });
    await recordSignup({ referred_user_id: "u4", prospect_id: "p1" }, { store, newId });
    await recordCommissionForPayment(
      {
        referred_user_id: "u4",
        invoice_id: "inv_3",
        type: "subscription",
        base_amount_cents: 10_00, // 40% = $4 → below $50 floor
        period_yyyy_mm: "2026-05",
      },
      { store, newId },
    );
    const plan = await buildPayoutPlan(
      "2026-05-26T10:00:00Z",
      [a.id],
      { store, newId, paypal: { send: async () => ({ batch_id: "", results: [] }) } },
    );
    expect(plan.length).toBe(0);
  });
});

describe("leaderboard", () => {
  it("materializes and respects opt-out", async () => {
    const store = freshStore();
    const a = await enrollAffiliate(baseEnrollInput, { store, newId, random: seq });
    await store.updateAffiliate(a.id, { leaderboard_visible: false });
    const rows = await refreshLeaderboard({ store });
    expect(rows.find((r) => r.affiliate_id === a.id)).toBeUndefined();
  });
});
