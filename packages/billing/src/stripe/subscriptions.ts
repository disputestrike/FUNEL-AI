/**
 * Stripe Subscriptions API wrapper.
 *
 * Mirrors the PayPal adapter surface: customers, products, prices,
 * subscriptions, invoices, payment methods, billing portal.
 *
 * All amounts are USD cents (Stripe's native unit). Callers translate from
 * our internal micros (× 100 = cents) via the helpers in `proration.ts`.
 *
 * Doc 12 PRD 4 §9: same adapter shape as PayPal, feature-flagged behind
 * `release.billing.stripe`.
 */

import type Stripe from "stripe";

import { BillingError } from "../types.js";
import { getStripeClient } from "./client.js";

export async function createOrGetCustomer(args: {
  workspace_id: string;
  email: string;
  name?: string;
  metadata?: Record<string, string>;
}): Promise<Stripe.Customer> {
  const stripe = getStripeClient();
  const existing = await stripe.customers.list({ email: args.email, limit: 1 });
  if (existing.data[0]) {
    const customer = existing.data[0];
    if (customer.metadata.workspace_id !== args.workspace_id) {
      // Stripe doesn't enforce unique email; we keep the first match but
      // patch the workspace_id link so later lookups by workspace work.
      await stripe.customers.update(customer.id, {
        metadata: { ...customer.metadata, workspace_id: args.workspace_id },
      });
    }
    return customer;
  }
  return stripe.customers.create(
    {
      email: args.email,
      name: args.name,
      metadata: { workspace_id: args.workspace_id, ...(args.metadata ?? {}) },
    },
    { idempotencyKey: `cust_${args.workspace_id}` },
  );
}

export async function createProduct(args: {
  name: string;
  description?: string;
  metadata?: Record<string, string>;
}): Promise<Stripe.Product> {
  const stripe = getStripeClient();
  return stripe.products.create({
    name: args.name,
    description: args.description,
    metadata: args.metadata,
  });
}

export async function createPrice(args: {
  product_id: string;
  unit_amount_cents: number;
  currency: string;
  interval: "month" | "year";
  trial_period_days?: number;
  metadata?: Record<string, string>;
}): Promise<Stripe.Price> {
  const stripe = getStripeClient();
  return stripe.prices.create({
    product: args.product_id,
    unit_amount: args.unit_amount_cents,
    currency: args.currency.toLowerCase(),
    recurring: { interval: args.interval },
    metadata: args.metadata,
  });
}

export interface CreateStripeSubscriptionInput {
  workspace_id: string;
  customer_id: string;
  price_id: string;
  trial_period_days?: number;
  payment_method_id?: string;
  /** Whether to allow promotion codes at checkout (Stripe Checkout path). */
  metadata?: Record<string, string>;
  idempotency_key?: string;
  /** Stripe Tax — automatic calculation. */
  automatic_tax?: boolean;
}

export async function createSubscription(
  input: CreateStripeSubscriptionInput,
): Promise<Stripe.Subscription> {
  const stripe = getStripeClient();
  return stripe.subscriptions.create(
    {
      customer: input.customer_id,
      items: [{ price: input.price_id }],
      trial_period_days: input.trial_period_days,
      default_payment_method: input.payment_method_id,
      payment_settings: {
        payment_method_types: ["card"],
        save_default_payment_method: "on_subscription",
      },
      automatic_tax: input.automatic_tax ? { enabled: true } : undefined,
      expand: ["latest_invoice.payment_intent"],
      metadata: { workspace_id: input.workspace_id, ...(input.metadata ?? {}) },
    },
    {
      idempotencyKey: input.idempotency_key ?? `sub_${input.workspace_id}_${input.price_id}`,
    },
  );
}

export async function getSubscription(id: string): Promise<Stripe.Subscription> {
  return getStripeClient().subscriptions.retrieve(id);
}

/** Upgrade or downgrade. `proration_behavior='create_prorations'` for upgrades. */
export async function updateSubscription(args: {
  subscription_id: string;
  new_price_id: string;
  /** `create_prorations` for upgrade-now; `none` for downgrade-at-cycle-end. */
  proration_behavior: "create_prorations" | "none" | "always_invoice";
  /** Set true for downgrades — schedules the change for next cycle. */
  cancel_at_period_end?: boolean;
}): Promise<Stripe.Subscription> {
  const stripe = getStripeClient();
  const current = await stripe.subscriptions.retrieve(args.subscription_id);
  const itemId = current.items.data[0]?.id;
  if (!itemId) {
    throw new BillingError("Subscription has no items", "stripe.no_items", 400);
  }
  return stripe.subscriptions.update(args.subscription_id, {
    items: [{ id: itemId, price: args.new_price_id }],
    proration_behavior: args.proration_behavior,
    cancel_at_period_end: args.cancel_at_period_end,
  });
}

export async function pauseSubscription(args: {
  subscription_id: string;
  resume_at_iso: string;
  /** `mark_uncollectible`, `keep_as_draft`, `void` */
  behavior?: "mark_uncollectible" | "keep_as_draft" | "void";
}): Promise<Stripe.Subscription> {
  return getStripeClient().subscriptions.update(args.subscription_id, {
    pause_collection: {
      behavior: args.behavior ?? "mark_uncollectible",
      resumes_at: Math.floor(new Date(args.resume_at_iso).getTime() / 1000),
    },
  });
}

export async function resumeSubscription(subscription_id: string): Promise<Stripe.Subscription> {
  return getStripeClient().subscriptions.update(subscription_id, {
    pause_collection: null,
  });
}

export async function cancelSubscription(args: {
  subscription_id: string;
  at_period_end?: boolean;
  cancellation_details?: Stripe.SubscriptionUpdateParams.CancellationDetails;
}): Promise<Stripe.Subscription> {
  const stripe = getStripeClient();
  if (args.at_period_end) {
    return stripe.subscriptions.update(args.subscription_id, {
      cancel_at_period_end: true,
      cancellation_details: args.cancellation_details,
    });
  }
  return stripe.subscriptions.cancel(args.subscription_id, {
    cancellation_details: args.cancellation_details,
  });
}

export async function listInvoices(args: {
  customer_id: string;
  limit?: number;
}): Promise<Stripe.Invoice[]> {
  const res = await getStripeClient().invoices.list({
    customer: args.customer_id,
    limit: args.limit ?? 100,
  });
  return res.data;
}

export async function attachPaymentMethod(args: {
  customer_id: string;
  payment_method_id: string;
  set_default?: boolean;
}): Promise<Stripe.PaymentMethod> {
  const stripe = getStripeClient();
  const attached = await stripe.paymentMethods.attach(args.payment_method_id, {
    customer: args.customer_id,
  });
  if (args.set_default) {
    await stripe.customers.update(args.customer_id, {
      invoice_settings: { default_payment_method: args.payment_method_id },
    });
  }
  return attached;
}

/** Stripe-hosted Billing Portal session for self-serve card updates. */
export async function createBillingPortalSession(args: {
  customer_id: string;
  return_url: string;
}): Promise<Stripe.BillingPortal.Session> {
  return getStripeClient().billingPortal.sessions.create({
    customer: args.customer_id,
    return_url: args.return_url,
  });
}

/** Re-export the Stripe namespace for callers that need raw types. */
export type { Stripe };
