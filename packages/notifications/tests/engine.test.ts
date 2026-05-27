import { describe, expect, it } from "vitest";

import {
  defaultPrefMatrix,
  InMemoryNotificationStore,
  InMemoryPreferencesStore,
  isOwnerMutable,
  lookupMapping,
  nextAttemptAt,
  notify,
  setMutedEvents,
  TCPA_QUIET_START_HOUR,
} from "../src/index.js";

let n = 0;
const newId = (e: string) => `${e}_${(n++).toString().padStart(6, "0")}`;

describe("event mapping", () => {
  it("returns null for unknown events", () => {
    expect(lookupMapping("xyz_unknown")).toBeNull();
  });
  it("billing events are owner_override_blocked", () => {
    const m = lookupMapping("payment_failed_own")!;
    expect(m.owner_override_blocked).toBe(true);
    expect(isOwnerMutable("payment_failed_own", true)).toBe(false);
  });
});

describe("retry policy", () => {
  it("delays grow exponentially up to DLQ", () => {
    const t0 = 0;
    const a1 = nextAttemptAt(1, t0);
    const a2 = nextAttemptAt(2, t0);
    const a3 = nextAttemptAt(3, t0);
    expect(a1.dlq).toBe(false);
    expect(a2.dlq).toBe(false);
    expect(a3.dlq).toBe(true);
    expect(new Date(a1.at!).valueOf() < new Date(a2.at!).valueOf()).toBe(true);
  });
});

describe("notify", () => {
  it("fans out to default channels + writes audit rows", async () => {
    const store = new InMemoryNotificationStore();
    const prefs = new InMemoryPreferencesStore();
    const result = await notify(
      {
        workspace_id: "w1",
        user_id: "u1",
        event_type: "new_lead",
        payload: { lead_name: "Maria G." },
      },
      {
        store,
        preferences: prefs,
        newId,
        channels: {
          in_app: { store: { insert: async (n) => n } },
          email: {
            email: { send: async () => ({ message_id: "m1" }) },
            resolveRecipient: async () => "u@example.com",
          },
          push: {
            push: { send: async () => ({ accepted: 1, rejected: 0, errors: [] }) },
            listDevices: async () => [{ device_token: "tok", platform: "ios" }],
          },
        },
      },
    );
    expect(result.notification_ids.length).toBe(3);
    expect(store.audits.length).toBe(3);
  });

  it("owner override mutes a mutable event for everyone", async () => {
    const store = new InMemoryNotificationStore();
    const prefs = new InMemoryPreferencesStore();
    await setMutedEvents(
      { workspace_id: "w1", muted_event_types: ["new_lead"], actor_user_id: "owner" },
      { store: prefs },
    );
    const r = await notify(
      {
        workspace_id: "w1",
        user_id: "u1",
        event_type: "new_lead",
        payload: {},
      },
      {
        store,
        preferences: prefs,
        newId,
        channels: {
          in_app: { store: { insert: async (n) => n } },
          email: {
            email: { send: async () => ({ message_id: "m" }) },
            resolveRecipient: async () => "x@example.com",
          },
          push: {
            push: { send: async () => ({ accepted: 1, rejected: 0, errors: [] }) },
            listDevices: async () => [],
          },
        },
      },
    );
    expect(r.decisions.every((d) => d.decision === "skipped")).toBe(true);
  });

  it("billing event is NOT mutable", async () => {
    const store = new InMemoryNotificationStore();
    const prefs = new InMemoryPreferencesStore();
    await setMutedEvents(
      { workspace_id: "w1", muted_event_types: ["payment_failed_own"], actor_user_id: "owner" },
      { store: prefs },
    );
    const r = await notify(
      {
        workspace_id: "w1",
        user_id: "u1",
        event_type: "payment_failed_own",
        payload: {},
      },
      {
        store,
        preferences: prefs,
        newId,
        channels: {
          in_app: { store: { insert: async (n) => n } },
          email: {
            email: { send: async () => ({ message_id: "m" }) },
            resolveRecipient: async () => "x@example.com",
          },
          push: {
            push: { send: async () => ({ accepted: 1, rejected: 0, errors: [] }) },
            listDevices: async () => [],
          },
        },
      },
    );
    // Channels should fire; override is ignored.
    expect(r.decisions.find((d) => d.channel === "email")?.decision).toBe("sent");
  });

  it("is idempotent on idempotency_key", async () => {
    const store = new InMemoryNotificationStore();
    const prefs = new InMemoryPreferencesStore();
    const dispatch = {
      store,
      preferences: prefs,
      newId,
      channels: {
        in_app: { store: { insert: async (n: any) => n } },
        email: {
          email: { send: async () => ({ message_id: "m" }) },
          resolveRecipient: async () => "x@example.com",
        },
        push: {
          push: { send: async () => ({ accepted: 1, rejected: 0, errors: [] }) },
          listDevices: async () => [],
        },
      },
    };
    const a = await notify(
      {
        workspace_id: "w1",
        user_id: "u1",
        event_type: "new_lead",
        payload: { lead_name: "Maria" },
        idempotency_key: "lead_123",
      },
      dispatch,
    );
    const b = await notify(
      {
        workspace_id: "w1",
        user_id: "u1",
        event_type: "new_lead",
        payload: { lead_name: "Maria" },
        idempotency_key: "lead_123",
      },
      dispatch,
    );
    expect(b.decisions[0]?.decision).toBe("duplicate");
  });
});
