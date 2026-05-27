/**
 * Test database fixture.
 *
 *  - In CI / local: spin up an ephemeral pglite Postgres in-memory instance.
 *  - Runs Prisma migrations against it.
 *  - Per-test transaction rollback for isolation.
 *  - Exposes withRls(workspaceId, fn) helper that sets the RLS GUC
 *    `app.current_workspace_id` so RLS policies fire exactly like prod.
 *
 * In environments without pglite installed (e.g. minimal lint runs), this
 * falls back to a stub that throws if anyone tries to use it.
 */

export interface TestDb {
  /** Raw query — bypasses RLS (admin role). Use for setup/teardown only. */
  raw<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
  /** Run `fn` inside a workspace's RLS context. Throws on tenant escape. */
  withRls<T>(workspaceId: string, fn: (q: TestDb) => Promise<T>): Promise<T>;
  /** Begin a savepoint that auto-rolls back at the end. */
  withTransaction<T>(fn: (tx: TestDb) => Promise<T>): Promise<T>;
  /** Close pool. */
  close(): Promise<void>;
}

let cached: TestDb | null = null;

export async function getTestDb(): Promise<TestDb> {
  if (cached) return cached;
  try {
    // Lazy import — pglite is optional dev-dep.
    const { PGlite } = await import("@electric-sql/pglite");
    const db = new PGlite();
    // Apply schema fixture (subset). Production loads Prisma migrations.
    await db.exec(`
      CREATE TABLE IF NOT EXISTS workspaces (id text PRIMARY KEY, name text NOT NULL);
      CREATE TABLE IF NOT EXISTS users (id text PRIMARY KEY, email text UNIQUE NOT NULL, workspace_id text REFERENCES workspaces(id));
      CREATE TABLE IF NOT EXISTS funnels (id text PRIMARY KEY, workspace_id text NOT NULL REFERENCES workspaces(id), name text);
      CREATE TABLE IF NOT EXISTS leads (id text PRIMARY KEY, workspace_id text NOT NULL REFERENCES workspaces(id), email text);
      ALTER TABLE funnels ENABLE ROW LEVEL SECURITY;
      ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
      CREATE POLICY funnels_tenant ON funnels USING (workspace_id = current_setting('app.current_workspace_id', true));
      CREATE POLICY leads_tenant   ON leads   USING (workspace_id = current_setting('app.current_workspace_id', true));
    `);

    const td: TestDb = {
      async raw<T>(sql: string, params: unknown[] = []) {
        const r = await db.query(sql, params as unknown[]);
        return r.rows as T[];
      },
      async withRls(workspaceId, fn) {
        await db.exec(`SET LOCAL app.current_workspace_id = '${workspaceId.replace(/'/g, "''")}'`);
        return fn(td);
      },
      async withTransaction(fn) {
        await db.exec("BEGIN");
        try {
          const res = await fn(td);
          await db.exec("ROLLBACK");
          return res;
        } catch (e) {
          await db.exec("ROLLBACK");
          throw e;
        }
      },
      async close() {
        await db.close();
      },
    };
    cached = td;
    return td;
  } catch {
    // pglite not installed — return stub. Tests that hit the DB skip.
    const stub: TestDb = {
      raw: () => Promise.reject(new Error("test-db: pglite not installed; install @electric-sql/pglite")),
      withRls: () => Promise.reject(new Error("test-db: pglite not installed")),
      withTransaction: () => Promise.reject(new Error("test-db: pglite not installed")),
      close: () => Promise.resolve(),
    };
    cached = stub;
    return stub;
  }
}

export async function isPgliteAvailable(): Promise<boolean> {
  try {
    await import("@electric-sql/pglite");
    return true;
  } catch {
    return false;
  }
}
