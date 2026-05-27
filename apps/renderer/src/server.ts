/**
 * Node-runtime entrypoint for the renderer.
 *
 * The renderer is canonically a Cloudflare Worker (apps/renderer/src/index.ts
 * exports the fetch handler). On Railway/Render we wrap that same Hono app
 * with @hono/node-server so we get a long-running Node process serving the
 * same routes on $PORT.
 *
 * tsc compiles this to apps/renderer/dist/server.js; the Dockerfile CMD
 * launches it directly with node.
 */
import { serve } from "@hono/node-server";
import app from "./index.js";
import { registerHealthRoutes } from "./health.js";

registerHealthRoutes(app as never);

const port = Number(process.env.PORT ?? 8787);

const server = serve({ fetch: app.fetch as never, port }, (info) => {
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ service: "renderer", msg: "listening", port: info.port }));
});

// Graceful shutdown — Railway/Render send SIGTERM on deploy + scale events.
const shutdown = (sig: string) => {
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ service: "renderer", msg: "shutdown", signal: sig }));
  const t = setTimeout(() => process.exit(1), 30_000);
  server.close(() => {
    clearTimeout(t);
    process.exit(0);
  });
};
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
