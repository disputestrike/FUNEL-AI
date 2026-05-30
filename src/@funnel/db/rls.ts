/**
 * Row-level security helpers.
 *
 * Postgres RLS policies in this database key on `current_setting('app.workspace_id', true)`.
 * Every workspace-scoped query MUST run inside `withWorkspaceContext` so that the
 * session variable is set before the query executes — otherwise RLS will see an
 * empty string and reject every row.
 *
 * Internally we wrap each call in an interactive Prisma transaction so that:
 *   1. `SET LOCAL app.workspace_id` is bound to the transaction's session
 *      (and automatically cleared on COMMIT/ROLLBACK — no leaks across pooled connections).
 *   2. The callback receives a transactional client (`TxClient`) that shares the
 *      same session and therefore the same RLS context.
 *
 * `withAdminContext` switches the session role to `funnel_admin` (BYPASSRLS).
 * Use this only for migrations, the seed script, and explicit admin tooling.
 */
import { Prisma, PrismaClient, prisma } from "./index.js";

export type TxClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

export interface WorkspaceContextOptions {
  /** Override the singleton (used in tests). */
  client?: PrismaClient;
  /** Transaction options forwarded to Prisma's interactive tx. */
  timeout?: number;
  maxWait?: number;
  isolationLevel?: Prisma.TransactionIsolationLevel;
}

export class MissingWorkspaceContextError extends Error {
  constructor() {
    super(
      "Missing workspace context. Wrap this call in `withWorkspaceContext(workspaceId, ...)`."
    );
    this.name = "MissingWorkspaceContextError";
  }
}

// ULID validation: prefix + 26-char Crockford base32. We accept lengths 26–40 to
// allow for our prefix conventions (e.g. "wsp_<ulid>" = 30 chars).
const WORKSPACE_ID_PATTERN = /^[a-z]{2,5}_[0-9A-HJKMNP-TV-Z]{26}$/i;

function isValidWorkspaceId(id: string): boolean {
  return typeof id === "string" && WORKSPACE_ID_PATTERN.test(id);
}

/**
 * Run `fn` with `app.workspace_id` set to `workspaceId` for the duration of
 * the underlying transaction. The transaction commits on success, rolls back
 * on throw — and either way the session var is released.
 */
export async function withWorkspaceContext<T>(
  workspaceId: string,
  fn: (tx: TxClient) => Promise<T>,
  options: WorkspaceContextOptions = {}
): Promise<T> {
  if (!isValidWorkspaceId(workspaceId)) {
    throw new TypeError(
      `withWorkspaceContext: invalid workspace id "${workspaceId}" — must match ${WORKSPACE_ID_PATTERN}`
    );
  }

  const client = options.client ?? prisma;

  return client.$transaction(
    async (tx) => {
      // set_config(setting, value, is_local). is_local = true → unset on COMMIT.
      // Using set_config (not SET LOCAL) so we can safely parametrize.
      await tx.$executeRaw`SELECT set_config('app.workspace_id', ${workspaceId}, true)`;
      return fn(tx as unknown as TxClient);
    },
    {
      timeout: options.timeout ?? 15_000,
      maxWait: options.maxWait ?? 5_000,
      isolationLevel: options.isolationLevel,
    }
  );
}

/**
 * Run `fn` with row-level security bypassed.
 *
 * We do this by switching to the `funnel_admin` role (created in the migration
 * with BYPASSRLS) for the duration of the transaction. The role is restored on
 * COMMIT/ROLLBACK via SET LOCAL semantics. If the `funnel_admin` role does not
 * exist (e.g. local dev DB) we fall back to a transaction that simply omits the
 * workspace context — callers should be aware that RLS will still apply unless
 * the connecting role itself has BYPASSRLS.
 */
export async function withAdminContext<T>(
  fn: (tx: TxClient) => Promise<T>,
  options: WorkspaceContextOptions = {}
): Promise<T> {
  const client = options.client ?? prisma;

  return client.$transaction(
    async (tx) => {
      try {
        await tx.$executeRawUnsafe(`SET LOCAL ROLE "funnel_admin"`);
      } catch {
        // Role not present (likely a dev/test DB seeded without it).
        // In that case the connecting role should already have BYPASSRLS or be
        // the table owner; we proceed without erroring.
      }
      return fn(tx as unknown as TxClient);
    },
    {
      timeout: options.timeout ?? 30_000,
      maxWait: options.maxWait ?? 5_000,
      isolationLevel: options.isolationLevel,
    }
  );
}

/**
 * Read the workspace_id currently bound to this transaction. Returns `null`
 * when no context is set. Mostly useful inside helpers and tests.
 */
export async function getCurrentWorkspaceId(
  tx: TxClient | PrismaClient
): Promise<string | null> {
  const rows = await (tx as PrismaClient).$queryRaw<Array<{ wsid: string | null }>>`
    SELECT current_setting('app.workspace_id', true) AS wsid
  `;
  const wsid = rows[0]?.wsid;
  return wsid && wsid.length > 0 ? wsid : null;
}

/**
 * Throws if no workspace context is set on the current transaction. Useful as a
 * guard in helper functions that must never run outside of `withWorkspaceContext`.
 */
export async function assertWorkspaceContext(
  tx: TxClient | PrismaClient
): Promise<string> {
  const wsid = await getCurrentWorkspaceId(tx);
  if (!wsid) throw new MissingWorkspaceContextError();
  return wsid;
}
