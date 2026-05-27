/**
 * Save-offer Pro Boost extension.
 *
 * - Extends an account's Pro Boost by 7 days for stalled users.
 * - One extension max per user (`pro_boost_extended_at` is the guard column).
 * - Skips suspended/canceled accounts.
 * - Writes an audit row to the event stream as
 *   `activation_save_offer_extended` and returns the audit id.
 *
 * Doc 06a §3 Day 7 not-activated branch.
 */

import { ulid } from "ulid";

import { ActivationEventEmitter, LifecycleStore } from "./success-path.js";
import { ProBoostExtensionResult } from "./types.js";

export async function extendProBoost(args: {
  user_id: string;
  workspace_id: string;
  /** Extension in days. Spec is 7. */
  days: number;
  store: LifecycleStore;
  emit: ActivationEventEmitter;
  now?: () => Date;
}): Promise<ProBoostExtensionResult> {
  const now = (args.now ?? (() => new Date()))();
  const state = await args.store.load(args.user_id);
  if (!state || state.workspace_id !== args.workspace_id) {
    return { applied: false, reason: "ineligible", new_expiry: null, audit_id: null };
  }
  if (state.workspace_suspended || state.workspace_canceled) {
    return {
      applied: false,
      reason: "workspace_suspended",
      new_expiry: null,
      audit_id: null,
    };
  }
  if (state.pro_boost_extended_at) {
    return {
      applied: false,
      reason: "already_extended",
      new_expiry: state.pro_boost_extends_until,
      audit_id: null,
    };
  }

  const expiryBase = state.pro_boost_extends_until
    ? Date.parse(state.pro_boost_extends_until)
    : now.getTime();
  const newExpiry = new Date(expiryBase + args.days * 86_400_000).toISOString();
  const auditId = ulid();

  await args.store.save({
    ...state,
    pro_boost_extended_at: now.toISOString(),
    pro_boost_extends_until: newExpiry,
    last_action_at: now.toISOString(),
    updated_at: now.toISOString(),
  });

  await args.emit("activation_save_offer_extended", {
    audit_id: auditId,
    user_id: state.user_id,
    workspace_id: state.workspace_id,
    extended_by_days: args.days,
    new_expiry: newExpiry,
    extended_at: now.toISOString(),
  });

  return {
    applied: true,
    reason: "ok",
    new_expiry: newExpiry,
    audit_id: auditId,
  };
}
