/**
 * Pluggable persistence layer for the billing package.
 *
 * The production wiring uses Prisma (@funnel/db) via the wireBillingStore() in
 * src/db-wiring.ts. Tests inject an in-memory store. Every method is async to
 * keep the contract DB-shaped.
 *
 * All amounts are USD micros unless explicitly noted as cents.
 */

import type {
  BillingProcessor,
  CardExpirySchedule,
  DunningState,
  DunningStep,
  FreeUntil1kState,
  Invoice,
  InvoiceStatus,
  Payment,
  Plan,
  PlanLimits,
  Refund,
  ResourceKind,
  Subscription,
  SubscriptionStatus,
} from "./types.js";
import type { WorkspaceId } from "@funnel/shared/types";

export interface BillingStore {
  // ---- subscriptions ----
  getSubscription(subscription_id: string): Promise<Subscription | null>;
  getSubscriptionByWorkspace(workspace_id: WorkspaceId): Promise<Subscription | null>;
  listActiveSubscriptions(processor?: BillingProcessor): Promise<Subscription[]>;
  upsertSubscription(sub: Subscription): Promise<Subscription>;
  updateSubscription(
    subscription_id: string,
    patch: Partial<Subscription>,
  ): Promise<Subscription>;

  // ---- invoices, payments, refunds ----
  insertInvoice(inv: Invoice): Promise<Invoice>;
  updateInvoice(invoice_id: string, patch: Partial<Invoice>): Promise<Invoice>;
  getInvoice(invoice_id: string): Promise<Invoice | null>;

  insertPayment(p: Payment): Promise<Payment>;
  getPayment(payment_id: string): Promise<Payment | null>;
  listPaymentsByInvoice(invoice_id: string): Promise<Payment[]>;

  insertRefund(r: Refund): Promise<Refund>;

  // ---- dunning ----
  getDunningState(subscription_id: string): Promise<DunningState | null>;
  upsertDunningState(state: DunningState): Promise<DunningState>;
  listDunningStatesDue(now: Date): Promise<DunningState[]>;

  // ---- idempotency ----
  reserveIdempotencyKey(args: {
    key: string;
    scope: string;
    workspace_id?: WorkspaceId | null;
    response_hash?: string | null;
    expires_at: Date;
  }): Promise<{ created: boolean; existing_response_hash?: string | null }>;
  setIdempotencyResponse(key: string, response_hash: string): Promise<void>;

  // ---- webhook deliveries ----
  recordWebhookDelivery(args: {
    delivery_id: string;
    workspace_id?: WorkspaceId | null;
    direction: "inbound" | "outbound";
    source: string;
    event_id_external?: string | null;
    payload_hash: string;
    signature_valid: boolean;
    attempt_n?: number;
    status: "received" | "retrying" | "succeeded" | "failed" | "dlq";
    last_error?: string | null;
    completed_at?: Date | null;
  }): Promise<{ created: boolean }>;
  markWebhookDeliveryStatus(
    delivery_id: string,
    status: "succeeded" | "failed" | "retrying" | "dlq",
    last_error?: string | null,
  ): Promise<void>;

  // ---- limits / usage ----
  getCurrentUsage(workspace_id: WorkspaceId, resource: ResourceKind): Promise<number>;
  getPlanLimits(plan: string): Promise<PlanLimits>;
  getPlan(plan: string): Promise<Plan | null>;

  // ---- free until $1K ----
  getFreeUntil1kState(workspace_id: WorkspaceId): Promise<FreeUntil1kState | null>;
  upsertFreeUntil1kState(state: FreeUntil1kState): Promise<FreeUntil1kState>;

  // ---- card expiry ----
  listCardExpirySchedules(args: {
    days_until_expiry_max?: number;
  }): Promise<CardExpirySchedule[]>;
  updateCardExpirySchedule(
    workspace_id: WorkspaceId,
    patch: Partial<CardExpirySchedule>,
  ): Promise<void>;
}

let store: BillingStore | null = null;

export function setBillingStore(s: BillingStore): void {
  store = s;
}

export function getBillingStore(): BillingStore {
  if (!store) {
    throw new Error(
      "BillingStore not configured. Call setBillingStore() at boot (production wires @funnel/db).",
    );
  }
  return store;
}

/** Convenience re-exports for store consumers. */
export type {
  Subscription,
  Invoice,
  Payment,
  Refund,
  DunningState,
  InvoiceStatus,
  SubscriptionStatus,
  DunningStep,
  ResourceKind,
};
