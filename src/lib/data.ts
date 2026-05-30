/**
 * Tenant-scoped data access pattern for the web app.
 *
 * Every server component / route handler that reads or writes
 * workspace-owned rows MUST go through `withWorkspace()`. It:
 *   1. Resolves the Auth.js session (`auth()`).
 *   2. Reads `workspaceId` off the session (hydrated by the auth callback).
 *   3. Calls `withWorkspaceContext(workspaceId, fn)` from @funnel/db, which
 *      opens an interactive transaction with `app.workspace_id` SET LOCAL
 *      so Postgres row-level security policies kick in for every SELECT/
 *      INSERT/UPDATE/DELETE.
 *
 * Forgetting to wrap → Postgres returns zero rows because RLS sees an empty
 * `app.workspace_id`. There is no silent cross-tenant leak.
 */
import { auth } from "@/lib/auth";
import { getSession, isOpenAccessMode } from "@/lib/session";
import { withWorkspaceContext, prisma, withAdminContext } from "@funnel/db";
import type { TxClient } from "@funnel/db";

export class NoWorkspaceError extends Error {
  constructor() {
    super(
      "No workspace bound to this session — sign-in callback must run first.",
    );
    this.name = "NoWorkspaceError";
  }
}

/**
 * Run `fn` inside a workspace-scoped transaction. `fn` receives the
 * transactional Prisma client AND the resolved workspaceId so it doesn't
 * have to look it up again.
 */
export async function withWorkspace<T>(
  fn: (tx: TxClient, workspaceId: string) => Promise<T>,
): Promise<T> {
  // getSession() handles both real auth() and the OPEN_ACCESS_MODE
  // fallback that returns a synthetic team workspace. This means every
  // dashboard query Just Works without a real signed-in user when the
  // app is in internal-preview mode.
  const session = await getSession();
  if (!session?.workspaceId) throw new NoWorkspaceError();

  return withWorkspaceContext(session.workspaceId, (tx) =>
    fn(tx, session.workspaceId),
  );
}

/**
 * Session shape every page/dashboard server-component asks for. Bundles
 * the user-display fields with the workspace metadata so callers don't
 * make two round-trips.
 */
export interface DashboardSession {
  userId: string;
  email: string;
  firstName: string;
  fullName: string | null;
  image: string | null;
  workspaceId: string;
  workspaceSlug: string;
  workspaceName: string;
  role: "owner" | "admin" | "editor" | "viewer";
  plan: "free" | "starter" | "growth" | "scale" | "agency";
}

/**
 * Resolve the session + workspace name in one call. Returns null on
 * unauthenticated requests when open-access mode is off so page components
 * can `redirect("/login")`. In OPEN_ACCESS_MODE the synthetic team session
 * is returned so the dashboard is usable without signing in.
 */
export async function getDashboardSession(): Promise<DashboardSession | null> {
  const session = await getSession();
  if (!session?.user?.id || !session.workspaceId) return null;

  const workspace = await withAdminContext((tx) =>
    tx.workspace.findUnique({
      where: { id: session.workspaceId },
      select: { name: true, slug: true, plan: true },
    }),
  );

  if (!workspace) {
    // In open-access mode, the in-memory provisioning latch may have raced
    // with a fresh container — the synthetic session points at a row that
    // hasn't been written yet. Fall through with a synthesized workspace so
    // the dashboard still renders rather than redirecting to /login.
    if (isOpenAccessMode()) {
      return {
        userId: session.user.id,
        email: session.user.email,
        firstName: (session.user.name ?? "Team").split(" ")[0] ?? "Team",
        fullName: session.user.name ?? "GoFunnelAI Team",
        image: session.user.image,
        workspaceId: session.workspaceId,
        workspaceSlug: session.workspaceSlug,
        workspaceName: "GoFunnelAI Team Workspace",
        role: session.role,
        plan: session.plan,
      };
    }
    return null;
  }

  const fullName = session.user.name;
  const email = session.user.email;
  const firstName =
    fullName?.split(" ")[0] ?? email.split("@")[0] ?? "there";

  return {
    userId: session.user.id,
    email,
    firstName,
    fullName,
    image: session.user.image,
    workspaceId: session.workspaceId,
    workspaceSlug: session.workspaceSlug ?? workspace.slug,
    workspaceName: workspace.name,
    role: session.role,
    plan: (workspace.plan ?? "free") as DashboardSession["plan"],
  };
}

/** Re-export so callers don't need a second import for unscoped reads. */
export { prisma };
