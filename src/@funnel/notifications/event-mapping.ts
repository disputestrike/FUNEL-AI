/**
 * Declarative event → channels + template map.
 *
 * Keep this near-exhaustive — the engine refuses to send for unknown events
 * (we'd rather drop than spam on a misconfiguration).
 */

import type { NotificationChannel, Severity } from "./types.js";

export interface EventMapping {
  channels: NotificationChannel[];
  template: string;             // base template name; channels pick variants
  severity: Severity;
  /** Owner override blocked? true for billing+security. */
  owner_override_blocked?: boolean;
  /** Subject builder — caller can compose per channel; this is the email default. */
  subject: (payload: Record<string, unknown>) => string;
  /** Used by daily/hourly digests; false → realtime only. */
  digestable?: boolean;
}

const F = {
  amount: (p: Record<string, unknown>) => `$${((p.amount_cents as number) ?? 0) / 100}`,
  lead: (p: Record<string, unknown>) => (p.lead_name as string) ?? "a new lead",
  funnel: (p: Record<string, unknown>) => (p.funnel_name as string) ?? "your funnel",
};

export const EVENT_MAPPING: Record<string, EventMapping> = {
  /* Lead activity */
  new_lead: {
    channels: ["in_app", "email", "push"],
    template: "new-lead",
    severity: "success",
    digestable: true,
    subject: (p) => `New lead — ${F.lead(p)}`,
  },
  lead_booked: {
    channels: ["in_app", "email", "push"],
    template: "lead-booked",
    severity: "success",
    subject: (p) => `Lead booked — ${F.lead(p)}`,
  },
  lead_replied_sms: {
    channels: ["in_app", "push"],
    template: "lead-replied-sms",
    severity: "info",
    subject: () => "Lead replied",
  },

  /* Billing */
  payment_failed_own: {
    channels: ["in_app", "email", "push"],
    template: "payment-failed-1",
    severity: "critical",
    owner_override_blocked: true,
    subject: () => "Payment failed — quick fix",
  },
  card_expiring: {
    channels: ["in_app", "email"],
    template: "card-expiring-t30",
    severity: "warning",
    owner_override_blocked: true,
    subject: () => "Your card expires in 30 days",
  },
  trial_ending_t3: {
    channels: ["in_app", "email"],
    template: "trial-ending-t3",
    severity: "info",
    owner_override_blocked: true,
    subject: () => "3 days left in your trial",
  },

  /* Funnel */
  funnel_published: {
    channels: ["in_app", "email"],
    template: "funnel-published",
    severity: "success",
    subject: (p) => `${F.funnel(p)} is live`,
  },
  first_lead_captured: {
    channels: ["in_app", "email", "push"],
    template: "first-lead-captured",
    severity: "success",
    subject: () => "You got your first lead 🎉",
  },
  milestone_hit: {
    channels: ["in_app", "email", "push"],
    template: "milestone-hit",
    severity: "success",
    subject: (p) => `You crossed ${F.amount(p)}`,
  },
  ab_winner_promoted: {
    channels: ["in_app", "email"],
    template: "ab-winner-promoted",
    severity: "info",
    subject: () => "A/B winner promoted",
  },

  /* Security */
  new_device_login: {
    channels: ["in_app", "email"],
    template: "new-device-login",
    severity: "warning",
    owner_override_blocked: true,
    subject: (p) => `New login from ${(p.location as string) ?? "an unknown device"}`,
  },
  api_key_created: {
    channels: ["in_app", "email"],
    template: "api-key-created",
    severity: "info",
    owner_override_blocked: true,
    subject: () => "API key created",
  },
  suspicious_activity_alert: {
    channels: ["in_app", "email", "push"],
    template: "suspicious-activity-alert",
    severity: "critical",
    owner_override_blocked: true,
    subject: () => "Suspicious activity on your account",
  },

  /* Trust & Safety */
  compliance_flagged: {
    channels: ["in_app", "email"],
    template: "compliance-review-needed",
    severity: "warning",
    subject: () => "Compliance review — quick action",
  },

  /* RevTry */
  revtry_call_completed: {
    channels: ["in_app", "push"],
    template: "revtry-call-completed",
    severity: "info",
    digestable: true,
    subject: (p) => `Call ended — ${(p.outcome as string) ?? "see transcript"}`,
  },

  /* Engagement */
  daily_digest: {
    channels: ["email"],
    template: "daily-digest",
    severity: "info",
    subject: () => "Your daily GoFunnelAI digest",
  },

  /* Community */
  level_up: {
    channels: ["in_app", "push"],
    template: "level-up",
    severity: "success",
    subject: (p) => `You hit Level ${(p.to_level as number) ?? "?"}`,
  },
};

export function lookupMapping(event_type: string): EventMapping | null {
  return EVENT_MAPPING[event_type] ?? null;
}
