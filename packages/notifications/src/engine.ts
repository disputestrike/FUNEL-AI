/**
 * Notification engine.
 *
 * Single entrypoint `notify(workspace_id, user_id, event_type, payload)` —
 *
 *   1. Look up the canonical mapping (event_type → channels + template + severity).
 *   2. Load user prefs + workspace override.
 *   3. For each channel: decide enabled / muted / quiet-hours.
 *   4. Send (channel sink injected) or defer to digest bucket.
 *   5. Persist + audit every decision.
 *   6. Retry failed sends 3× with exponential backoff; then DLQ.
 *
 * Idempotency: caller supplies `idempotency_key` in payload; we de-dup at the
 * (workspace × idempotency_key × channel × event_type) level.
 */

import { recordAudit } from "./audit.js";
import { sendDiscord } from "./channels/discord.js";
import { sendEmail } from "./channels/email.js";
import { sendInApp } from "./channels/in-app.js";
import { sendPush } from "./channels/push.js";
import { sendSlack } from "./channels/slack.js";
import { sendSms } from "./channels/sms.js";
import type { DiscordDeps } from "./channels/discord.js";
import type { EmailDeps } from "./channels/email.js";
import type { InAppDeps } from "./channels/in-app.js";
import type { PushDeps } from "./channels/push.js";
import type { SlackDeps } from "./channels/slack.js";
import type { SmsDeps } from "./channels/sms.js";
import { deferToDigest } from "./digest.js";
import type { DigestDeps } from "./digest.js";
import { lookupMapping } from "./event-mapping.js";
import { channelEnabled } from "./preferences.js";
import type { PreferencesStore } from "./preferences.js";
import { nextAttemptAt } from "./retry.js";
import type { NotificationStore } from "./store.js";
import type { Notification, NotificationChannel } from "./types.js";

export interface EngineDeps {
  store: NotificationStore;
  preferences: PreferencesStore;
  newId: (entity: "request") => string;
  clock?: { now(): number; iso(): string };
  channels: {
    in_app?: InAppDeps;
    email?: EmailDeps;
    push?: PushDeps;
    sms?: SmsDeps;
    slack?: SlackDeps;
    discord?: DiscordDeps;
  };
  digest?: DigestDeps;
}

const defaultClock = { now: () => Date.now(), iso: () => new Date().toISOString() };

export interface NotifyResult {
  notification_ids: string[];
  decisions: Array<{ channel: NotificationChannel; decision: string; reason?: string | null }>;
}

export async function notify(
  args: {
    workspace_id: string;
    user_id: string | null;
    event_type: string;
    payload: Record<string, unknown>;
    /** Caller-supplied idempotency for replay safety. */
    idempotency_key?: string;
    /** Optional override that forces digest deferral. */
    force_digest?: boolean;
  },
  deps: EngineDeps,
): Promise<NotifyResult> {
  const mapping = lookupMapping(args.event_type);
  const clock = deps.clock ?? defaultClock;
  if (!mapping) {
    return { notification_ids: [], decisions: [{ channel: "in_app", decision: "skipped_pref", reason: "unknown_event_type" }] };
  }

  // Idempotency check.
  if (args.idempotency_key) {
    const dupe = await deps.store.findByIdempotency(args.workspace_id, args.idempotency_key);
    if (dupe) {
      return {
        notification_ids: [dupe.id],
        decisions: [{ channel: dupe.channel, decision: "duplicate", reason: "idempotency_key_match" }],
      };
    }
  }

  const prefs = args.user_id ? await deps.preferences.get(args.user_id, args.workspace_id) : null;
  const override = await deps.preferences.getAccountOverride(args.workspace_id);

  const ids: string[] = [];
  const decisions: NotifyResult["decisions"] = [];

  for (const channel of mapping.channels) {
    const dec = channelEnabled({
      event_type: args.event_type,
      channel,
      prefs,
      override,
      ownerOverrideBlocked: !!mapping.owner_override_blocked,
    });
    const baseNotification: Notification = {
      id: deps.newId("request"),
      workspace_id: args.workspace_id,
      user_id: args.user_id,
      channel,
      event_type: args.event_type,
      template: mapping.template,
      subject: mapping.subject(args.payload),
      body: typeof args.payload.body === "string" ? (args.payload.body as string) : "",
      payload: { ...args.payload, _idempotency_key: args.idempotency_key ?? null },
      severity: mapping.severity,
      cta_url: typeof args.payload.cta_url === "string" ? (args.payload.cta_url as string) : null,
      status: "queued",
      attempts: 0,
      next_attempt_at: null,
      last_error: null,
      external_message_id: null,
      read_at: null,
      created_at: clock.iso(),
      sent_at: null,
    };

    if (!dec.enabled) {
      await recordAudit(
        {
          notification_id: baseNotification.id,
          workspace_id: args.workspace_id,
          user_id: args.user_id,
          event_type: args.event_type,
          channel,
          decision: dec.reason === "account_owner_muted" ? "skipped_override" : "skipped_pref",
          reason: dec.reason ?? null,
        },
        { store: deps.store, clock },
      );
      decisions.push({ channel, decision: "skipped", reason: dec.reason ?? null });
      continue;
    }

    // Digest-eligible + user picked daily/hourly?
    const digestCadence = prefs?.digest[args.event_type];
    if (mapping.digestable && (args.force_digest || digestCadence === "daily" || digestCadence === "hourly") && args.user_id && deps.digest) {
      await deferToDigest(
        { user_id: args.user_id, event_type: args.event_type, payload: args.payload },
        deps.digest,
      );
      await deps.store.insert({ ...baseNotification, status: "deferred_digest" });
      await recordAudit(
        {
          notification_id: baseNotification.id,
          workspace_id: args.workspace_id,
          user_id: args.user_id,
          event_type: args.event_type,
          channel,
          decision: "deferred",
          reason: digestCadence ?? "forced",
        },
        { store: deps.store, clock },
      );
      ids.push(baseNotification.id);
      decisions.push({ channel, decision: "deferred", reason: digestCadence ?? "forced" });
      continue;
    }

    // Send.
    let result = baseNotification;
    try {
      result = await dispatch(channel, baseNotification, deps);
    } catch (err) {
      const next = nextAttemptAt(baseNotification.attempts + 1, clock.now());
      result = {
        ...baseNotification,
        status: next.dlq ? "dlq" : "failed",
        attempts: baseNotification.attempts + 1,
        next_attempt_at: next.at,
        last_error: err instanceof Error ? err.message : String(err),
      };
    }
    await deps.store.insert(result);
    await recordAudit(
      {
        notification_id: result.id,
        workspace_id: args.workspace_id,
        user_id: args.user_id,
        event_type: args.event_type,
        channel,
        decision: result.status === "sent" ? "sent" : "failed",
        reason: result.last_error ?? null,
      },
      { store: deps.store, clock },
    );
    ids.push(result.id);
    decisions.push({ channel, decision: result.status, reason: result.last_error ?? null });
  }

  return { notification_ids: ids, decisions };
}

async function dispatch(
  channel: NotificationChannel,
  n: Notification,
  deps: EngineDeps,
): Promise<Notification> {
  switch (channel) {
    case "in_app":
      if (!deps.channels.in_app) throw new Error("in_app channel not configured");
      return sendInApp(n, deps.channels.in_app);
    case "email":
      if (!deps.channels.email) throw new Error("email channel not configured");
      return sendEmail(n, deps.channels.email);
    case "push":
      if (!deps.channels.push) throw new Error("push channel not configured");
      return sendPush(n, deps.channels.push);
    case "sms":
      if (!deps.channels.sms) throw new Error("sms channel not configured");
      return sendSms(n, deps.channels.sms);
    case "slack":
      if (!deps.channels.slack) throw new Error("slack channel not configured");
      return sendSlack(n, deps.channels.slack);
    case "discord":
      if (!deps.channels.discord) throw new Error("discord channel not configured");
      return sendDiscord(n, deps.channels.discord);
  }
}

/** Retry tick — drains the queue and re-attempts failed/queued rows. */
export async function processPendingQueue(deps: EngineDeps, limit = 100): Promise<{ retried: number; dlq: number }> {
  const now = (deps.clock ?? defaultClock).iso();
  const pending = await deps.store.listPending(limit, now);
  let retried = 0;
  let dlq = 0;
  for (const n of pending) {
    if (n.attempts >= 3) {
      await deps.store.updateStatus(n.id, "dlq");
      dlq++;
      continue;
    }
    try {
      const sent = await dispatch(n.channel, n, deps);
      await deps.store.updateStatus(sent.id, sent.status, sent);
      retried++;
    } catch (err) {
      const next = nextAttemptAt(n.attempts + 1, (deps.clock ?? defaultClock).now());
      await deps.store.updateStatus(n.id, next.dlq ? "dlq" : "failed", {
        attempts: n.attempts + 1,
        next_attempt_at: next.at,
        last_error: err instanceof Error ? err.message : String(err),
      });
      if (next.dlq) dlq++;
    }
  }
  return { retried, dlq };
}
