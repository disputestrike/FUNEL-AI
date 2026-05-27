/**
 * Opt-out preferences.
 *
 * Three levels exposed in /settings/coaching (Doc 06a §7):
 *   - Mute all activation nudges          → coaching_opt_out
 *   - Mute email only                     → email_opt_out
 *   - Mute push only                      → push_opt_out
 *   - Mute SMS only                       → sms_opt_out
 *   - (Also: in-app, revtry-sms-specific)
 *
 * Workspace-level override: Agency tier owners can mute activation nudges for
 * all of their non-billing members. Stored on the workspace, applied here.
 */

import { ActivationEventEmitter, LifecycleStore } from "./success-path.js";
import {
  InterventionChannel,
  OPT_OUT_LEVELS,
  OptOutLevel,
  OptOutPreferences,
} from "./types.js";

export interface OptOutStore {
  loadWorkspacePrefs(workspace_id: string): Promise<{
    workspace_mute_non_billing: boolean;
  }>;
}

export async function setOptOut(args: {
  user_id: string;
  workspace_id: string;
  level: OptOutLevel;
  value: boolean;
  store: LifecycleStore;
  emit: ActivationEventEmitter;
  now?: () => Date;
}): Promise<OptOutPreferences> {
  if (!OPT_OUT_LEVELS.includes(args.level)) {
    throw new Error(`unknown opt-out level: ${args.level}`);
  }
  const ts = (args.now ?? (() => new Date()))().toISOString();
  const state = await args.store.load(args.user_id);
  if (!state) {
    throw new Error(`setOptOut: no lifecycle state for ${args.user_id}`);
  }
  if (state.workspace_id !== args.workspace_id) {
    throw new Error("workspace mismatch");
  }

  const next = { ...state, updated_at: ts };
  switch (args.level) {
    case "all":
      next.coaching_opt_out = args.value;
      break;
    case "email":
      next.email_opt_out = args.value;
      break;
    case "push":
      next.push_opt_out = args.value;
      break;
    case "sms":
      next.sms_opt_out = args.value;
      break;
    case "in_app":
      next.in_app_opt_out = args.value;
      break;
  }
  await args.store.save(next);

  await args.emit("user_opted_out", {
    user_id: args.user_id,
    workspace_id: args.workspace_id,
    channel: args.level,
    value: args.value,
    ts,
  });

  return projectPrefs(next);
}

export async function getOptOut(args: {
  user_id: string;
  workspace_id: string;
  store: LifecycleStore;
  optStore: OptOutStore;
}): Promise<OptOutPreferences> {
  const state = await args.store.load(args.user_id);
  if (!state) {
    throw new Error(`getOptOut: no lifecycle state for ${args.user_id}`);
  }
  const ws = await args.optStore.loadWorkspacePrefs(args.workspace_id);
  return { ...projectPrefs(state), workspace_mute_non_billing: ws.workspace_mute_non_billing };
}

function projectPrefs(s: {
  user_id: string;
  workspace_id: string;
  coaching_opt_out: boolean;
  email_opt_out: boolean;
  push_opt_out: boolean;
  sms_opt_out: boolean;
  in_app_opt_out: boolean;
  updated_at: string;
}): OptOutPreferences {
  return {
    user_id: s.user_id,
    workspace_id: s.workspace_id,
    mute_all: s.coaching_opt_out,
    mute_email: s.email_opt_out,
    mute_push: s.push_opt_out,
    mute_sms: s.sms_opt_out,
    mute_in_app: s.in_app_opt_out,
    workspace_mute_non_billing: false,
    updated_at: s.updated_at,
  };
}

/**
 * Resolve whether a channel should be considered muted for this user at send
 * time, factoring in the per-user prefs AND the workspace-level Agency
 * override. Triggers route through this when they want to do a final
 * pre-dispatch gate.
 *
 * `member_role` is the user's role inside the workspace; the workspace-level
 * override only mutes non-billing roles.
 */
export function shouldSuppress(args: {
  state: Pick<
    OptOutPreferences,
    "mute_all" | "mute_email" | "mute_push" | "mute_sms" | "mute_in_app"
  > & { workspace_mute_non_billing: boolean };
  channel: InterventionChannel;
  member_role: string;
}): boolean {
  if (args.state.mute_all) return true;
  const isBilling = args.member_role === "billing" || args.member_role === "owner";
  if (args.state.workspace_mute_non_billing && !isBilling) return true;
  switch (args.channel) {
    case "email":
      return args.state.mute_email;
    case "push":
      return args.state.mute_push;
    case "sms":
      return args.state.mute_sms;
    case "in_app":
      return args.state.mute_in_app;
    case "voice":
    case "call_task":
    case "internal_slack":
      return false;
  }
}
