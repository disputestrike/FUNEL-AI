/**
 * GET /api/healthz â€” liveness for the grader (gofunnelai.com/grade).
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET(): Response {
  return new Response(
    JSON.stringify({
      ok: true,
      service: "grader",
      release: process.env.RELEASE ?? "dev",
      ts: new Date().toISOString(),
    }),
    { status: 200, headers: { "content-type": "application/json", "cache-control": "no-store" } },
  );
}
