/**
 * Auth wiring — Auth.js v5 + Google + workspace auto-provisioning.
 *
 * These tests verify the side-effects of the signIn / session callbacks
 * configured in `apps/web/src/lib/auth.ts` without spinning up the
 * Next.js runtime. We capture the NextAuth() config via a hoisted mock,
 * then invoke the callbacks directly with synthetic users.
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";

// ---------------------------------------------------------------------
// Shared mocks. vi.mock() factories are hoisted ABOVE all imports, so
// any module-scoped state they reference must live on `globalThis`.
// ---------------------------------------------------------------------
vi.mock("@auth/prisma-adapter", () => ({
  PrismaAdapter: () => ({}),
}));

vi.mock("next-auth/providers/google", () => ({
  default: (opts: unknown) => ({ id: "google", name: "Google", options: opts }),
}));

vi.mock("next-auth", () => {
  return {
    default: (config: unknown) => {
      (globalThis as any).__capturedAuthConfig = config;
      return {
        handlers: { GET: () => {}, POST: () => {} },
        // `auth()` reads from a global stash so each test can inject the
        // session it wants without having to re-mock the module graph.
        auth: () => (globalThis as any).__authSessionMock?.(),
        signIn: () => {},
        signOut: () => {},
      };
    },
  };
});

// `@funnel/db` is stubbed via vitest's resolve.alias (see vitest.config.ts).
// The stub plumbs through to `globalThis.__txState`, which we set up below.

// `auth()` for the data helper. We can't fully mock `@/lib/auth` (we need
// the real module so its NextAuth(config) call actually runs and the
// config callbacks are captured), so we stash a function on globalThis
// that the data layer's `auth()` proxy will read.
(globalThis as any).__authSessionMock = () => null;

// ---------------------------------------------------------------------
// Bring auth.ts into scope ONCE so the config is captured. Importing it
// inside beforeAll() ensures the mocks above are wired before evaluation.
// ---------------------------------------------------------------------
beforeAll(async () => {
  (globalThis as any).__txState = {
    workspaceMember: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    workspace: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  };
  // Force-resolve the module graph through our mocks.
  await import("@/lib/auth");
});

function tx(): {
  workspaceMember: { findFirst: any; create: any };
  workspace: { create: any; findUnique: any };
  user: { findUnique: any; update: any };
  auditLog: { create: any };
} {
  return (globalThis as any).__txState;
}

beforeEach(() => {
  const t = tx();
  t.workspaceMember.findFirst.mockReset();
  t.workspaceMember.create.mockReset();
  t.workspace.create.mockReset();
  t.workspace.findUnique.mockReset();
  t.user.findUnique.mockReset();
  t.user.update.mockReset();
  t.auditLog.create.mockReset().mockResolvedValue({});
  (globalThis as any).__authSessionMock = () => null;
});

function config(): {
  callbacks: {
    signIn: (args: { user: { id: string; email: string; name?: string } }) =>
      Promise<boolean>;
    session: (args: {
      session: { user: { email?: string } };
      user: { id: string };
    }) => Promise<any>;
  };
} {
  const c = (globalThis as any).__capturedAuthConfig;
  if (!c) throw new Error("NextAuth config was never captured — mock failed");
  return c;
}

// ---------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------

describe("auth.ts — signIn callback (workspace auto-provisioning)", () => {
  it("creates a workspace + owner membership on first sign-in", async () => {
    tx().workspaceMember.findFirst.mockResolvedValue(null);

    const ok = await config().callbacks.signIn({
      user: { id: "usr_abc", email: "founder@acme.io", name: "Ada Founder" },
    });

    expect(ok).toBe(true);
    expect(tx().workspace.create).toHaveBeenCalledTimes(1);
    expect(tx().workspaceMember.create).toHaveBeenCalledTimes(1);

    const wsData = tx().workspace.create.mock.calls[0][0].data;
    expect(wsData.ownerUserId).toBe("usr_abc");
    expect(wsData.plan).toBe("free");
    expect(wsData.name).toBe("Ada Founder's workspace");
    expect(wsData.slug).toMatch(/^founder-/);

    const memberData = tx().workspaceMember.create.mock.calls[0][0].data;
    expect(memberData.role).toBe("owner");
    expect(memberData.userId).toBe("usr_abc");
    expect(memberData.workspaceId).toBe(wsData.id);
  });

  it("does NOT create a workspace if one already exists", async () => {
    tx().workspaceMember.findFirst.mockResolvedValue({ id: "wsm_existing" });

    const ok = await config().callbacks.signIn({
      user: { id: "usr_abc", email: "founder@acme.io", name: "Ada" },
    });

    expect(ok).toBe(true);
    expect(tx().workspace.create).not.toHaveBeenCalled();
    expect(tx().workspaceMember.create).not.toHaveBeenCalled();
  });
});

describe("auth.ts — session callback (workspace hydration)", () => {
  it("hydrates workspaceId, slug, role, plan from the user's membership", async () => {
    tx().workspaceMember.findFirst.mockResolvedValue({
      workspaceId: "wsp_xyz",
      role: "owner",
      workspace: { id: "wsp_xyz", slug: "acme", plan: "growth" },
    });

    const session = await config().callbacks.session({
      session: { user: { email: "founder@acme.io" } },
      user: { id: "usr_abc" },
    });

    expect(session.user.id).toBe("usr_abc");
    expect(session.workspaceId).toBe("wsp_xyz");
    expect(session.workspaceSlug).toBe("acme");
    expect(session.role).toBe("owner");
    expect(session.plan).toBe("growth");
  });

  it("leaves workspace fields undefined when the user has no membership", async () => {
    tx().workspaceMember.findFirst.mockResolvedValue(null);

    const session = await config().callbacks.session({
      session: { user: { email: "orphan@nowhere.io" } },
      user: { id: "usr_orphan" },
    });

    expect(session.user.id).toBe("usr_orphan");
    expect(session.workspaceId).toBeUndefined();
    expect(session.role).toBeUndefined();
  });
});

describe("lib/data.ts — withWorkspace", () => {
  it("throws NoWorkspaceError when the session has no workspaceId", async () => {
    (globalThis as any).__authSessionMock = async () => ({
      user: { id: "usr_abc" },
    });
    const { withWorkspace, NoWorkspaceError } = await import("@/lib/data");
    await expect(
      withWorkspace(async () => "should-not-run"),
    ).rejects.toBeInstanceOf(NoWorkspaceError);
  });

  it("passes the workspaceId through to withWorkspaceContext", async () => {
    (globalThis as any).__authSessionMock = async () => ({
      user: { id: "usr_abc" },
      workspaceId: "wsp_xyz",
    });
    const { withWorkspace } = await import("@/lib/data");
    const wsId = await withWorkspace(async (_t, id) => id);
    expect(wsId).toBe("wsp_xyz");
  });
});

describe("middleware — public vs protected route classification", () => {
  // Mirror of middleware.ts's isPublic — duplicated here so the test doesn't
  // have to import the actual middleware (which pulls in next/server +
  // an env-coupled Auth.js handler).
  const PUBLIC_PATHS = [
    "/",
    "/pricing",
    "/industries",
    "/about",
    "/grade",
    "/help",
    "/community",
    "/academy",
    "/awards",
    "/wins",
    "/marketplace",
    "/affiliate",
    "/contact",
    "/careers",
    "/press",
    "/blog",
    "/legal",
    "/privacy",
    "/terms",
    "/vs",
    "/f",
    "/login",
    "/signup",
    "/api/auth",
    "/api/webhooks",
    "/api/healthz",
    "/api/readyz",
    "/api/email-capture",
    "/api/share",
    "/api/domains",
  ];

  function isPublic(pathname: string): boolean {
    return PUBLIC_PATHS.some(
      (p) => pathname === p || pathname.startsWith(p + "/"),
    );
  }

  it("flags protected routes correctly", () => {
    for (const p of [
      "/dashboard",
      "/dashboard/funnels",
      "/settings/profile",
      "/onboarding/form",
      "/generate",
    ]) {
      expect(isPublic(p), `${p} should be PROTECTED`).toBe(false);
    }
  });

  it("flags public routes correctly", () => {
    for (const p of [
      "/",
      "/pricing",
      "/login",
      "/signup",
      "/login?callbackUrl=/dashboard",
      "/api/auth/session",
      "/api/webhooks/paypal",
      "/legal/terms",
    ]) {
      // The query-string variant won't be matched by isPublic — strip it
      // first the way the middleware does (req.nextUrl.pathname only).
      const path = p.split("?")[0]!;
      expect(isPublic(path), `${path} should be PUBLIC`).toBe(true);
    }
  });
});
