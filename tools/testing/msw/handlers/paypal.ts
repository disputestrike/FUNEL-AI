import { http, HttpResponse } from "msw";

export const paypalHandlers = [
  // OAuth token.
  http.post("https://api-m.sandbox.paypal.com/v1/oauth2/token", () =>
    HttpResponse.json({ access_token: "test-paypal-token", expires_in: 3600, token_type: "Bearer" }),
  ),
  // Verify webhook signature endpoint — mock as VERIFICATION_SUCCESS when caller passes header.
  http.post(
    "https://api-m.sandbox.paypal.com/v1/notifications/verify-webhook-signature",
    async ({ request }) => {
      const body = (await request.json()) as { webhook_event?: { id?: string } };
      const status = body.webhook_event?.id?.startsWith("BAD_") ? "FAILURE" : "SUCCESS";
      return HttpResponse.json({ verification_status: status });
    },
  ),
  // Subscriptions create / cancel / pause / activate.
  http.post("https://api-m.sandbox.paypal.com/v1/billing/subscriptions", () =>
    HttpResponse.json({ id: "I-TESTSUB123", status: "APPROVAL_PENDING", links: [] }),
  ),
  http.post(
    "https://api-m.sandbox.paypal.com/v1/billing/subscriptions/:id/cancel",
    () => new HttpResponse(null, { status: 204 }),
  ),
  http.post(
    "https://api-m.sandbox.paypal.com/v1/billing/subscriptions/:id/suspend",
    () => new HttpResponse(null, { status: 204 }),
  ),
  http.post(
    "https://api-m.sandbox.paypal.com/v1/billing/subscriptions/:id/activate",
    () => new HttpResponse(null, { status: 204 }),
  ),
  http.post(
    "https://api-m.sandbox.paypal.com/v2/payments/captures/:id/refund",
    () => HttpResponse.json({ id: "REF_TEST_1", status: "COMPLETED" }),
  ),
];
