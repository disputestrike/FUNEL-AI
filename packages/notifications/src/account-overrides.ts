/**
 * Workspace-owner overrides.
 *
 * Owners can mute certain event_types for the whole workspace. Billing +
 * security events are NEVER mutable (see `preferences.isOwnerMutable`).
 */

import type { AccountOverride } from "./types.js";
import type { PreferencesStore } from "./preferences.js";

export interface OverrideDeps {
  store: PreferencesStore;
  clock?: { iso(): string };
  emit?: (
    name: "notification_override_changed",
    payload: Record<string, unknown>,
  ) => Promise<void>;
}

const defaultClock = { iso: () => new Date().toISOString() };

const NEVER_MUTABLE = new Set([
  "payment_failed_own",
  "card_expiring",
  "trial_ending_t3",
  "trial_ending_t1",
  "account_past_due",
  "account_suspended",
  "new_device_login",
  "suspicious_activity_alert",
  "api_key_created",
  "api_key_revoked",
]);

export async function setMutedEvents(
  args: { workspace_id: string; muted_event_types: string[]; actor_user_id: string },
  deps: OverrideDeps,
): Promise<AccountOverride> {
  const allowed = args.muted_event_types.filter((e) => !NEVER_MUTABLE.has(e));
  const next: AccountOverride = {
    workspace_id: args.workspace_id,
    muted_event_types: allowed,
    updated_at: (deps.clock ?? defaultClock).iso(),
  };
  const upserted = await deps.store.upsertAccountOverride(next);
  if (deps.emit) {
    await deps.emit("notification_override_changed", {
      workspace_id: args.workspace_id,
      actor_user_id: args.actor_user_id,
      muted_event_types: allowed,
    });
  }
  return upserted;
}
