/**
 * Adapter registry. Single map keyed by providerKey.
 * The orchestrator never imports adapters directly — it asks the registry.
 */

import type { AdapterFactory, ProviderAdapter } from "./types.js";

const FACTORIES = new Map<string, AdapterFactory>();
const SINGLETONS = new Map<string, ProviderAdapter>();

export function registerAdapter(name: string, factory: AdapterFactory): void {
  if (FACTORIES.has(name)) {
    throw new Error(`Adapter "${name}" already registered`);
  }
  FACTORIES.set(name, factory);
}

/**
 * Resolve an adapter by provider key. Returns a cached singleton per
 * `name`+`config`-hash so connections aren't churned per call.
 */
export function getAdapter<T extends ProviderAdapter = ProviderAdapter>(
  name: string,
  config?: Record<string, unknown>,
): T {
  const cacheKey = `${name}::${configHash(config)}`;
  const cached = SINGLETONS.get(cacheKey);
  if (cached) return cached as T;

  const factory = FACTORIES.get(name);
  if (!factory) {
    throw new Error(`Unknown adapter "${name}". Registered: ${[...FACTORIES.keys()].join(", ")}`);
  }
  const adapter = factory(config);
  SINGLETONS.set(cacheKey, adapter);
  return adapter as T;
}

/** Test-only: clear singletons + factories. */
export function _resetRegistry(): void {
  FACTORIES.clear();
  SINGLETONS.clear();
}

export function listAdapters(): string[] {
  return [...FACTORIES.keys()].sort();
}

function configHash(config?: Record<string, unknown>): string {
  if (!config) return "default";
  try {
    return JSON.stringify(Object.entries(config).sort());
  } catch {
    return Math.random().toString(36).slice(2);
  }
}
