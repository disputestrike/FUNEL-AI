/**
 * Per-workspace voice minutes ledger.
 *
 *   - Plan credits (Doc 16 + tier sheet):
 *       Free      ........  25 min/mo
 *       Starter   ........ 100 min/mo
 *       Growth    ........ 500 min/mo
 *       Scale     ........ 2500 min/mo
 *       Agency    ........ pooled (Scale * sub-accounts)
 *   - Overage cost: $0.18/min
 *   - Ledger is double-entry-friendly: each entry is a signed `minutes_delta`.
 *
 * The actual call cost is materialized POST-call (we don't know exact minutes
 * until hangup). This module provides:
 *   - `creditCycle`: writes plan credits at cycle start (idempotent on cycle).
 *   - `consume`: writes a negative delta for a completed call.
 *   - `balance`: sum across the active cycle.
 *   - `chargeOverage`: when consume pushes the balance negative.
 */

import type { MinutesLedgerEntry } from "./types.js";

export const OVERAGE_CENTS_PER_MIN = 18;

export const PLAN_MINUTES_PER_CYCLE: Record<string, number> = {
  free: 25,
  starter: 100,
  growth: 500,
  scale: 2_500,
  agency: 0, // agency is pooled per sub-account — see poolForAgency
};

export interface MinutesLedgerStore {
  insert(e: MinutesLedgerEntry): Promise<MinutesLedgerEntry>;
  listForCycle(workspace_id: string, cycle: string): Promise<MinutesLedgerEntry[]>;
  hasCreditedCycle(workspace_id: string, cycle: string): Promise<boolean>;
}

export interface MinutesLedgerDeps {
  store: MinutesLedgerStore;
  newId: (entity: "request") => string;
  clock?: { iso(): string };
}

const defaultClock = { iso: () => new Date().toISOString() };

export async function balance(workspace_id: string, cycle: string, deps: MinutesLedgerDeps): Promise<number> {
  const entries = await deps.store.listForCycle(workspace_id, cycle);
  return entries.reduce((s, e) => s + e.minutes_delta, 0);
}

export async function creditCycle(
  args: { workspace_id: string; cycle: string; plan: keyof typeof PLAN_MINUTES_PER_CYCLE; agency_pool_total?: number },
  deps: MinutesLedgerDeps,
): Promise<MinutesLedgerEntry | null> {
  if (await deps.store.hasCreditedCycle(args.workspace_id, args.cycle)) return null;
  const credit = args.plan === "agency"
    ? args.agency_pool_total ?? 0
    : PLAN_MINUTES_PER_CYCLE[args.plan] ?? 0;
  if (credit === 0) return null;
  return deps.store.insert({
    id: deps.newId("request"),
    workspace_id: args.workspace_id,
    cycle_yyyy_mm: args.cycle,
    call_id: null,
    minutes_delta: credit,
    reason: "plan_credit",
    cost_cents_overage: 0,
    created_at: (deps.clock ?? defaultClock).iso(),
  });
}

/**
 * Consume minutes for a completed call. If consumption pushes the balance
 * below zero, the negative portion is charged at $0.18/min via the same
 * ledger entry's `cost_cents_overage` and `reason="overage"`. Caller is
 * responsible for billing the overage on the next invoice cycle.
 */
export async function consume(
  args: {
    workspace_id: string;
    cycle: string;
    call_id: string;
    duration_sec: number;
  },
  deps: MinutesLedgerDeps,
): Promise<{ minutes_charged: number; overage_minutes: number; overage_cents: number }> {
  const minutes = Math.ceil(args.duration_sec / 60); // billed up
  const cur = await balance(args.workspace_id, args.cycle, deps);
  const after = cur - minutes;
  const overage = after < 0 ? Math.abs(after) - Math.max(0, -cur) : 0;
  const within = minutes - overage;
  const now = (deps.clock ?? defaultClock).iso();
  if (within > 0) {
    await deps.store.insert({
      id: deps.newId("request"),
      workspace_id: args.workspace_id,
      cycle_yyyy_mm: args.cycle,
      call_id: args.call_id,
      minutes_delta: -within,
      reason: "consumed",
      cost_cents_overage: 0,
      created_at: now,
    });
  }
  if (overage > 0) {
    await deps.store.insert({
      id: deps.newId("request"),
      workspace_id: args.workspace_id,
      cycle_yyyy_mm: args.cycle,
      call_id: args.call_id,
      minutes_delta: -overage,
      reason: "overage",
      cost_cents_overage: overage * OVERAGE_CENTS_PER_MIN,
      created_at: now,
    });
  }
  return {
    minutes_charged: minutes,
    overage_minutes: overage,
    overage_cents: overage * OVERAGE_CENTS_PER_MIN,
  };
}

export async function listLedger(workspace_id: string, cycle: string, deps: MinutesLedgerDeps): Promise<MinutesLedgerEntry[]> {
  return deps.store.listForCycle(workspace_id, cycle);
}

/* ---------------------------------------------------------------- */
/* In-memory store                                                  */
/* ---------------------------------------------------------------- */

export class InMemoryMinutesLedgerStore implements MinutesLedgerStore {
  private rows: MinutesLedgerEntry[] = [];
  private creditedCycles = new Set<string>();
  async insert(e: MinutesLedgerEntry): Promise<MinutesLedgerEntry> {
    this.rows.push(e);
    if (e.reason === "plan_credit") this.creditedCycles.add(`${e.workspace_id}:${e.cycle_yyyy_mm}`);
    return e;
  }
  async listForCycle(workspace_id: string, cycle: string): Promise<MinutesLedgerEntry[]> {
    return this.rows.filter((r) => r.workspace_id === workspace_id && r.cycle_yyyy_mm === cycle);
  }
  async hasCreditedCycle(workspace_id: string, cycle: string): Promise<boolean> {
    return this.creditedCycles.has(`${workspace_id}:${cycle}`);
  }
}
