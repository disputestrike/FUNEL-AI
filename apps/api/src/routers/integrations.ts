/**
 * Integrations router — start an OAuth flow, list connected providers, disconnect.
 *
 * The actual OAuth dance is HTTP — not tRPC — see `src/oauth/` for the GET
 * `/oauth/:provider/start` and `/oauth/:provider/callback` handlers. This
 * router is for management UI surfaces (the dashboard listing).
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, workspaceProcedure } from "../trpc.js";
import { writeAuditLog } from "../lib/audit.js";
import { OAUTH_PROVIDERS, type OAuthProviderKey } from "../oauth/providers.js";

const ProviderKey = z.enum(OAUTH_PROVIDERS.map((p) => p.providerKey) as [OAuthProviderKey, ...OAuthProviderKey[]]);

export const integrationsRouter = router({
  /** List providers and the workspace's connection status for each. */
  list: workspaceProcedure.query(async ({ ctx }) => {
    return ctx.withTx(async (tx) => {
      const connections = await tx.integrationConnection.findMany({
        where: { workspace_id: ctx.req.workspaceId!, deleted_at: null },
        select: {
          id: true,
          provider: true,
          external_account_id: true,
          status: true,
          scopes: true,
          connected_at: true,
          last_sync_at: true,
          last_webhook_at: true,
          degraded: true,
          degraded_reason: true,
        },
      });
      const byProvider = new Map(connections.map((c) => [c.provider, c]));
      return OAUTH_PROVIDERS.map((p) => ({
        provider: p.providerKey,
        label: p.label,
        category: p.category,
        capability_flag: p.capabilityFlag,
        connection: byProvider.get(p.providerKey) ?? null,
      }));
    });
  }),

  /** Begin an OAuth flow — returns the authorize URL the UI redirects to. */
  begin: workspaceProcedure
    .input(z.object({ provider: ProviderKey, return_to: z.string().url().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { beginOAuth } = await import("../oauth/handlers.js");
      const { authorizeUrl, stateId } = await beginOAuth({
        env: ctx.env,
        workspaceId: ctx.req.workspaceId!,
        provider: input.provider,
        returnTo: input.return_to ?? `${ctx.env.WEB_PUBLIC_URL}/dashboard/integrations`,
      });
      await writeAuditLog(ctx.req, {
        workspace_id: ctx.req.workspaceId,
        action: "oauth_connect",
        resource: "integration",
        metadata: { provider: input.provider, stage: "begin", state_id: stateId },
      });
      return { authorize_url: authorizeUrl, state_id: stateId };
    }),

  /** Disconnect a provider. Revokes upstream tokens where possible. */
  disconnect: workspaceProcedure
    .input(z.object({ provider: ProviderKey }))
    .mutation(async ({ ctx, input }) => {
      const { disconnectOAuth } = await import("../oauth/handlers.js");
      const result = await disconnectOAuth({
        env: ctx.env,
        workspaceId: ctx.req.workspaceId!,
        provider: input.provider,
      });
      await writeAuditLog(ctx.req, {
        workspace_id: ctx.req.workspaceId,
        action: "oauth_disconnect",
        resource: "integration",
        metadata: { provider: input.provider },
      });
      return result;
    }),

  /** Force a sync from the provider (admin-tier action — checks limits inside the adapter). */
  forceSync: workspaceProcedure
    .input(z.object({ provider: ProviderKey, since: z.string().datetime().optional() }))
    .mutation(async ({ ctx, input }) => {
      // Sync is provider-side; the orchestrator schedules a one-off job.
      const { syncProvider } = await import("../oauth/handlers.js").catch(() => ({ syncProvider: null as never }));
      if (!syncProvider) throw new TRPCError({ code: "NOT_IMPLEMENTED" });
      return syncProvider({
        env: ctx.env,
        workspaceId: ctx.req.workspaceId!,
        provider: input.provider,
        since: input.since,
      });
    }),
});
