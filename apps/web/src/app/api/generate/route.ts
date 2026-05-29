/**
 * Streaming generation endpoint — SSE.
 *
 * POST /api/generate
 *   body: { workspace_id, industry, business_profile }
 *   returns: text/event-stream of GenerationEvent frames (orchestrator wire format).
 *
 * The route runs an event producer (`buildGenerationEventStream`) and pipes
 * it through the shared `toSseReadableStream` adapter so frames are wire-
 * identical to what the real orchestrator will emit. When the production
 * orchestrator runner is wired in (Doc 19 §A.3), swap the producer — no
 * client changes required.
 *
 * Customer-facing labels live entirely on the client; this route never
 * emits friendly strings, only canonical GenerationEvents.
 */

import { z } from "zod";
import {
  toSseReadableStream,
  type GenerationEvent,
  type AgentName,
  type ArchetypeId,
  type ModelId,
} from "@funnel/orchestrator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RequestSchema = z.object({
  workspace_id: z.string().min(1).default("web-preview"),
  industry: z.string().min(1),
  business_profile: z
    .object({
      offer: z.string().min(1),
      target_customer: z.string().min(1).default("qualified buyers"),
      geography: z.string().length(2).default("US"),
      businessName: z.string().optional(),
      brandUrl: z.string().url().optional().nullable(),
      awareness: z.enum(["cold", "warm", "hot"]).optional(),
      price_point_cents: z.number().int().nonnegative().optional(),
    })
    .passthrough(),
  archetypeHint: z
    .enum([
      "lead_magnet_optin",
      "free_consult_booking",
      "tripwire",
      "webinar_evergreen",
      "application_funnel",
      "product_launch",
    ])
    .optional(),
  budgetCapCents: z.number().int().positive().optional(),
});

export async function POST(req: Request) {
  let parsed;
  try {
    parsed = RequestSchema.safeParse(await req.json());
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: "Missing or invalid input" }),
      { status: 400, headers: { "content-type": "application/json" } },
    );
  }

  const events = buildGenerationEventStream(parsed.data);
  const sse = toSseReadableStream(events);

  return new Response(sse, {
    status: 200,
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
      connection: "keep-alive",
    },
  });
}

/* ---------------------------------------------------------------------------
 * Generation event producer.
 *
 * Emits the exact GenerationEvent shapes from @funnel/orchestrator so the
 * client renders against real wire types. Replace with the real
 * Orchestrator.run() instance once Doc 19 §A.3 wiring lands — the consumer
 * does not care.
 * ------------------------------------------------------------------------ */

type ProducerInput = z.infer<typeof RequestSchema>;

async function* buildGenerationEventStream(
  input: ProducerInput,
): AsyncIterable<GenerationEvent> {
  const generationId = `gen_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  const ts = () => new Date().toISOString();
  const archetype: ArchetypeId = input.archetypeHint ?? "lead_magnet_optin";
  const budgetCapCents = input.budgetCapCents ?? 150;
  const offer = input.business_profile.offer;
  const audience = input.business_profile.target_customer;
  const industry = input.industry;

  const phase2Agents: AgentName[] = [
    "hook",
    "page",
    "lead_magnet",
    "image",
    "ad_copy",
    "audience",
    "email",
    "sms",
    "voice_script",
    "upsell",
    "brand_guardian",
  ];

  let spentCents = 0;
  const tick = (ms: number) => new Promise((r) => setTimeout(r, ms));

  // 1. generation_started
  yield {
    type: "generation_started",
    data: {
      generationId,
      workspaceId: input.workspace_id,
      estimatedDurationMs: 45_000,
      estimatedCostCents: 120,
      budgetCapCents,
      archetypeHint: archetype,
      ts: ts(),
    },
  };

  // 2. planner
  await tick(250);
  yield {
    type: "planner_started",
    data: { generationId, ts: ts() },
  };
  await tick(1_400);
  spentCents += 8;
  yield {
    type: "planner_completed",
    data: {
      generationId,
      archetype,
      rationale: `${industry} buyers are skeptical until they see ungated value. Lead with the proof, then the offer.`,
      agentsDispatched: phase2Agents,
      ts: ts(),
    },
  };

  // 3. Phase 2 fanout — streamed in waves to keep the UI alive.
  const waves: AgentName[][] = [
    ["hook", "audience", "brand_guardian"],
    ["page", "lead_magnet", "ad_copy"],
    ["image", "email", "sms"],
    ["voice_script", "upsell"],
  ];

  for (const wave of waves) {
    // start all in wave
    for (const agent of wave) {
      yield {
        type: "agent_started",
        data: {
          generationId,
          agent,
          modelUsed: pickModel(agent),
          estimatedDurationMs: 3_500,
          ts: ts(),
        },
      };
    }

    // stream chunks for chunkable agents
    const chunkable = wave.filter((a) =>
      ["hook", "page", "ad_copy", "email"].includes(a),
    );
    for (const agent of chunkable) {
      const phrases = streamingPhrases(agent, offer, audience);
      let cumulative = "";
      for (const word of phrases) {
        await tick(60 + Math.random() * 40);
        cumulative += (cumulative ? " " : "") + word;
        yield {
          type: "agent_chunk",
          data: {
            generationId,
            agent,
            slot: defaultSlot(agent),
            delta: (cumulative === word ? "" : " ") + word,
            cumulative,
            ts: ts(),
          },
        };
      }
    }

    await tick(400);

    // complete all in wave
    for (const agent of wave) {
      const cost = agentCostCents(agent);
      spentCents += cost;
      yield {
        type: "agent_completed",
        data: {
          generationId,
          agent,
          output: agentOutput(agent, { offer, audience, industry }),
          costCents: cost,
          durationMs: 2_800 + Math.floor(Math.random() * 1_200),
          cacheHitRatio: 0.42 + Math.random() * 0.4,
          ts: ts(),
        },
      };

      // budget warning when crossing 80%
      const pct = (spentCents / budgetCapCents) * 100;
      if (pct >= 80 && pct < 100 && agent === "image") {
        yield {
          type: "budget_warning",
          data: {
            generationId,
            spentCents,
            capCents: budgetCapCents,
            pctUsed: pct,
            ts: ts(),
          },
        };
      }
    }

    await tick(300);
  }

  // 4. assembly
  yield {
    type: "assembly_started",
    data: { generationId, ts: ts() },
  };
  await tick(700);

  // 5. fact_check + compliance + qa
  for (const agent of ["fact_check", "compliance", "qa"] as AgentName[]) {
    yield {
      type: "agent_started",
      data: {
        generationId,
        agent,
        modelUsed: pickModel(agent),
        estimatedDurationMs: 2_500,
        ts: ts(),
      },
    };
    await tick(1_200);
    const cost = agentCostCents(agent);
    spentCents += cost;
    yield {
      type: "agent_completed",
      data: {
        generationId,
        agent,
        output: agentOutput(agent, { offer, audience, industry }),
        costCents: cost,
        durationMs: 1_400,
        cacheHitRatio: 0.6,
        ts: ts(),
      },
    };
  }

  // QA score
  yield {
    type: "quality_scored",
    data: {
      generationId,
      overall: 86,
      dimensions: {
        clarity: 92,
        specificity: 85,
        proof: 81,
        cta_strength: 88,
        compliance: 90,
        brand: 84,
      },
      failingDimensions: [],
      ts: ts(),
    },
  };

  // 6. publish + complete
  await tick(500);
  const slug = slugify(`${industry}-${generationId}`);
  yield {
    type: "funnel_published",
    data: {
      generationId,
      funnelId: `fun_${generationId.slice(4)}`,
      url: `/f/${slug}`,
      ts: ts(),
    },
  };

  yield {
    type: "generation_completed",
    data: {
      generationId,
      funnelId: `fun_${generationId.slice(4)}`,
      url: `/f/${slug}`,
      totalCostCents: spentCents,
      durationMs: Date.now() % 60_000,
      ts: ts(),
    },
  };
}

function pickModel(agent: AgentName): ModelId {
  // simplified model picker — keeps the wire format honest
  switch (agent) {
    case "image":
      return "flux-1.1-pro";
    case "video":
      return "runway-gen-3";
    case "voice_script":
      return "claude-sonnet-4-6";
    case "qa":
    case "fact_check":
    case "compliance":
    case "brand_guardian":
      return "claude-opus-4-7";
    default:
      return "claude-sonnet-4-6";
  }
}

function defaultSlot(agent: AgentName): string {
  switch (agent) {
    case "hook":
      return "headline";
    case "page":
      return "section";
    case "ad_copy":
      return "primary_text";
    case "email":
      return "body";
    default:
      return "output";
  }
}

function agentCostCents(agent: AgentName): number {
  switch (agent) {
    case "image":
      return 18;
    case "page":
      return 14;
    case "hook":
    case "ad_copy":
    case "email":
    case "lead_magnet":
      return 9;
    case "qa":
    case "fact_check":
    case "compliance":
      return 6;
    default:
      return 5;
  }
}

function streamingPhrases(
  agent: AgentName,
  offer: string,
  audience: string,
): string[] {
  switch (agent) {
    case "hook":
      return `The ${audience.toLowerCase()} playbook for ${offer.toLowerCase()} — without the guesswork`.split(
        " ",
      );
    case "page":
      return "We help you ship a high-converting funnel in minutes, not weeks — start with a free asset, no card needed.".split(
        " ",
      );
    case "ad_copy":
      return `Stop chasing leads. Start with a free, no-strings asset that does the qualifying for you.`.split(
        " ",
      );
    case "email":
      return `Subject: Your free ${offer} kit is inside — preview it before we talk.`.split(
        " ",
      );
    default:
      return ["..."];
  }
}

function agentOutput(
  agent: AgentName,
  ctx: { offer: string; audience: string; industry: string },
): unknown {
  const { offer, audience, industry } = ctx;
  switch (agent) {
    case "hook":
      return {
        headline: `The ${audience} playbook for ${offer}`,
        subhead: `Built for ${industry}. Free to start. No card.`,
        preview: "Bold, specific, and proof-backed.",
      };
    case "page":
      return {
        hero: {
          headline: `The ${audience} playbook for ${offer}`,
          subhead: `Built for ${industry}. Free to start. No card.`,
          ctaLabel: "Get the free playbook",
        },
        sections: [
          {
            id: "proof",
            type: "proof",
            title: "Why it works",
            body: "Sourced stats and real outcomes — no vague claims.",
          },
          {
            id: "promise",
            type: "promise",
            title: "What you'll get",
            body: `A vetted ${offer} kit with templates, scripts, and a 7-day rollout plan.`,
          },
          {
            id: "objections",
            type: "objections",
            title: "Common objections, answered",
            body: `Risk-free. Cancel anytime. Built for ${industry} teams.`,
          },
          {
            id: "cta",
            type: "cta",
            title: "Start with the free asset",
            body: "Most teams see qualified replies within 72 hours.",
          },
        ],
      };
    case "lead_magnet":
      return {
        title: `The ${industry} ${offer} kit`,
        modules: [
          "30-min qualification call script",
          "Objection-handling cheat sheet",
          "7-day rollout calendar",
        ],
      };
    case "image":
      return {
        hero: {
          url: `https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1600&q=80`,
          alt: `${audience} reviewing the ${offer} playbook`,
          width: 1600,
          height: 900,
        },
      };
    case "ad_copy":
      return {
        primary_text: `Stop chasing leads in ${industry}. Start with a free, no-strings asset that does the qualifying for you.`,
        headline: `The ${audience} playbook`,
        description: `Free ${offer} kit. No card.`,
        cta: "Get the kit",
      };
    case "audience":
      return {
        primary: `${audience} in ${industry} who own their pipeline`,
        excluded: ["job seekers", "students"],
        interests: ["sales playbooks", "lead qualification", industry.toLowerCase()],
      };
    case "email":
      return {
        sequence: [
          { delay: "immediate", subject: "Your free kit is inside" },
          { delay: "+1 day", subject: "How to actually use it" },
          { delay: "+3 days", subject: "One question before we talk" },
        ],
      };
    case "sms":
      return {
        sequence: [
          { delay: "+15 min", body: "Kit sent. Reply YES for the rollout calendar." },
          { delay: "+1 day", body: "Quick check — did the templates land?" },
        ],
      };
    case "voice_script":
      return {
        opening: "Hi — this is your free briefing on the kit you grabbed.",
        qualifying: ["What's your timeline?", "What have you tried before?"],
      };
    case "upsell":
      return {
        ladder: [
          { title: "Done-for-you rollout (7 days)", price: "$497" },
          { title: "Quarterly optimization", price: "$197/mo" },
        ],
      };
    case "brand_guardian":
      return {
        palette: {
          primary: "#0F4FF0",
          secondary: "#0A2540",
          accent: "#22D3A5",
          bg: "#FFFFFF",
          fg: "#0A2540",
        },
        voice: { register: "authoritative", bannedWords: ["guaranteed", "instant"] },
      };
    case "fact_check":
      return { verifiedClaims: 12, flagged: [] };
    case "compliance":
      return { severity: "note", findings: [] };
    case "qa":
      return { overall: 86, pass: true };
    default:
      return {};
  }
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}
