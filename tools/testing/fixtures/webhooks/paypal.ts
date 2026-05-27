import { createHmac } from "node:crypto";

/**
 * Anonymised PayPal webhook payload replays.
 *
 * Real PayPal webhooks verify via the v1/notifications/verify-webhook-signature
 * endpoint (mocked in msw/handlers/paypal.ts) — but headers must still be present.
 */
export function paypalSignedHeaders(eventId = "EVT-TEST-1") {
  return {
    "paypal-auth-algo": "SHA256withRSA",
    "paypal-cert-url": "https://api.sandbox.paypal.com/v1/notifications/certs/CERT-TEST",
    "paypal-transmission-id": eventId,
    "paypal-transmission-sig": "test-sig",
    "paypal-transmission-time": new Date().toISOString(),
    "content-type": "application/json",
  };
}

export const PAYPAL_PAYMENT_SALE_COMPLETED = {
  id: "EVT-TEST-PAYMENT-SALE-COMPLETED",
  event_type: "PAYMENT.SALE.COMPLETED",
  create_time: "2025-01-01T00:00:00Z",
  resource_type: "sale",
  resource: {
    id: "SALE-TEST-1",
    state: "completed",
    amount: { total: "49.00", currency: "USD" },
    billing_agreement_id: "I-TESTSUB123",
  },
};

export const PAYPAL_BILLING_SUBSCRIPTION_CANCELLED = {
  id: "EVT-TEST-CANCELLED-1",
  event_type: "BILLING.SUBSCRIPTION.CANCELLED",
  create_time: "2025-01-01T00:00:00Z",
  resource_type: "subscription",
  resource: {
    id: "I-TESTSUB123",
    status: "CANCELLED",
    plan_id: "P-STARTER-TEST",
  },
};

export const PAYPAL_BILLING_SUBSCRIPTION_PAYMENT_FAILED = {
  id: "EVT-TEST-PAYMENT-FAILED-1",
  event_type: "BILLING.SUBSCRIPTION.PAYMENT.FAILED",
  create_time: "2025-01-01T00:00:00Z",
  resource_type: "subscription",
  resource: {
    id: "I-TESTSUB123",
    status: "ACTIVE",
    billing_info: { failed_payments_count: 1 },
  },
};

export const PAYPAL_REFUND_COMPLETED = {
  id: "EVT-TEST-REFUND-1",
  event_type: "PAYMENT.CAPTURE.REFUNDED",
  resource_type: "refund",
  resource: { id: "REF_TEST_1", status: "COMPLETED", amount: { value: "49.00", currency_code: "USD" } },
};

/** Used in security tests — replays with mutated id should be rejected. */
export const PAYPAL_INVALID_EVENT = {
  id: "BAD_EVT_TAMPERED",
  event_type: "BILLING.SUBSCRIPTION.CANCELLED",
  resource: { id: "I-TESTSUB123" },
};
