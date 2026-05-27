import { createHmac } from "node:crypto";

const STRIPE_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "whsec_test_stripe";

/** Build a v1 Stripe-Signature header. */
export function stripeSignedHeader(payload: string, timestamp = Math.floor(Date.now() / 1000)): string {
  const signed = `${timestamp}.${payload}`;
  const v1 = createHmac("sha256", STRIPE_SECRET).update(signed).digest("hex");
  return `t=${timestamp},v1=${v1}`;
}

export const STRIPE_INVOICE_PAYMENT_FAILED = {
  id: "evt_test_invoice_payment_failed",
  object: "event",
  type: "invoice.payment_failed",
  data: {
    object: {
      id: "in_test_1",
      object: "invoice",
      customer: "cus_test",
      subscription: "sub_test",
      amount_due: 4900,
      attempt_count: 1,
    },
  },
};

export const STRIPE_INVOICE_PAYMENT_SUCCEEDED = {
  id: "evt_test_invoice_payment_succeeded",
  object: "event",
  type: "invoice.payment_succeeded",
  data: {
    object: {
      id: "in_test_2",
      object: "invoice",
      customer: "cus_test",
      subscription: "sub_test",
      amount_paid: 4900,
    },
  },
};

export const STRIPE_CUSTOMER_SUBSCRIPTION_DELETED = {
  id: "evt_test_sub_deleted",
  object: "event",
  type: "customer.subscription.deleted",
  data: { object: { id: "sub_test", customer: "cus_test", status: "canceled" } },
};

export const STRIPE_CHARGE_REFUNDED = {
  id: "evt_test_refund",
  object: "event",
  type: "charge.refunded",
  data: { object: { id: "ch_test", amount_refunded: 4900 } },
};
