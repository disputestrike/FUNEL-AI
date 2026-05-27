import { describe, expect, it, vi } from "vitest";

import { makeJob } from "../helpers.js";

const db = { runRestoreDrill: vi.fn() };
vi.mock("@funnel/db", () => db);
vi.mock("@funnel/events", () => ({ EventSchemas: {}, emit: vi.fn() }));

describe("backups-restore-drill worker", () => {
  async function load() {
    const { getHandlerForTests } = await import("../../src/worker-base.js");
    const { backupsRestoreDrillWorker } = await import("../../src/workers/backups-restore-drill.js");
    return getHandlerForTests(backupsRestoreDrillWorker as never);
  }

  it("SLA met: returns sla_met=true", async () => {
    db.runRestoreDrill.mockResolvedValue({
      drill_id: "dr_1",
      rpo_seconds: 60,
      rto_seconds: 60 * 60,
      backup_id: "bk_1",
      smoke_passed: true,
      issues: [],
    });
    const handler = await load();
    const out = await handler.run({ job: makeJob({}) as never, data: {} });
    expect(out).toMatchObject({ sla_met: true });
  });

  it("SLA breach: throws (escalates to on-call via DLQ)", async () => {
    db.runRestoreDrill.mockResolvedValue({
      drill_id: "dr_1",
      rpo_seconds: 60,
      rto_seconds: 24 * 60 * 60,
      backup_id: "bk_1",
      smoke_passed: false,
      issues: ["snapshot stale"],
    });
    const handler = await load();
    await expect(handler.run({ job: makeJob({}) as never, data: {} })).rejects.toThrow(
      /backup drill SLA breach/,
    );
  });
});
