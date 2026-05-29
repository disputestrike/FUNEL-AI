/**
 * GoFunnelAI — Campaign lifecycle state machine.
 *
 * Canonical happy-path:
 *
 *   DRAFT
 *     -> GENERATING
 *     -> READY_FOR_REVIEW
 *     -> APPROVED
 *     -> EXPORTED
 *     -> LAUNCHED_EXTERNALLY
 *     -> TRACKING_ACTIVE
 *     -> OPTIMIZING
 *     -> ARCHIVED
 *
 * The transition table below is intentionally permissive for backwards
 * motion (a state can be reverted to DRAFT for re-edits, or kicked back from
 * READY_FOR_REVIEW to GENERATING for a regen), but every forward step is
 * gated explicitly. ARCHIVED is a sink — once archived, the campaign is
 * immutable except for cosmetic metadata.
 *
 * Consumers should treat `canTransition` as the single source of truth. The
 * `emitTransition` helper appends to an in-memory event log and fires
 * subscribed listeners; backend code is expected to additionally write to
 * the durable `campaign_events` table when persisting transitions.
 */

import { CampaignStatus } from "./types.js";

// ---------------------------------------------------------------------------
// Transition table
// ---------------------------------------------------------------------------

/**
 * Allowed transitions. Each key is a source state; the array lists every
 * valid destination state. Same-state "transitions" are NOT allowed (use a
 * different mechanism for idempotent re-emits).
 */
export const ALLOWED_TRANSITIONS: Readonly<Record<CampaignStatus, readonly CampaignStatus[]>> = {
  [CampaignStatus.Draft]: [
    CampaignStatus.Generating,
    CampaignStatus.Archived,
  ],
  [CampaignStatus.Generating]: [
    CampaignStatus.ReadyForReview,
    CampaignStatus.Draft, // generation failed / user cancelled
    CampaignStatus.Archived,
  ],
  [CampaignStatus.ReadyForReview]: [
    CampaignStatus.Approved,
    CampaignStatus.Draft, // reviewer kicked back for edits
    CampaignStatus.Generating, // reviewer requested a regen
    CampaignStatus.Archived,
  ],
  [CampaignStatus.Approved]: [
    CampaignStatus.Exported,
    CampaignStatus.ReadyForReview, // re-review required
    CampaignStatus.Archived,
  ],
  [CampaignStatus.Exported]: [
    CampaignStatus.LaunchedExternally,
    CampaignStatus.Approved, // need to re-export with new variant
    CampaignStatus.Archived,
  ],
  [CampaignStatus.LaunchedExternally]: [
    CampaignStatus.TrackingActive,
    CampaignStatus.Archived,
  ],
  [CampaignStatus.TrackingActive]: [
    CampaignStatus.Optimizing,
    CampaignStatus.Archived,
  ],
  [CampaignStatus.Optimizing]: [
    CampaignStatus.TrackingActive, // optimizer paused
    CampaignStatus.Archived,
  ],
  [CampaignStatus.Archived]: [
    // terminal — no outbound transitions
  ],
} as const;

/**
 * Canonical forward chain in spec order. Used by tooling, reporting, and
 * the test suite's reachability proof.
 */
export const FORWARD_CHAIN: readonly CampaignStatus[] = [
  CampaignStatus.Draft,
  CampaignStatus.Generating,
  CampaignStatus.ReadyForReview,
  CampaignStatus.Approved,
  CampaignStatus.Exported,
  CampaignStatus.LaunchedExternally,
  CampaignStatus.TrackingActive,
  CampaignStatus.Optimizing,
  CampaignStatus.Archived,
] as const;

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

/**
 * Returns true iff `from -> to` is a valid transition. Same-state moves are
 * always rejected.
 */
export function canTransition(from: CampaignStatus, to: CampaignStatus): boolean {
  if (from === to) return false;
  const allowed = ALLOWED_TRANSITIONS[from];
  return allowed.includes(to);
}

/**
 * Returns true iff `state` has no outbound transitions (i.e. ARCHIVED).
 */
export function isTerminal(state: CampaignStatus): boolean {
  return ALLOWED_TRANSITIONS[state].length === 0;
}

/**
 * Returns the next allowed states from `from`, in declaration order.
 */
export function nextStates(from: CampaignStatus): readonly CampaignStatus[] {
  return ALLOWED_TRANSITIONS[from];
}

// ---------------------------------------------------------------------------
// Event emitter
// ---------------------------------------------------------------------------

export interface CampaignTransitionEvent {
  campaignId: string;
  from: CampaignStatus;
  to: CampaignStatus;
  at: Date;
  actorId: string | null;
  reason: string | null;
  metadata: Record<string, unknown>;
}

export class IllegalCampaignTransitionError extends Error {
  readonly from: CampaignStatus;
  readonly to: CampaignStatus;
  readonly campaignId: string;
  constructor(campaignId: string, from: CampaignStatus, to: CampaignStatus) {
    super(
      `Illegal campaign transition for ${campaignId}: ${from} -> ${to}. ` +
        `Allowed from ${from}: [${ALLOWED_TRANSITIONS[from].join(", ")}]`,
    );
    this.name = "IllegalCampaignTransitionError";
    this.from = from;
    this.to = to;
    this.campaignId = campaignId;
  }
}

export type CampaignTransitionListener = (event: CampaignTransitionEvent) => void;

const listeners: Set<CampaignTransitionListener> = new Set();

/**
 * Subscribe to every emitted transition. Returns an unsubscribe function.
 * Listeners are invoked synchronously in registration order; a listener that
 * throws will not prevent later listeners from running.
 */
export function onTransition(listener: CampaignTransitionListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Validate the transition, then notify all subscribed listeners and return
 * the event record. Throws `IllegalCampaignTransitionError` if the move is
 * disallowed; the listeners are NOT called in that case.
 */
export function emitTransition(input: {
  campaignId: string;
  from: CampaignStatus;
  to: CampaignStatus;
  actorId?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown>;
  at?: Date;
}): CampaignTransitionEvent {
  if (!canTransition(input.from, input.to)) {
    throw new IllegalCampaignTransitionError(input.campaignId, input.from, input.to);
  }

  const event: CampaignTransitionEvent = {
    campaignId: input.campaignId,
    from: input.from,
    to: input.to,
    at: input.at ?? new Date(),
    actorId: input.actorId ?? null,
    reason: input.reason ?? null,
    metadata: input.metadata ?? {},
  };

  for (const listener of listeners) {
    try {
      listener(event);
    } catch {
      // Swallow listener errors so one bad subscriber does not break the
      // transition pipeline. Callers needing visibility should register an
      // error-handling wrapper.
    }
  }

  return event;
}

/**
 * Test-only escape hatch. Removes every registered listener. Do not call
 * from production code.
 */
export function __resetListeners(): void {
  listeners.clear();
}
