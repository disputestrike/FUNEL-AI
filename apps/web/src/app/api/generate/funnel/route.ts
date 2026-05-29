import { NextResponse } from "next/server";
import { buildAutomatedFunnel } from "@funnel/orchestrator";
import { z } from "zod";

import { saveGeneratedFunnel } from "@/lib/funnels/generated-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GenerateFunnelRequest = z.object({
  industry: z.string().trim().min(1),
  audience: z.string().trim().min(1),
  offer: z.string().trim().min(1),
  geography: z.string().trim().min(2).default("US"),
  businessName: z.string().trim().max(120).optional(),
  brandUrl: z.string().trim().url().optional().nullable(),
});

export async function POST(req: Request) {
  const parsed = GenerateFunnelRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Industry, audience, and offer are required." }, { status: 400 });
  }

  const origin = new URL(req.url).origin;
  const providerReadiness = readProviderReadiness();
  const funnel = buildAutomatedFunnel({
    generationId: `gen_${Date.now().toString(36)}`,
    workspaceId: "web-preview",
    industry: parsed.data.industry,
    audience: parsed.data.audience,
    offer: parsed.data.offer,
    geography: parsed.data.geography,
    businessName: parsed.data.businessName,
    brandUrl: parsed.data.brandUrl,
    appUrl: origin,
    providerReadiness,
  });

  saveGeneratedFunnel(funnel);

  return NextResponse.json({
    ok: true,
    funnel,
    publish_url: funnel.public_url,
    provider_readiness: providerReadiness,
    next_steps: missingProviderSteps(providerReadiness),
  });
}

function readProviderReadiness() {
  return {
    googleAuth: hasAny("GOOGLE_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_ID"),
    openai: hasAny("OPENAI_API_KEY"),
    anthropic: hasAny("ANTHROPIC_API_KEY"),
    replicate: hasAny("REPLICATE_API_TOKEN"),
    railwayStorage: hasAll("R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME")
      || hasAny("RAILWAY_VOLUME_MOUNT_PATH"),
    resend: hasAny("RESEND_API_KEY"),
    stripe: hasAny("STRIPE_SECRET_KEY"),
    paypal: hasAny("PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET"),
    signalwire: hasAny("SIGNALWIRE_PROJECT_ID") && hasAny("SIGNALWIRE_API_TOKEN", "SIGNALWIRE_AUTH_TOKEN", "SIGNALWIRE_TOKEN"),
  };
}

function hasAny(...keys: string[]) {
  return keys.some((key) => Boolean(process.env[key]));
}

function hasAll(...keys: string[]) {
  return keys.every((key) => Boolean(process.env[key]));
}

function missingProviderSteps(readiness: ReturnType<typeof readProviderReadiness>) {
  const steps: Array<{ provider: string; env: string[]; purpose: string }> = [];
  if (!readiness.googleAuth) steps.push({ provider: "Google Auth", env: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"], purpose: "Real account signup and login." });
  if (!readiness.openai) steps.push({ provider: "OpenAI", env: ["OPENAI_API_KEY"], purpose: "Copy, reasoning, and image generation." });
  if (!readiness.anthropic) steps.push({ provider: "Anthropic", env: ["ANTHROPIC_API_KEY"], purpose: "Offer strategy and quality rewrites." });
  if (!readiness.replicate) steps.push({ provider: "Replicate", env: ["REPLICATE_API_TOKEN"], purpose: "Flux/Ideogram-style image fallback." });
  if (!readiness.railwayStorage) steps.push({ provider: "Railway/R2 bucket", env: ["R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME"], purpose: "Store generated images, PDFs, and exports." });
  if (!readiness.resend) steps.push({ provider: "Resend", env: ["RESEND_API_KEY"], purpose: "Deliver lead magnets and nurture emails." });
  if (!readiness.stripe) steps.push({ provider: "Stripe", env: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"], purpose: "Tripwire, order bump, and subscription checkout." });
  if (!readiness.paypal) steps.push({ provider: "PayPal", env: ["PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET", "PAYPAL_WEBHOOK_ID"], purpose: "Alternative checkout." });
  if (!readiness.signalwire) steps.push({ provider: "SignalWire", env: ["SIGNALWIRE_PROJECT_ID", "SIGNALWIRE_API_TOKEN", "SIGNALWIRE_SPACE_URL", "SIGNALWIRE_FROM_NUMBER"], purpose: "SMS and voice follow-up." });
  return steps;
}
