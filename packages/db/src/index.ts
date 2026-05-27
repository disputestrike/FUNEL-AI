/**
 * @funnel/db — public entry point.
 *
 * Exposes:
 *  - `prisma`                     A singleton PrismaClient (connection-pooled, dev hot-reload safe).
 *  - `withWorkspaceContext`       Run a callback with `app.workspace_id` set so RLS applies.
 *  - `withAdminContext`           Run a callback with a bypass-RLS session (admin / migrations / seed).
 *  - `getCurrentWorkspaceId`      Inspect the workspace_id bound to the current transaction.
 *  - All Prisma model types       Re-exported under their original names.
 *  - Zod schemas                  Available under `@funnel/db/schemas`.
 */
import { Prisma, PrismaClient } from "@prisma/client";

export { Prisma, PrismaClient };
export type {
  User,
  Workspace,
  WorkspaceMember,
  Funnel,
  FunnelVersion,
  CrmContact,
  Lead,
  Booking,
  Subscription,
  Invoice,
  Payment,
  Refund,
  ApiKey,
  Webhook,
  AuditLog,
  EventLog,
  Asset,
  AssetVersion,
  IntegrationConnection,
  RevTryCall,
  AdCampaign,
  EmailSequence,
  SmsSequence,
  LeadMagnet,
  DeletionTombstone,
  SuppressionEntry,
  KbPack,
} from "@prisma/client";

export {
  WorkspaceRole,
  SubscriptionStatus,
  InvoiceStatus,
  LeadStatus,
  CallOutcome,
  AssetType,
  FunnelStatus,
  PiiTier,
  UserStatus,
  WorkspaceStatus,
  PaymentStatus,
  BookingStatus,
} from "@prisma/client";

export {
  withWorkspaceContext,
  withAdminContext,
  getCurrentWorkspaceId,
  assertWorkspaceContext,
  MissingWorkspaceContextError,
  type WorkspaceContextOptions,
  type TxClient,
} from "./rls.js";

export * as schemas from "./schemas/index.js";
export { newId, stripPrefix, ID_PREFIXES, type IdPrefix } from "./ids.js";

// ---------------------------------------------------------------------
// PrismaClient singleton
// ---------------------------------------------------------------------

declare global {
  // eslint-disable-next-line no-var
  var __funnelPrisma: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  const logQueries = process.env.PRISMA_QUERY_LOG === "1";
  return new PrismaClient({
    log: logQueries
      ? [
          { emit: "stdout", level: "query" },
          { emit: "stdout", level: "warn" },
          { emit: "stdout", level: "error" },
        ]
      : [
          { emit: "stdout", level: "warn" },
          { emit: "stdout", level: "error" },
        ],
    datasources: {
      db: { url: process.env.DATABASE_URL ?? "" },
    },
  });
}

/**
 * Connection-pooled PrismaClient singleton.
 *
 * In dev (Node ESM + tsx watch) the module graph re-runs frequently. To avoid
 * "too many connections" errors we stash the client on globalThis under a
 * package-scoped key. In production we always create a fresh instance.
 */
export const prisma: PrismaClient =
  globalThis.__funnelPrisma ??
  (globalThis.__funnelPrisma = createPrismaClient());

if (process.env.NODE_ENV !== "production") {
  globalThis.__funnelPrisma = prisma;
}

// Graceful shutdown helper — used by long-running workers.
export async function disconnect(): Promise<void> {
  await prisma.$disconnect();
}
