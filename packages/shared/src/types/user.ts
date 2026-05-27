/**
 * User domain types.
 *
 * A User is the human authenticating into GoFunnelAI. A user can belong to many
 * workspaces via `WorkspaceMember` rows. We never store password plaintext;
 * `password_hash` is argon2id.
 */

import type { UserId } from "./workspace.js";

export type { UserId } from "./workspace.js";

export enum UserStatus {
  Active = "active",
  Deactivated = "deactivated",
  Deleted = "deleted",
}

export enum MfaFactorType {
  Totp = "totp",
  WebAuthn = "webauthn",
  Sms = "sms",
  Email = "email",
  RecoveryCode = "recovery_code",
}

export interface MfaFactor {
  type: MfaFactorType;
  /** Stable identifier for the factor (e.g. webauthn credential ID). */
  factor_id: string;
  /** Display label shown to the user, e.g. "iPhone 16 (Touch ID)". */
  label?: string;
  enrolled_at: string;
  last_used_at?: string | null;
}

/**
 * NotificationPrefs controls which channels GoFunnelAI may use to reach the
 * human. These are policy bits enforced by `@funnel/notifications`.
 */
export interface NotificationPrefs {
  email: {
    product_updates: boolean;
    weekly_digest: boolean;
    security_alerts: boolean; // legally we may still send these
    billing: boolean; // legally we may still send these
  };
  in_app: {
    funnel_publish: boolean;
    new_lead: boolean;
    quality_alerts: boolean;
  };
  sms: {
    security_alerts: boolean;
    critical_billing: boolean;
  };
  push: {
    enabled: boolean;
  };
  /** Quiet hours window in IANA timezone â€” no non-essential pushes. */
  quiet_hours?: {
    timezone: string;
    start_hhmm: string; // "22:00"
    end_hhmm: string; // "07:00"
  };
}

export interface User {
  id: UserId;
  email: string;
  email_verified_at?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
  locale: string; // BCP47 e.g. "en-US"
  timezone: string; // IANA e.g. "America/Chicago"
  password_hash?: string | null; // argon2id; null for SSO-only users
  password_changed_at?: string | null;
  mfa_enrolled: boolean;
  mfa_factors: MfaFactor[];
  last_login_at?: string | null;
  last_login_ip_hash?: string | null;
  is_internal: boolean; // GoFunnelAI employees
  status: UserStatus;
  notification_prefs: NotificationPrefs;
  deactivated_at?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  email: {
    product_updates: true,
    weekly_digest: true,
    security_alerts: true,
    billing: true,
  },
  in_app: {
    funnel_publish: true,
    new_lead: true,
    quality_alerts: true,
  },
  sms: {
    security_alerts: false,
    critical_billing: false,
  },
  push: { enabled: false },
};
