/**
 * PayPal Subscriptions API wrapper.
 *
 * The official @paypal/paypal-server-sdk doesn't yet expose Catalog Products
 * or Billing Plans as typed controllers — we hit the REST endpoints directly
 * with a fetch wrapper. The Subscriptions resource is exposed under the same
 * URL family (/v1/billing/subscriptions). Auth uses an OAuth bearer token
 * fetched lazily via client.ts.
 *
 * Endpoints implemented (per https://developer.paypal.com/docs/api/subscriptions/v1/):
 *  - POST /v1/catalogs/products
 *  - POST /v1/billing/plans
 *  - POST /v1/billing/subscriptions
 *  - GET  /v1/billing/subscriptions/{id}
 *  - PATCH /v1/billing/subscriptions/{id}
 *  - POST /v1/billing/subscriptions/{id}/revise        (upgrade/downgrade)
 *  - POST /v1/billing/subscriptions/{id}/suspend
 *  - POST /v1/billing/subscriptions/{id}/activate
 *  - POST /v1/billing/subscriptions/{id}/cancel
 *  - POST /v1/billing/subscriptions/{id}/capture       (one-time charge during pending)
 *  - GET  /v1/billing/subscriptions/{id}/transactions
 */

import { randomUUID } from "node:crypto";

import { BillingError } from "../types.js";
import { getAccessToken, getPayPalApiBase } from "./client.js";

export interface PayPalProduct {
  id?: string;
  name: string;
  description?: string;
  type: "PHYSICAL" | "DIGITAL" | "SERVICE";
  category?: string;
}

export interface PayPalBillingCycle {
  frequency: { interval_unit: "DAY" | "WEEK" | "MONTH" | "YEAR"; interval_count: number };
  tenure_type: "REGULAR" | "TRIAL";
  sequence: number;
  total_cycles: number;
  pricing_scheme: {
    fixed_price: { value: string; currency_code: string };
  };
}

export interface PayPalPlanInput {
  product_id: string;
  name: string;
  description?: string;
  status?: "ACTIVE" | "INACTIVE";
  billing_cycles: PayPalBillingCycle[];
  payment_preferences: {
    auto_bill_outstanding: boolean;
    setup_fee?: { value: string; currency_code: string };
    payment_failure_threshold: number;
  };
  taxes?: { percentage: string; inclusive: boolean };
}

export interface PayPalSubscriptionInput {
  plan_id: string;
  start_time?: string; // ISO-8601; defaults to now
  quantity?: string;
  subscriber: {
    name?: { given_name: string; surname?: string };
    email_address: string;
  };
  custom_id?: string; // we use workspace_id
  application_context: {
    brand_name: string;
    locale?: string;
    shipping_preference?: "NO_SHIPPING" | "SET_PROVIDED_ADDRESS" | "GET_FROM_FILE";
    user_action: "SUBSCRIBE_NOW" | "CONTINUE";
    return_url: string;
    cancel_url: string;
    payment_method?: { payer_selected: string; payee_preferred: string };
  };
}

export interface PayPalSubscriptionResponse {
  id: string;
  status:
    | "APPROVAL_PENDING"
    | "APPROVED"
    | "ACTIVE"
    | "SUSPENDED"
    | "CANCELLED"
    | "EXPIRED";
  status_update_time?: string;
  plan_id: string;
  start_time?: string;
  quantity?: string;
  subscriber?: { email_address?: string; payer_id?: string };
  billing_info?: {
    next_billing_time?: string;
    last_payment?: { amount?: { value: string; currency_code: string }; time?: string };
    cycle_executions?: Array<{
      tenure_type: string;
      sequence: number;
      cycles_completed: number;
      cycles_remaining: number;
    }>;
    failed_payments_count?: number;
  };
  custom_id?: string;
  links?: Array<{ href: string; rel: string; method: string }>;
}

async function paypalFetch<T>(
  method: "GET" | "POST" | "PATCH",
  path: string,
  body?: unknown,
  opts: { idempotency_key?: string } = {},
): Promise<T> {
  const token = await getAccessToken();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (opts.idempotency_key) headers["PayPal-Request-Id"] = opts.idempotency_key;

  const res = await fetch(`${getPayPalApiBase()}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  // 204 No Content for several mutations
  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const parsed = text ? (safeJson(text) as Record<string, unknown>) : {};

  if (!res.ok) {
    const code = (parsed?.name as string) || `paypal_${res.status}`;
    throw new BillingError(
      `PayPal ${method} ${path} failed: ${res.status} ${code}`,
      `paypal.${code.toLowerCase()}`,
      res.status >= 500 ? 502 : res.status,
      { paypal_response: parsed },
    );
  }
  return parsed as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

export async function createProduct(input: PayPalProduct): Promise<{ id: string }> {
  const res = await paypalFetch<{ id: string }>(
    "POST",
    "/v1/catalogs/products",
    input,
    { idempotency_key: `prod_${randomUUID()}` },
  );
  return { id: res.id };
}

export async function createPlan(input: PayPalPlanInput): Promise<{ id: string }> {
  const res = await paypalFetch<{ id: string }>(
    "POST",
    "/v1/billing/plans",
    input,
    { idempotency_key: `plan_${randomUUID()}` },
  );
  return { id: res.id };
}

export async function activatePlan(plan_id: string): Promise<void> {
  await paypalFetch<void>("POST", `/v1/billing/plans/${plan_id}/activate`);
}

export async function deactivatePlan(plan_id: string): Promise<void> {
  await paypalFetch<void>("POST", `/v1/billing/plans/${plan_id}/deactivate`);
}

export async function createSubscription(
  input: PayPalSubscriptionInput,
  idempotency_key?: string,
): Promise<PayPalSubscriptionResponse> {
  return paypalFetch<PayPalSubscriptionResponse>(
    "POST",
    "/v1/billing/subscriptions",
    input,
    { idempotency_key: idempotency_key ?? `sub_${randomUUID()}` },
  );
}

export async function getSubscription(id: string): Promise<PayPalSubscriptionResponse> {
  return paypalFetch<PayPalSubscriptionResponse>("GET", `/v1/billing/subscriptions/${id}`);
}

export async function listAllActiveSubscriptions(args: {
  page_size?: number;
}): Promise<PayPalSubscriptionResponse[]> {
  // PayPal's list endpoint is plan-scoped; for reconciliation we iterate
  // known plan IDs. Callers should pass the union of plan_ids to recon.ts.
  void args;
  throw new BillingError(
    "Use reconciliation.ts:reconcileSubscriptionsAgainstPayPal — PayPal does not expose a global subscription list endpoint.",
    "paypal.no_global_list",
    501,
  );
}

/**
 * Update a subscription's plan, quantity, or shipping. Triggers a redirect to
 * PayPal-hosted approval flow per their docs.
 */
export async function reviseSubscription(
  id: string,
  body: {
    plan_id?: string;
    quantity?: string;
    shipping_amount?: { value: string; currency_code: string };
    application_context?: { return_url: string; cancel_url: string };
  },
): Promise<{ approval_url?: string; raw: PayPalSubscriptionResponse }> {
  const res = await paypalFetch<PayPalSubscriptionResponse>(
    "POST",
    `/v1/billing/subscriptions/${id}/revise`,
    body,
    { idempotency_key: `rev_${randomUUID()}` },
  );
  const approval = res.links?.find((l) => l.rel === "approve")?.href;
  return { approval_url: approval, raw: res };
}

/**
 * In-place attribute update (e.g. billing_info.outstanding_balance). PayPal
 * accepts JSON Patch. Use a typed wrapper for the common cases.
 */
export async function updateSubscription(
  id: string,
  patches: Array<{ op: "add" | "replace" | "remove"; path: string; value?: unknown }>,
): Promise<void> {
  await paypalFetch<void>("PATCH", `/v1/billing/subscriptions/${id}`, patches);
}

export async function suspendSubscription(id: string, reason: string): Promise<void> {
  await paypalFetch<void>("POST", `/v1/billing/subscriptions/${id}/suspend`, { reason });
}

export async function activateSubscription(id: string, reason: string): Promise<void> {
  await paypalFetch<void>("POST", `/v1/billing/subscriptions/${id}/activate`, { reason });
}

export async function cancelSubscription(id: string, reason: string): Promise<void> {
  await paypalFetch<void>("POST", `/v1/billing/subscriptions/${id}/cancel`, { reason });
}

/** Capture an authorized one-time amount on a subscription (e.g. proration upcharge). */
export async function captureSubscription(
  id: string,
  body: { note: string; capture_type: "OUTSTANDING_BALANCE"; amount: { value: string; currency_code: string } },
): Promise<{ id: string; status: string }> {
  return paypalFetch<{ id: string; status: string }>(
    "POST",
    `/v1/billing/subscriptions/${id}/capture`,
    body,
    { idempotency_key: `cap_${randomUUID()}` },
  );
}

export interface PayPalTransaction {
  id: string;
  status: string;
  amount_with_breakdown: {
    gross_amount: { value: string; currency_code: string };
    fee_amount?: { value: string; currency_code: string };
    net_amount?: { value: string; currency_code: string };
  };
  payer_name?: { given_name?: string; surname?: string };
  payer_email?: string;
  time: string;
}

export async function listSubscriptionTransactions(args: {
  subscription_id: string;
  start_time: string;
  end_time: string;
}): Promise<PayPalTransaction[]> {
  const qs = new URLSearchParams({
    start_time: args.start_time,
    end_time: args.end_time,
  });
  const res = await paypalFetch<{ transactions: PayPalTransaction[] }>(
    "GET",
    `/v1/billing/subscriptions/${args.subscription_id}/transactions?${qs.toString()}`,
  );
  return res.transactions ?? [];
}
