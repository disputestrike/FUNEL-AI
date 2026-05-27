import { http, HttpResponse } from "msw";

export const stripeHandlers = [
  http.post("https://api.stripe.com/v1/customers", () =>
    HttpResponse.json({ id: "cus_test", object: "customer", email: "test@example.com" }),
  ),
  http.post("https://api.stripe.com/v1/subscriptions", () =>
    HttpResponse.json({
      id: "sub_test",
      object: "subscription",
      status: "active",
      current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400,
    }),
  ),
  http.delete("https://api.stripe.com/v1/subscriptions/:id", () =>
    HttpResponse.json({ id: "sub_test", status: "canceled" }),
  ),
  http.post("https://api.stripe.com/v1/refunds", () =>
    HttpResponse.json({ id: "re_test", object: "refund", status: "succeeded" }),
  ),
  http.post("https://api.stripe.com/v1/tax/calculations", () =>
    HttpResponse.json({ id: "taxcalc_test", amount_total: 100, tax_amount_exclusive: 8 }),
  ),
];
