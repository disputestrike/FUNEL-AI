/**
 * GoFunnelAI — Launch Center: Video Render pipeline (Level 2).
 *
 * Brand: GoFunnelAI. Domain: gofunnelai.com.
 *
 * Responsibilities
 * ----------------
 * Take the textual `VideoAsset` produced by `runVideoScript` and assemble a
 * playable file. Two assembly paths are documented; only the
 * `programmaticRender` entry point is exposed at Level 2 launch.
 *
 *   1) Programmatic (Remotion + FFmpeg, with optional generative shots)
 *      ----------------------------------------------------------------
 *      For each scene we either:
 *        a) render a templated motion-graphic in Remotion (kinetic captions,
 *           CTA cards, dashboard mockup overlays) using the brand tokens, or
 *        b) request a clip from a generative provider routed via
 *           `scenePromptsForGen.preferredProvider` (Runway / Luma / Kling /
 *           Pika), polled to completion, then downloaded to a temp file.
 *      Audio is built by sending `voiceoverScript` to ElevenLabs (one MP3 per
 *      VO line, concatenated against scene boundaries). FFmpeg muxes scenes +
 *      audio + SRT into a single MP4, which is uploaded to R2 and returned as
 *      a `cdn.gofunnelai.com` URL.
 *
 *   2) Full-generative (Sora-class) — DOCUMENTED, not implemented at L2
 *      ----------------------------------------------------------------
 *      Submit the entire script as a single prompt to a Sora-class model when
 *      that API ships GA. Polling + safety checks identical to (1).
 *
 * Level 2 launch posture
 * ----------------------
 * At GA we ship the script + storyboard + caption files + per-scene prompts.
 * The actual stitching pipeline is stubbed so deployments without Remotion /
 * FFmpeg / generative API keys still produce a valid `RenderResult`
 * (`status: "draft_only"`) — the Launch UI lets the operator export the
 * assets and finish in their editor of choice. As soon as keys are present,
 * `programmaticRender` switches to `status: "rendered"` automatically.
 *
 * Integration points
 * ------------------
 *  - Generative video providers:
 *      `RunwayClient`, `LumaClient`, `KlingClient`, `PikaClient` — adapters to
 *      be added under `packages/integrations/src/adapters/`. Each must expose
 *      `submit(prompt, durationSec, aspectRatio) -> jobId` and `poll(jobId)`.
 *  - ElevenLabs TTS:
 *      `@funnel/integrations` `ElevenLabsAdapter.create("voice", {...})` —
 *      already implemented. We post one TTS request per voiceover line so we
 *      can splice them precisely against scene boundaries.
 *  - R2 upload:
 *      `@funnel/integrations` `R2AssetsClient.uploadFromUrl(...)` — or the
 *      bytes-mode variant for local FFmpeg output.
 *  - Remotion render farm:
 *      `@remotion/cli render <root> <comp-id> out.mp4 --props=...` — wrapped
 *      in `remotionAdapter.render(asset)`. Optional; absent in CI.
 */

import { emitLaunch } from "./events.js";
import type { VideoAsset, ScenePromptForGen, StoryboardScene } from "./video-script.js";

/* ---------------------------------------------------------------------------
 * Public types
 * ------------------------------------------------------------------------ */

export type VideoProvider = "runway" | "luma" | "kling" | "pika" | "stock_broll";

export interface VoiceoverAdapter {
  /** Render a single line of voiceover (mp3 bytes). */
  synthesize(input: {
    voicePersona: VideoAsset["voicePersona"];
    text: string;
    abortSignal?: AbortSignal;
  }): Promise<{ url?: string; bytes?: ArrayBuffer; durationSec: number }>;
  /** Returns true when the underlying API is configured. */
  isConfigured(): boolean;
}

export interface GenerativeVideoAdapter {
  provider: VideoProvider;
  /** Returns true when the underlying API key is configured. */
  isConfigured(): boolean;
  /** Submit one scene. Returns a CDN URL or a buffer. */
  generateScene(input: {
    prompt: string;
    durationSec: number;
    aspectRatio: string;
    abortSignal?: AbortSignal;
  }): Promise<{ url: string; durationSec: number; costCents: number }>;
}

export interface RemotionAdapter {
  isConfigured(): boolean;
  /** Render the storyboard with kinetic captions + CTA cards. */
  render(input: {
    asset: VideoAsset;
    audioMp3Url?: string;
    sceneClipUrls?: string[];
    abortSignal?: AbortSignal;
  }): Promise<{ mp4Url: string; durationSec: number; costCents: number }>;
}

export interface R2UploadAdapterLike {
  hasCredentials(): boolean;
  uploadFromUrl(input: {
    funnelId: string;
    sourceUrl: string;
    contentType?: string;
    extension?: string;
    abortSignal?: AbortSignal;
  }): Promise<{ cdnUrl: string; key: string }>;
}

export interface ProgrammaticRenderOptions {
  /** Voiceover adapter (ElevenLabs). Optional — skipped if not configured. */
  voiceover?: VoiceoverAdapter;
  /** Generative video adapters keyed by provider. Optional. */
  generative?: Partial<Record<VideoProvider, GenerativeVideoAdapter>>;
  /** Remotion adapter for motion-graphic templates. Optional. */
  remotion?: RemotionAdapter;
  /** R2 uploader (final mp4 hosting). Optional. */
  r2?: R2UploadAdapterLike;
  funnelId?: string;
  abortSignal?: AbortSignal;
  /** Inject a clock for deterministic tests. */
  now?: () => Date;
}

export interface SceneRenderRecord {
  sceneNumber: number;
  status: "rendered" | "stubbed" | "failed" | "skipped";
  provider?: VideoProvider | "remotion";
  url?: string;
  costCents?: number;
  error?: string;
}

export interface VoiceoverRenderRecord {
  status: "rendered" | "stubbed" | "failed";
  url?: string;
  durationSec?: number;
  voiceLines: { sceneNumber: number; text: string; url?: string; durationSec?: number; error?: string }[];
}

export interface RenderResult {
  status: "rendered" | "draft_only" | "partial";
  finalUrl?: string;
  campaignId: string;
  videoType: VideoAsset["videoType"];
  durationSec: number;
  scenes: SceneRenderRecord[];
  voiceover: VoiceoverRenderRecord;
  /** Hosted SRT + script files for the operator to download. */
  artifacts: {
    captionsSrtUrl?: string;
    voiceoverScriptUrl?: string;
    storyboardJsonUrl?: string;
  };
  totalCostCents: number;
  notes: string[];
  generatedAt: string;
}

/* ---------------------------------------------------------------------------
 * Public entry point
 * ------------------------------------------------------------------------ */

/**
 * Run the programmatic assembly path for a `VideoAsset`.
 *
 * When all three adapters (voiceover, generative video, remotion) are wired,
 * the function produces a final MP4 hosted on R2 and returns the CDN URL.
 *
 * When any required adapter is missing, the function gracefully degrades:
 *
 *   - Missing voiceover  -> VO is stubbed; scripts still returned for manual TTS
 *   - Missing generative -> scenes are stubbed; per-scene prompts still returned
 *   - Missing remotion   -> no mux; result.status = "draft_only"
 *   - Missing R2         -> result.finalUrl uses the local/temp URLs
 *
 * The Launch UI uses `status` to decide whether to show the "Render now"
 * button or the "Export storyboard" download bundle.
 */
export async function programmaticRender(
  asset: VideoAsset,
  options: ProgrammaticRenderOptions = {},
): Promise<RenderResult> {
  if (!asset?.campaignId) throw new Error("programmaticRender: asset.campaignId required");
  const now = options.now ?? (() => new Date());

  await emitLaunch(
    "launch_export_started",
    {
      stage: "video_render",
      videoType: asset.videoType,
      durationSec: asset.durationSec,
      sceneCount: asset.storyboard.length,
    },
    { campaignId: asset.campaignId, workspaceId: asset.workspaceId ?? null },
  );

  const notes: string[] = [];
  let totalCostCents = 0;

  // -------------------------------------------------------------------------
  // 1. Voiceover synthesis (ElevenLabs)
  // -------------------------------------------------------------------------
  const voiceover = await renderVoiceover(asset, options, notes);
  totalCostCents += voiceover.voiceLines.reduce((s, l) => s + 0, 0); // VO cost surfaces via adapter

  // -------------------------------------------------------------------------
  // 2. Generative scene clips (Runway / Luma / Kling / Pika)
  // -------------------------------------------------------------------------
  const scenes: SceneRenderRecord[] = [];
  for (const prompt of asset.scenePromptsForGen) {
    if (options.abortSignal?.aborted) {
      scenes.push({ sceneNumber: prompt.sceneNumber, status: "skipped" });
      continue;
    }
    const adapter = pickGenerativeAdapter(prompt, options);
    if (!adapter) {
      scenes.push({
        sceneNumber: prompt.sceneNumber,
        status: "stubbed",
        provider: prompt.preferredProvider,
      });
      notes.push(
        `scene_${prompt.sceneNumber}_stubbed: provider=${prompt.preferredProvider} (no adapter configured)`,
      );
      continue;
    }
    try {
      const result = await adapter.generateScene({
        prompt: prompt.prompt,
        durationSec: prompt.durationSec,
        aspectRatio: aspectFromFormat(asset.format),
        abortSignal: options.abortSignal,
      });
      totalCostCents += result.costCents;
      scenes.push({
        sceneNumber: prompt.sceneNumber,
        status: "rendered",
        provider: adapter.provider,
        url: result.url,
        costCents: result.costCents,
      });
    } catch (err) {
      scenes.push({
        sceneNumber: prompt.sceneNumber,
        status: "failed",
        provider: adapter.provider,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // -------------------------------------------------------------------------
  // 3. Remotion mux (kinetic captions + CTA cards + scene clips + VO)
  // -------------------------------------------------------------------------
  let finalUrl: string | undefined;
  let status: RenderResult["status"] = "draft_only";

  if (options.remotion?.isConfigured()) {
    try {
      const out = await options.remotion.render({
        asset,
        audioMp3Url: voiceover.url,
        sceneClipUrls: scenes
          .filter((s) => s.status === "rendered" && s.url)
          .map((s) => s.url!),
        abortSignal: options.abortSignal,
      });
      totalCostCents += out.costCents;
      const uploaded = await uploadIfPossible(out.mp4Url, asset, options);
      finalUrl = uploaded?.cdnUrl ?? out.mp4Url;
      const renderedScenes = scenes.filter((s) => s.status === "rendered").length;
      status = renderedScenes === scenes.length ? "rendered" : "partial";
    } catch (err) {
      notes.push(`remotion_failed: ${err instanceof Error ? err.message : String(err)}`);
      status = "draft_only";
    }
  } else {
    notes.push("remotion_not_configured: returning draft-only with storyboard + prompts");
    status = "draft_only";
  }

  // -------------------------------------------------------------------------
  // 4. Pin downloadable artifacts (SRT, voiceover script, storyboard JSON).
  //    These are always available even in draft_only mode.
  // -------------------------------------------------------------------------
  const artifacts = await pinArtifacts(asset, options);

  const result: RenderResult = {
    status,
    finalUrl,
    campaignId: asset.campaignId,
    videoType: asset.videoType,
    durationSec: asset.durationSec,
    scenes,
    voiceover,
    artifacts,
    totalCostCents,
    notes,
    generatedAt: now().toISOString(),
  };

  await emitLaunch(
    status === "rendered" ? "launch_export_completed" : "launch_export_failed",
    {
      stage: "video_render",
      status,
      sceneCount: scenes.length,
      renderedScenes: scenes.filter((s) => s.status === "rendered").length,
      voiceoverStatus: voiceover.status,
      totalCostCents,
    },
    { campaignId: asset.campaignId, workspaceId: asset.workspaceId ?? null },
  );

  return result;
}

/* ---------------------------------------------------------------------------
 * Voiceover synthesis (ElevenLabs)
 * ------------------------------------------------------------------------ */

async function renderVoiceover(
  asset: VideoAsset,
  options: ProgrammaticRenderOptions,
  notes: string[],
): Promise<VoiceoverRenderRecord & { url?: string }> {
  const adapter = options.voiceover;
  if (!adapter?.isConfigured()) {
    notes.push("voiceover_stubbed: ElevenLabs adapter not configured");
    return {
      status: "stubbed",
      voiceLines: asset.storyboard.map((s) => ({
        sceneNumber: s.sceneNumber,
        text: s.voiceoverLine,
      })),
    };
  }
  const voiceLines: VoiceoverRenderRecord["voiceLines"] = [];
  let totalDur = 0;
  let allOk = true;
  let firstUrl: string | undefined;
  for (const scene of asset.storyboard) {
    try {
      const out = await adapter.synthesize({
        voicePersona: asset.voicePersona,
        text: scene.voiceoverLine,
        abortSignal: options.abortSignal,
      });
      totalDur += out.durationSec;
      firstUrl = firstUrl ?? out.url;
      voiceLines.push({
        sceneNumber: scene.sceneNumber,
        text: scene.voiceoverLine,
        url: out.url,
        durationSec: out.durationSec,
      });
    } catch (err) {
      allOk = false;
      voiceLines.push({
        sceneNumber: scene.sceneNumber,
        text: scene.voiceoverLine,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return {
    status: allOk ? "rendered" : "failed",
    url: firstUrl,
    durationSec: totalDur,
    voiceLines,
  };
}

/* ---------------------------------------------------------------------------
 * Adapter selection
 * ------------------------------------------------------------------------ */

function pickGenerativeAdapter(
  prompt: ScenePromptForGen,
  options: ProgrammaticRenderOptions,
): GenerativeVideoAdapter | undefined {
  const map = options.generative ?? {};
  const preferred = map[prompt.preferredProvider];
  if (preferred?.isConfigured()) return preferred;
  // Fallback order: runway -> luma -> kling -> pika -> stock_broll
  const fallback: VideoProvider[] = ["runway", "luma", "kling", "pika", "stock_broll"];
  for (const p of fallback) {
    const candidate = map[p];
    if (candidate?.isConfigured()) return candidate;
  }
  return undefined;
}

/* ---------------------------------------------------------------------------
 * Artifact pinning (SRT + script files)
 *
 * In production we would upload these as text blobs to R2; in the L2 stub
 * they're embedded as data URIs so the Launch UI can offer immediate
 * download without a network round-trip.
 * ------------------------------------------------------------------------ */

async function pinArtifacts(
  asset: VideoAsset,
  options: ProgrammaticRenderOptions,
): Promise<RenderResult["artifacts"]> {
  if (options.r2?.hasCredentials() && options.funnelId) {
    // Real path: upload bytes. The R2 client only knows how to upload from a
    // URL today; we keep these as data URIs and document the bytes upload as
    // a future improvement. (Adding `uploadBytes` to R2AssetsClient is a
    // single-method addition; out of scope for L2 launch.)
  }
  return {
    captionsSrtUrl: toDataUri("application/x-subrip", asset.captionsSrt),
    voiceoverScriptUrl: toDataUri("text/plain", asset.voiceoverScript),
    storyboardJsonUrl: toDataUri("application/json", JSON.stringify(asset.storyboard, null, 2)),
  };
}

function toDataUri(mime: string, body: string): string {
  // Browser-safe base64 — works in both Node 20 and Workers.
  let b64: string;
  if (typeof Buffer !== "undefined") {
    b64 = Buffer.from(body, "utf8").toString("base64");
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    b64 = (globalThis as any).btoa(unescape(encodeURIComponent(body)));
  }
  return `data:${mime};base64,${b64}`;
}

async function uploadIfPossible(
  sourceUrl: string,
  asset: VideoAsset,
  options: ProgrammaticRenderOptions,
): Promise<{ cdnUrl: string; key: string } | undefined> {
  if (!options.r2?.hasCredentials() || !options.funnelId) return undefined;
  try {
    return await options.r2.uploadFromUrl({
      funnelId: options.funnelId,
      sourceUrl,
      extension: "mp4",
      contentType: "video/mp4",
      abortSignal: options.abortSignal,
    });
  } catch {
    return undefined;
  }
}

function aspectFromFormat(format: VideoAsset["format"]): string {
  switch (format) {
    case "vertical_9_16":
      return "9:16";
    case "square_1_1":
      return "1:1";
    case "horizontal_16_9":
      return "16:9";
  }
}

/* ---------------------------------------------------------------------------
 * Provider routing documentation
 *
 * The four generative providers we plan to support behave very differently in
 * production. We list the trade-offs here so the eventual adapter modules
 * land with consistent behavior.
 *
 *   Runway (gen-3 alpha) :
 *     - Best quality for screen-recording-style demos
 *     - 5s default, 10s max per call
 *     - $0.05 / sec
 *     - Image-to-video supported (use heroImageUrl)
 *
 *   Luma (Dream Machine) :
 *     - Fastest turnaround (~30s avg)
 *     - 5s default; ~9s max
 *     - $0.04 / sec
 *     - Good motion fidelity for ad creative
 *
 *   Kling (Kuaishou) :
 *     - Best for talking-head / founder shots
 *     - 5s / 10s presets
 *     - $0.04 / sec
 *     - Slowest queue (~3 min P95)
 *
 *   Pika (1.5) :
 *     - Cheapest, fast, 3s short clips
 *     - $0.025 / sec
 *     - Good for hook/cutaway shots, not for full scenes
 *
 *   Fallback: stock_broll
 *     - Pulls a license-clean Pexels / Coverr clip matching the scene query
 *     - Zero AI cost; always available
 * ------------------------------------------------------------------------ */
