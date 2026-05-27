/**
 * Google Ads doesn't have classic webhooks — we listen to Pub/Sub push messages.
 * Push messages carry an Authorization: Bearer <ID token> we verify against the
 * service account email. In tests we use a static "service account" token.
 */
import { createHmac } from "node:crypto";

const SECRET = process.env.GOOGLE_ADS_WEBHOOK_SECRET ?? "test-google-ads-secret";

export function gadsAuthHeader(): string {
  // Stand-in: a deterministic test token. Real verification uses JWKs.
  return "Bearer test-google-ads-id-token";
}

export function gadsHmacHeader(body: string): string {
  return createHmac("sha256", SECRET).update(body).digest("hex");
}

export const GADS_CONVERSION_UPLOAD = {
  message: {
    data: Buffer.from(
      JSON.stringify({
        customerId: "123-456-7890",
        conversionAction: "customers/1234567890/conversionActions/55555",
        conversionDateTime: "2025-01-01 00:00:00+00:00",
        conversionValue: 49.0,
        currencyCode: "USD",
      }),
    ).toString("base64"),
    messageId: "gads-msg-1",
    publishTime: "2025-01-01T00:00:00Z",
  },
  subscription: "projects/funnel-test/subscriptions/google-ads-conversions",
};

export const GADS_ACCOUNT_SUSPENDED = {
  message: {
    data: Buffer.from(
      JSON.stringify({ customerId: "123-456-7890", status: "SUSPENDED" }),
    ).toString("base64"),
    messageId: "gads-msg-2",
  },
};
