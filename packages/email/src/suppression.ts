/**
 * Suppression list + audit.
 *
 *   - Hard bounces, complaints, manual blocks all flow into a single store.
 *   - Resend webhooks materialize new entries.
 *   - `send()` checks against this before dispatch.
 */

export type SuppressionReason =
  | "hard_bounce"
  | "complaint"
  | "unsubscribe"
  | "manual_block"
  | "spamtrap"
  | "invalid_address";

export interface SuppressionEntry {
  email_hash: string;       // SHA-256 of lowercased email
  reason: SuppressionReason;
  source: string;           // "resend.webhook" | "unsubscribe.page" | "ops"
  added_at: string;
}

export interface SuppressionStore {
  has(email_hash: string): Promise<boolean>;
  add(entry: SuppressionEntry): Promise<void>;
  list(limit: number, offset?: number): Promise<SuppressionEntry[]>;
  remove(email_hash: string): Promise<void>;
}

export class InMemorySuppressionStore implements SuppressionStore {
  private rows = new Map<string, SuppressionEntry>();
  async has(email_hash: string): Promise<boolean> {
    return this.rows.has(email_hash);
  }
  async add(entry: SuppressionEntry): Promise<void> {
    this.rows.set(entry.email_hash, entry);
  }
  async list(limit: number, offset = 0): Promise<SuppressionEntry[]> {
    return [...this.rows.values()].slice(offset, offset + limit);
  }
  async remove(email_hash: string): Promise<void> {
    this.rows.delete(email_hash);
  }
}

/** Stable hash for an email — case-normalized first, then SHA-256. */
export async function hashEmail(email: string): Promise<string> {
  const norm = email.trim().toLowerCase();
  // Use Web Crypto if available; fall back to a simple FNV.
  if (typeof crypto !== "undefined" && (crypto as { subtle?: SubtleCrypto }).subtle) {
    const buf = new TextEncoder().encode(norm);
    const digest = await crypto.subtle.digest("SHA-256", buf);
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  // FNV-1a 32-bit fallback.
  let h = 0x811c9dc5;
  for (let i = 0; i < norm.length; i++) {
    h ^= norm.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}
