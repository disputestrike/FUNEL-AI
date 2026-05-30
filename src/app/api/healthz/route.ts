/**
 * GET /api/healthz — liveness.
 *
 * 200 once the Next.js server is up. Does NOT touch DB/Redis — Railway uses
 * this to decide "is the container alive?" Any expensive check belongs in
 * /api/readyz.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET(): Response {
  return new Response(
    JSON.stringify({
      ok: true,
      service: "web",
      release: process.env.RELEASE ?? "dev",
      ts: new Date().toISOString(),
    }),
    { status: 200, headers: { "content-type": "application/json", "cache-control": "no-store" } },
  );
}
