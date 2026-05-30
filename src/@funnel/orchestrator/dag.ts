/**
 * Phase 2 scheduler — parallel agent dispatcher with dependency awareness
 * (Doc 19 §C).
 *
 * Rules implemented here:
 *
 *   - Brand Guardian MUST finish before Image (Image consumes brand tokens).
 *   - Page benefits from Hook but does NOT require it (Doc 19 §C.2). Page
 *     starts in parallel; if Hook lands first the assembly step stitches its
 *     output in, otherwise the assembler uses the Planner brief alone.
 *   - All other Phase-2 agents are independent.
 *   - On QA failure, `runTargeted()` re-runs ONLY the agents listed in
 *     `failingDimensions[].suggestedAgentsToRerun`. Max one re-run cycle
 *     across the whole generation (orchestrator enforces).
 *
 * The scheduler emits a unified `AsyncIterable<GenerationEvent>` so the
 * orchestrator can re-emit it as-is over SSE.
 */

import type {
  Agent,
  AgentContext,
  AgentEvent,
  AgentName,
  BrandTokensOutput,
  GenerationEvent,
  Logger,
  ModelId,
  PlannerOutput,
} from "./types.js";

const PHASE2_AGENTS: AgentName[] = [
  "hook",
  "page",
  "lead_magnet",
  "ad_copy",
  "audience",
  "email",
  "sms",
  "voice_script",
  "upsell",
  "brand_guardian",
  // image is added after brand_guardian finishes
];

export class Phase2Scheduler {
  constructor(
    private readonly agents: Map<AgentName, Agent<unknown, unknown>>,
    private readonly logger: Logger,
  ) {}

  /**
   * Run the full Phase 2 fanout. Yields agent-level GenerationEvents
   * (`agent_started`, `agent_chunk`, `agent_completed`).
   *
   * Returns (via the final yielded `agent_completed` set) the assembled
   * per-agent output map — owned by the orchestrator for Phase-3 input.
   */
  async *run(
    ctx: AgentContext,
    plan: PlannerOutput,
    options: {
      skipAgents?: AgentName[];
      collect: (agent: AgentName, output: unknown) => void;
    },
  ): AsyncIterable<GenerationEvent> {
    const skip = new Set<AgentName>(options.skipAgents ?? []);
    const dispatch = plan.dispatch;

    // Build queue: agents the planner dispatched, minus skipped, minus image.
    const queue: AgentName[] = PHASE2_AGENTS.filter(
      (n) => !skip.has(n) && dispatch[n as Exclude<AgentName, "planner">] !== undefined,
    );

    const inflight = new Map<AgentName, AsyncIterator<AgentEvent<unknown>>>();
    let brandTokens: BrandTokensOutput | null = null;
    let imageStarted = false;

    for (const name of queue) {
      const agent = this.agents.get(name);
      if (!agent) {
        this.logger.warn("agent_not_registered", { agent: name });
        continue;
      }
      inflight.set(name, this.launch(agent, ctx, name)[Symbol.asyncIterator]());
    }

    while (inflight.size > 0) {
      if (ctx.abortSignal.aborted) {
        for (const it of inflight.values()) {
          try {
            await it.return?.(undefined);
          } catch {
            /* ignore */
          }
        }
        return;
      }

      const next = await raceNext(inflight);
      if (!next) break;
      const { name, event } = next;

      // Surface to outer SSE
      yield* this.toGenerationEvents(ctx, name, event);

      if (event.type === "final") {
        options.collect(name, event.output);
        if (name === "brand_guardian") {
          brandTokens = event.output as BrandTokensOutput;
          if (!imageStarted && !skip.has("image") && dispatch.image !== undefined) {
            const imageAgent = this.agents.get("image");
            if (imageAgent) {
              const imageCtx: AgentContext = { ...ctx, brandTokens };
              inflight.set(
                "image",
                this.launch(imageAgent, imageCtx, "image")[Symbol.asyncIterator](),
              );
              imageStarted = true;
            }
          }
        }
        inflight.delete(name);
      } else if (event.type === "error") {
        // The retry middleware decided this is terminal. Drop the agent and
        // continue with what we have. Phase-3 + QA will catch any required
        // missing output. We do NOT abort siblings — partial publish is the
        // designed degraded path (Doc 19 §C.2, §E.3).
        this.logger.warn("agent_terminal_error", {
          agent: name,
          error: event.error,
        });
        // If brand_guardian dies and image hasn't started, fall back to default tokens.
        if (name === "brand_guardian" && !imageStarted && !skip.has("image")) {
          const imageAgent = this.agents.get("image");
          if (imageAgent) {
            const imageCtx: AgentContext = { ...ctx, brandTokens: defaultBrandTokens() };
            inflight.set(
              "image",
              this.launch(imageAgent, imageCtx, "image")[Symbol.asyncIterator](),
            );
            imageStarted = true;
          }
        }
        inflight.delete(name);
      }
    }
  }

  /**
   * Targeted re-run for the regen cycle. The orchestrator should only call
   * this ONCE per generation — bounded by the spec (§C.2).
   */
  async *runTargeted(
    ctx: AgentContext,
    plan: PlannerOutput,
    agentsToRerun: AgentName[],
    options: {
      collect: (agent: AgentName, output: unknown) => void;
    },
  ): AsyncIterable<GenerationEvent> {
    const inflight = new Map<AgentName, AsyncIterator<AgentEvent<unknown>>>();
    const filtered = agentsToRerun.filter(
      (n) =>
        n !== "planner" &&
        n !== "fact_check" &&
        n !== "compliance" &&
        n !== "qa" &&
        n !== "video" &&
        this.agents.has(n) &&
        plan.dispatch[n as Exclude<AgentName, "planner">] !== undefined,
    );

    for (const name of filtered) {
      const agent = this.agents.get(name)!;
      inflight.set(name, this.launch(agent, ctx, name)[Symbol.asyncIterator]());
    }

    while (inflight.size > 0) {
      const next = await raceNext(inflight);
      if (!next) break;
      const { name, event } = next;
      yield* this.toGenerationEvents(ctx, name, event);
      if (event.type === "final") {
        options.collect(name, event.output);
        inflight.delete(name);
      } else if (event.type === "error") {
        inflight.delete(name);
      }
    }
  }

  /** Run a single agent (used for Planner, FactCheck, Compliance, QA, Video). */
  async *runOne<TIn, TOut>(
    agent: Agent<TIn, TOut>,
    input: TIn,
    ctx: AgentContext,
  ): AsyncIterable<{ name: AgentName; event: AgentEvent<TOut> }> {
    for await (const ev of agent.run(input, ctx)) {
      yield { name: agent.name, event: ev };
    }
  }

  private launch(
    agent: Agent<unknown, unknown>,
    ctx: AgentContext,
    name: AgentName,
  ): AsyncIterable<AgentEvent<unknown>> {
    // Input for a dispatched agent is the planner brief + ambient ctx data.
    // Each concrete agent extracts what it needs from `ctx.plan!.dispatch[name].brief`.
    const brief =
      ctx.plan?.dispatch[name as Exclude<AgentName, "planner">]?.brief ?? "";
    return agent.run({ brief, agentName: name }, ctx);
  }

  private async *toGenerationEvents(
    ctx: AgentContext,
    name: AgentName,
    event: AgentEvent<unknown>,
  ): AsyncIterable<GenerationEvent> {
    const ts = ctx.clock.iso();
    if (event.type === "started") {
      yield {
        type: "agent_started",
        data: {
          generationId: ctx.generationId,
          agent: name,
          modelUsed: ctx._modelOverride ?? selectPrimaryModel(this.agents, name),
          estimatedDurationMs: estimateDurationMs(name),
          ts,
        },
      };
    } else if (event.type === "chunk") {
      const slot = event.slot ?? "stream";
      const delta = event.raw ?? JSON.stringify(event.delta);
      yield {
        type: "agent_chunk",
        data: {
          generationId: ctx.generationId,
          agent: name,
          slot,
          delta,
          ts,
        },
      };
    } else if (event.type === "final") {
      const cost = event.cost.totalCents;
      yield {
        type: "agent_completed",
        data: {
          generationId: ctx.generationId,
          agent: name,
          output: event.output,
          costCents: cost,
          durationMs: estimateDurationMs(name),
          cacheHitRatio: event.cacheHits.ratio,
          ts,
        },
      };
    } else if (event.type === "progress") {
      yield {
        type: "agent_chunk",
        data: {
          generationId: ctx.generationId,
          agent: name,
          slot: "progress",
          delta: String(event.pct),
          ts,
        },
      };
    }
    // error events are surfaced via logger in caller; the orchestrator
    // re-emits a generation_failed only on the final cycle.
  }
}

function selectPrimaryModel(
  agents: Map<AgentName, Agent<unknown, unknown>>,
  name: AgentName,
): ModelId {
  const a = agents.get(name);
  return a?.primaryModel ?? "claude-sonnet-4-6";
}

function estimateDurationMs(name: AgentName): number {
  // Doc 19 §A.6 — rough P50 used for client-side progress bars.
  switch (name) {
    case "planner":
      return 4000;
    case "image":
      return 12000;
    case "video":
      return 90000;
    case "fact_check":
    case "compliance":
      return 8000;
    case "qa":
      return 5000;
    default:
      return 6000;
  }
}

async function raceNext<K, V>(
  iters: Map<K, AsyncIterator<V>>,
): Promise<{ name: K; event: V } | null> {
  if (iters.size === 0) return null;
  const entries = Array.from(iters.entries());
  const promises = entries.map(([name, it]) =>
    it.next().then((res) => ({ name, res })),
  );
  const { name, res } = await Promise.race(promises);
  if (res.done) {
    iters.delete(name);
    return raceNext(iters);
  }
  return { name, event: res.value };
}

function defaultBrandTokens(): BrandTokensOutput {
  return {
    palette: {
      primary: "#0F172A",
      secondary: "#3B82F6",
      accent: "#F59E0B",
      bg: "#FFFFFF",
      fg: "#0F172A",
    },
    typography: {
      headingFont: "Inter",
      bodyFont: "Inter",
      scale: [14, 16, 18, 24, 32, 48],
    },
    voice: {
      register: "casual",
      bannedWords: [],
      signaturePhrases: [],
    },
    imagery: {
      mood: "clean modern",
      lighting: "natural daylight",
      subjectGuidance: "no faces of specific identifiable people",
    },
  };
}
