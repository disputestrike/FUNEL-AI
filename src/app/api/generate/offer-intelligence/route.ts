import { NextResponse } from "next/server";
import { z } from "zod";
import { generate } from "@funnel/orchestrator";

const GenerateOfferRequest = z.object({
  industry: z.string().min(1),
  audience: z.string().min(1),
  offer: z.string().min(1),
  geography: z.string().min(2).default("US"),
});

export async function POST(req: Request) {
  const parsed = GenerateOfferRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid generation request" }, { status: 400 });
  }

  const result = await generate({
    generationId: `gen_${Date.now().toString(36)}`,
    workspaceId: "web-preview",
    vertical: parsed.data.industry,
    prompt: `${parsed.data.offer} Audience: ${parsed.data.audience}. Geography: ${parsed.data.geography}.`,
    kbPackIds: [],
    parentGenerationId: null,
  });

  return NextResponse.json(result);
}
