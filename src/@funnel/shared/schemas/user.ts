/**
 * Zod schemas for User.
 *
 * Mirrors `types/user.ts`.
 */

import { z } from "zod";

export const UserStatusSchema = z.enum(["active", "deactivated", "deleted"]);

export const MfaFactorTypeSchema = z.enum([
  "totp",
  "webauthn",
  "sms",
  "email",
  "recovery_code",
]);

export const MfaFactorSchema = z.object({
  type: MfaFactorTypeSchema,
  factor_id: z.string().min(1),
  label: z.string().optional(),
  enrolled_at: z.string().datetime(),
  last_used_at: z.string().datetime().nullable().optional(),
});

export const NotificationPrefsSchema = z.object({
  email: z.object({
    product_updates: z.boolean(),
    weekly_digest: z.boolean(),
    security_alerts: z.boolean(),
    billing: z.boolean(),
  }),
  in_app: z.object({
    funnel_publish: z.boolean(),
    new_lead: z.boolean(),
    quality_alerts: z.boolean(),
  }),
  sms: z.object({
    security_alerts: z.boolean(),
    critical_billing: z.boolean(),
  }),
  push: z.object({
    enabled: z.boolean(),
  }),
  quiet_hours: z
    .object({
      timezone: z.string(),
      start_hhmm: z.string().regex(/^\d{2}:\d{2}$/),
      end_hhmm: z.string().regex(/^\d{2}:\d{2}$/),
    })
    .optional(),
});

export const UserSchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  email_verified_at: z.string().datetime().nullable().optional(),
  full_name: z.string().nullable().optional(),
  avatar_url: z.string().url().nullable().optional(),
  locale: z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/),
  timezone: z.string(),
  password_hash: z.string().nullable().optional(),
  password_changed_at: z.string().datetime().nullable().optional(),
  mfa_enrolled: z.boolean(),
  mfa_factors: z.array(MfaFactorSchema),
  last_login_at: z.string().datetime().nullable().optional(),
  last_login_ip_hash: z.string().nullable().optional(),
  is_internal: z.boolean(),
  status: UserStatusSchema,
  notification_prefs: NotificationPrefsSchema,
  deactivated_at: z.string().datetime().nullable().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  deleted_at: z.string().datetime().nullable().optional(),
});
