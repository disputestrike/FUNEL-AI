/**
 * Session resolver — single chokepoint for "who is the current user?".
 *
 * Two modes, switched by the OPEN_ACCESS_MODE env var:
 *
 *   1. OPEN_ACCESS_MODE=1 — the dashboard is open to the GoFunnelAI team
 *      and trusted collaborators with NO login required. This is the FULL
 *      product, not a preview: every feature (funnel generation, RevTry
 *      voice, ad publishing, CRM, billing, image generation, command center,
 *      analytics) works exactly as it would for a signed-in user. Anyone
 *      hitting the URL is the synthetic "GoFunnelAI Team" owner of a
 *      stable `workspace_team` workspace, so all funnels, leads, campaigns,
 *      and call recordings persist and are shared across the team.
 *
 *   2. OPEN_ACCESS_MODE unset — normal commercial mode. Real login required
 *      (email+password or Google). Each signed-up account gets its own
 *      workspace.
 *
 * To flip between them: set or unset OPEN_ACCESS_MODE in Railway → redeploy.
 * No code change required.
 */
import { auth } from "@/lib/auth";
import { withAdminContext, WorkspaceRole } from "@funnel/db";

export interface AppSession {
  user: { id: string; email: string; name: string | null; image: string | null };
  workspaceId: string;
  workspaceSlug: string;
  role: "owner" | "admin" | "editor" | "viewer";
  plan: "free" | "starter" | "growth" | "scale" | "agency";
}

const TEAM_USER_ID = "user_team";
const TEAM_WORKSPACE_ID = "workspace_team";
const TEAM_WORKSPACE_MEMBER_ID = "wsmember_team";
const TEAM_EMAIL = "team@gofunnelai.com";

// In-process latch — once provisioned for this container we skip the DB
// roundtrip on every subsequent request.
let teamProvisioned = false;

export function isOpenAccessMode(): boolean {
  return process.env.OPEN_ACCESS_MODE === "1";
}

/**
 * Idempotent — creates the team user + workspace + owner membership if
 * they don't already exist. Safe to call concurrently (uses upsert).
 * Plan is set to "agency" so every feature gate (Scale-only RevTry voice
 * cloning, Growth+ custom domains, Agency white-label, etc.) is unlocked.
 */
async function ensureTeamRecords(): Promise<void> {
  if (teamProvisioned) return;

  try {
    await withAdminContext(async (tx) => {
      await tx.user.upsert({
        where: { id: TEAM_USER_ID },
        update: {},
        create: {
          id: TEAM_USER_ID,
          name: "GoFunnelAI Team",
          email: TEAM_EMAIL,
          emailNormalized: TEAM_EMAIL,
          // No password — open-access mode bypasses login entirely. If
          // OPEN_ACCESS_MODE is later unset this account stays inert.
          passwordHash: null,
          passwordSetAt: null,
        },
      });

      await tx.workspace.upsert({
        where: { id: TEAM_WORKSPACE_ID },
        update: {},
        create: {
          id: TEAM_WORKSPACE_ID,
          slug: "team",
          name: "GoFunnelAI Team Workspace",
          ownerUserId: TEAM_USER_ID,
          // Agency plan unlocks every feature gate — full product surface.
          plan: "agency",
        },
      });

      await tx.workspaceMember.upsert({
        where: { id: TEAM_WORKSPACE_MEMBER_ID },
        update: {},
        create: {
          id: TEAM_WORKSPACE_MEMBER_ID,
          workspaceId: TEAM_WORKSPACE_ID,
          userId: TEAM_USER_ID,
          role: WorkspaceRole.owner,
          joinedAt: new Date(),
        },
      });
    });

    teamProvisioned = true;
  } catch (err) {
    // Provisioning is best-effort — if the DB is down or schema is stale,
    // log and fall through. The synthetic session is returned regardless,
    // so the dashboard still renders (it just won't have real data).
    console.error("[session] team workspace provisioning failed:", err);
  }
}

function syntheticTeamSession(): AppSession {
  return {
    user: {
      id: TEAM_USER_ID,
      email: TEAM_EMAIL,
      name: "GoFunnelAI Team",
      image: null,
    },
    workspaceId: TEAM_WORKSPACE_ID,
    workspaceSlug: "team",
    role: "owner",
    plan: "agency",
  };
}

/**
 * Returns the active session, or `null` when there's no user and open-
 * access mode is off. Use this in every dashboard server component
 * instead of `await auth()` so open-access mode works transparently.
 */
export async function getSession(): Promise<AppSession | null> {
  const real = await auth();
  if (real?.user?.id) {
    return {
      user: {
        id: real.user.id,
        email: real.user.email ?? "",
        name: real.user.name ?? null,
        image: real.user.image ?? null,
      },
      workspaceId: real.workspaceId ?? TEAM_WORKSPACE_ID,
      workspaceSlug: real.workspaceSlug ?? "team",
      role: real.role ?? "owner",
      plan: real.plan ?? "free",
    };
  }

  if (!isOpenAccessMode()) return null;

  await ensureTeamRecords();
  return syntheticTeamSession();
}
