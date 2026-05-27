/**
 * Preference store + matrix evaluator.
 *
 * The matrix is per-user-per-workspace. The owner can install a workspace-level
 * override that mutes certain event_types for everyone — except billing +
 * security events, which the engine refuses to mute (per Doc 12 §B "fiduciary
 * notifications").
 */

import type {
  AccountOverride,
  NotificationChannel,
  PreferencesMatrix,
} from "./types.js";

export interface PreferencesStore {
  get(user_id: string, workspace_id: string): Promise<PreferencesMatrix | null>;
  upsert(prefs: PreferencesMatrix): Promise<PreferencesMatrix>;
  getAccountOverride(workspace_id: string): Promise<AccountOverride | null>;
  upsertAccountOverride(o: AccountOverride): Promise<AccountOverride>;
}

export class InMemoryPreferencesStore implements PreferencesStore {
  private prefs = new Map<string, PreferencesMatrix>();
  private overrides = new Map<string, AccountOverride>();
  async get(user_id: string, workspace_id: string): Promise<PreferencesMatrix | null> {
    return this.prefs.get(`${workspace_id}:${user_id}`) ?? null;
  }
  async upsert(prefs: PreferencesMatrix): Promise<PreferencesMatrix> {
    this.prefs.set(`${prefs.workspace_id}:${prefs.user_id}`, prefs);
    return prefs;
  }
  async getAccountOverride(workspace_id: string): Promise<AccountOverride | null> {
    return this.overrides.get(workspace_id) ?? null;
  }
  async upsertAccountOverride(o: AccountOverride): Promise<AccountOverride> {
    this.overrides.set(o.workspace_id, o);
    return o;
  }
}

export interface ChannelDecision {
  channel: NotificationChannel;
  enabled: boolean;
  reason?: string;
}

export function isOwnerMutable(event_type: string, ownerOverrideBlocked: boolean): boolean {
  if (ownerOverrideBlocked) return false;
  // Belt-and-suspenders: never mute the explicit fiduciary list.
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
  return !NEVER_MUTABLE.has(event_type);
}

export function defaultPrefMatrix(user_id: string, workspace_id: string): PreferencesMatrix {
  return {
    user_id,
    workspace_id,
    channels: {},
    digest: {},
    sms_opt_in: false,
    slack_webhook_url: null,
    discord_webhook_url: null,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Decide whether a single (event_type × channel) is enabled for a user. The
 * fallback is "enabled" — the engine errs on delivery. The override + the
 * user's pref both have to OPT OUT for the channel to drop.
 */
export function channelEnabled(args: {
  event_type: string;
  channel: NotificationChannel;
  prefs: PreferencesMatrix | null;
  override: AccountOverride | null;
  ownerOverrideBlocked: boolean;
}): ChannelDecision {
  const { event_type, channel, prefs, override, ownerOverrideBlocked } = args;

  if (
    override &&
    override.muted_event_types.includes(event_type) &&
    isOwnerMutable(event_type, ownerOverrideBlocked)
  ) {
    return { channel, enabled: false, reason: "account_owner_muted" };
  }

  const userMap = prefs?.channels[event_type];
  if (userMap && userMap[channel] === false) {
    return { channel, enabled: false, reason: "user_pref_off" };
  }

  if (channel === "sms" && !(prefs?.sms_opt_in ?? false)) {
    return { channel, enabled: false, reason: "sms_not_opted_in" };
  }
  if (channel === "slack" && !prefs?.slack_webhook_url) {
    return { channel, enabled: false, reason: "no_slack_webhook" };
  }
  if (channel === "discord" && !prefs?.discord_webhook_url) {
    return { channel, enabled: false, reason: "no_discord_webhook" };
  }

  return { channel, enabled: true };
}
