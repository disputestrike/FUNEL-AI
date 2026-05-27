/**
 * Shared types reused across adapters, the OAuth orchestrator, the webhook
 * router, and the health checker.
 */

import type { ProviderEvent } from "./pal/types.js";

/** Persisted OAuth state — written to KV during connect, consumed in callback. */
export interface OAuthState {
  workspaceId: string;
  provider: string;
  csrf: string;
  /** PKCE verifier when applicable. */
  codeVerifier?: string;
  redirectUri: string;
  scopes: string[];
  createdAt: string;
  /** ISO timestamp. Default 10 min. */
  expiresAt: string;
  /** Free-form provider data (e.g. Meta business id, LinkedIn org id chosen during flow). */
  extra?: Record<string, unknown>;
}

/** Encrypted token bundle that lives in vault and is referenced from
 *  `integration_connections.vault_path`. */
export interface TokenBundle {
  accessToken: string;
  refreshToken?: string;
  /** ISO. */
  expiresAt?: string;
  /** Provider-specific (e.g. Google's scope, Meta's user_id). */
  metadata?: Record<string, unknown>;
}

/** Inbound webhook envelope as written to `raw_webhooks` table / R2. */
export interface InboundWebhook {
  id: string;
  provider: string;
  receivedAt: string;
  headers: Record<string, string>;
  body: string;
  /** Set true after the adapter's webhookVerify returned true. */
  verified: boolean;
}

/** Job we enqueue after a verified webhook is parsed into events. */
export interface WebhookJob {
  webhookEventId: string;
  provider: string;
  events: ProviderEvent[];
  enqueuedAt: string;
}
