/**
 * Tests for the GoFunnelAI Campaign lifecycle state machine.
 *
 * Coverage:
 *  - Every declared forward transition is accepted by `canTransition`.
 *  - A representative set of invalid transitions is rejected.
 *  - Same-state self-transitions are rejected.
 *  - Every CampaignStatus is reachable from DRAFT via the forward chain.
 *  - `emitTransition` notifies listeners on success and throws on failure.
 *  - ARCHIVED is terminal — no outbound transitions exist.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ALLOWED_TRANSITIONS,
  CampaignStatus,
  FORWARD_CHAIN,
  IllegalCampaignTransitionError,
  __resetListeners,
  canTransition,
  emitTransition,
  isTerminal,
  nextStates,
  onTransition,
} from "../src/launch/index.js";

afterEach(() => {
  __resetListeners();
});

describe("ALLOWED_TRANSITIONS table", () => {
  it("covers every CampaignStatus value", () => {
    const allStates = Object.values(CampaignStatus);
    for (const s of allStates) {
      expect(ALLOWED_TRANSITIONS[s]).toBeDefined();
    }
  });

  it("never lists a same-state self-transition", () => {
    for (const [from, tos] of Object.entries(ALLOWED_TRANSITIONS)) {
      expect(tos).not.toContain(from);
    }
  });

  it("declares ARCHIVED terminal (no outbound transitions)", () => {
    expect(ALLOWED_TRANSITIONS[CampaignStatus.Archived]).toEqual([]);
    expect(isTerminal(CampaignStatus.Archived)).toBe(true);
  });
});

describe("canTransition — valid transitions accepted", () => {
  it("accepts every declared forward step on the canonical chain", () => {
    for (let i = 0; i < FORWARD_CHAIN.length - 1; i++) {
      const from = FORWARD_CHAIN[i]!;
      const to = FORWARD_CHAIN[i + 1]!;
      expect(canTransition(from, to)).toBe(true);
    }
  });

  it("accepts every entry declared in the transition table", () => {
    for (const [fromStr, tos] of Object.entries(ALLOWED_TRANSITIONS)) {
      const from = fromStr as CampaignStatus;
      for (const to of tos) {
        expect(canTransition(from, to)).toBe(true);
      }
    }
  });

  it("accepts backwards motion from READY_FOR_REVIEW to DRAFT", () => {
    expect(canTransition(CampaignStatus.ReadyForReview, CampaignStatus.Draft)).toBe(true);
  });

  it("accepts re-review path from APPROVED back to READY_FOR_REVIEW", () => {
    expect(canTransition(CampaignStatus.Approved, CampaignStatus.ReadyForReview)).toBe(true);
  });

  it("accepts archival from every non-terminal state", () => {
    for (const s of Object.values(CampaignStatus)) {
      if (s === CampaignStatus.Archived) continue;
      expect(canTransition(s, CampaignStatus.Archived)).toBe(true);
    }
  });
});

describe("canTransition — invalid transitions blocked", () => {
  it("rejects same-state self-transitions for every state", () => {
    for (const s of Object.values(CampaignStatus)) {
      expect(canTransition(s, s)).toBe(false);
    }
  });

  it("rejects skipping over GENERATING (DRAFT -> READY_FOR_REVIEW)", () => {
    expect(canTransition(CampaignStatus.Draft, CampaignStatus.ReadyForReview)).toBe(false);
  });

  it("rejects skipping APPROVED (READY_FOR_REVIEW -> EXPORTED)", () => {
    expect(canTransition(CampaignStatus.ReadyForReview, CampaignStatus.Exported)).toBe(false);
  });

  it("rejects skipping EXPORTED (APPROVED -> LAUNCHED_EXTERNALLY)", () => {
    expect(canTransition(CampaignStatus.Approved, CampaignStatus.LaunchedExternally)).toBe(false);
  });

  it("rejects jumping to OPTIMIZING from EXPORTED", () => {
    expect(canTransition(CampaignStatus.Exported, CampaignStatus.Optimizing)).toBe(false);
  });

  it("rejects reviving an ARCHIVED campaign to any state", () => {
    for (const s of Object.values(CampaignStatus)) {
      if (s === CampaignStatus.Archived) continue;
      expect(canTransition(CampaignStatus.Archived, s)).toBe(false);
    }
  });

  it("rejects going LAUNCHED_EXTERNALLY -> DRAFT", () => {
    expect(canTransition(CampaignStatus.LaunchedExternally, CampaignStatus.Draft)).toBe(false);
  });

  it("rejects going TRACKING_ACTIVE -> APPROVED", () => {
    expect(canTransition(CampaignStatus.TrackingActive, CampaignStatus.Approved)).toBe(false);
  });
});

describe("Reachability from DRAFT", () => {
  it("can reach every state via a BFS over allowed transitions", () => {
    const visited = new Set<CampaignStatus>([CampaignStatus.Draft]);
    const queue: CampaignStatus[] = [CampaignStatus.Draft];

    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const next of nextStates(current)) {
        if (!visited.has(next)) {
          visited.add(next);
          queue.push(next);
        }
      }
    }

    for (const s of Object.values(CampaignStatus)) {
      expect(visited.has(s)).toBe(true);
    }
  });

  it("can traverse the canonical forward chain end-to-end", () => {
    for (let i = 0; i < FORWARD_CHAIN.length - 1; i++) {
      const from = FORWARD_CHAIN[i]!;
      const to = FORWARD_CHAIN[i + 1]!;
      expect(canTransition(from, to)).toBe(true);
    }
    expect(FORWARD_CHAIN[0]).toBe(CampaignStatus.Draft);
    expect(FORWARD_CHAIN[FORWARD_CHAIN.length - 1]).toBe(CampaignStatus.Archived);
  });
});

describe("emitTransition", () => {
  it("returns an event record for a valid transition", () => {
    const evt = emitTransition({
      campaignId: "cmp_test_1",
      from: CampaignStatus.Draft,
      to: CampaignStatus.Generating,
      actorId: "usr_abc",
      reason: "kickoff",
    });
    expect(evt.campaignId).toBe("cmp_test_1");
    expect(evt.from).toBe(CampaignStatus.Draft);
    expect(evt.to).toBe(CampaignStatus.Generating);
    expect(evt.actorId).toBe("usr_abc");
    expect(evt.reason).toBe("kickoff");
    expect(evt.at).toBeInstanceOf(Date);
  });

  it("notifies every registered listener", () => {
    const a = vi.fn();
    const b = vi.fn();
    onTransition(a);
    onTransition(b);

    emitTransition({
      campaignId: "cmp_test_2",
      from: CampaignStatus.Generating,
      to: CampaignStatus.ReadyForReview,
    });

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it("unsubscribes via the returned function", () => {
    const a = vi.fn();
    const off = onTransition(a);
    off();

    emitTransition({
      campaignId: "cmp_test_3",
      from: CampaignStatus.Draft,
      to: CampaignStatus.Generating,
    });

    expect(a).not.toHaveBeenCalled();
  });

  it("does not call listeners when the transition is illegal", () => {
    const a = vi.fn();
    onTransition(a);

    expect(() =>
      emitTransition({
        campaignId: "cmp_test_4",
        from: CampaignStatus.Draft,
        to: CampaignStatus.LaunchedExternally,
      }),
    ).toThrow(IllegalCampaignTransitionError);

    expect(a).not.toHaveBeenCalled();
  });

  it("swallows listener errors so later listeners still fire", () => {
    const bad = vi.fn(() => {
      throw new Error("boom");
    });
    const good = vi.fn();
    onTransition(bad);
    onTransition(good);

    expect(() =>
      emitTransition({
        campaignId: "cmp_test_5",
        from: CampaignStatus.Draft,
        to: CampaignStatus.Generating,
      }),
    ).not.toThrow();

    expect(bad).toHaveBeenCalledTimes(1);
    expect(good).toHaveBeenCalledTimes(1);
  });
});

describe("IllegalCampaignTransitionError", () => {
  it("includes the campaign id, from, and to in the message", () => {
    try {
      emitTransition({
        campaignId: "cmp_err",
        from: CampaignStatus.Draft,
        to: CampaignStatus.TrackingActive,
      });
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(IllegalCampaignTransitionError);
      const err = e as IllegalCampaignTransitionError;
      expect(err.campaignId).toBe("cmp_err");
      expect(err.from).toBe(CampaignStatus.Draft);
      expect(err.to).toBe(CampaignStatus.TrackingActive);
      expect(err.message).toContain("cmp_err");
      expect(err.message).toContain(CampaignStatus.Draft);
      expect(err.message).toContain(CampaignStatus.TrackingActive);
    }
  });
});
