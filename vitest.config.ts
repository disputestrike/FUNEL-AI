import { defineConfig } from "vitest/config";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const criticalPaths = JSON.parse(
  readFileSync(resolve(__dirname, "tooling/coverage/critical-paths.json"), "utf8"),
) as { include: string[]; exclude: string[]; thresholds: Record<string, number> };

/**
 * Root vitest config — workspace mode.
 *
 * Per-package vitest.config.ts files extend this. Coverage thresholds are
 * 80% on the critical-paths allowlist (see tooling/coverage/critical-paths.json),
 * matching the engineering-ops spec §08.
 */
export default defineConfig({
  test: {
    workspace: [
      "packages/*",
      "apps/api",
      "apps/web",
      "apps/grader",
      "apps/admin",
      "tools/testing/integration",
      "tools/testing/security",
      "tools/testing/regression",
    ],
    globals: false,
    environment: "node",
    testTimeout: 30_000,
    hookTimeout: 30_000,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov", "json-summary"],
      reportsDirectory: "./coverage",
      include: criticalPaths.include,
      exclude: criticalPaths.exclude,
      thresholds: {
        lines: criticalPaths.thresholds.lines,
        functions: criticalPaths.thresholds.functions,
        branches: criticalPaths.thresholds.branches,
        statements: criticalPaths.thresholds.statements,
      },
    },
    setupFiles: ["./tools/testing/setup.ts"],
  },
});
