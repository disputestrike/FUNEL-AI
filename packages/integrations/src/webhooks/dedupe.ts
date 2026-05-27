/**
 * Cross-process dedupe for webhook events. Production uses Cloudflare KV;
 * tests use the in-memory implementation.
 */

export interface DedupeStore {
  /** Returns true if `eventId` was already seen (i.e. duplicate). */
  seen(eventId: string): Promise<boolean>;
  /** Mark `eventId` as seen with `ttlSec` lifetime. */
  mark(eventId: string, ttlSec: number): Promise<void>;
}

export class InMemoryDedupeStore implements DedupeStore {
  private readonly store = new Map<string, number>();

  async seen(eventId: string): Promise<boolean> {
    const exp = this.store.get(eventId);
    if (!exp) return false;
    if (exp < Date.now()) {
      this.store.delete(eventId);
      return false;
    }
    return true;
  }

  async mark(eventId: string, ttlSec: number): Promise<void> {
    this.store.set(eventId, Date.now() + ttlSec * 1000);
  }
}
