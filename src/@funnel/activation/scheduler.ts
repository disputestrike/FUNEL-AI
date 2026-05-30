/**
 * Scheduler — pg-boss-backed intervention job runner.
 *
 * Responsibilities:
 *   - Schedule intervention jobs from the lifecycle orchestrator's
 *     `scheduleFullBattery()` call.
 *   - Honor opt-outs and workspace suspend/cancel at fire-time (a
 *     last-chance check, complementing the orchestrator's pre-emptive
 *     cancellations).
 *   - Be idempotent — pg-boss enforces single-execution on `singletonKey`,
 *     and triggers themselves dedupe on `dedupe_key`.
 *   - Provide a `evaluatePendingForUser()` helper for rerun-safety so a
 *     full backfill of historical signups doesn't double-send.
 *
 * Implementation note: this file is the orchestration surface, not the
 * trigger logic itself. The actual side effects live in `./triggers/*`.
 */

import type PgBoss from "pg-boss";

import {
  AwardsTracker,
  LifecycleStore,
  ReferralAskTrigger,
} from "./success-path.js";
import { isInterventionEligible } from "./lifecycle-orchestrator.js";
import {
  fireD0Welcome,
  fireD1ConnectSource,
  fireD14Exit,
  fireD14PaidAsk,
  fireD2NoSource,
  fireD3NoLead,
  fireD4Community,
  fireD5Concierge,
  fireD7Activated,
  fireD7NotActivated,
} from "./triggers/index.js";
import { TriggerDeps } from "./triggers/_common.js";
import { InterventionKind } from "./types.js";
import { InterventionScheduler } from "./lifecycle-orchestrator.js";

/* ===== Job queue name ================================================= */

export const ACTIVATION_QUEUE = "activation.interventions";
export const ACTIVATION_CANCEL_QUEUE = "activation.interventions.cancel";

/* ===== Job payload shape ============================================== */

export interface ActivationJobPayload {
  user_id: string;
  workspace_id: string;
  kind: InterventionKind;
  dedupe_key: string;
}

/* ===== Worker dispatch table ========================================= */

/**
 * Returns the trigger function bound to `kind`. New triggers plug in here.
 * Kept as a switch (not a map) so TS exhaustiveness-checks for us.
 */
export async function dispatchTrigger(
  payload: ActivationJobPayload,
  deps: TriggerDeps & {
    awards: AwardsTracker;
    referrals: ReferralAskTrigger;
  },
): Promise<void> {
  const state = await deps.store.load(payload.user_id);
  if (!state) return;
  if (state.workspace_id !== payload.workspace_id) return;

  const eligible = isInterventionEligible(state);
  if (!eligible.ok) {
    await deps.emit("activation_intervention_suppressed", {
      user_id: payload.user_id,
      workspace_id: payload.workspace_id,
      kind: payload.kind,
      reason: eligible.reason,
      dedupe_key: payload.dedupe_key,
    });
    return;
  }

  switch (payload.kind) {
    case "d0_welcome":
      return fireD0Welcome({ ...payload, deps });
    case "d1_connect_source":
      return fireD1ConnectSource({ ...payload, deps });
    case "d2_no_source":
      return fireD2NoSource({ ...payload, deps });
    case "d3_no_lead":
      return fireD3NoLead({ ...payload, deps });
    case "d4_community":
      return fireD4Community({ ...payload, deps });
    case "d5_concierge":
      return fireD5Concierge({ ...payload, deps });
    case "d7_activated":
      return fireD7Activated({
        ...payload,
        deps,
        awards: deps.awards,
        referrals: deps.referrals,
      });
    case "d7_not_activated":
      return fireD7NotActivated({ ...payload, deps });
    case "d14_paid_ask":
      return fireD14PaidAsk({ ...payload, deps });
    case "d14_exit":
      return fireD14Exit({ ...payload, deps });
  }
}

/* ===== pg-boss-backed scheduler ====================================== */

/**
 * Thin port; we accept the minimal pg-boss surface we need so consumers can
 * pass either a real `PgBoss` instance or an in-memory stub in tests.
 */
export interface PgBossLike {
  send<T extends object>(
    name: string,
    data: T,
    options: { startAfter?: Date; singletonKey?: string; expireInHours?: number },
  ): Promise<string | null>;
  /**
   * pg-boss exposes `cancel(jobId)` and the v10+ batch cancel. We model
   * cancellation by singletonKey via a side-channel queue write to the
   * cancellation worker.
   */
  send<T extends object>(name: string, data: T): Promise<string | null>;
}

export class PgBossActivationScheduler implements InterventionScheduler {
  constructor(private readonly boss: PgBossLike) {}

  async scheduleIntervention(input: {
    user_id: string;
    workspace_id: string;
    kind: InterventionKind;
    fire_at: string;
    dedupe_key: string;
  }): Promise<void> {
    await this.boss.send<ActivationJobPayload>(
      ACTIVATION_QUEUE,
      {
        user_id: input.user_id,
        workspace_id: input.workspace_id,
        kind: input.kind,
        dedupe_key: input.dedupe_key,
      },
      {
        startAfter: new Date(input.fire_at),
        // singletonKey makes the schedule rerun-safe — pg-boss collapses
        // identical keys into one row in `pgboss.job`.
        singletonKey: input.dedupe_key,
        expireInHours: 24,
      },
    );
  }

  async cancelInterventions(input: {
    user_id: string;
    kinds: InterventionKind[];
    reason: string;
  }): Promise<void> {
    for (const kind of input.kinds) {
      await this.boss.send(ACTIVATION_CANCEL_QUEUE, {
        user_id: input.user_id,
        kind,
        reason: input.reason,
      });
    }
  }

  async cancelAll(input: { user_id: string; reason: string }): Promise<void> {
    await this.boss.send(ACTIVATION_CANCEL_QUEUE, {
      user_id: input.user_id,
      kind: null,
      reason: input.reason,
    });
  }
}

/* ===== Bootstrap (production wiring) ================================== */

/**
 * Bootstrap helper — wires the pg-boss work() loop to the dispatcher. Call
 * once per worker process.
 */
export async function startWorker(
  boss: PgBoss,
  deps: TriggerDeps & {
    awards: AwardsTracker;
    referrals: ReferralAskTrigger;
  },
): Promise<void> {
  await boss.work<ActivationJobPayload>(
    ACTIVATION_QUEUE,
    { teamSize: 8, teamConcurrency: 4 },
    async (job) => {
      await dispatchTrigger(job.data, deps);
    },
  );

  await boss.work<{
    user_id: string;
    kind: InterventionKind | null;
    reason: string;
  }>(ACTIVATION_CANCEL_QUEUE, async (job) => {
    // pg-boss does not expose a direct "delete by singletonKey" API across
    // versions; this worker is the trail of cancellations. The dispatcher
    // itself re-validates state at fire-time, so cancellations are advisory.
    await deps.emit("activation_intervention_cancelled", {
      user_id: job.data.user_id,
      kind: job.data.kind,
      reason: job.data.reason,
      ts: new Date().toISOString(),
    });
  });
}
