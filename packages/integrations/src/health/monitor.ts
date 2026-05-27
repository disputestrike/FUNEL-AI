/**
 * Hourly health-check loop. For each registered adapter:
 *
 *   - Run `adapter.healthCheck()`.
 *   - If `ok = false`, raise a governance event (`integration_failed`) and
 *     bump the consecutive-failure counter for the provider.
 *   - After 3 consecutive failures across a 15-min window, page on-call.
 *   - On recovery emit `integration_recovered`.
 *
 * Rate-limit headroom tracking lives here too: callers report consumed quota
 * via `recordUsage(provider, ratio)`; the monitor emits a warning at >= 0.80
 * and an alert at >= 0.95.
 */

import type { HealthCheckResult, ProviderAdapter } from "../pal/types.js";

export type GovernanceEventName =
  | "integration_failed"
  | "integration_recovered"
  | "integration_rate_limit_warning"
  | "integration_rate_limit_alert"
  | "ad_rejected"
  | "integration_webhook_signature_failed";

export interface GovernanceEmitter {
  emit(name: GovernanceEventName, payload: Record<string, unknown>): Promise<void> | void;
}

export interface PagerDutyClient {
  page(severity: "info" | "warning" | "critical", routingKey: string, payload: Record<string, unknown>): Promise<void>;
}

export interface HealthMonitorDeps {
  adapters: Map<string, ProviderAdapter>;
  emitter: GovernanceEmitter;
  pager?: PagerDutyClient;
  /** Mapping of provider key → PagerDuty routing key. */
  pagerRoutingKeys?: Record<string, string>;
}

interface ProviderHealthState {
  consecutiveFailures: number;
  lastFailureAt?: string;
  lastSuccessAt?: string;
  rateUsageRatio: number;
}

export class HealthMonitor {
  private readonly state = new Map<string, ProviderHealthState>();
  constructor(private readonly deps: HealthMonitorDeps) {}

  /** Run one check cycle against all registered adapters. */
  async runOnce(): Promise<Record<string, HealthCheckResult>> {
    const out: Record<string, HealthCheckResult> = {};
    for (const [key, adapter] of this.deps.adapters) {
      const result = await adapter.healthCheck().catch(
        (err): HealthCheckResult => ({
          ok: false,
          latencyMs: 0,
          checkedAt: new Date().toISOString(),
          upstream: "down",
          notes: err instanceof Error ? err.message : String(err),
        }),
      );
      out[key] = result;
      await this.reconcile(key, result);
    }
    return out;
  }

  /** Adapters call this after every API request that exposes quota usage. */
  async recordUsage(provider: string, usedRatio: number): Promise<void> {
    const s = this.ensure(provider);
    s.rateUsageRatio = usedRatio;
    if (usedRatio >= 0.95) {
      await this.deps.emitter.emit("integration_rate_limit_alert", {
        provider,
        used_ratio: usedRatio,
      });
      if (this.deps.pager && this.deps.pagerRoutingKeys?.[provider]) {
        await this.deps.pager.page("warning", this.deps.pagerRoutingKeys[provider], {
          provider,
          used_ratio: usedRatio,
        });
      }
    } else if (usedRatio >= 0.8) {
      await this.deps.emitter.emit("integration_rate_limit_warning", {
        provider,
        used_ratio: usedRatio,
      });
    }
  }

  private ensure(provider: string): ProviderHealthState {
    let s = this.state.get(provider);
    if (!s) {
      s = { consecutiveFailures: 0, rateUsageRatio: 0 };
      this.state.set(provider, s);
    }
    return s;
  }

  private async reconcile(provider: string, result: HealthCheckResult): Promise<void> {
    const s = this.ensure(provider);
    if (result.ok) {
      const wasFailing = s.consecutiveFailures > 0;
      s.consecutiveFailures = 0;
      s.lastSuccessAt = result.checkedAt;
      if (wasFailing) {
        await this.deps.emitter.emit("integration_recovered", {
          provider,
          latency_ms: result.latencyMs,
        });
      }
      return;
    }
    s.consecutiveFailures += 1;
    s.lastFailureAt = result.checkedAt;
    await this.deps.emitter.emit("integration_failed", {
      provider,
      consecutive_failures: s.consecutiveFailures,
      notes: result.notes ?? null,
      upstream: result.upstream ?? "down",
    });
    if (s.consecutiveFailures >= 3 && this.deps.pager && this.deps.pagerRoutingKeys?.[provider]) {
      await this.deps.pager.page("critical", this.deps.pagerRoutingKeys[provider], {
        provider,
        consecutive_failures: s.consecutiveFailures,
        notes: result.notes ?? null,
      });
    }
  }

  /** Inspect current state — used by status-page endpoints. */
  snapshot(): Record<string, ProviderHealthState> {
    return Object.fromEntries(this.state);
  }
}
