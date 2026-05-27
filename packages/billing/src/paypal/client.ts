/**
 * PayPal client initialization.
 *
 * Wraps `@paypal/paypal-server-sdk` so the rest of the package never reads
 * env vars directly. Supports sandbox/live switching via PAYPAL_ENV.
 */

import { Client, Environment, LogLevel } from "@paypal/paypal-server-sdk";

import { BillingError } from "../types.js";

export interface PayPalConfig {
  client_id: string;
  client_secret: string;
  environment: "sandbox" | "live";
  /** Webhook ID issued by PayPal when you register a webhook URL. */
  webhook_id: string;
  /** Optional custom request timeout in ms. */
  timeout_ms?: number;
}

let cached: { client: Client; config: PayPalConfig } | null = null;

export function configurePayPal(config: PayPalConfig): void {
  cached = { client: buildClient(config), config };
}

export function getPayPalClient(): Client {
  if (!cached) {
    const env = loadConfigFromEnv();
    cached = { client: buildClient(env), config: env };
  }
  return cached.client;
}

export function getPayPalConfig(): PayPalConfig {
  if (!cached) {
    const env = loadConfigFromEnv();
    cached = { client: buildClient(env), config: env };
  }
  return cached.config;
}

function buildClient(config: PayPalConfig): Client {
  return new Client({
    clientCredentialsAuthCredentials: {
      oAuthClientId: config.client_id,
      oAuthClientSecret: config.client_secret,
    },
    environment: config.environment === "live" ? Environment.Production : Environment.Sandbox,
    timeout: config.timeout_ms ?? 30_000,
    logging: {
      logLevel: LogLevel.Warn,
      logRequest: { logBody: false },
      logResponse: { logHeaders: false },
    },
  });
}

function loadConfigFromEnv(): PayPalConfig {
  const client_id = process.env.PAYPAL_CLIENT_ID;
  const client_secret = process.env.PAYPAL_CLIENT_SECRET;
  const webhook_id = process.env.PAYPAL_WEBHOOK_ID;
  const env = (process.env.PAYPAL_ENV ?? "sandbox") as "sandbox" | "live";
  if (!client_id || !client_secret || !webhook_id) {
    throw new BillingError(
      "PayPal not configured: set PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_WEBHOOK_ID",
      "paypal.not_configured",
      500,
    );
  }
  return { client_id, client_secret, webhook_id, environment: env };
}

/**
 * Issue an OAuth bearer token. The SDK manages this internally, but our
 * webhook-verify endpoint (`/v1/notifications/verify-webhook-signature`)
 * is REST-only and requires the token explicitly.
 */
export async function getAccessToken(): Promise<string> {
  const config = getPayPalConfig();
  const base = config.environment === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
  const auth = Buffer.from(`${config.client_id}:${config.client_secret}`).toString("base64");
  const res = await fetch(`${base}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) {
    throw new BillingError(
      `PayPal token request failed: ${res.status}`,
      "paypal.token_failed",
      502,
    );
  }
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

/** Helper: API base URL for direct REST calls. */
export function getPayPalApiBase(): string {
  const config = getPayPalConfig();
  return config.environment === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}
