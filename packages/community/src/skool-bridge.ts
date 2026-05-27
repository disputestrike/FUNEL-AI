/**
 * Skool bridge (Doc 16 §5.1) — Phase 1 (Months 1–6).
 *
 *   - Skool hosts the actual forum UI at community.gofunnelai.com.
 *   - SSO from GoFunnelAI login lets us auto-create the Skool account.
 *   - XP + Levels are tracked in OUR system (not Skool's), so this bridge
 *     pushes badge updates back to Skool when a user levels up.
 *   - On migration to native (Months 6–18), we run BOTH for 90 days; this
 *     module exposes a `mirror()` helper that double-writes posts during
 *     that window.
 */

export interface SkoolClient {
  /** Idempotent: returns the Skool user id (creates if missing). */
  ensureUser(args: { funnel_user_id: string; email: string; display_name: string }): Promise<{ skool_user_id: string }>;
  /** Set the level badge — Skool calls this on `level_up`. */
  setLevelBadge(args: { skool_user_id: string; level: number; label: string }): Promise<void>;
  /** Mirror a post into Skool for the dual-running migration window. */
  mirrorPost(args: {
    skool_user_id: string;
    hub_slug: string;
    title: string;
    body: string;
    created_at: string;
  }): Promise<{ skool_post_id: string }>;
}

export interface SkoolBridgeDeps {
  skool: SkoolClient;
}

export async function syncUserToSkool(
  args: { funnel_user_id: string; email: string; display_name: string },
  deps: SkoolBridgeDeps,
): Promise<{ skool_user_id: string }> {
  return deps.skool.ensureUser(args);
}

export async function pushLevelBadge(
  args: { skool_user_id: string; level: number },
  deps: SkoolBridgeDeps,
): Promise<void> {
  const labels: Record<number, string> = {
    1: "Newcomer",
    2: "Active",
    3: "Connected",
    4: "Regular",
    5: "Flair Holder",
    6: "Event Host",
    7: "Mentor",
    8: "Beta Builder",
    9: "Inner Circle",
    10: "Founder's List",
  };
  await deps.skool.setLevelBadge({
    skool_user_id: args.skool_user_id,
    level: args.level,
    label: labels[args.level] ?? `L${args.level}`,
  });
}

/**
 * Dual-running post mirror — used during the Skool → native migration window.
 * Returns the Skool post id (for later linking back from native).
 */
export async function mirrorPostToSkool(
  args: {
    skool_user_id: string;
    hub_slug: string;
    title: string;
    body: string;
    created_at: string;
  },
  deps: SkoolBridgeDeps,
): Promise<{ skool_post_id: string }> {
  return deps.skool.mirrorPost(args);
}
