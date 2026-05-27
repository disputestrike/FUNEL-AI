/**
 * SMS channel — SignalWire (NOT Twilio).
 *
 * SMS only fires when:
 *   - user has explicitly opted in (`prefs.sms_opt_in === true`)
 *   - phone number has a `consent_ledger` entry (caller pre-checks)
 *   - we're not inside TCPA quiet hours (caller passes the local time)
 *
 * Quiet hours: no SMS before 08:00 or after 21:00 local time. If outside,
 * the engine returns a `deferred` decision and the caller schedules for next
 * morning.
 */

import type { Notification } from "../types.js";

export interface SmsSender {
  send(args: {
    to_e164: string;
    body: string;
    idempotency_key?: string;
  }): Promise<{ message_id: string }>;
}

export interface SmsDeps {
  sms: SmsSender;
  /** Resolve the user's E.164 phone — or null if unknown. */
  resolvePhone: (user_id: string) => Promise<string | null>;
  /** Resolve user's local-time hour 0-23. */
  resolveLocalHour: (user_id: string, now: number) => Promise<number>;
}

export const TCPA_QUIET_START_HOUR = 21;
export const TCPA_QUIET_END_HOUR = 8;

export async function sendSms(notification: Notification, deps: SmsDeps): Promise<Notification> {
  if (!notification.user_id) throw new Error("sms requires user_id");
  const phone = await deps.resolvePhone(notification.user_id);
  if (!phone) {
    return { ...notification, status: "failed", last_error: "no_phone" };
  }
  const hour = await deps.resolveLocalHour(notification.user_id, Date.now());
  if (hour >= TCPA_QUIET_START_HOUR || hour < TCPA_QUIET_END_HOUR) {
    return { ...notification, status: "deferred_digest", last_error: "tcpa_quiet_hours" };
  }
  // Body must include STOP language. The engine pads if missing.
  const body = /STOP/i.test(notification.body)
    ? notification.body
    : `${notification.body.slice(0, 140)} Reply STOP to opt out.`;
  const r = await deps.sms.send({
    to_e164: phone,
    body,
    idempotency_key: notification.id,
  });
  return {
    ...notification,
    status: "sent",
    sent_at: new Date().toISOString(),
    external_message_id: r.message_id,
  };
}
