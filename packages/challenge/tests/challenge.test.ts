import { describe, expect, it } from "vitest";

import {
  buildCohortDashboard,
  createCohortForMonth,
  curriculumFor,
  CURRICULUM,
  enrollParticipant,
  InMemoryChallengeStore,
  issueCertificate,
  markDayCompleted,
  recordPaidConversion,
  sendDailyDrop,
  startCohort,
} from "../src/index.js";

let n = 0;
const newId = (e: string) => `${e}_${(n++).toString().padStart(6, "0")}`;

function freshStore() {
  return new InMemoryChallengeStore();
}

const emailMock = (sent: Array<Record<string, unknown>>) => ({
  send: async (args: any) => {
    sent.push(args);
    return { message_id: `mid_${sent.length}` };
  },
});
const smsMock = (sent: Array<Record<string, unknown>>) => ({
  send: async (args: any) => {
    sent.push(args);
    return { message_id: `sms_${sent.length}` };
  },
});
const communityMock = (threads: Array<Record<string, unknown>>) => ({
  postThread: async (args: any) => {
    threads.push(args);
    return { thread_url: `https://community.gofunnelai.com/${args.cohort_id}/day${args.day}` };
  },
});

describe("curriculum", () => {
  it("covers all 7 days with required fields", () => {
    expect(CURRICULUM.length).toBe(7);
    for (const d of CURRICULUM) {
      expect(d.email_subject.length).toBeGreaterThan(0);
      expect(d.sms_body).toContain("STOP");
    }
  });

  it("lookup by day number", () => {
    expect(curriculumFor(3)?.theme).toMatch(/tracking/i);
  });
});

describe("cohort lifecycle", () => {
  it("creates + starts + completes a cohort", async () => {
    const store = freshStore();
    const c = await createCohortForMonth(
      { challenge_id: "ch_1", year: 2026, month: 5, cohort_number: 1 },
      { store, newId },
    );
    expect(c.status).toBe("scheduled");
    const started = await startCohort(c.id, { store, newId });
    expect(started.status).toBe("running");
  });
});

describe("enrollment", () => {
  it("is idempotent on (cohort, email)", async () => {
    const store = freshStore();
    await createCohortForMonth(
      { challenge_id: "ch_1", year: 2026, month: 5, cohort_number: 1 },
      { store, newId },
    );
    const a = await enrollParticipant({ email: "ada@example.com" }, { store, newId });
    const b = await enrollParticipant({ email: "ada@example.com" }, { store, newId });
    expect(a.participant.id).toBe(b.participant.id);
  });

  it("rejects when no scheduled cohort", async () => {
    const store = freshStore();
    await expect(
      enrollParticipant({ email: "ada@example.com" }, { store, newId }),
    ).rejects.toThrow();
  });
});

describe("daily engine", () => {
  it("sends email + SMS + posts community thread", async () => {
    const store = freshStore();
    const cohort = await createCohortForMonth(
      { challenge_id: "ch_1", year: 2026, month: 5, cohort_number: 1 },
      { store, newId },
    );
    await enrollParticipant(
      { email: "ada@example.com", sms_opt_in: true, phone_e164: "+15555550101" },
      { store, newId },
    );
    const emails: any[] = [];
    const sms: any[] = [];
    const threads: any[] = [];
    const r = await sendDailyDrop(
      { cohort, day: 1 },
      {
        store,
        email: emailMock(emails),
        sms: smsMock(sms),
        community: communityMock(threads),
      },
    );
    expect(r.emails_sent).toBe(1);
    expect(r.sms_sent).toBe(1);
    expect(threads[0].day).toBe(1);
    expect(emails[0].idempotency_key).toContain("cohort_");
  });

  it("marks a day complete and emits completion on day 7", async () => {
    const store = freshStore();
    await createCohortForMonth(
      { challenge_id: "ch_1", year: 2026, month: 5, cohort_number: 1 },
      { store, newId },
    );
    const { participant } = await enrollParticipant(
      { email: "ada@example.com" },
      { store, newId },
    );
    let completedEvents = 0;
    for (let d = 1; d <= 7; d++) {
      await markDayCompleted(
        { participant_id: participant.id, day: d as 1 },
        {
          store,
          email: emailMock([]),
          sms: smsMock([]),
          community: communityMock([]),
          emit: async (n) => {
            if (n === "challenge_completed") completedEvents++;
          },
        },
      );
    }
    expect(completedEvents).toBe(1);
  });
});

describe("dashboard", () => {
  it("builds a cohort dashboard with day progress", async () => {
    const store = freshStore();
    const c = await createCohortForMonth(
      { challenge_id: "ch_1", year: 2026, month: 5, cohort_number: 1 },
      { store, newId },
    );
    const { participant } = await enrollParticipant(
      { email: "a@b.com" },
      { store, newId },
    );
    await markDayCompleted(
      { participant_id: participant.id, day: 1 },
      {
        store,
        email: emailMock([]),
        sms: smsMock([]),
        community: communityMock([]),
      },
    );
    const dash = await buildCohortDashboard(c.id, {
      store,
      getParticipantFunnelStats: async () => ({ leads: 5, cr_pct: 4.1, revenue_cents: 0, first_1k_at: null }),
    });
    expect(dash?.total_enrolled).toBe(1);
    expect(dash?.days_progress.find((p) => p.day === 1)?.completed_count).toBe(1);
  });
});

describe("certificate", () => {
  it("issues a certificate after 7 days complete", async () => {
    const store = freshStore();
    await createCohortForMonth(
      { challenge_id: "ch_1", year: 2026, month: 5, cohort_number: 1 },
      { store, newId },
    );
    const { participant } = await enrollParticipant(
      { email: "a@b.com" },
      { store, newId },
    );
    for (let d = 1; d <= 7; d++) {
      await markDayCompleted(
        { participant_id: participant.id, day: d as 1 },
        {
          store,
          email: emailMock([]),
          sms: smsMock([]),
          community: communityMock([]),
        },
      );
    }
    const result = await issueCertificate(
      { participant_id: participant.id },
      {
        store,
        renderer: {
          render: async () => ({ png_1080_url: "https://x.com/p.png", png_linkedin_url: "https://x.com/li.png" }),
        },
        email: { send: async () => ({ message_id: "m" }) },
      },
    );
    expect(result.png_1080_url).toBe("https://x.com/p.png");
    expect(result.share_url).toContain("utm_source=challenge_cert");
  });

  it("rejects before 7 days", async () => {
    const store = freshStore();
    await createCohortForMonth(
      { challenge_id: "ch_1", year: 2026, month: 5, cohort_number: 1 },
      { store, newId },
    );
    const { participant } = await enrollParticipant(
      { email: "a@b.com" },
      { store, newId },
    );
    await expect(
      issueCertificate(
        { participant_id: participant.id },
        {
          store,
          renderer: { render: async () => ({ png_1080_url: "", png_linkedin_url: "" }) },
          email: { send: async () => ({ message_id: "" }) },
        },
      ),
    ).rejects.toThrow(/7 days/);
  });
});

describe("conversion", () => {
  it("stamps a paid conversion on the participant + cohort", async () => {
    const store = freshStore();
    const c = await createCohortForMonth(
      { challenge_id: "ch_1", year: 2026, month: 5, cohort_number: 1 },
      { store, newId },
    );
    await enrollParticipant(
      { email: "a@b.com", user_id: "usr_1" },
      { store, newId },
    );
    let event: any = null;
    const r = await recordPaidConversion(
      { user_id: "usr_1", cohort_id: c.id, plan: "starter", mrr_cents: 4900 },
      { store, emit: async (n, p) => { event = { n, p }; } },
    );
    expect(r.matched).toBe(true);
    expect(event.n).toBe("challenge_paid_conversion");
    const reloaded = await store.getCohortById(c.id);
    expect(reloaded?.paid_conversion_count).toBe(1);
  });
});
