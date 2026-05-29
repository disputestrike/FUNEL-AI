/**
 * Read-side fixtures.
 *
 * In production these functions live behind @funnel/db with the admin
 * context wrapper applied (`withAdminContext` bypasses tenant RLS — only
 * permitted through this wrapper). For now they return realistic shapes
 * so the UI is fully exercisable in dev + tests without a database.
 *
 * Every reader in this file MUST be called inside a server component or
 * a route handler that already validated the admin session, since the
 * returned data is cross-tenant.
 */

import type { AuditLogRow } from "@/components/AuditLogTable";
import type { EmailRow } from "@/components/EmailDeliveryLogViewer";
import type { WebhookRow } from "@/components/WebhookDeliveryLogViewer";

export interface WorkspaceSummary {
  id: string;
  name: string;
  owner_email: string;
  plan: "free" | "starter" | "growth" | "scale" | "enterprise";
  status: "active" | "trial" | "past_due" | "suspended" | "deleted";
  mrr_cents: number;
  signup_at: string;
  members_count: number;
  funnels_count: number;
  trial_ends_at?: string | null;
}

export interface FunnelSummary {
  id: string;
  workspace_id: string;
  name: string;
  url: string;
  status: "draft" | "live" | "paused" | "deleted";
  leads_30d: number;
  created_at: string;
  deleted_at?: string | null;
}

export interface LeadSummary {
  id: string;
  workspace_id: string;
  funnel_id: string;
  email: string;
  phone: string | null;
  score: number;
  qualified: boolean;
  created_at: string;
}

export interface DashboardAlert {
  id: string;
  source: "sentry" | "webhook" | "ad" | "revtry" | "billing";
  severity: "info" | "warning" | "critical";
  title: string;
  detail: string;
  first_seen_at: string;
  count_24h: number;
  ack_url?: string;
}

export interface DashboardStats {
  signups_today: number;
  churned_today: number;
  failed_payments_today: number;
  suspended_total: number;
  escalated_tickets_open: number;
  mrr_cents: number;
  funnels_generated_24h: number;
}

export interface QueueStats {
  name: string;
  waiting: number;
  active: number;
  failed: number;
  delayed: number;
  completed_24h: number;
  p50_ms: number;
  p95_ms: number;
}

export interface FailedJob {
  id: string;
  queue: string;
  name: string;
  attempts: number;
  failed_reason: string;
  failed_at: string;
  payload_excerpt: string;
}

export interface IntegrationHealth {
  provider: string;
  status: "healthy" | "degraded" | "down";
  rate_limit_headroom_pct: number;
  error_rate_24h_pct: number;
  last_success_at: string;
  last_failure_at: string | null;
}

export interface SentryEvent {
  id: string;
  title: string;
  level: "error" | "warning" | "fatal";
  count_24h: number;
  users_affected: number;
  first_seen_at: string;
  last_seen_at: string;
  release: string;
  link: string;
  workspace_id?: string | null;
}

export interface BillingDiscrepancy {
  id: string;
  workspace_id: string;
  provider: "stripe" | "paypal";
  kind:
    | "missing_webhook"
    | "amount_mismatch"
    | "status_mismatch"
    | "orphan_invoice";
  detail: string;
  detected_at: string;
}

export interface DataRequest {
  id: string;
  workspace_id: string;
  type: "export" | "deletion";
  requested_at: string;
  sla_due_at: string;
  status: "pending" | "in_progress" | "completed" | "rejected";
  requestor_email: string;
}

export interface ReviewQueueItem {
  id: string;
  workspace_id: string;
  resource_type: "funnel" | "ad_creative" | "email_body";
  reason: string;
  submitted_at: string;
  claimed_by: string | null;
  status: "pending" | "claimed" | "approved" | "rejected" | "escalated";
}

export interface Incident {
  id: string;
  title: string;
  severity: "MINOR" | "MAJOR" | "CRITICAL";
  status: "open" | "monitoring" | "resolved";
  opened_at: string;
  scenario_class: string;
  comms_template_id: string;
}

export interface FeatureFlag {
  key: string;
  enabled: boolean;
  rollout_pct: number;
  description: string;
  last_changed_at: string;
  owner: string;
}

// ---------------------------------------------------------------------------
// Mock generators — small, stable, deterministic so tests don't flake.
// ---------------------------------------------------------------------------

const NOW = () => new Date();
const isoMinusMin = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
const isoMinusHr = (h: number) => isoMinusMin(h * 60);
const isoMinusDay = (d: number) => isoMinusHr(d * 24);

export async function listWorkspaces(): Promise<WorkspaceSummary[]> {
  return [
    {
      id: "ws_acme",
      name: "Acme Solar",
      owner_email: "owner@acmesolar.com",
      plan: "growth",
      status: "active",
      mrr_cents: 49900,
      signup_at: isoMinusDay(42),
      members_count: 4,
      funnels_count: 7,
    },
    {
      id: "ws_brightroof",
      name: "Bright Roof Co",
      owner_email: "ceo@brightroof.co",
      plan: "starter",
      status: "trial",
      mrr_cents: 0,
      signup_at: isoMinusDay(3),
      members_count: 1,
      funnels_count: 1,
      trial_ends_at: new Date(Date.now() + 4 * 24 * 60 * 60_000).toISOString(),
    },
    {
      id: "ws_chimera",
      name: "Chimera Coaching",
      owner_email: "founder@chimera.io",
      plan: "scale",
      status: "past_due",
      mrr_cents: 149900,
      signup_at: isoMinusDay(180),
      members_count: 11,
      funnels_count: 23,
    },
    {
      id: "ws_dunkin_dental",
      name: "Dunkin Dental Group",
      owner_email: "ops@dunkindental.com",
      plan: "growth",
      status: "suspended",
      mrr_cents: 0,
      signup_at: isoMinusDay(95),
      members_count: 3,
      funnels_count: 4,
    },
  ];
}

export async function getWorkspace(id: string): Promise<WorkspaceSummary | null> {
  const all = await listWorkspaces();
  return all.find((w) => w.id === id) ?? null;
}

export async function listFunnelsForWorkspace(id: string): Promise<FunnelSummary[]> {
  return [
    {
      id: "fn_solar_1",
      workspace_id: id,
      name: "Free Solar Quote — CA",
      url: "https://acmesolar.com/free-quote",
      status: "live",
      leads_30d: 218,
      created_at: isoMinusDay(30),
    },
    {
      id: "fn_solar_2",
      workspace_id: id,
      name: "Battery Backup Offer",
      url: "https://acmesolar.com/battery",
      status: "paused",
      leads_30d: 11,
      created_at: isoMinusDay(8),
    },
    {
      id: "fn_solar_3",
      workspace_id: id,
      name: "Legacy Affiliate Funnel",
      url: "https://acmesolar.com/legacy",
      status: "deleted",
      leads_30d: 0,
      created_at: isoMinusDay(120),
      deleted_at: isoMinusDay(12),
    },
  ];
}

export async function listFunnelsGlobal(): Promise<FunnelSummary[]> {
  const wss = await listWorkspaces();
  const out: FunnelSummary[] = [];
  for (const w of wss) {
    out.push(...(await listFunnelsForWorkspace(w.id)));
  }
  return out;
}

export async function listLeadsGlobal(): Promise<LeadSummary[]> {
  const wss = await listWorkspaces();
  return wss.flatMap((w) => [
    {
      id: `ld_${w.id}_1`,
      workspace_id: w.id,
      funnel_id: `fn_${w.id}_1`,
      email: `lead1@example-${w.id}.com`,
      phone: "+15551112222",
      score: 0.84,
      qualified: true,
      created_at: isoMinusHr(3),
    },
    {
      id: `ld_${w.id}_2`,
      workspace_id: w.id,
      funnel_id: `fn_${w.id}_2`,
      email: `lead2@example-${w.id}.com`,
      phone: null,
      score: 0.42,
      qualified: false,
      created_at: isoMinusDay(1),
    },
  ]);
}

export async function listDashboardAlerts(): Promise<DashboardAlert[]> {
  return [
    {
      id: "al_sentry_1",
      source: "sentry",
      severity: "critical",
      title: "ReferenceError in orchestrator.stage.compose",
      detail: "Affects 38 users in last 24h, release v2.13.4",
      first_seen_at: isoMinusHr(2),
      count_24h: 412,
      ack_url: "/sentry",
    },
    {
      id: "al_webhook_1",
      source: "webhook",
      severity: "warning",
      title: "Stripe webhook 5xx spike",
      detail: "12% of stripe.subscription.* webhooks failed in last 1h",
      first_seen_at: isoMinusHr(1),
      count_24h: 86,
      ack_url: "/customers",
    },
    {
      id: "al_ad_1",
      source: "ad",
      severity: "warning",
      title: "Meta ad rejection rate â†‘ 4x",
      detail: "26 creatives rejected in last 30m — likely policy update",
      first_seen_at: isoMinusMin(30),
      count_24h: 26,
      ack_url: "/integrations-health",
    },
    {
      id: "al_revtry_1",
      source: "revtry",
      severity: "info",
      title: "RevTry provider failover (Twilioâ†’Vonage)",
      detail: "Auto-failover triggered, 3-min call gap, recovered",
      first_seen_at: isoMinusHr(5),
      count_24h: 1,
    },
  ];
}

export async function getDashboardStats(): Promise<DashboardStats> {
  return {
    signups_today: 47,
    churned_today: 3,
    failed_payments_today: 11,
    suspended_total: 8,
    escalated_tickets_open: 5,
    mrr_cents: 28_410_000,
    funnels_generated_24h: 312,
  };
}

export async function listQueues(): Promise<QueueStats[]> {
  return [
    { name: "orchestrator", waiting: 12, active: 4, failed: 2, delayed: 0, completed_24h: 1834, p50_ms: 12300, p95_ms: 41200 },
    { name: "email", waiting: 1, active: 1, failed: 0, delayed: 4, completed_24h: 4920, p50_ms: 240, p95_ms: 1100 },
    { name: "webhook-out", waiting: 7, active: 2, failed: 18, delayed: 12, completed_24h: 9132, p50_ms: 180, p95_ms: 4200 },
    { name: "ad-publish", waiting: 0, active: 0, failed: 3, delayed: 0, completed_24h: 230, p50_ms: 8400, p95_ms: 22000 },
    { name: "billing-retry", waiting: 0, active: 0, failed: 5, delayed: 9, completed_24h: 88, p50_ms: 400, p95_ms: 2400 },
  ];
}

export async function listFailedJobs(): Promise<FailedJob[]> {
  return [
    {
      id: "job_92834",
      queue: "webhook-out",
      name: "deliver",
      attempts: 5,
      failed_reason: "EHOSTUNREACH",
      failed_at: isoMinusMin(12),
      payload_excerpt: '{ "url": "https://customer.example/hook", "event": "lead.created" }',
    },
    {
      id: "job_92835",
      queue: "orchestrator",
      name: "compose-page",
      attempts: 3,
      failed_reason: "ModelTimeoutError",
      failed_at: isoMinusMin(34),
      payload_excerpt: '{ "workspace_id": "ws_chimera", "funnel_id": "fn_xyz" }',
    },
    {
      id: "job_92836",
      queue: "ad-publish",
      name: "submit-meta",
      attempts: 2,
      failed_reason: "RateLimitError",
      failed_at: isoMinusMin(8),
      payload_excerpt: '{ "ad_set_id": "as_1234" }',
    },
  ];
}

export async function listIntegrationHealth(): Promise<IntegrationHealth[]> {
  return [
    { provider: "stripe", status: "healthy", rate_limit_headroom_pct: 84, error_rate_24h_pct: 0.2, last_success_at: isoMinusMin(1), last_failure_at: isoMinusHr(6) },
    { provider: "resend", status: "healthy", rate_limit_headroom_pct: 92, error_rate_24h_pct: 0.0, last_success_at: isoMinusMin(1), last_failure_at: null },
    { provider: "meta-ads", status: "degraded", rate_limit_headroom_pct: 22, error_rate_24h_pct: 4.6, last_success_at: isoMinusMin(2), last_failure_at: isoMinusMin(8) },
    { provider: "google-ads", status: "healthy", rate_limit_headroom_pct: 71, error_rate_24h_pct: 0.4, last_success_at: isoMinusMin(1), last_failure_at: isoMinusHr(11) },
    { provider: "twilio", status: "down", rate_limit_headroom_pct: 100, error_rate_24h_pct: 18.0, last_success_at: isoMinusMin(40), last_failure_at: isoMinusMin(2) },
    { provider: "openai", status: "healthy", rate_limit_headroom_pct: 65, error_rate_24h_pct: 0.1, last_success_at: isoMinusMin(1), last_failure_at: isoMinusHr(3) },
  ];
}

export async function listSentryEvents(): Promise<SentryEvent[]> {
  return [
    {
      id: "ev_1",
      title: "ReferenceError: cannot read 'persona' of undefined",
      level: "error",
      count_24h: 412,
      users_affected: 38,
      first_seen_at: isoMinusHr(2),
      last_seen_at: isoMinusMin(4),
      release: "v2.13.4",
      link: "https://sentry.io/funnel-ai/issues/123",
    },
    {
      id: "ev_2",
      title: "FetchError: connect ETIMEDOUT api.meta.com:443",
      level: "warning",
      count_24h: 91,
      users_affected: 11,
      first_seen_at: isoMinusHr(8),
      last_seen_at: isoMinusMin(20),
      release: "v2.13.4",
      link: "https://sentry.io/funnel-ai/issues/124",
    },
  ];
}

export async function listBillingDiscrepancies(): Promise<BillingDiscrepancy[]> {
  return [
    {
      id: "rec_1",
      workspace_id: "ws_chimera",
      provider: "stripe",
      kind: "missing_webhook",
      detail: "Subscription cancelled in Stripe but DB still shows active. Last webhook seen: 4h ago.",
      detected_at: isoMinusHr(2),
    },
    {
      id: "rec_2",
      workspace_id: "ws_acme",
      provider: "paypal",
      kind: "amount_mismatch",
      detail: "Invoice in_xyz expected $499.00, PayPal reports $499.50 — currency conversion drift.",
      detected_at: isoMinusHr(6),
    },
  ];
}

export async function listDataRequests(): Promise<DataRequest[]> {
  return [
    {
      id: "dr_1",
      workspace_id: "ws_acme",
      type: "export",
      requested_at: isoMinusHr(18),
      sla_due_at: isoMinusHr(-6),
      status: "in_progress",
      requestor_email: "owner@acmesolar.com",
    },
    {
      id: "dr_2",
      workspace_id: "ws_dunkin_dental",
      type: "deletion",
      requested_at: isoMinusHr(40),
      sla_due_at: isoMinusHr(-16),
      status: "pending",
      requestor_email: "ops@dunkindental.com",
    },
  ];
}

export async function listReviewQueueItems(): Promise<ReviewQueueItem[]> {
  return [
    {
      id: "rv_1",
      workspace_id: "ws_chimera",
      resource_type: "ad_creative",
      reason: "auto: contains testimonial without disclosure",
      submitted_at: isoMinusHr(1),
      claimed_by: null,
      status: "pending",
    },
    {
      id: "rv_2",
      workspace_id: "ws_acme",
      resource_type: "funnel",
      reason: "auto: prohibited claim ('guaranteed savings')",
      submitted_at: isoMinusHr(3),
      claimed_by: "tns_jane@gofunnelai.com",
      status: "claimed",
    },
  ];
}

export async function listIncidents(): Promise<Incident[]> {
  return [
    {
      id: "inc_001",
      title: "Meta ads policy rejection wave",
      severity: "MAJOR",
      status: "open",
      opened_at: isoMinusHr(2),
      scenario_class: "ai_content_major",
      comms_template_id: "ai_content_major",
    },
  ];
}

export async function listFeatureFlags(): Promise<FeatureFlag[]> {
  return [
    { key: "orchestrator_v3", enabled: false, rollout_pct: 0, description: "New orchestrator pipeline", last_changed_at: isoMinusDay(2), owner: "eng_lead@gofunnelai.com" },
    { key: "revtry_voice_v2", enabled: true, rollout_pct: 25, description: "New voice qualification model", last_changed_at: isoMinusHr(8), owner: "voice_lead@gofunnelai.com" },
    { key: "ai_disclosure_v2", enabled: true, rollout_pct: 100, description: "Updated AI disclosure copy", last_changed_at: isoMinusDay(14), owner: "legal@gofunnelai.com" },
  ];
}

export async function listAuditLog(): Promise<AuditLogRow[]> {
  return [
    {
      id: "au_1",
      timestamp: isoMinusMin(4),
      actor: "billing@gofunnelai.com",
      action: "issue_refund.succeeded",
      resource_type: "billing.invoice",
      resource_id: "in_abc12345",
      workspace_id: "ws_acme",
      ticket_id: "PLN-1023",
      status: "succeeded",
      reason: "Customer reported double-billing on annual upgrade",
    },
    {
      id: "au_2",
      timestamp: isoMinusMin(22),
      actor: "support@gofunnelai.com",
      action: "resend_verification.succeeded",
      resource_type: "user",
      resource_id: "usr_jjs82h",
      workspace_id: "ws_brightroof",
      ticket_id: "PLN-1024",
      status: "succeeded",
      reason: "User reported never receiving verification email",
    },
    {
      id: "au_3",
      timestamp: isoMinusHr(1),
      actor: "eng@gofunnelai.com",
      action: "retry_webhook.failed",
      resource_type: "webhook.delivery",
      resource_id: "wh_92834",
      workspace_id: "ws_chimera",
      ticket_id: null,
      status: "failed",
      reason: "Investigating webhook 5xx spike on customer endpoint",
    },
  ];
}

export async function listEmailsForWorkspace(_workspaceId: string): Promise<EmailRow[]> {
  return [
    {
      id: "em_1",
      to: "owner@acmesolar.com",
      subject: "Welcome to GoFunnelAI",
      template_id: "welcome_v3",
      status: "opened",
      sent_at: isoMinusDay(2),
      last_event_at: isoMinusDay(2),
    },
    {
      id: "em_2",
      to: "billing@acmesolar.com",
      subject: "Your invoice is past due",
      template_id: "dunning_d3",
      status: "bounced_hard",
      sent_at: isoMinusDay(1),
      last_event_at: isoMinusDay(1),
      bounce_reason: "550 user unknown",
    },
  ];
}

export async function listWebhooksForWorkspace(_workspaceId: string): Promise<WebhookRow[]> {
  return [
    {
      id: "wh_1",
      url: "https://acmesolar.com/api/funnel-hooks",
      event_type: "lead.created",
      status: "delivered",
      http_status: 200,
      attempt: 1,
      max_attempts: 8,
      last_attempt_at: isoMinusHr(1),
      next_attempt_at: null,
      signature_verified: "pass",
      error_class: null,
    },
    {
      id: "wh_2",
      url: "https://acmesolar.com/api/funnel-hooks",
      event_type: "booking.created",
      status: "failed",
      http_status: 502,
      attempt: 5,
      max_attempts: 8,
      last_attempt_at: isoMinusMin(8),
      next_attempt_at: isoMinusMin(-5),
      signature_verified: "pass",
      error_class: "BadGateway",
    },
  ];
}
