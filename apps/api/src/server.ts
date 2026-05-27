/**
 * Node-runtime entrypoint for the API.
 *
 * The API is canonically a Cloudflare Worker (apps/api/src/index.ts). On
 * Railway/Render we wrap the same Hono app with @hono/node-server and run
 * it as a long-running Node process.
 *
 * Compiled to apps/api/dist/server.js — Dockerfile CMD launches this with
 * `node apps/api/dist/index.js` after tsc rewrites the entrypoint, or you
 * can change the CMD to dist/server.js directly. The Dockerfile in this PR
 * targets dist/index.js (tsc compiles whichever entrypoint the package.json
 * declares — see the build script).
 */
import { serve } from "@hono/node-server";
import { createApp } from "./app.js";

const app = createApp();
const port = Number(process.env.PORT ?? 8080);

const server = serve({ fetch: app.fetch as never, port }, (info) => {
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ service: "api", msg: "listening", port: info.port }));
});

const SHUTDOWN_DRAIN_MS = Number(process.env.SHUTDOWN_DRAIN_TIMEOUT_MS ?? 30_000);

const shutdown = (sig: string) => {
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ service: "api", msg: "shutdown initiated", signal: sig, drainMs: SHUTDOWN_DRAIN_MS }));
  const hard = setTimeout(() => {
    // eslint-disable-next-line no-console
    console.error(JSON.stringify({ service: "api", msg: "drain timeout — forcing exit" }));
    process.exit(1);
  }, SHUTDOWN_DRAIN_MS);
  server.close(() => {
    clearTimeout(hard);
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ service: "api", msg: "shutdown complete" }));
    process.exit(0);
  });
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  // eslint-disable-next-line no-console
  console.error(JSON.stringify({ service: "api", level: "error", msg: "unhandledRejection", reason: String(reason) }));
});
process.on("uncaughtException", (err) => {
  // eslint-disable-next-line no-console
  console.error(JSON.stringify({ service: "api", level: "fatal", msg: "uncaughtException", error: err.message, stack: err.stack }));
  shutdown("uncaughtException");
});

// tsc needs a stable entrypoint with side effects so that node imports it
// directly — keep this default export trivial.
export default server;
