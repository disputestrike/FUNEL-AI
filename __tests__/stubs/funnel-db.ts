/**
 * Test-only stub for `@funnel/db`. Vitest's resolver runs before vi.mock
 * intercepts, so we point the alias here. The stub plumbs through to
 * `globalThis.__txState`, which the test harness sets up in beforeAll().
 *
 * NB: This file is ONLY loaded by vitest, never by `next dev` / build.
 */

function getTx(): any {
  const tx = (globalThis as any).__txState;
  if (!tx) {
    throw new Error(
      "@funnel/db stub: globalThis.__txState is not set. Did you forget to wire it in beforeAll()?",
    );
  }
  return tx;
}

export const prisma: any = new Proxy(
  {},
  {
    get(_target, key) {
      const tx = (globalThis as any).__txState;
      if (tx && tx[key]) return tx[key];
      // Fallback — return a chainable noop so misc Prisma calls don't crash.
      return new Proxy(() => undefined, {
        get: () => () => Promise.resolve({}),
        apply: () => Promise.resolve({}),
      });
    },
  },
);

export async function withAdminContext<T>(
  fn: (tx: any) => Promise<T> | T,
): Promise<T> {
  return fn(getTx()) as Promise<T>;
}

export async function withWorkspaceContext<T>(
  _workspaceId: string,
  fn: (tx: any) => Promise<T> | T,
): Promise<T> {
  return fn(getTx()) as Promise<T>;
}

export function newId(prefix: string): string {
  const prefixMap: Record<string, string> = {
    workspace: "wsp",
    workspaceMember: "wsm",
    auditLog: "aud",
  };
  return `${prefixMap[prefix] ?? prefix}_test_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export const WorkspaceRole = {
  owner: "owner",
  admin: "admin",
  editor: "editor",
  viewer: "viewer",
} as const;

export type TxClient = any;
export type User = any;
export type Workspace = any;
