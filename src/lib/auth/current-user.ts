/**
 * Auth.js → DB bridge.
 *
 * `getCurrentSession()` is the canonical "who is calling this route" helper.
 * It resolves the Auth.js session (`auth()`), then looks up the matching
 * `User` row + their primary `Workspace` so the rest of the app can branch
 * on workspace-scoped fields without re-querying.
 *
 * This file is the v2 of an older Clerk-era bridge. The function signature
 * is preserved so call sites in route handlers don't have to change all
 * at once — they keep getting back the same `CurrentSession` shape.
 */
import { cookies } from "next/headers";
import {
  withAdminContext,
  type User,
  type Workspace,
  WorkspaceRole,
} from "@funnel/db";
import { auth } from "@/lib/auth";

const WORKSPACE_COOKIE = "funnel.ws";

export interface CurrentSession {
  user: User;
  workspace: Workspace;
  workspaces: Array<{
    id: string;
    name: string;
    slug: string;
    role: WorkspaceRole;
  }>;
}

export async function getCurrentSession(): Promise<CurrentSession | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const userId = session.user.id;

  const user = await withAdminContext((tx) =>
    tx.user.findUnique({ where: { id: userId } }),
  );
  if (!user) return null;

  // Memberships.
  const memberships = await withAdminContext((tx) =>
    tx.workspaceMember.findMany({
      where: { userId, removedAt: null },
      include: { workspace: true },
      orderBy: { createdAt: "asc" },
    }),
  );

  if (memberships.length === 0) return null;

  // Preferred workspace via cookie, else first.
  const cookieJar = cookies();
  const preferred = cookieJar.get(WORKSPACE_COOKIE)?.value;
  const chosen =
    memberships.find((m) => m.workspaceId === preferred) ?? memberships[0];

  return {
    user,
    workspace: chosen.workspace,
    workspaces: memberships.map((m) => ({
      id: m.workspaceId,
      name: m.workspace.name,
      slug: m.workspace.slug,
      role: m.role,
    })),
  };
}

/**
 * Slugify a name into a URL-safe workspace handle. Kept here (rather than
 * inlined in auth.ts) because the test suite exercises the edge cases.
 */
export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 40) || "workspace"
  );
}

export { WORKSPACE_COOKIE };
