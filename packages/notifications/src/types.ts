/**
 * Notifications domain types.
 *
 * The engine accepts an `eventType` and the per-user prefs map decides which
 * channels fire. Per-channel templates are picked from a declarative mapping
 * in `event-mapping.ts`. SMS (SignalWire, NOT Twilio) only fires for
 * explicit opt-in events. Email uses Resend.
 */

import { z } from "zod";

export const NotificationChannelEnum = z.enum([
  "in_app",
  "email",
  "push",
  "sms",
  "slack",
  "discord",
]);
export type NotificationChannel = z.infer<typeof NotificationChannelEnum>;

export const SeverityEnum = z.enum(["info", "success", "warning", "critical"]);
export type Severity = z.infer<typeof SeverityEnum>;

export const DigestEnum = z.enum(["realtime", "hourly", "daily", "off"]);
export type DigestCadence = z.infer<typeof DigestEnum>;

export const PreferencesMatrixSchema = z.object({
  user_id: z.string().min(1),
  workspace_id: z.string().min(1),
  /** event_type → channel → enabled flag. */
  channels: z.record(z.record(z.boolean())),
  /** event_type → digest cadence. */
  digest: z.record(DigestEnum),
  /** Honor SMS quiet hours (start/end HH:mm in user's local tz). */
  sms_opt_in: z.boolean().default(false),
  /** Optional Slack / Discord webhook for Agency+ tiers. */
  slack_webhook_url: z.string().url().nullable(),
  discord_webhook_url: z.string().url().nullable(),
  updated_at: z.string().datetime(),
});
export type PreferencesMatrix = z.infer<typeof PreferencesMatrixSchema>;

export const AccountOverrideSchema = z.object({
  workspace_id: z.string().min(1),
  /** Owner-imposed mute of certain event_types for everyone in the workspace.
   *  Billing/security events are NOT mutable — caller must enforce. */
  muted_event_types: z.array(z.string()),
  updated_at: z.string().datetime(),
});
export type AccountOverride = z.infer<typeof AccountOverrideSchema>;

export const NotificationStatusEnum = z.enum([
  "queued",
  "sending",
  "sent",
  "failed",
  "deferred_digest",
  "dlq",
]);
export type NotificationStatus = z.infer<typeof NotificationStatusEnum>;

export const NotificationSchema = z.object({
  id: z.string().min(1),
  workspace_id: z.string().min(1),
  user_id: z.string().min(1).nullable(),
  channel: NotificationChannelEnum,
  event_type: z.string(),
  template: z.string(),
  subject: z.string().nullable(),
  body: z.string(),
  payload: z.record(z.unknown()),
  severity: SeverityEnum,
  /** in-app: where to deep-link. */
  cta_url: z.string().nullable(),
  status: NotificationStatusEnum,
  attempts: z.number().int().nonnegative().default(0),
  next_attempt_at: z.string().datetime().nullable(),
  last_error: z.string().nullable(),
  external_message_id: z.string().nullable(),
  read_at: z.string().datetime().nullable(),
  created_at: z.string().datetime(),
  sent_at: z.string().datetime().nullable(),
});
export type Notification = z.infer<typeof NotificationSchema>;

export const AuditRowSchema = z.object({
  notification_id: z.string(),
  workspace_id: z.string(),
  user_id: z.string().nullable(),
  event_type: z.string(),
  channel: NotificationChannelEnum,
  decision: z.enum(["sent", "skipped_pref", "skipped_override", "skipped_quiet_hours", "deferred", "failed", "duplicate"]),
  reason: z.string().nullable(),
  ts: z.string().datetime(),
});
export type AuditRow = z.infer<typeof AuditRowSchema>;
