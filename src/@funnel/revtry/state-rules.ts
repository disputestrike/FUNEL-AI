/**
 * State-specific TCPA + recording consent rules (Doc 07a §8.3, §8.5).
 *
 *   - Two-party-consent recording states: CA, CT, DE, FL, IL, MD, MA, MT, NV,
 *     NH, PA, WA, OR (electronic comm). Federal default + 39 others are
 *     one-party.
 *   - TCPA hours: no outbound before 08:00 or after 21:00 callee local time.
 *     Sunday calls require workspace opt-in.
 */

import type { StateConsentRule } from "./types.js";

export const TWO_PARTY_CONSENT_STATES = new Set([
  "CA", "CT", "DE", "FL", "IL", "MD", "MA", "MT", "NV", "NH", "PA", "WA", "OR",
]);

export function consentRuleForState(state_iso2: string | null | undefined): StateConsentRule {
  if (!state_iso2) return "two_party";  // fail safe
  return TWO_PARTY_CONSENT_STATES.has(state_iso2.toUpperCase()) ? "two_party" : "one_party";
}

export const TCPA_QUIET_START_HOUR = 21;   // 9pm
export const TCPA_QUIET_END_HOUR = 8;      // 8am

export function withinTcpaHours(callee_local_hour: number): boolean {
  return callee_local_hour >= TCPA_QUIET_END_HOUR && callee_local_hour < TCPA_QUIET_START_HOUR;
}

/** Returns true if the callee's local day-of-week is Sunday (0 in JS). */
export function isSundayLocal(now: Date, tz_offset_min: number): boolean {
  const localMs = now.valueOf() + tz_offset_min * 60_000;
  return new Date(localMs).getUTCDay() === 0;
}
