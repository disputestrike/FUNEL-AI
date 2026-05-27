/**
 * OAuth state + token storage abstractions.
 *
 * `OAuthStateStore`  → short-lived (10 min) per-attempt state. Goes in KV.
 * `TokenStore`       → long-lived encrypted tokens. Goes in vault, referenced
 *                      from `integration_connections.vault_path`.
 *
 * The package ships an in-memory implementation suitable for unit tests +
 * single-Worker dev. Apps wire production-grade implementations via DI.
 */

import { ulid } from "ulid";
import type { OAuthState, TokenBundle } from "../types.js";

export interface OAuthStateStore {
  put(state: OAuthState): Promise<string>;
  get(stateId: string): Promise<OAuthState | null>;
  delete(stateId: string): Promise<void>;
}

export interface TokenStore {
  /** Returns the vault path under which the token bundle is stored. */
  write(workspaceId: string, provider: string, tokens: TokenBundle): Promise<string>;
  read(workspaceId: string, provider: string): Promise<TokenBundle | null>;
  delete(workspaceId: string, provider: string): Promise<void>;
}

// -----------------------------------------------------------------------------
// In-memory implementations (test fixtures + dev only).
// -----------------------------------------------------------------------------

export class InMemoryOAuthStateStore implements OAuthStateStore {
  private readonly store = new Map<string, OAuthState>();
  async put(state: OAuthState): Promise<string> {
    const id = `oas_${ulid()}`;
    this.store.set(id, state);
    return id;
  }
  async get(stateId: string): Promise<OAuthState | null> {
    const v = this.store.get(stateId);
    if (!v) return null;
    if (new Date(v.expiresAt).getTime() < Date.now()) {
      this.store.delete(stateId);
      return null;
    }
    return v;
  }
  async delete(stateId: string): Promise<void> {
    this.store.delete(stateId);
  }
}

export class InMemoryTokenStore implements TokenStore {
  private readonly store = new Map<string, TokenBundle>();
  private key(workspaceId: string, provider: string): string {
    return `${workspaceId}::${provider}`;
  }
  async write(workspaceId: string, provider: string, tokens: TokenBundle): Promise<string> {
    const path = `vault://${workspaceId}/${provider}`;
    this.store.set(this.key(workspaceId, provider), tokens);
    return path;
  }
  async read(workspaceId: string, provider: string): Promise<TokenBundle | null> {
    return this.store.get(this.key(workspaceId, provider)) ?? null;
  }
  async delete(workspaceId: string, provider: string): Promise<void> {
    this.store.delete(this.key(workspaceId, provider));
  }
}
