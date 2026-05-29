/**
 * DNC (Do-Not-Call) list adapter.
 *
 * Implements the DncChecker contract used by `@funnel/revtry`'s placeOutboundCall:
 *   - Federal: FTC National DNC Registry (https://telemarketing.donotcall.gov/)
 *   - State:   per-state registries (a few states maintain separate lists)
 *   - Internal: workspace-level suppression list (opt-outs the workspace owns)
 *
 * Production wiring:
 *   - Federal DNC requires registered SAN + telephone-number download or the
 *     "Reassigned Numbers Database" tier-1 API. We never store raw E.164 in our
 *     side-cache — we store sha256(e164) only.
 *   - State DNC registries vary; we hit them via per-state HTTPS endpoints
 *     when DNC_STATE_<ISO>_URL is set in env.
 *   - Internal list is just a DB lookup against the suppression store.
 *
 * Caching:
 *   - All lookups are cached by sha256(e164) with a 24h TTL. The cache is
 *     in-process (LRU) by default; production swaps in Redis via the injected
 *     KVStore.
 *
 * Hard-gate guarantee:
 *   - This module always fails *closed*: if a check throws, we return TRUE
 *     (i.e., "on DNC"). Telephony providers prefer false positives over
 *     accidental TCPA violations.
 */

import crypto from "node:crypto";

export interface DncCheckResult {
  on_federal: boolean;
  on_state: boolean;
  on_internal: boolean;
  /** sha256 of E.164 (hex, 64 chars). Stored, not the raw number. */
  e164_hash: string;
  checked_at: string;
  /** Source of the verdict — useful for audit logs. */
  reasons: string[];
}

export interface KVStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSec: number): Promise<void>;
}

export interface InternalSuppressionStore {
  isSuppressed(e164: string): Promise<boolean>;
}

export interface DncAdapterConfig {
  /** FTC National DNC SAN (Subscription Account Number). */
  federalSan?: string;
  /** Optional federal lookup endpoint override (defaults to the FTC API). */
  federalEndpoint?: string;
  /** Per-state lookup endpoints (keyed by uppercase ISO-2 code). */
  stateEndpoints?: Record<string, string>;
  /** TTL for cached results. Default 24h. */
  cacheTtlSec?: number;
  /** Cache backing store. Defaults to in-process LRU. */
  cache?: KVStore;
  /** Workspace-level suppression list. Required in production. */
  internal?: InternalSuppressionStore;
  /** Override the global fetch — for tests + tracing. */
  fetchImpl?: typeof fetch;
  /** Skip network calls — useful in dev / CI. Returns false on all checks. */
  offlineMode?: boolean;
}

const DEFAULT_TTL = 24 * 60 * 60;
const FEDERAL_DEFAULT = "https://telemarketing.donotcall.gov/registry/api/v1/lookup";

function sha256Hex(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex");
}

/** Minimal in-process LRU. Process-wide for the lifetime of the worker. */
class MemoryKV implements KVStore {
  private map = new Map<string, { v: string; exp: number }>();
  private readonly cap: number;
  constructor(cap = 50_000) {
    this.cap = cap;
  }
  async get(key: string): Promise<string | null> {
    const row = this.map.get(key);
    if (!row) return null;
    if (Date.now() > row.exp) {
      this.map.delete(key);
      return null;
    }
    // LRU touch.
    this.map.delete(key);
    this.map.set(key, row);
    return row.v;
  }
  async set(key: string, value: string, ttlSec: number): Promise<void> {
    this.map.set(key, { v: value, exp: Date.now() + ttlSec * 1000 });
    while (this.map.size > this.cap) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) break;
      this.map.delete(oldest);
    }
  }
}

export class DncAdapter {
  private readonly federalSan?: string;
  private readonly federalEndpoint: string;
  private readonly stateEndpoints: Record<string, string>;
  private readonly cacheTtlSec: number;
  private readonly cache: KVStore;
  private readonly internal: InternalSuppressionStore | undefined;
  private readonly fetch: typeof fetch;
  private readonly offline: boolean;

  constructor(cfg: DncAdapterConfig = {}) {
    this.federalSan = cfg.federalSan ?? process.env.FTC_DNC_SAN;
    this.federalEndpoint = cfg.federalEndpoint ?? process.env.FTC_DNC_ENDPOINT ?? FEDERAL_DEFAULT;
    this.stateEndpoints = { ...stateEndpointsFromEnv(), ...(cfg.stateEndpoints ?? {}) };
    this.cacheTtlSec = cfg.cacheTtlSec ?? DEFAULT_TTL;
    this.cache = cfg.cache ?? new MemoryKV();
    this.internal = cfg.internal;
    this.fetch = cfg.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.offline =
      cfg.offlineMode ??
      (process.env.DNC_OFFLINE_MODE === "1" || !this.federalSan); // no SAN ⇒ offline-only by default
  }

  /**
   * Full check — federal + state + internal. Use this when you want a
   * structured audit record. Returns the `e164_hash` so callers can persist
   * the verdict without persisting the raw number.
   */
  async check(e164: string, state_iso2: string | null | undefined): Promise<DncCheckResult> {
    const hash = sha256Hex(e164);
    const reasons: string[] = [];

    const cached = await this.readCache(hash, state_iso2 ?? null);
    if (cached) return cached;

    let on_federal = false;
    let on_state = false;
    let on_internal = false;

    try {
      on_internal = (await this.internal?.isSuppressed(e164)) ?? false;
      if (on_internal) reasons.push("internal_suppression");
    } catch (err) {
      reasons.push(`internal_error:${stringifyErr(err)}`);
      on_internal = true; // fail closed
    }

    if (!this.offline) {
      try {
        on_federal = await this.lookupFederal(e164);
        if (on_federal) reasons.push("federal_dnc");
      } catch (err) {
        reasons.push(`federal_error:${stringifyErr(err)}`);
        on_federal = true; // fail closed
      }

      if (state_iso2) {
        try {
          on_state = await this.lookupState(e164, state_iso2.toUpperCase());
          if (on_state) reasons.push(`state_dnc:${state_iso2.toUpperCase()}`);
        } catch (err) {
          reasons.push(`state_error:${stringifyErr(err)}`);
          on_state = true; // fail closed
        }
      }
    }

    const verdict: DncCheckResult = {
      on_federal,
      on_state,
      on_internal,
      e164_hash: hash,
      checked_at: new Date().toISOString(),
      reasons,
    };
    await this.writeCache(hash, state_iso2 ?? null, verdict);
    return verdict;
  }

  /** Federal-only convenience. */
  async isOnFederalDnc(e164: string): Promise<boolean> {
    if (this.offline) return false;
    try {
      return await this.lookupFederal(e164);
    } catch {
      return true; // fail closed
    }
  }

  /** State-only convenience. */
  async isOnStateDnc(e164: string, state_iso2: string | null | undefined): Promise<boolean> {
    if (!state_iso2 || this.offline) return false;
    try {
      return await this.lookupState(e164, state_iso2.toUpperCase());
    } catch {
      return true;
    }
  }

  /** Internal suppression convenience. */
  async isOnInternalDnc(e164: string): Promise<boolean> {
    if (!this.internal) return false;
    try {
      return await this.internal.isSuppressed(e164);
    } catch {
      return true;
    }
  }

  /* ---------------------------------------------------------------- */
  /* Internals                                                        */
  /* ---------------------------------------------------------------- */

  private async lookupFederal(e164: string): Promise<boolean> {
    if (!this.federalSan) return false;
    const url = `${this.federalEndpoint}?san=${encodeURIComponent(
      this.federalSan,
    )}&phone=${encodeURIComponent(e164)}`;
    const res = await this.fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      // 404 = not found in registry, 200 = found.
      if (res.status === 404) return false;
      throw new Error(`federal_dnc_http_${res.status}`);
    }
    const body = (await res.json().catch(() => ({}))) as { listed?: boolean; on_dnc?: boolean };
    return Boolean(body.listed ?? body.on_dnc ?? true);
  }

  private async lookupState(e164: string, state_iso2: string): Promise<boolean> {
    const endpoint = this.stateEndpoints[state_iso2];
    if (!endpoint) return false;
    const url = `${endpoint}?phone=${encodeURIComponent(e164)}`;
    const res = await this.fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      if (res.status === 404) return false;
      throw new Error(`state_dnc_http_${res.status}`);
    }
    const body = (await res.json().catch(() => ({}))) as { listed?: boolean; on_dnc?: boolean };
    return Boolean(body.listed ?? body.on_dnc ?? true);
  }

  private cacheKey(hash: string, state_iso2: string | null): string {
    return `dnc:${hash}:${state_iso2 ?? "_"}`;
  }

  private async readCache(hash: string, state_iso2: string | null): Promise<DncCheckResult | null> {
    const raw = await this.cache.get(this.cacheKey(hash, state_iso2));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as DncCheckResult;
    } catch {
      return null;
    }
  }

  private async writeCache(
    hash: string,
    state_iso2: string | null,
    result: DncCheckResult,
  ): Promise<void> {
    try {
      await this.cache.set(this.cacheKey(hash, state_iso2), JSON.stringify(result), this.cacheTtlSec);
    } catch {
      // cache errors are non-fatal
    }
  }
}

function stateEndpointsFromEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of Object.keys(process.env)) {
    const m = /^DNC_STATE_([A-Z]{2})_URL$/.exec(key);
    if (m && process.env[key]) out[m[1]!] = process.env[key]!;
  }
  return out;
}

function stringifyErr(err: unknown): string {
  if (err instanceof Error) return err.message.slice(0, 80);
  return String(err).slice(0, 80);
}

/* ---------------------------------------------------------------- */
/* Module-level singleton + factory                                 */
/* ---------------------------------------------------------------- */

let _shared: DncAdapter | null = null;

export function getDncAdapter(cfg?: DncAdapterConfig): DncAdapter {
  if (_shared) return _shared;
  _shared = new DncAdapter(cfg);
  return _shared;
}

export function __resetDncAdapterForTests(): void {
  _shared = null;
}

export const dncFactory = (config?: Record<string, unknown>) =>
  new DncAdapter({
    federalSan: (config?.federalSan as string) ?? process.env.FTC_DNC_SAN,
    offlineMode: process.env.DNC_OFFLINE_MODE === "1",
  });
