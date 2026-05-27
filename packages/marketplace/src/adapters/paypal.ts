/**
 * PayPal Payouts adapter implementing `PayPalPort`.
 *
 * Uses the REST API directly (avoids the heavy `@paypal/paypal-server-sdk`
 * surface; the marketplace only needs the Payouts endpoint). Auth via OAuth2
 * client_credentials grant, token cached in-memory for 8 hours.
 */

import { Buffer } from "node:buffer";

import type { PayPalPort } from "../port.js";
import { MarketplaceError } from "../types.js";

export interface PayPalAdapterConfig {
  client_id: string;
  client_secret: string;
  base_url?: string; // https://api-m.paypal.com (live) or https://api-m.sandbox.paypal.com
}

export function createPayPalAdapter(cfg: PayPalAdapterConfig): PayPalPort {
  const baseUrl = cfg.base_url ?? "https://api-m.paypal.com";
  let cachedToken: { token: string; expires_at: number } | null = null;

  async function getToken(): Promise<string> {
    if (cachedToken && cachedToken.expires_at > Date.now() + 60_000) return cachedToken.token;
    const auth = Buffer.from(`${cfg.client_id}:${cfg.client_secret}`).toString("base64");
    const res = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
    if (!res.ok) {
      throw new MarketplaceError("PayPal auth failed.", "PAYPAL_AUTH_FAILED", 502, {
        status: res.status,
      });
    }
    const json = (await res.json()) as { access_token: string; expires_in: number };
    cachedToken = {
      token: json.access_token,
      expires_at: Date.now() + json.expires_in * 1000,
    };
    return cachedToken.token;
  }

  return {
    async sendPayout(args) {
      const token = await getToken();
      const res = await fetch(`${baseUrl}/v1/payments/payouts`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "PayPal-Request-Id": args.idempotency_key,
        },
        body: JSON.stringify({
          sender_batch_header: {
            sender_batch_id: args.idempotency_key,
            email_subject: "You have a payout from GoFunnelAI",
            email_message: args.description,
          },
          items: [
            {
              recipient_type: "EMAIL",
              amount: {
                value: (args.amount_usd_cents / 100).toFixed(2),
                currency: "USD",
              },
              receiver: args.payout_email,
              note: args.description,
              sender_item_id: args.idempotency_key,
            },
          ],
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new MarketplaceError("PayPal payout failed.", "PAYPAL_PAYOUT_FAILED", 502, {
          status: res.status,
          body: body.slice(0, 400),
        });
      }
      const json = (await res.json()) as { batch_header: { payout_batch_id: string } };
      return { payout_batch_id: json.batch_header.payout_batch_id };
    },
  };
}
