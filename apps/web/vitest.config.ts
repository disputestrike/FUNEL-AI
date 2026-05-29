import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // Workspace packages aren't built in the test environment. Stub them
      // so the auth.spec.ts harness can intercept and inspect the calls.
      "@funnel/db": fileURLToPath(
        new URL("./__tests__/stubs/funnel-db.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: [
      "src/**/*.{test,spec}.{ts,tsx}",
      "tests/**/*.{test,spec}.{ts,tsx}",
      "__tests__/**/*.{test,spec}.{ts,tsx}",
    ],
    passWithNoTests: true,
  },
});
