import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      include: ["src/**/*.ts"],
      exclude: ["src/index.ts", "src/health.ts", "src/monitoring.ts"],
      thresholds: { lines: 70, branches: 60, functions: 70 },
    },
    testTimeout: 15_000,
  },
});
