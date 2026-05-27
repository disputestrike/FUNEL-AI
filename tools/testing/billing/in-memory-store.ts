/**
 * Minimal in-memory BillingStore for unit tests.
 *
 * Mirrors the public surface of `@funnel/billing`'s BillingStore interface so
 * tests can `setBillingStore(makeMemoryStore())` and exercise lifecycle / dunning
 * code paths end-to-end without a real DB.
 */
import type {
  BillingStore,
  Subscription,
  Invoice,
  Payment,
  Refund,
  DunningState,
  ResourceKind,
} from "@funnel/billing";
import { PLAN_LIMITS } from "@funnel/billing";

export function makeMemoryStore(): BillingStore & {
  /** Test helpers. */
  __subs: Map<string, Subscription>;
  __invoices: Map<string, Invoice>;
  __payments: Map<string, Payment>;
  __refunds: Refund[];
  __dunning: Map<string, DunningState>;
  __idem: Map<string, { response_hash: string | null; created_at: number }>;
  __webhooks: Map<string, { status: string; last_error?: string | null; attempt_n: number }>;
  __usage: Map<string, number>;
} {
  const subs = new Map<string, Subscription>();
  const invoices = new Map<string, Invoice>();
  const payments = new Map<string, Payment>();
  const refunds: Refund[] = [];
  const dunning = new Map<string, DunningState>();
  const idem = new Map<string, { response_hash: string | null; created_at: number }>();
  const webhooks = new Map<string, { status: string; last_error?: string | null; attempt_n: number }>();
  const usage = new Map<string, number>();
  const cardExpiry: Map<string, unknown> = new Map();

  return {
    __subs: subs,
    __invoices: invoices,
    __payments: payments,
    __refunds: refunds,
    __dunning: dunning,
    __idem: idem,
    __webhooks: webhooks,
    __usage: usage,

    async getSubscription(id) {
      return subs.get(id) ?? null;
    },
    async getSubscriptionByWorkspace(ws) {
      return [...subs.values()].find((s) => s.workspace_id === ws) ?? null;
    },
    async listActiveSubscriptions(processor) {
      return [...subs.values()].filter(
        (s) => s.status === "active" && (!processor || s.external_processor === processor),
      );
    },
    async upsertSubscription(sub) {
      subs.set(sub.id, { ...sub });
      return { ...sub };
    },
    async updateSubscription(id, patch) {
      const cur = subs.get(id);
      if (!cur) throw new Error(`no sub ${id}`);
      const next = { ...cur, ...patch, metadata: { ...cur.metadata, ...(patch.metadata ?? {}) } };
      subs.set(id, next);
      return next;
    },
    async insertInvoice(inv) {
      invoices.set(inv.id, { ...inv });
      return { ...inv };
    },
    async updateInvoice(id, patch) {
      const cur = invoices.get(id);
      if (!cur) throw new Error(`no invoice ${id}`);
      const next = { ...cur, ...patch };
      invoices.set(id, next);
      return next;
    },
    async getInvoice(id) {
      return invoices.get(id) ?? null;
    },
    async insertPayment(p) {
      payments.set(p.id, { ...p });
      return { ...p };
    },
    async getPayment(id) {
      return payments.get(id) ?? null;
    },
    async listPaymentsByInvoice(invoice_id) {
      return [...payments.values()].filter((p) => p.invoice_id === invoice_id);
    },
    async insertRefund(r) {
      refunds.push({ ...r });
      return { ...r };
    },
    async getDunningState(subscription_id) {
      return dunning.get(subscription_id) ?? null;
    },
    async upsertDunningState(state) {
      dunning.set(state.subscription_id, { ...state });
      return { ...state };
    },
    async listDunningStatesDue(now) {
      return [...dunning.values()].filter(
        (d) => d.next_step_at && new Date(d.next_step_at).getTime() <= now.getTime(),
      );
    },
    async reserveIdempotencyKey({ key }) {
      if (idem.has(key))
        return { created: false, existing_response_hash: idem.get(key)?.response_hash ?? null };
      idem.set(key, { response_hash: null, created_at: Date.now() });
      return { created: true };
    },
    async setIdempotencyResponse(key, response_hash) {
      const cur = idem.get(key);
      if (cur) cur.response_hash = response_hash;
    },
    async recordWebhookDelivery({ delivery_id, status, last_error, attempt_n }) {
      if (webhooks.has(delivery_id)) return { created: false };
      webhooks.set(delivery_id, { status, last_error: last_error ?? null, attempt_n: attempt_n ?? 1 });
      return { created: true };
    },
    async markWebhookDeliveryStatus(delivery_id, status, last_error) {
      const cur = webhooks.get(delivery_id);
      if (cur) {
        cur.status = status;
        cur.last_error = last_error ?? null;
      }
    },
    async getCurrentUsage(ws, resource) {
      return usage.get(`${ws}:${resource}`) ?? 0;
    },
    async getPlanLimits(plan) {
      const slug = plan as keyof typeof PLAN_LIMITS;
      return PLAN_LIMITS[slug] ?? PLAN_LIMITS.free;
    },
    async getPlan(plan) {
      return {
        slug: plan,
        name: plan,
        price_usd_cents: 0,
        interval: "month",
        features: [],
      } as unknown as ReturnType<BillingStore["getPlan"]> extends Promise<infer R> ? R : never;
    },
    async getFreeUntil1kState(ws) {
      return null;
    },
    async upsertFreeUntil1kState(state) {
      return state;
    },
    async listCardExpirySchedules() {
      return [];
    },
    async updateCardExpirySchedule(ws, patch) {
      cardExpiry.set(ws as string, { ...((cardExpiry.get(ws as string) as object) ?? {}), ...patch });
    },
  } as BillingStore & ReturnType<typeof makeMemoryStore>;
}

export function setUsage(
  store: ReturnType<typeof makeMemoryStore>,
  workspace_id: string,
  resource: ResourceKind,
  value: number,
) {
  store.__usage.set(`${workspace_id}:${resource}`, value);
}
