import { describe, expect, it } from "vitest";

import { extendProBoost } from "../src/save-offers.js";
import {
  InMemoryEmitter,
  InMemoryLifecycleStore,
  makeState,
} from "./_helpers.js";

describe("Pro Boost extension", () => {
  it("extends 7 days, emits audit event", async () => {
    const store = new InMemoryLifecycleStore();
    const emitter = new InMemoryEmitter();
    await store.save(makeState());
    const r = await extendProBoost({
      user_id: "usr_test",
      workspace_id: "wsp_test",
      days: 7,
      store,
      emit: emitter.emit,
      now: () => new Date("2026-05-08T00:00:00Z"),
    });
    expect(r.applied).toBe(true);
    expect(r.new_expiry).toBe("2026-05-15T00:00:00.000Z");
    expect(emitter.byName("activation_save_offer_extended")).toHaveLength(1);
  });

  it("does not double-extend", async () => {
    const store = new InMemoryLifecycleStore();
    const emitter = new InMemoryEmitter();
    await store.save(
      makeState({
        pro_boost_extended_at: "2026-05-08T00:00:00Z",
        pro_boost_extends_until: "2026-05-15T00:00:00Z",
      }),
    );
    const r = await extendProBoost({
      user_id: "usr_test",
      workspace_id: "wsp_test",
      days: 7,
      store,
      emit: emitter.emit,
    });
    expect(r.applied).toBe(false);
    expect(r.reason).toBe("already_extended");
  });

  it("refuses suspended workspaces", async () => {
    const store = new InMemoryLifecycleStore();
    const emitter = new InMemoryEmitter();
    await store.save(makeState({ workspace_suspended: true }));
    const r = await extendProBoost({
      user_id: "usr_test",
      workspace_id: "wsp_test",
      days: 7,
      store,
      emit: emitter.emit,
    });
    expect(r.applied).toBe(false);
    expect(r.reason).toBe("workspace_suspended");
  });
});
