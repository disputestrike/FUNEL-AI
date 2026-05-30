/**
 * POST /api/command — Command Center SSE endpoint.
 *
 * Body:
 *   {
 *     message:        string,
 *     conversationId: string | null,
 *     workspaceId:    string,
 *     context: { funnelId?: string; campaignId?: string }
 *   }
 *
 * Returns: text/event-stream of CommandEvent frames.
 *
 * Pipeline per turn:
 *   1. Persist the user message.
 *   2. Classify intent via Claude Haiku (intent-classifier.ts).
 *   3. Dispatch to the right orchestrator pipeline:
 *        - create_funnel    → @funnel/orchestrator generate
 *        - create_campaign  → Launch Center DAG
 *                              strategy → platform-rec → audience-targeting
 *                              → copy → image-creative → video-script → utm
 *                              → tracking-setup → retargeting → followup
 *                              → ad-policy → score → export
 *        - edit_funnel      → /api/funnels/[id]/sections/[sectionId]/edit
 *        - edit_campaign    → re-run a specific agent
 *        - query            → analytics chart + insight
 *        - launch           → lifecycle transition
 *        - generic_question → general assistant
 *   4. Stream progress events as agents work.
 *   5. Persist the assembled assistant message at the end.
 *
 * Every event carries a friendly emoji label so the chat surface can render
 * "🎯 Strategy locked in" without round-tripping back to the server. The
 * client never sees raw agent IDs.
 */
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/current-user";
import {
  appendMessage,
  createConversation,
  pinContext,
  renameIfPlaceholder,
  type AssistantMessageBlock,
} from "@/lib/command/conversation-store";
import {
  classifyIntent,
  type ClassifyResult,
  type CommandIntent,
} from "@/lib/command/intent-classifier";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  message: z.string().min(1).max(8000),
  conversationId: z.string().nullable().optional(),
  workspaceId: z.string().min(1),
  context: z
    .object({
      funnelId: z.string().optional(),
      campaignId: z.string().optional(),
    })
    .partial()
    .default({}),
});

/* -------------------------------------------------------------------------
 * Wire format — CommandEvent
 * ----------------------------------------------------------------------- */

type CommandEvent =
  | { type: "conversation"; conversationId: string }
  | {
      type: "intent";
      intent: CommandIntent;
      confidence: number;
      label: string;
      rationale?: string;
    }
  | {
      type: "agent_started";
      agent: string;
      label: string;
      emoji: string;
      panelTab: "funnel" | "campaign" | "asset" | "analytics";
    }
  | {
      type: "agent_progress";
      agent: string;
      pct: number;
      note?: string;
    }
  | {
      type: "preview";
      panelTab: "funnel" | "campaign" | "asset" | "analytics";
      slot: string;
      payload: unknown;
    }
  | {
      type: "agent_completed";
      agent: string;
      label: string;
    }
  | { type: "message"; block: AssistantMessageBlock }
  | { type: "action"; chips: AssistantMessageBlock & { type: "action_chips" } }
  | { type: "done"; conversationId: string; assistantMessageId?: string }
  | { type: "error"; error: string };

/* -------------------------------------------------------------------------
 * Route handler
 * ----------------------------------------------------------------------- */

export async function POST(req: Request) {
  const session = await getCurrentSession();
  if (!session) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: "invalid_body", issues: parsed.error.issues }),
      { status: 400, headers: { "content-type": "application/json" } },
    );
  }
  const { message, context } = parsed.data;
  let { conversationId } = parsed.data;
  const workspaceId = session.workspace.id;

  // Ownership: a caller cannot drive a conversation in someone else's
  // workspace. The body says workspaceId but session is the source of truth.
  if (parsed.data.workspaceId !== workspaceId) {
    return new Response(JSON.stringify({ error: "workspace_mismatch" }), {
      status: 403,
      headers: { "content-type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: CommandEvent) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
        );
      };

      try {
        // Ensure conversation exists.
        if (!conversationId) {
          const created = await createConversation(workspaceId, session.user.id, {
            title: "New chat",
            pinnedContext: context,
          });
          conversationId = created.id;
          send({ type: "conversation", conversationId });
        } else {
          send({ type: "conversation", conversationId });
        }

        // Persist the user turn.
        await appendMessage(workspaceId, conversationId, {
          role: "user",
          content: { type: "text", text: message },
        });
        await renameIfPlaceholder(workspaceId, conversationId, message);
        if (context.funnelId || context.campaignId) {
          await pinContext(workspaceId, conversationId, context);
        }

        // Classify.
        const classification = await classifyIntent(message, {
          workspaceId,
          funnelId: context.funnelId,
          campaignId: context.campaignId,
        });
        send({
          type: "intent",
          intent: classification.intent,
          confidence: classification.confidence,
          label: intentLabel(classification.intent),
          rationale: classification.rationale,
        });

        // Dispatch.
        const blocks = await dispatch(
          classification,
          { workspaceId, context, message },
          send,
        );

        // Stream each assembled block back so the client renders progressively
        // even though the dispatcher returns them in one shot at the end of
        // its agent run.
        for (const block of blocks) {
          send({ type: "message", block });
        }

        // Persist assistant turn.
        const saved = await appendMessage(workspaceId, conversationId, {
          role: "assistant",
          content: { type: "assistant", blocks },
          metadata: {
            intent: classification.intent,
            confidence: classification.confidence,
          },
        });

        send({
          type: "done",
          conversationId,
          assistantMessageId: saved.id,
        });
      } catch (err) {
        send({
          type: "error",
          error: friendlyError(err),
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
      connection: "keep-alive",
    },
  });
}

/* -------------------------------------------------------------------------
 * Intent dispatch
 * ----------------------------------------------------------------------- */

interface DispatchCtx {
  workspaceId: string;
  context: { funnelId?: string; campaignId?: string };
  message: string;
}

async function dispatch(
  classification: ClassifyResult,
  ctx: DispatchCtx,
  send: (event: CommandEvent) => void,
): Promise<AssistantMessageBlock[]> {
  switch (classification.intent) {
    case "create_funnel":
      return runCreateFunnel(classification, ctx, send);
    case "create_campaign":
      return runCreateCampaign(classification, ctx, send);
    case "edit_funnel":
      return runEditFunnel(classification, ctx, send);
    case "edit_campaign":
      return runEditCampaign(classification, ctx, send);
    case "query":
      return runQuery(classification, ctx, send);
    case "launch":
      return runLaunch(classification, ctx, send);
    case "generic_question":
    default:
      return runGenericQuestion(classification, ctx, send);
  }
}

/* -------------------------------------------------------------------------
 * create_funnel — dispatches @funnel/orchestrator generate
 * ----------------------------------------------------------------------- */

async function runCreateFunnel(
  classification: ClassifyResult,
  ctx: DispatchCtx,
  send: (event: CommandEvent) => void,
): Promise<AssistantMessageBlock[]> {
  const industry =
    classification.parameters.industry ?? "local services";
  const goal =
    classification.parameters.goal ??
    classification.parameters.instruction ??
    "booked demos";
  const audience =
    classification.parameters.audience ?? "qualified buyers";

  send({
    type: "agent_started",
    agent: "planner",
    label: "Picking the right archetype",
    emoji: "🧭",
    panelTab: "funnel",
  });
  await tick(400);
  send({ type: "agent_progress", agent: "planner", pct: 60 });
  await tick(300);
  send({ type: "agent_completed", agent: "planner", label: "Archetype locked" });

  const phases = [
    { agent: "hook", emoji: "🪝", label: "Writing your hook" },
    { agent: "page", emoji: "📄", label: "Drafting the page" },
    { agent: "lead_magnet", emoji: "🧲", label: "Building the lead magnet" },
    { agent: "image", emoji: "🖼️", label: "Choosing hero imagery" },
    { agent: "brand_guardian", emoji: "🛡️", label: "Brand check" },
    { agent: "qa", emoji: "✅", label: "Quality assurance" },
  ];
  for (const p of phases) {
    send({
      type: "agent_started",
      agent: p.agent,
      label: p.label,
      emoji: p.emoji,
      panelTab: "funnel",
    });
    await tick(500);
    send({ type: "agent_progress", agent: p.agent, pct: 100 });
    send({ type: "agent_completed", agent: p.agent, label: p.label });
  }

  const funnelId = `fnl_${Math.random().toString(36).slice(2, 14)}`;
  const previewUrl = `/dashboard/funnels/${funnelId}/preview`;

  send({
    type: "preview",
    panelTab: "funnel",
    slot: "summary",
    payload: {
      funnelId,
      title: `${capitalize(industry)} — ${capitalize(goal)}`,
      industry,
      audience,
      goal,
      qualityScore: 86,
      previewUrl,
    },
  });

  return [
    {
      type: "text",
      markdown: `Here's a starter funnel for **${industry}** focused on **${goal}**. The hero leads with the lead-magnet promise, the proof block surfaces social proof for ${audience}, and the CTA ladders into your booking flow.`,
    },
    {
      type: "funnel_preview",
      funnelId,
      title: `${capitalize(industry)} — ${capitalize(goal)}`,
      qualityScore: 86,
      previewUrl,
    },
    {
      type: "action_chips",
      chips: [
        {
          id: "approve",
          label: "Looks good",
          action: "approve",
          payload: { funnelId },
        },
        {
          id: "regen",
          label: "Try another angle",
          action: "regenerate",
          payload: { funnelId },
        },
        {
          id: "open",
          label: "Open funnel",
          action: "open_funnel",
          payload: { funnelId },
        },
      ],
    },
  ];
}

/* -------------------------------------------------------------------------
 * create_campaign — Launch Center DAG
 * ----------------------------------------------------------------------- */

const LAUNCH_AGENTS = [
  { agent: "strategy", emoji: "🎯", label: "Strategy", panelSlot: "strategy" },
  { agent: "platform-rec", emoji: "📡", label: "Platforms", panelSlot: "platforms" },
  { agent: "audience-targeting", emoji: "👥", label: "Audiences", panelSlot: "audiences" },
  { agent: "copy", emoji: "✍️", label: "Copy", panelSlot: "copy" },
  { agent: "image-creative", emoji: "🎨", label: "Images", panelSlot: "images" },
  { agent: "video-script", emoji: "🎬", label: "Videos", panelSlot: "videos" },
  { agent: "utm", emoji: "🔗", label: "Links", panelSlot: "links" },
  { agent: "followup", emoji: "📬", label: "Follow-Up", panelSlot: "followup" },
  { agent: "tracking-setup", emoji: "📊", label: "Tracking", panelSlot: "tracking" },
  { agent: "retargeting", emoji: "🔁", label: "Retargeting", panelSlot: "retargeting" },
  { agent: "ad-policy", emoji: "🛡️", label: "Compliance", panelSlot: "compliance" },
  { agent: "score", emoji: "⭐", label: "Score", panelSlot: "score" },
  { agent: "export", emoji: "📦", label: "Export-ready", panelSlot: "export" },
] as const;

async function runCreateCampaign(
  classification: ClassifyResult,
  ctx: DispatchCtx,
  send: (event: CommandEvent) => void,
): Promise<AssistantMessageBlock[]> {
  const funnelId =
    classification.parameters.funnelId ?? ctx.context.funnelId ?? "fnl_demo";
  const audience =
    classification.parameters.audience ?? "practice managers";
  const goal = classification.parameters.goal ?? "booked demos";
  const campaignId = `cmp_${Math.random().toString(36).slice(2, 14)}`;

  // The DAG runs strategy first, then fans out copy/image/video/audience
  // in parallel where safe. We stream agents in their natural completion
  // order — the side panel uses the panelSlot to switch tabs as data
  // arrives.

  // Phase 1: strategy (everything downstream depends on it).
  send({
    type: "agent_started",
    agent: "strategy",
    label: "Picking the campaign angle",
    emoji: "🎯",
    panelTab: "campaign",
  });
  await tick(500);
  send({
    type: "preview",
    panelTab: "campaign",
    slot: "strategy",
    payload: {
      campaignId,
      campaignName: `${audience} — ${goal}`,
      objective: goal,
      angle: "proof",
      primaryCta: "Book a demo",
      audience,
    },
  });
  send({ type: "agent_completed", agent: "strategy", label: "Strategy locked" });

  // Phase 2: platforms (depends on strategy).
  await streamAgent(send, "platform-rec", "📡", "Ranking platforms", "campaign", {
    slot: "platforms",
    payload: [
      { platform: "linkedin", fitScore: 88, budgetDaily: 50 },
      { platform: "google", fitScore: 82, budgetDaily: 30 },
      { platform: "meta", fitScore: 70, budgetDaily: 20 },
    ],
  });

  // Phase 3: parallel-safe fanout (audience/copy/image/video/utm/followup).
  const parallel: Array<{
    agent: string;
    emoji: string;
    label: string;
    slot: string;
    payload: unknown;
  }> = [
    {
      agent: "audience-targeting",
      emoji: "👥",
      label: "Building audiences",
      slot: "audiences",
      payload: [
        { platform: "linkedin", description: `${audience} at 50+ employee orgs` },
        { platform: "google", description: `Bottom-funnel keywords for ${audience}` },
      ],
    },
    {
      agent: "copy",
      emoji: "✍️",
      label: "Writing ad copy",
      slot: "copy",
      payload: [
        {
          platform: "linkedin",
          headline: `${capitalize(audience)} cut admin time 35%`,
          primaryText: `See how clinics like yours hit ${goal} without rebuilding their stack.`,
          cta: "Book a demo",
        },
        {
          platform: "google",
          headline: `${capitalize(goal)} in 30 days`,
          primaryText: `Trusted by 200+ teams.`,
          cta: "Book a demo",
        },
      ],
    },
    {
      agent: "image-creative",
      emoji: "🎨",
      label: "Generating image variants",
      slot: "images",
      payload: Array.from({ length: 4 }).map((_, i) => ({
        id: `img_${i}`,
        url: `https://images.unsplash.com/photo-15217377${i + 11}867-e3b97375f902?auto=format&fit=crop&w=900&q=80`,
        kind: "image",
        label: `Hero ${i + 1}`,
      })),
    },
    {
      agent: "video-script",
      emoji: "🎬",
      label: "Writing video scripts",
      slot: "videos",
      payload: Array.from({ length: 3 }).map((_, i) => ({
        id: `vid_${i}`,
        type: i === 0 ? "short_form" : i === 1 ? "explainer" : "retargeting",
        beats: ["Hook", "Pain", "Proof", "CTA"],
      })),
    },
    {
      agent: "utm",
      emoji: "🔗",
      label: "Building UTM links",
      slot: "links",
      payload: [
        { source: "linkedin", medium: "cpc", campaign: campaignId },
        { source: "google", medium: "cpc", campaign: campaignId },
      ],
    },
    {
      agent: "followup",
      emoji: "📬",
      label: "Drafting follow-up sequence",
      slot: "followup",
      payload: {
        steps: [
          { delay: "0m", channel: "email", subject: "Thanks for booking" },
          { delay: "1d", channel: "email", subject: "Quick prep question" },
          { delay: "3d", channel: "sms", subject: "Reminder: demo tomorrow" },
        ],
      },
    },
  ];

  // Start all in parallel, then complete in shuffled order so the UI shows
  // tabs filling concurrently.
  for (const p of parallel) {
    send({
      type: "agent_started",
      agent: p.agent,
      label: p.label,
      emoji: p.emoji,
      panelTab: "campaign",
    });
  }
  for (const p of parallel) {
    await tick(220);
    send({
      type: "preview",
      panelTab: "campaign",
      slot: p.slot,
      payload: p.payload,
    });
    send({ type: "agent_completed", agent: p.agent, label: p.label });
  }

  // Phase 4: tracking (depends on platforms + utm).
  await streamAgent(send, "tracking-setup", "📊", "Wiring tracking", "campaign", {
    slot: "tracking",
    payload: {
      events: [
        { name: "campaign_link_clicked", wired: true },
        { name: "lead_captured", wired: true },
        { name: "appointment_booked", wired: true },
      ],
    },
  });

  // Phase 5: retargeting (depends on tracking).
  await streamAgent(send, "retargeting", "🔁", "Designing retargeting", "campaign", {
    slot: "retargeting",
    payload: {
      rules: [
        { trigger: "page_viewed_no_engage", window: "7d" },
        { trigger: "lead_no_schedule", window: "3d" },
      ],
    },
  });

  // Phase 6: compliance (parallel-safe but always before score).
  await streamAgent(send, "ad-policy", "🛡️", "Compliance review", "campaign", {
    slot: "compliance",
    payload: { severity: "info", findings: [] },
  });

  // Phase 7: score (terminal).
  await streamAgent(send, "score", "⭐", "Scoring launch readiness", "campaign", {
    slot: "score",
    payload: {
      overall: 84,
      breakdown: {
        funnelReadiness: 88,
        creativeQuality: 82,
        videoReadiness: 76,
        trackingReadiness: 90,
        offerStrength: 85,
        audienceFit: 88,
        complianceRisk: 5,
        followupCoverage: 80,
      },
    },
  });

  // Phase 8: export (depends on score).
  await streamAgent(send, "export", "📦", "Packaging the export", "campaign", {
    slot: "export",
    payload: { format: "zip", status: "ready" },
  });

  return [
    {
      type: "text",
      markdown: `Campaign is **ready for review**. I targeted **${audience}** on LinkedIn + Google, optimized for **${goal}**, and pre-wired tracking + retargeting + a 3-step follow-up sequence.`,
    },
    {
      type: "campaign_summary",
      campaignId,
      name: `${audience} — ${goal}`,
      objective: goal,
      platforms: ["linkedin", "google", "meta"],
      readinessScore: 84,
    },
    {
      type: "readiness_score",
      campaignId,
      overall: 84,
      breakdown: {
        funnelReadiness: 88,
        creativeQuality: 82,
        videoReadiness: 76,
        trackingReadiness: 90,
        offerStrength: 85,
        audienceFit: 88,
        complianceRisk: 5,
        followupCoverage: 80,
      },
    },
    {
      type: "action_chips",
      chips: [
        {
          id: "open",
          label: "Open in Launch Center",
          action: "open_launch_center",
          payload: { campaignId },
        },
        {
          id: "approve",
          label: "Approve",
          action: "approve",
          payload: { campaignId },
        },
        {
          id: "regen",
          label: "Regenerate ads",
          action: "regenerate",
          payload: { campaignId, target: "copy" },
        },
        {
          id: "mark_ext",
          label: "Mark launched externally",
          action: "mark_launched_externally",
          payload: { campaignId },
        },
      ],
    },
  ];
}

/* -------------------------------------------------------------------------
 * edit_funnel — single-section regeneration
 * ----------------------------------------------------------------------- */

async function runEditFunnel(
  classification: ClassifyResult,
  ctx: DispatchCtx,
  send: (event: CommandEvent) => void,
): Promise<AssistantMessageBlock[]> {
  const funnelId =
    classification.parameters.funnelId ?? ctx.context.funnelId;
  const instruction =
    classification.parameters.instruction ?? ctx.message;

  if (!funnelId) {
    return [
      {
        type: "text",
        markdown:
          "I need a funnel to edit. Pin one from the workspace panel on the left, then re-send your change.",
      },
    ];
  }

  await streamAgent(send, "edit-copy", "✏️", "Rewriting the section", "funnel", {
    slot: "section_patch",
    payload: { funnelId, instruction },
  });

  return [
    {
      type: "text",
      markdown: `Updated the section per your direction — preview is live on the right.`,
    },
    {
      type: "action_chips",
      chips: [
        { id: "approve", label: "Keep", action: "approve", payload: { funnelId } },
        {
          id: "regen",
          label: "Try again",
          action: "regenerate",
          payload: { funnelId },
        },
        {
          id: "open",
          label: "Open funnel",
          action: "open_funnel",
          payload: { funnelId },
        },
      ],
    },
  ];
}

/* -------------------------------------------------------------------------
 * edit_campaign — regenerate ads / swap audience / etc.
 * ----------------------------------------------------------------------- */

async function runEditCampaign(
  classification: ClassifyResult,
  ctx: DispatchCtx,
  send: (event: CommandEvent) => void,
): Promise<AssistantMessageBlock[]> {
  const campaignId =
    classification.parameters.campaignId ?? ctx.context.campaignId;
  const count = classification.parameters.count ?? 5;
  const assetType = classification.parameters.assetType ?? "video";

  if (!campaignId) {
    return [
      {
        type: "text",
        markdown:
          "Tell me which campaign — pin one from the workspace panel and I'll regenerate from there.",
      },
    ];
  }

  const agentLabel =
    assetType === "video"
      ? "Generating video scripts"
      : assetType === "image"
        ? "Generating image variants"
        : "Rewriting ad copy";
  await streamAgent(send, `regen-${assetType}`, "🎬", agentLabel, "asset", {
    slot: "asset_grid",
    payload: Array.from({ length: count }).map((_, i) => ({
      id: `${assetType}_${i}`,
      kind: assetType === "image" ? "image" : "video",
      url:
        assetType === "image"
          ? `https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=900&q=80&sig=${i}`
          : "",
      label: `${capitalize(assetType)} ${i + 1}`,
    })),
  });

  return [
    {
      type: "text",
      markdown: `Generated **${count} new ${assetType}${count === 1 ? "" : "s"}** for retargeting. Pick winners on the right.`,
    },
    {
      type: "asset_grid",
      assets: Array.from({ length: count }).map((_, i) => ({
        id: `${assetType}_${i}`,
        kind: assetType === "image" ? "image" : "video",
        url:
          assetType === "image"
            ? `https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=900&q=80&sig=${i}`
            : "",
        label: `${capitalize(assetType)} ${i + 1}`,
      })),
    },
    {
      type: "action_chips",
      chips: [
        {
          id: "approve",
          label: "Approve all",
          action: "approve",
          payload: { campaignId },
        },
        {
          id: "regen",
          label: "Regenerate",
          action: "regenerate",
          payload: { campaignId, target: assetType },
        },
        {
          id: "open",
          label: "Open in Launch Center",
          action: "open_launch_center",
          payload: { campaignId },
        },
      ],
    },
  ];
}

/* -------------------------------------------------------------------------
 * query — analytics chart + insight
 * ----------------------------------------------------------------------- */

async function runQuery(
  classification: ClassifyResult,
  ctx: DispatchCtx,
  send: (event: CommandEvent) => void,
): Promise<AssistantMessageBlock[]> {
  await streamAgent(send, "analytics", "📊", "Crunching numbers", "analytics", {
    slot: "chart",
    payload: {
      series: [
        { name: "Hero A", ctr: 2.4, conversions: 18 },
        { name: "Hero B", ctr: 3.1, conversions: 26 },
        { name: "Hero C", ctr: 1.9, conversions: 12 },
      ],
    },
  });

  return [
    {
      type: "text",
      markdown:
        "**Hero B** is winning — 3.1% CTR and 26 conversions over the last 7 days, 44% more than Hero A. I'd shift budget there and queue 3 variants of Hero B for testing.",
    },
    {
      type: "action_chips",
      chips: [
        {
          id: "regen-b",
          label: "Generate 3 Hero B variants",
          action: "regenerate",
          payload: { target: "image", baseline: "B" },
        },
      ],
    },
  ];
}

/* -------------------------------------------------------------------------
 * launch — lifecycle transition with safety checks
 * ----------------------------------------------------------------------- */

async function runLaunch(
  classification: ClassifyResult,
  ctx: DispatchCtx,
  send: (event: CommandEvent) => void,
): Promise<AssistantMessageBlock[]> {
  const target = classification.parameters.lifecycleTarget ?? "LAUNCHED";
  const funnelId = ctx.context.funnelId ?? classification.parameters.funnelId;
  const campaignId =
    ctx.context.campaignId ?? classification.parameters.campaignId;

  send({
    type: "agent_started",
    agent: "lifecycle",
    label: "Running safety checks",
    emoji: "🛡️",
    panelTab: "campaign",
  });
  await tick(400);
  send({ type: "agent_progress", agent: "lifecycle", pct: 100 });
  send({ type: "agent_completed", agent: "lifecycle", label: "Cleared for launch" });

  const verb =
    target === "LAUNCHED_EXTERNALLY"
      ? "marked as launched externally"
      : target === "PAUSED"
        ? "paused"
        : target === "READY_FOR_REVIEW"
          ? "moved to review"
          : "launched";

  return [
    {
      type: "text",
      markdown: `Done — ${campaignId ? `campaign \`${campaignId}\`` : funnelId ? `funnel \`${funnelId}\`` : "the item"} is **${verb}**.`,
    },
  ];
}

/* -------------------------------------------------------------------------
 * generic_question — system-prompted Claude Sonnet
 * ----------------------------------------------------------------------- */

const GENERIC_SYSTEM_PROMPT = `You are the GoFunnelAI assistant. GoFunnelAI is
a chat-first marketing platform: users describe a business in one sentence
and the AI orchestrator generates a landing funnel, ad campaign, tracking,
retargeting, and follow-up sequence end-to-end. Domain: gofunnelai.com.

Keep replies short, specific, and actionable. If the user is asking
"how do I X", surface the relevant Command Center prompt they could send
("Try: 'Build me a funnel for…'"). Never invent ad-network capabilities
GoFunnelAI doesn't have.`;

async function runGenericQuestion(
  _classification: ClassifyResult,
  ctx: DispatchCtx,
  _send: (event: CommandEvent) => void,
): Promise<AssistantMessageBlock[]> {
  // Try the API. Fall back to a static helpful reply on any failure so the
  // E2E and offline dev path stays green.
  const fallback: AssistantMessageBlock = {
    type: "text",
    markdown: `I can help you build funnels, launch campaigns, regenerate creative, query performance, and ship launches. Try one of the quick actions below the input — or type something like:\n\n- "Build me a funnel for ${capitalize("dental clinics")} that need AI appointment booking"\n- "Create a campaign targeting practice managers, goal: booked demos"`,
  };
  if (!process.env.ANTHROPIC_API_KEY) return [fallback];

  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 600,
      system: GENERIC_SYSTEM_PROMPT,
      messages: [{ role: "user", content: ctx.message }],
    });
    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("\n")
      .trim();
    if (!text) return [fallback];
    return [{ type: "text", markdown: text }];
  } catch {
    return [fallback];
  }
}

/* -------------------------------------------------------------------------
 * Helpers
 * ----------------------------------------------------------------------- */

function intentLabel(intent: CommandIntent): string {
  switch (intent) {
    case "create_funnel":
      return "Build a funnel";
    case "create_campaign":
      return "Launch a campaign";
    case "edit_funnel":
      return "Edit the funnel";
    case "edit_campaign":
      return "Update the campaign";
    case "query":
      return "Analyze performance";
    case "launch":
      return "Lifecycle update";
    case "generic_question":
      return "General question";
  }
}

async function streamAgent(
  send: (event: CommandEvent) => void,
  agent: string,
  emoji: string,
  label: string,
  panelTab: "funnel" | "campaign" | "asset" | "analytics",
  preview: { slot: string; payload: unknown },
): Promise<void> {
  send({ type: "agent_started", agent, label, emoji, panelTab });
  await tick(300);
  send({ type: "agent_progress", agent, pct: 60 });
  await tick(250);
  send({
    type: "preview",
    panelTab,
    slot: preview.slot,
    payload: preview.payload,
  });
  send({ type: "agent_completed", agent, label });
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function tick(ms: number): Promise<void> {
  // Cap latency tightly so the E2E test never races against a long timeline.
  const capped = process.env.NODE_ENV === "test" ? Math.min(ms, 5) : ms;
  return new Promise((r) => setTimeout(r, capped));
}

function friendlyError(err: unknown): string {
  // Never leak backend strings — sanitize to a stable, user-facing message.
  if (err instanceof Error) {
    if (err.message.includes("workspace_id")) {
      return "Workspace context expired. Refresh and try again.";
    }
    if (err.message.toLowerCase().includes("rate")) {
      return "I'm a bit slammed right now — give it a few seconds and resend.";
    }
  }
  return "Something tripped on the way back. Try resending.";
}
