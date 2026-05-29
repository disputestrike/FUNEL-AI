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
  const session = await auth();
  if (!session?.workspaceId) throw new NoWorkspaceError();

  return withWorkspaceContext(session.workspaceId, (tx) =>
    fn(tx, session.workspaceId!),
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
 * Resolve `auth()` + the workspace name in one call. Returns null on
 * unauthenticated requests so page components can `redirect("/login")`.
 */
export async function getDashboardSession(): Promise<DashboardSession | null> {
  const session = await auth();
  if (!session?.user?.id || !session.workspaceId) return null;

  const workspace = await withAdminContext((tx) =>
    tx.workspace.findUnique({
      where: { id: session.workspaceId! },
      select: { name: true, slug: true, plan: true },
    }),
  );

  if (!workspace) return null;

  const fullName = session.user.name ?? null;
  const email = session.user.email ?? "";
  const firstName =
    fullName?.split(" ")[0] ?? email.split("@")[0] ?? "there";

  return {
    userId: session.user.id,
    email,
    firstName,
    fullName,
    image: session.user.image ?? null,
    workspaceId: session.workspaceId!,
    workspaceSlug: session.workspaceSlug ?? workspace.slug,
    workspaceName: workspace.name,
    role: (session.role ?? "viewer") as DashboardSession["role"],
    plan: (workspace.plan ?? "free") as DashboardSession["plan"],
  };
}

/** Re-export so callers don't need a second import for unscoped reads. */
export { prisma };
