/**
 * POST /api/audit
 *
 * Public submit endpoint for a new audit:
 *  1. Parse + validate URL (SSRF-safe).
 *  2. Verify Turnstile (if configured).
 *  3. Apply layered rate limits (per-IP + per-domain).
 *  4. Check the 24h URL-hash cache; return cached audit if found.
 *  5. Insert new audit row, generate share code, dispatch agent-runner job.
 *  6. Return `audit_id` immediately so the client can subscribe to the SSE stream.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { prisma } from "@funnel/db";
import { emit } from "@funnel/events";
import { AuditRequestSchema } from "@funnel/shared";

import { dispatchAuditJob } from "@/lib/grader/queue";
import { hashIp, hashUrl } from "@/lib/grader/hash";
import { createMockAudit } from "@/lib/grader/mock-audit";
import { checkAuditRateLimits } from "@/lib/grader/rate-limit";
import { newShareCode } from "@/lib/grader/share-code";
import { verifyTurnstile } from "@/lib/grader/turnstile";
import {
  describeValidationError,
  InvalidAuditUrlError,
  validateAuditUrl,
} from "@/lib/grader/url-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_WINDOW_MS = 24 * 60 * 60 * 1000;

function clientIp(req: NextRequest): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf;
  return null;
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = AuditRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // 1. Strict SSRF-safe validation.
  let urlObj: URL;
  try {
    urlObj = validateAuditUrl(parsed.data.url);
  } catch (err) {
    if (err instanceof InvalidAuditUrlError) {
      return NextResponse.json(
        { error: describeValidationError(err.reason), reason: err.reason },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  const ip = clientIp(req);
  const ua = req.headers.get("user-agent");

  try {
  // 2. Turnstile.
  const captcha = await verifyTurnstile({ token: parsed.data.turnstile_token, remoteIp: ip });
  if (!captcha.ok) {
    return NextResponse.json(
      { error: "Captcha verification failed. Please retry.", reason: captcha.reason },
      { status: 403 },
    );
  }

  // 3. Rate limits.
  const rl = await checkAuditRateLimits({ ip, hostname: urlObj.hostname });
  if (!rl.ok) {
    await emit("rate_limited", {
      layer: rl.blocked.layer,
      scope: rl.blocked.scope,
      endpoint: "/api/audit",
    }).catch(() => null);
    return NextResponse.json(
      {
        error: "Rate limit reached. Try again later.",
        layer: rl.blocked.layer,
        resetAt: rl.blocked.resetAt.toISOString(),
      },
      { status: 429 },
    );
  }

  // 4. Cache lookup (24h dedupe by url_hash).
  const url_hash = await hashUrl(urlObj);
  const since = new Date(Date.now() - CACHE_WINDOW_MS);
  const cached = await prisma.audit.findFirst({
    where: {
      urlHash: url_hash,
      status: "done",
      completedAt: { gte: since },
    },
    include: { shareCode: true },
    orderBy: { completedAt: "desc" },
  });

  if (cached && cached.shareCode) {
    return NextResponse.json({
      audit_id: cached.id,
      share_code: cached.shareCode.code,
      status: cached.status,
      cached: true,
    });
  }

  // 5. Create new audit + share code.
  const audit = await prisma.audit.create({
    data: {
      url: urlObj.toString(),
      urlHostname: urlObj.hostname,
      urlHash: url_hash,
      requesterIp: ip ?? undefined,
      requesterUa: ua ?? undefined,
      status: "queued",
      shareCode: {
        create: { code: newShareCode() },
      },
    },
    include: { shareCode: true },
  });

  // 6. Fire telemetry + dispatch the job to the agent-runner Worker.
  await emit("audit_requested", {
    audit_id: audit.id,
    url_hostname: urlObj.hostname,
    url_hash,
    requester_ip_hash: ip ? await hashIp(ip) : null,
    referrer: req.headers.get("referer") ?? null,
    utm: parsed.data.utm,
    user_agent_class: classifyUa(ua),
  }).catch(() => null);

  // Fire-and-forget dispatch — runner streams progress back over pubsub.
  void dispatchAuditJob({ audit_id: audit.id, url: urlObj.toString() });

  return NextResponse.json(
    {
      audit_id: audit.id,
      share_code: audit.shareCode!.code,
      status: audit.status,
      cached: false,
    },
    { status: 202 },
  );
  } catch {
    const audit = createMockAudit(urlObj.toString());

    return NextResponse.json(
      {
        audit_id: audit.id,
        share_code: audit.shareCode,
        status: "done",
        cached: false,
        local_fallback: true,
      },
      { status: 202 },
    );
  }
}

function classifyUa(ua: string | null): string {
  if (!ua) return "unknown";
  if (/bot|crawl|spider/i.test(ua)) return "bot";
  if (/mobile|android|iphone/i.test(ua)) return "mobile";
  return "desktop";
}
