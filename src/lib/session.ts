/**
 * Session resolver — single chokepoint for "who is the current user?".
 *
 * Wraps NextAuth's `auth()` with an INTERNAL_PREVIEW_MODE escape hatch so the
 * GoFunnelAI team can use the dashboard before the product is public-facing.
 *
 * Modes:
 *   1. Real session  — `auth()` returns a user. Pass through unchanged.
 *   2. INTERNAL_PREVIEW_MODE=1 + no session — return a synthetic session
 *      pointing at the auto-provisioned `workspace_internal_preview` workspace.
 *      Anyone with the URL is treated as the internal team owner. Use this
 *      ONLY for internal access on a not-yet-commercial deploy.
 *   3. Neither — return null. Middleware will bounce to /login.
 *
 * To go commercial: unset INTERNAL_PREVIEW_MODE in Railway. Auth is enforced
 * immediately on the next deploy. No code change needed.
 */
import { auth } from "@/lib/auth";
import { prisma, withAdminContext, WorkspaceRole } from "@funnel/db";

export interface AppSession {
  user: { id: string; email: string; name: string | null; image: string | null };
  workspaceId: string;
  workspaceSlug: string;
  role: "owner" | "admin" | "editor" | "viewer";
  plan: "free" | "starter" | "growth" | "scale" | "agency";
}

const INTERNAL_USER_ID = "user_internal_preview";
const INTERNAL_WORKSPACE_ID = "workspace_internal_preview";
const INTERNAL_WORKSPACE_MEMBER_ID = "wsmember_internal_preview";
const INTERNAL_EMAIL = "team@gofunnelai.com";

// In-process latch — once provisioned for this container we skip the DB
// roundtrip on every subsequent request.
let internalProvisioned = false;

function isPreviewMode(): boolean {
  return process.env.INTERNAL_PREVIEW_MODE === "1";
}

/**
 * Idempotent — creates the internal user + workspace + owner membership
 * if they don't already exist. Safe to call concurrently (uses upsert).
 */
async function ensureInternalRecords(): Promise<void> {
  if (internalProvisioned) return;

  try {
    await withAdminContext(async (tx) => {
      await tx.user.upsert({
        where: { id: INTERNAL_USER_ID },
        update: {},
        create: {
          id: INTERNAL_USER_ID,
          name: "GoFunnelAI Team",
          email: INTERNAL_EMAIL,
          emailNormalized: INTERNAL_EMAIL,
          // Sentinel hash — never used; preview mode bypasses login entirely.
          // If preview mode is later disabled this account stays inert.
          passwordHash: null,
          passwordSetAt: null,
        },
      });

      await tx.workspace.upsert({
        where: { id: INTERNAL_WORKSPACE_ID },
        update: {},
        create: {
          id: INTERNAL_WORKSPACE_ID,
          slug: "internal",
          name: "GoFunnelAI Internal",
          ownerUserId: INTERNAL_USER_ID,
          plan: "agency",
        },
      });

      await tx.workspaceMember.upsert({
        where: { id: INTERNAL_WORKSPACE_MEMBER_ID },
        update: {},
        create: {
          id: INTERNAL_WORKSPACE_MEMBER_ID,
          workspaceId: INTERNAL_WORKSPACE_ID,
          userId: INTERNAL_USER_ID,
          role: WorkspaceRole.owner,
          joinedAt: new Date(),
        },
      });
    });

    internalProvisioned = true;
  } catch (err) {
    // Provisioning is best-effort — if the DB is down or schema is stale,
    // log and fall through. The synthetic session is returned regardless,
    // so the dashboard still renders (it just won't have real data).
    console.error("[session] preview-mode provisioning failed:", err);
  }
}

function syntheticInternalSession(): AppSession {
  return {
    user: {
      id: INTERNAL_USER_ID,
      email: INTERNAL_EMAIL,
      name: "GoFunnelAI Team",
      image: null,
    },
    workspaceId: INTERNAL_WORKSPACE_ID,
    workspaceSlug: "internal",
    role: "owner",
    plan: "agency",
  };
}

/**
 * Returns the active session, or `null` when there's no user and preview
 * mode is off. Use this in every dashboard server component instead of
 * `await auth()` so internal-preview mode works transparently.
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
      workspaceId: real.workspaceId ?? INTERNAL_WORKSPACE_ID,
      workspaceSlug: real.workspaceSlug ?? "internal",
      role: real.role ?? "owner",
      plan: real.plan ?? "free",
    };
  }

  if (!isPreviewMode()) return null;

  await ensureInternalRecords();
  return syntheticInternalSession();
}

/**
 * For middleware — true if the current deploy should bypass login walls.
 * Exposed separately so middleware doesn't need a DB hit.
 */
export function isInternalPreviewMode(): boolean {
  return isPreviewMode();
}
