import { describe, expect, it } from "vitest";

import { handleEvent } from "../src/lifecycle-orchestrator.js";
import {
  ACTIVATION_QUEUE,
  ACTIVATION_CANCEL_QUEUE,
  ActivationJobPayload,
  PgBossActivationScheduler,
  PgBossLike,
  dispatchTrigger,
} from "../src/scheduler.js";
import { INTERVENTION_KINDS } from "../src/types.js";
import {
  InMemoryAwards,
  InMemoryEmitter,
  InMemoryLifecycleStore,
  InMemoryReferrals,
  makeState,
  makeTriggerDeps,
} from "./_helpers.js";

class StubBoss implements PgBossLike {
  sends: Array<{ name: string; data: object; opts?: object }> = [];
  async send<T extends object>(
    name: string,
    data: T,
    opts?: { startAfter?: Date; singletonKey?: string; expireInHours?: number },
  ): Promise<string | null> {
    // Honor singletonKey idempotency by short-circuiting duplicates.
    if (opts?.singletonKey && this.sends.some(
      (s) =>
        s.name === name &&
        (s.opts as { singletonKey?: string } | undefined)?.singletonKey === opts.singletonKey,
    )) {
      return null;
    }
    this.sends.push({ name, data, ...(opts ? { opts } : {}) });
    return `job_${this.sends.length}`;
  }
}

describe("Scheduler — pg-boss adapter", () => {
  it("scheduleIntervention is idempotent on singletonKey", async () => {
    const boss = new StubBoss();
    const sched = new PgBossActivationScheduler(boss);
    await sched.scheduleIntervention({
      user_id: "usr_a",
      workspace_id: "wsp_a",
      kind: "d0_welcome",
      fire_at: "2026-05-01T00:00:00Z",
      dedupe_key: "usr_a:d0_welcome:2026-05-01",
    });
    await sched.scheduleIntervention({
      user_id: "usr_a",
      workspace_id: "wsp_a",
      kind: "d0_welcome",
      fire_at: "2026-05-01T00:00:00Z",
      dedupe_key: "usr_a:d0_welcome:2026-05-01",
    });
    const enqueues = boss.sends.filter((s) => s.name === ACTIVATION_QUEUE);
    expect(enqueues).toHaveLength(1);
  });

  it("cancelInterventions writes to the cancel queue", async () => {
    const boss = new StubBoss();
    const sched = new PgBossActivationScheduler(boss);
    await sched.cancelInterventions({
      user_id: "usr_a",
      kinds: ["d1_connect_source", "d2_no_source"],
      reason: "traffic_source_connected",
    });
    expect(
      boss.sends.filter((s) => s.name === ACTIVATION_CANCEL_QUEUE),
    ).toHaveLength(2);
  });

  it("orchestrator-scheduled full battery survives rerun", async () => {
    const store = new InMemoryLifecycleStore();
    const boss = new StubBoss();
    const scheduler = new PgBossActivationScheduler(boss);
    const emitter = new InMemoryEmitter();
    const awards = new InMemoryAwards();
    const referrals = new InMemoryReferrals();

    const deps = { store, scheduler, emit: emitter.emit, awards, referrals };
    await handleEvent(
      {
        name: "user_signed_up",
        user_id: "usr_a",
        workspace_id: "wsp_a",
        ts: "2026-05-01T00:00:00Z",
        industry: null,
        plan_tier: "free",
      },
      deps,
    );
    const after1 = boss.sends.filter((s) => s.name === ACTIVATION_QUEUE).length;
    expect(after1).toBe(INTERVENTION_KINDS.length);

    // Rerun the same signup (e.g. event-bus retry) → no duplicates.
    await handleEvent(
      {
        name: "user_signed_up",
        user_id: "usr_a",
        workspace_id: "wsp_a",
        ts: "2026-05-01T00:00:00Z",
        industry: null,
        plan_tier: "free",
      },
      deps,
    );
    const after2 = boss.sends.filter((s) => s.name === ACTIVATION_QUEUE).length;
    expect(after2).toBe(INTERVENTION_KINDS.length);
  });

  it("dispatchTrigger skips suspended workspaces (no email, no SMS)", async () => {
    const tdeps = makeTriggerDeps();
    await tdeps._store.save(makeState({ workspace_suspended: true }));
    const awards = new InMemoryAwards();
    const referrals = new InMemoryReferrals();
    const payload: ActivationJobPayload = {
      user_id: "usr_test",
      workspace_id: "wsp_test",
      kind: "d0_welcome",
      dedupe_key: "usr_test:d0_welcome:2026-05-01",
    };
    await dispatchTrigger(payload, { ...tdeps, awards, referrals });
    expect(tdeps._email.sent).toHaveLength(0);
    expect(tdeps._notifications.messages).toHaveLength(0);
  });
});
