/**
 * Stripe client init.
 *
 * `stripe` SDK is a singleton — we cache one instance per process. API version
 * is pinned (Doc 04 PAL: pin Stripe-Version for every call).
 */

import Stripe from "stripe";

import { BillingError } from "../types.js";

export interface StripeConfig {
  secret_key: string;
  webhook_secret: string;
  api_version: Stripe.LatestApiVersion;
}

let cached: { stripe: Stripe; config: StripeConfig } | null = null;

export function configureStripe(config: StripeConfig): void {
  cached = { stripe: new Stripe(config.secret_key, { apiVersion: config.api_version }), config };
}

export function getStripeClient(): Stripe {
  if (!cached) {
    const env = loadConfigFromEnv();
    cached = { stripe: new Stripe(env.secret_key, { apiVersion: env.api_version }), config: env };
  }
  return cached.stripe;
}

export function getStripeConfig(): StripeConfig {
  if (!cached) {
    const env = loadConfigFromEnv();
    cached = { stripe: new Stripe(env.secret_key, { apiVersion: env.api_version }), config: env };
  }
  return cached.config;
}

function loadConfigFromEnv(): StripeConfig {
  const secret_key = process.env.STRIPE_SECRET_KEY;
  const webhook_secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret_key || !webhook_secret) {
    throw new BillingError(
      "Stripe not configured: set STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET",
      "stripe.not_configured",
      500,
    );
  }
  return {
    secret_key,
    webhook_secret,
    api_version: (process.env.STRIPE_API_VERSION as Stripe.LatestApiVersion) ?? "2024-11-20.acacia",
  };
}
