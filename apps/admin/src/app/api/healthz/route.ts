/**
 * GET /api/healthz — liveness.
 *
 * 200 once the Next.js admin console is up.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET(): Response {
  return new Response(
    JSON.stringify({
      ok: true,
      service: "admin",
      release: process.env.RELEASE ?? "dev",
      ts: new Date().toISOString(),
    }),
    { status: 200, headers: { "content-type": "application/json", "cache-control": "no-store" } },
  );
}
