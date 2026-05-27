/**
 * Generates a static OpenAPI 3.1 snapshot to disk.
 *
 * Used by CI to (a) gate that the spec validates and (b) feed the SDK
 * regenerators in packages/sdk and packages/sdk-python. Drift = red build.
 *
 * Usage: pnpm --filter @funnel/api openapi
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { publicApi } from "../src/public-api/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outFile = resolve(__dirname, "../../../packages/sdk/openapi.json");

mkdirSync(dirname(outFile), { recursive: true });

const doc = publicApi.getOpenAPI31Document({
  openapi: "3.1.0",
  info: {
    title: "GoFunnelAI API",
    version: "1.0.0",
  },
});

writeFileSync(outFile, JSON.stringify(doc, null, 2));

// Mirror to the Python SDK and the developer portal.
writeFileSync(resolve(__dirname, "../../../packages/sdk-python/openapi.json"), JSON.stringify(doc, null, 2));
writeFileSync(
  resolve(__dirname, "../../../apps/developer-portal/public/openapi.json"),
  JSON.stringify(doc, null, 2),
);

const pathCount = Object.keys(doc.paths ?? {}).length;
const opCount = Object.values(doc.paths ?? {}).reduce(
  (n, item) => n + Object.keys(item ?? {}).length,
  0,
);
// eslint-disable-next-line no-console
console.log(`OpenAPI snapshot written: ${pathCount} paths, ${opCount} operations`);
