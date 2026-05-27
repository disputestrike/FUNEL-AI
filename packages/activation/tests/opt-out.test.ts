import { describe, expect, it } from "vitest";

import { getOptOut, setOptOut, shouldSuppress } from "../src/opt-out.js";
import {
  InMemoryEmitter,
  InMemoryLifecycleStore,
  InMemoryOptOutStore,
  makeState,
} from "./_helpers.js";

describe("Opt-out", () => {
  it("setOptOut(all) mutes everything via coaching_opt_out", async () => {
    const store = new InMemoryLifecycleStore();
    const emitter = new InMemoryEmitter();
    await store.save(makeState());
    const prefs = await setOptOut({
      user_id: "usr_test",
      workspace_id: "wsp_test",
      level: "all",
      value: true,
      store,
      emit: emitter.emit,
    });
    expect(prefs.mute_all).toBe(true);
    expect(emitter.byName("user_opted_out")).toHaveLength(1);
  });

  it("setOptOut(email) only mutes email", async () => {
    const store = new InMemoryLifecycleStore();
    const emitter = new InMemoryEmitter();
    await store.save(makeState());
    await setOptOut({
      user_id: "usr_test",
      workspace_id: "wsp_test",
      level: "email",
      value: true,
      store,
      emit: emitter.emit,
    });
    const s = await store.load("usr_test");
    expect(s?.email_opt_out).toBe(true);
    expect(s?.sms_opt_out).toBe(false);
  });

  it("shouldSuppress respects workspace_mute_non_billing for non-billing roles", () => {
    const prefs = {
      mute_all: false,
      mute_email: false,
      mute_push: false,
      mute_sms: false,
      mute_in_app: false,
      workspace_mute_non_billing: true,
    };
    expect(
      shouldSuppress({ state: prefs, channel: "email", member_role: "editor" }),
    ).toBe(true);
    expect(
      shouldSuppress({ state: prefs, channel: "email", member_role: "billing" }),
    ).toBe(false);
    expect(
      shouldSuppress({ state: prefs, channel: "email", member_role: "owner" }),
    ).toBe(false);
  });

  it("getOptOut merges per-user + workspace prefs", async () => {
    const store = new InMemoryLifecycleStore();
    const optStore = new InMemoryOptOutStore();
    await store.save(makeState({ email_opt_out: true }));
    optStore.workspaceMuteNonBilling.set("wsp_test", true);
    const prefs = await getOptOut({
      user_id: "usr_test",
      workspace_id: "wsp_test",
      store,
      optStore,
    });
    expect(prefs.mute_email).toBe(true);
    expect(prefs.workspace_mute_non_billing).toBe(true);
  });
});
