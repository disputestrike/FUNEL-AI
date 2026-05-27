/**
 * Runtime configuration for the workers service.
 *
 * All required env vars fail fast on boot via zod. Optional knobs default to
 * production-sane values. The workers service is deployed independently of the
 * Cloudflare Workers API — this is a long-running Node process on
 * Railway/Fly/Render with its own env namespace.
 */

import { z } from "zod";

const ConfigSchema = z.object({
  NODE_ENV: z.enum(["development", "staging", "production", "test"]).default("development"),

  // Redis (BullMQ backing store — managed Upstash in prod).
  REDIS_URL: z.string().url(),
  REDIS_TLS: z
    .string()
    .optional()
    .transform((v) => v === "true" || v === "1"),
  REDIS_KEY_PREFIX: z.string().default("funnel:"),

  // DB (Prisma via @funnel/db).
  DATABASE_URL: z.string().url(),

  // Observability.
  SENTRY_DSN: z.string().optional(),
  SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0.05),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),

  // Health-check server.
  HEALTH_PORT: z.coerce.number().int().positive().default(8080),

  // Hosting.
  REGION: z.string().default("us-east-1"),
  HOSTNAME: z.string().default(process.env["HOSTNAME"] ?? "workers-local"),
  RELEASE: z.string().default(process.env["GIT_SHA"] ?? "dev"),

  // Worker tuning. Allow ops to override concurrency without code changes.
  CONCURRENCY_OVERRIDE: z
    .string()
    .optional()
    .transform((raw) => {
      if (!raw) return {} as Record<string, number>;
      try {
        return JSON.parse(raw) as Record<string, number>;
      } catch {
        return {} as Record<string, number>;
      }
    }),

  // Graceful shutdown.
  SHUTDOWN_DRAIN_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),

  // Worker secrets fed by env (each adapter pulls its own from process.env;
  // we don't re-list them here — that would duplicate the integrations matrix).
});

export type WorkerConfig = z.infer<typeof ConfigSchema>;

let cached: WorkerConfig | null = null;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): WorkerConfig {
  if (cached) return cached;
  const parsed = ConfigSchema.safeParse(env);
  if (!parsed.success) {
    // Loud failure: dump the issues and crash so the orchestrator restarts us.
    // We deliberately do not swallow these — bad config => not booting.
    const flat = parsed.error.flatten();
    // eslint-disable-next-line no-console
    console.error(
      JSON.stringify({
        level: "fatal",
        service: "workers",
        message: "Invalid worker configuration",
        issues: flat.fieldErrors,
      }),
    );
    throw new Error("Invalid worker configuration — see logs for missing env vars");
  }
  cached = parsed.data;
  return cached;
}

/** Test-only — reset cached config so unit tests can re-load with different env. */
export function __resetConfigForTests(): void {
  cached = null;
}
