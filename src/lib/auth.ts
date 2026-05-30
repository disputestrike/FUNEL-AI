/**
 * NextAuth / Auth.js v5 configuration — Google + email/password (Credentials).
 *
 * GoFunnelAI supports two sign-in surfaces:
 *
 *   1. Google OAuth — one-tap on, 2FA inherited, zero password reset traffic.
 *      Most acquirers have a Google identity already.
 *   2. Email + password (Credentials) — required for prospects who prefer
 *      not to bind a Google account, plus enterprise reviewers who run
 *      sandboxes off corp SSO.
 *
 * On first sign-in we create the User → Workspace → owner WorkspaceMember
 * tuple inside one `withAdminContext` transaction so RLS is bypassed safely.
 * For the Credentials flow the user row is created up-front by
 * `POST /api/auth/signup`; the signIn callback below is the idempotent
 * "ensure workspace exists" step that runs for every provider.
 *
 * Why JWT sessions? Credentials providers in Auth.js v5 require JWT —
 * database sessions are not supported alongside them. We hydrate
 * workspaceId / workspaceSlug / role / plan into the JWT in the `jwt`
 * callback, then mirror those onto `session` in the `session` callback.
 */
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
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

/**
 * Ensure the given user has at least one workspace + owner membership.
 * Idempotent — returns immediately if a membership already exists.
 *
 * Exported so the signup route can call it inline (the Credentials
 * provider's signIn callback also runs this on each subsequent login,
 * where it's a fast no-op).
 */
export async function ensureWorkspaceForUser(params: {
  userId: string;
  email: string;
  name?: string | null;
  source: "google_oauth" | "credentials";
}): Promise<void> {
  const { userId, email, name, source } = params;

  await withAdminContext(async (tx) => {
    const existing = await tx.workspaceMember.findFirst({
      where: { userId, removedAt: null },
    });
    if (existing) return;

    const workspaceId = newId("workspace");
    const handle = email.split("@")[0] ?? "workspace";
    const slug = `${slugify(handle)}-${Date.now().toString(36)}`;
    const displayName = name ?? handle;

    await tx.workspace.create({
      data: {
        id: workspaceId,
        slug,
        name: `${displayName}'s workspace`,
        ownerUserId: userId,
        plan: "free",
      },
    });
    await tx.workspaceMember.create({
      data: {
        id: newId("workspaceMember"),
        workspaceId,
        userId,
        role: WorkspaceRole.owner,
        joinedAt: new Date(),
      },
    });
    await tx.auditLog
      .create({
        data: {
          id: newId("auditLog"),
          workspaceId,
          actorUserId: userId,
          action: "workspace.created",
          subjectType: "workspace",
          subjectId: workspaceId,
          afterBlob: { source, plan: "free" },
        },
      })
      .catch(() => {
        // Audit table is partitioned with stricter constraints; non-fatal.
      });
  });
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
    Credentials({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const email = typeof raw?.email === "string" ? raw.email.trim().toLowerCase() : "";
        const password = typeof raw?.password === "string" ? raw.password : "";
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
            passwordHash: true,
            status: true,
          },
        });
        if (!user || !user.passwordHash) return null;
        if (user.status !== "active") return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  callbacks: {
    /**
     * Runs for both Google and Credentials sign-ins.
     * For Google: provisions a workspace + owner membership on first sign-in.
     * For Credentials: signup route already provisioned, so this no-ops.
     */
    async signIn({ user, account }) {
      if (!user.id || !user.email) return true;

      // Credentials sign-ins flow through the signup route which already
      // calls ensureWorkspaceForUser, so this is a fast no-op for them too —
      // but we still run it to handle the (rare) case where the workspace
      // create failed mid-signup and the user is retrying.
      const source = account?.provider === "google" ? "google_oauth" : "credentials";
      await ensureWorkspaceForUser({
        userId: user.id,
        email: user.email,
        name: user.name,
        source,
      });
      return true;
    },

    /**
     * Hydrate the JWT with workspace + role + plan so we can mirror it
     * into the session without an extra DB round-trip on every request.
     * Runs on sign-in (`user` defined) and on every subsequent JWT
     * verification (`user` undefined — read from `token`).
     */
    async jwt({ token, user }) {
      // First call after sign-in — copy stable identity bits onto token.
      if (user?.id) {
        token.userId = user.id;
      }

      const userId = (token.userId as string | undefined) ?? token.sub;
      if (!userId) return token;

      // Hydrate workspace fields if we don't have them yet (or refresh on
      // sign-in). We avoid a DB hit on every request by gating on a marker.
      if (!token.workspaceId || user) {
        const member = await withAdminContext((tx) =>
          tx.workspaceMember.findFirst({
            where: { userId, removedAt: null },
            include: { workspace: true },
            orderBy: { createdAt: "asc" },
          }),
        );

        if (member) {
          token.workspaceId = member.workspaceId;
          token.workspaceSlug = member.workspace.slug;
          token.role = member.role;
          token.plan = member.workspace.plan;
        }
      }

      return token;
    },

    /**
     * Mirror token fields onto the Session object so every server
     * component reads them off `await auth()` with zero DB hits.
     */
    async session({ session, token }) {
      const userId = (token.userId as string | undefined) ?? token.sub;
      if (userId) {
        session.user.id = userId;
      }
      if (typeof token.workspaceId === "string") {
        session.workspaceId = token.workspaceId;
      }
      if (typeof token.workspaceSlug === "string") {
        session.workspaceSlug = token.workspaceSlug;
      }
      if (typeof token.role === "string") {
        session.role = token.role as
          | "owner"
          | "admin"
          | "editor"
          | "viewer";
      }
      if (typeof token.plan === "string") {
        session.plan = token.plan as
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
