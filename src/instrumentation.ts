/**
 * Next.js instrumentation hook
 *
 * Runs once when the Node server boots (before any request is served).
 * We use it to spawn BullMQ workers inside the same Node process as the web
 * app — that way Railway only needs ONE service to run both HTTP and
 * background jobs.
 *
 * To scale workers separately later: set ENABLE_EMBEDDED_WORKERS=0 and deploy
 * apps/workers as a second Railway service.
 */

export async function register() {
  // Only runs in the Node.js runtime (skips Edge runtime + browser).
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  // Opt-out so you can run workers as a separate service in production.
  if (process.env.ENABLE_EMBEDDED_WORKERS === '0') {
    console.log('[instrumentation] embedded workers disabled (ENABLE_EMBEDDED_WORKERS=0)');
    return;
  }

  // In Vercel/build mode there is no Redis; skip silently.
  if (!process.env.REDIS_URL && !process.env.UPSTASH_REDIS_REST_URL) {
    console.log('[instrumentation] no REDIS_URL set — embedded workers skipped');
    return;
  }

  try {
    // Lazy import so the web app doesn't pull worker deps unless they're needed.
    // @ts-expect-error — workspace package, types resolved at runtime via tsconfig path
    const { startEmbeddedWorkers } = await import('@funnel/workers/embedded');
    await startEmbeddedWorkers();
    console.log('[instrumentation] embedded BullMQ workers started');
  } catch (err) {
    // Don't crash the web server if workers fail to start. Log it loudly so
    // ops can see it in Sentry, but keep serving HTTP.
    console.error('[instrumentation] embedded workers failed to start:', err);
  }
}
