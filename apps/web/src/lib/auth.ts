/**
 * NextAuth / Auth.js v5 configuration — Google as the sole provider.
 *
 * Google was chosen because GoFunnelAI has a partner relationship with Google
 * and every prospective customer already has a Google identity (Workspace,
 * Gmail, or Android). One-tap on, two-factor inherited, zero password reset
 * traffic for support.
 *
 * On first sign-in we create the User → Workspace → owner WorkspaceMember
 * tuple inside one `withAdminContext` transaction so RLS is bypassed safely.
 * Subsequent sign-ins are a no-op fast path.
 *
 * The session callback hydrates `session.workspaceId`, `workspaceSlug`,
 * `role`, and `plan` so every server component can branch off `auth()`
 * without an extra DB roundtrip.
 */
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import {
  prisma,
  withAdminContext,
  newId,
  WorkspaceRole,
} from "@funnel/db";

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 40) || "workspace"
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  session: { strategy: "database" },
  pages: { signIn: "/login" },
  callbacks: {
    /**
     * On first sign-in, provision a workspace + owner membership.
     * Idempotent — checks for existing ownership first.
     */
    async signIn({ user }) {
      if (!user.id || !user.email) return true;

      await withAdminContext(async (tx) => {
        const existing = await tx.workspaceMember.findFirst({
          where: { userId: user.id!, removedAt: null },
        });
        if (existing) return;

        const workspaceId = newId("workspace");
        const handle = user.email!.split("@")[0] ?? "workspace";
        const slug = `${slugify(handle)}-${Date.now().toString(36)}`;
        const displayName = user.name ?? handle;

        await tx.workspace.create({
          data: {
            id: workspaceId,
            slug,
            name: `${displayName}'s workspace`,
            ownerUserId: user.id!,
            plan: "free",
          },
        });
        await tx.workspaceMember.create({
          data: {
            id: newId("workspaceMember"),
            workspaceId,
            userId: user.id!,
            role: WorkspaceRole.owner,
            joinedAt: new Date(),
          },
        });
        await tx.auditLog
          .create({
            data: {
              id: newId("auditLog"),
              workspaceId,
              actorUserId: user.id!,
              action: "workspace.created",
              subjectType: "workspace",
              subjectId: workspaceId,
              afterBlob: { source: "google_oauth", plan: "free" },
            },
          })
          .catch(() => {
            // Audit table is partitioned with stricter constraints; non-fatal.
          });
      });

      return true;
    },

    /**
     * Hydrate session with workspace + role + plan so every server
     * component reads them off `await auth()` with zero extra round-trips.
     */
    async session({ session, user }) {
      session.user.id = user.id;

      const member = await withAdminContext((tx) =>
        tx.workspaceMember.findFirst({
          where: { userId: user.id, removedAt: null },
          include: { workspace: true },
          orderBy: { createdAt: "asc" },
        }),
      );

      if (member) {
        session.workspaceId = member.workspaceId;
        session.workspaceSlug = member.workspace.slug;
        session.role = member.role as
          | "owner"
          | "admin"
          | "editor"
          | "viewer";
        session.plan = member.workspace.plan as
          | "free"
          | "starter"
          | "growth"
          | "scale"
          | "agency";
      }

      return session;
    },
  },
  events: {
    async signIn({ user }) {
      if (!user.id) return;
      await prisma.user
        .update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        })
        .catch(() => {
          // Best-effort — the User row may not exist yet under the adapter's
          // own state machine on the very first call.
        });
    },
  },
});
