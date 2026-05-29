/**
 * POST /api/funnels/[id]/publish
 *
 * REST-style alias for `POST /api/publish` that takes the funnel id from
 * the URL. Useful for clients that want a clean per-resource URL. Behaviour
 * is identical — same body schema (minus funnel_id), same response.
 *
 * Body: { slug?, custom_domain?, vanity_short_code? }
 *
 * On success, emits a `funnel_published` event downstream via the queue
 * fan-out triggered by the canonical handler.
 */
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  let payload: Record<string, unknown> = {};
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    payload = {};
  }
  payload.funnel_id = params.id;

  const targetUrl = new URL(req.url);
  targetUrl.pathname = "/api/publish";
  targetUrl.search = "";

  const cookies = req.headers.get("cookie") ?? "";
  const inner = await fetch(targetUrl.toString(), {
    method: "POST",
    headers: { cookie: cookies, "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  const text = await inner.text();
  return new Response(text, {
    status: inner.status,
    headers: { "content-type": inner.headers.get("content-type") ?? "application/json" },
  });
}
