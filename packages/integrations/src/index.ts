/**
 * @funnel/integrations — public surface.
 *
 * Re-exports the PAL contract, the OAuth orchestrator, the webhook router,
 * and concrete provider adapters. Apps and workers should import from this
 * barrel rather than reaching into sub-paths, except for the deep entry
 * points listed in package.json (`./pal`, `./adapters`, `./oauth`, `./webhooks`,
 * `./health`).
 */

export * from "./types.js";
export * from "./pal/types.js";
export * from "./pal/errors.js";
export { BaseAdapter } from "./pal/base-adapter.js";
export type { BaseAdapterConfig } from "./pal/base-adapter.js";

// Adapter exports (named — keeps tree-shake friendly).
export { SignalwireAdapter, signalwireFactory } from "./adapters/signalwire.js";

// Image generation: Replicate (Flux/Ideogram/SDXL), stock (Unsplash/Pexels), R2 hosting.
export {
  ReplicateImageClient,
  REPLICATE_LIST_RATES,
  type ReplicateImageModel,
  type ReplicateRunInput,
  type ReplicateRunResult,
  type ReplicateClientConfig,
} from "./adapters/replicate.js";
export {
  StockClient,
  type StockSource,
  type StockLicense,
  type StockImage,
  type StockSearchInput,
  type StockClientConfig,
} from "./adapters/stock.js";
export {
  R2AssetsClient,
  type R2UploadInput,
  type R2UploadResult,
  type R2ClientConfig,
  type R2Bucket,
} from "./adapters/r2-assets.js";
export type {
  SignalwireConfig,
  SendSmsInput,
  SendSmsResult,
  PlaceVoiceCallInput,
  PlaceVoiceCallResult,
  LookupInput,
  LookupResult,
} from "./adapters/signalwire.js";

// DNC list (federal + state + internal). Used by the RevTry dial gate.
export {
  DncAdapter,
  dncFactory,
  getDncAdapter,
  __resetDncAdapterForTests,
  type DncAdapterConfig,
  type DncCheckResult,
  type KVStore,
  type InternalSuppressionStore,
} from "./adapters/dnc.js";

// Convenience accessor used by workers that import dynamically.
import { SignalwireAdapter, signalwireFactory } from "./adapters/signalwire.js";

let _signalwire: SignalwireAdapter | null = null;

/**
 * Lazily construct (and cache) a process-wide SignalWire adapter from env.
 * Workers call this rather than instantiating directly so config lives in one
 * place.
 */
export async function getSignalwireAdapter(): Promise<SignalwireAdapter> {
  if (_signalwire) return _signalwire;
  _signalwire = signalwireFactory() as SignalwireAdapter;
  return _signalwire;
}

/** Test helper — reset the cached adapter between specs. */
export function __resetSignalwireAdapterForTests(): void {
  _signalwire = null;
}
