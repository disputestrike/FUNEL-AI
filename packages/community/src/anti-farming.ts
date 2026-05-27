/**
 * Anti-farming utilities.
 *
 * Daily-bucket XP cap per category + cross-referenced source verification:
 *   - `mentor_mentee_first_lead` requires a verified Match row.
 *   - `funnel_shipped` requires a funnel_id that hasn't fired this source before.
 *   - `first_lead` and `first_1k_revenue` are once-per-funnel.
 *
 * The cap math lives in `xp.ts`; this module is the validation layer that
 * external callers route through before calling `grantXp`.
 */

import type { CommunityStore } from "./store.js";
import type { XpSource } from "./types.js";

export interface AntiFarmDeps {
  store: CommunityStore;
  /** Used to check whether a mentee→mentor match exists. */
  getActiveMatchForMentee: (mentee_user_id: string) => Promise<{ mentor_user_id: string } | null>;
}

export interface ValidationResult {
  ok: boolean;
  reason?: string;
}

/**
 * Validate a proposed XP grant before it lands. The caller (e.g. an event
 * subscriber on `funnel_published`) calls this with the source + source_id and
 * acts on the response — `ok: false` → skip the grant.
 */
export async function validateXpGrant(
  args: {
    user_id: string;
    source: XpSource;
    source_id?: string | null;
    /** For `mentor_mentee_first_lead`, the mentee_user_id. */
    related_user_id?: string;
  },
  deps: AntiFarmDeps,
): Promise<ValidationResult> {
  switch (args.source) {
    case "mentor_mentee_first_lead": {
      if (!args.related_user_id) return { ok: false, reason: "mentee_user_id required" };
      const match = await deps.getActiveMatchForMentee(args.related_user_id);
      if (!match) return { ok: false, reason: "no active mentor-mentee match" };
      if (match.mentor_user_id !== args.user_id) {
        return { ok: false, reason: "not the active mentor" };
      }
      return { ok: true };
    }
    case "funnel_shipped":
    case "first_lead":
    case "first_1k_revenue": {
      if (!args.source_id) return { ok: false, reason: "source_id (funnel_id) required" };
      const prior = await deps.store.listXpForUser(args.user_id);
      const exists = prior.some((r) => r.source === args.source && r.source_id === args.source_id);
      return exists
        ? { ok: false, reason: "already granted for this funnel" }
        : { ok: true };
    }
    default:
      return { ok: true };
  }
}
