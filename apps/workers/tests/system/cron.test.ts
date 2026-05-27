import { describe, expect, it } from "vitest";

import { CRON_JOBS } from "../../src/cron.js";

describe("cron schedule", () => {
  it("declares every required cron job", () => {
    const ids = CRON_JOBS.map((c) => c.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "dunning-hourly",
        "activation-hourly",
        "ingestion-daily",
        "reconciliation-hourly",
        "bias-audit-quarterly",
        "backups-restore-drill-monthly",
        "domain-reputation-monthly",
        "model-version-promote-monthly",
        "card-expiring-alerts-daily",
        "recursive-learning-nightly",
      ]),
    );
  });

  it("hourly jobs use distinct minute offsets (no thundering herd)", () => {
    const hourly = CRON_JOBS.filter((c) => /^\d+ \* \* \* \*$/.test(c.cron));
    const minutes = hourly.map((c) => c.cron.split(" ")[0]);
    expect(new Set(minutes).size).toBe(minutes.length);
  });

  it("ingestion runs daily at 02:00 UTC", () => {
    const ingestion = CRON_JOBS.find((c) => c.id === "ingestion-daily");
    expect(ingestion?.cron).toBe("0 2 * * *");
  });

  it("recursive-learning runs daily at 03:00 UTC", () => {
    const rl = CRON_JOBS.find((c) => c.id === "recursive-learning-nightly");
    expect(rl?.cron).toBe("0 3 * * *");
  });

  it("bias-audit runs quarterly", () => {
    const ba = CRON_JOBS.find((c) => c.id === "bias-audit-quarterly");
    expect(ba?.cron).toBe("0 4 1 1,4,7,10 *");
  });

  it("every cron points at a real queue", () => {
    for (const c of CRON_JOBS) {
      // queue is typed; redundant runtime assertion to catch hand-edits.
      expect(typeof c.queue).toBe("string");
      expect(c.queue.length).toBeGreaterThan(0);
    }
  });
});
