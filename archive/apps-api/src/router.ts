/**
 * Root tRPC router.
 *
 * Re-exports the per-domain routers under stable namespaces. The web/admin
 * apps import the type with:
 *
 *   import type { AppRouter } from "@funnel/api/router";
 */

import { router } from "./trpc.js";
import { workspaceRouter } from "./routers/workspace.js";
import { userRouter } from "./routers/user.js";
import { funnelRouter } from "./routers/funnel.js";
import { generationRouter } from "./routers/generation.js";
import { crmRouter } from "./routers/crm.js";
import { billingRouter } from "./routers/billing.js";
import { integrationsRouter } from "./routers/integrations.js";
import { analyticsRouter } from "./routers/analytics.js";
import { adminRouter } from "./routers/admin.js";
import { aiEditRouter } from "./routers/ai-edit.js";
import { publishRouter } from "./routers/publish.js";
import { domainsRouter } from "./routers/domains.js";

export const appRouter = router({
  workspace: workspaceRouter,
  user: userRouter,
  funnel: funnelRouter,
  generation: generationRouter,
  crm: crmRouter,
  billing: billingRouter,
  integrations: integrationsRouter,
  analytics: analyticsRouter,
  admin: adminRouter,
  aiEdit: aiEditRouter,
  publish: publishRouter,
  domains: domainsRouter,
});

export type AppRouter = typeof appRouter;
