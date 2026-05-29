/**
 * Launch Center — Video Script + Render tests.
 *
 * Three snapshot scenarios as requested:
 *   - solar / 30s / explainer
 *   - dental / 15s / short_form
 *   - saas   / 45s / saas_demo
 *
 * Plus property-style assertions on storyboard timing, SRT correctness, and
 * graceful degradation of the render pipeline when adapters are absent.
 *
 * Image-gen and voiceover calls are mocked — no network.
 */
import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_VIDEO_DURATIONS,
  runVideoScript,
  type VideoBrief,
} from "../src/launch/video-script.js";
import {
  programmaticRender,
  type GenerativeVideoAdapter,
  type VoiceoverAdapter,
} from "../src/launch/video-render.js";
import { resetLaunchEventSink } from "../src/launch/events.js";

function briefFor(industry: string, overrides: Partial<VideoBrief> = {}): VideoBrief {
  return {
    campaignId: `cmp_${industry}`,
    workspaceId: "ws_test",
    funnelId: `fnl_${industry}`,
    industry,
    offer:
      industry === "saas"
        ? "Generate a full funnel + ads in 5 minutes"
        : industry === "dental"
          ? "Book new patient consults on autopilot"
          : "Cut suburban power bills with solar",
    audience:
      industry === "saas"
        ? "solo operators"
        : industry === "dental"
          ? "dental practice owners"
          : "California homeowners",
    hook: {
      headline: industry === "dental" ? "Patients booking themselves" : "We did the math.",
      promise: `You can ship before lunch with ${industry}`,
      proof: `Trusted by hundreds of ${industry} businesses`,
    },
    ctas: ["Start free", "Book a demo"],
    founderName: industry === "saas" ? "Ben" : undefined,
    ...overrides,
  };
}

describe("Launch Video Script — snapshot scenarios", () => {
  it("solar / 30s / explainer — storyboard hits exact duration", async () => {
    resetLaunchEventSink();
    const asset = await runVideoScript(briefFor("solar"), "explainer", {
      durationSec: 30,
      format: "square_1_1",
      now: () => new Date("2026-05-29T00:00:00Z"),
    });
    expect(asset.videoType).toBe("explainer");
    expect(asset.durationSec).toBe(30);
    expect(asset.format).toBe("square_1_1");
    expect(asset.industry).toBe("solar");
    expect(asset.storyboard.length).toBeGreaterThanOrEqual(4);
    expect(asset.storyboard.length).toBeLessThanOrEqual(6);
    const sumDur = asset.storyboard.reduce((s, sc) => s + sc.durationSec, 0);
    expect(sumDur).toBe(30);
    // Every scene line carries a voiceoverLine and captionOverlay
    for (const scene of asset.storyboard) {
      expect(scene.voiceoverLine.length).toBeGreaterThan(0);
      expect(scene.captionOverlay.length).toBeGreaterThan(0);
      expect(scene.durationSec).toBeGreaterThanOrEqual(2);
      expect(scene.durationSec).toBeLessThanOrEqual(8);
    }
    // Voiceover script = one line per scene
    expect(asset.voiceoverScript.split("\n")).toHaveLength(asset.storyboard.length);
    // Industry family is services (solar maps to services)
    expect(asset.meta.industryAnchor).toBe("services");
    // SRT has the right number of cues
    const srtCueCount = asset.captionsSrt
      .split("\n\n")
      .filter((b) => /\d{2}:\d{2}:\d{2},\d{3} --> /.test(b)).length;
    expect(srtCueCount).toBe(asset.storyboard.length);
  });

  it("dental / 15s / short_form — TikTok-shaped vertical", async () => {
    resetLaunchEventSink();
    const asset = await runVideoScript(briefFor("dental"), "short_form", {
      now: () => new Date("2026-05-29T00:00:00Z"),
    });
    expect(asset.videoType).toBe("short_form");
    expect(asset.durationSec).toBe(DEFAULT_VIDEO_DURATIONS.short_form);
    expect(asset.durationSec).toBe(15);
    expect(asset.format).toBe("vertical_9_16");
    expect(asset.storyboard).toHaveLength(4);
    const sumDur = asset.storyboard.reduce((s, sc) => s + sc.durationSec, 0);
    expect(sumDur).toBe(15);
    // dental maps to services family
    expect(asset.meta.industryAnchor).toBe("services");
    // First scene must be the hook
    expect(asset.storyboard[0]!.sceneNumber).toBe(1);
    expect(asset.storyboard[0]!.voiceoverLine).toContain("Patients booking themselves");
    // Last scene must carry the CTA
    expect(asset.storyboard.at(-1)!.voiceoverLine.toLowerCase()).toContain("link in bio");
    // Scene prompts every scene
    expect(asset.scenePromptsForGen).toHaveLength(asset.storyboard.length);
    expect(asset.scenePromptsForGen.every((p) => p.prompt.includes("9:16"))).toBe(true);
  });

  it("saas / 45s / saas_demo — dashboard-aware prompts + maestro voice", async () => {
    resetLaunchEventSink();
    const asset = await runVideoScript(briefFor("saas"), "saas_demo", {
      now: () => new Date("2026-05-29T00:00:00Z"),
    });
    expect(asset.videoType).toBe("saas_demo");
    expect(asset.durationSec).toBe(45);
    expect(asset.format).toBe("horizontal_16_9");
    expect(asset.voicePersona).toBe("maestro");
    expect(asset.meta.industryAnchor).toBe("saas");
    // saas_demo plan: hook + 3 demo_steps + proof + cta = 6 scenes
    expect(asset.storyboard).toHaveLength(6);
    const sumDur = asset.storyboard.reduce((s, sc) => s + sc.durationSec, 0);
    expect(sumDur).toBe(45);
    // Demo steps must reference dashboard / product UI
    const demoSteps = asset.storyboard.filter((s) =>
      /step \d/.test(s.captionOverlay.toLowerCase()),
    );
    expect(demoSteps.length).toBe(3);
    for (const step of demoSteps) {
      expect(step.visualDescription.toLowerCase()).toMatch(
        /dashboard|screen recording|product/,
      );
    }
    // Runway preferred for the multi-second demo scenes
    const runwayPicked = asset.scenePromptsForGen.filter(
      (p) => p.preferredProvider === "runway",
    );
    expect(runwayPicked.length).toBeGreaterThan(0);
  });
});

describe("Launch Video Script — SRT", () => {
  it("first cue starts at 00:00:00,000 and cues are non-overlapping", async () => {
    resetLaunchEventSink();
    const asset = await runVideoScript(briefFor("solar"), "explainer", { durationSec: 30 });
    const blocks = asset.captionsSrt
      .split("\n\n")
      .filter((b) => /\d{2}:\d{2}:\d{2},\d{3} --> /.test(b));
    expect(blocks[0]).toContain("00:00:00,000 -->");
    let prevEnd = 0;
    for (const block of blocks) {
      const m = block.match(
        /(\d{2}):(\d{2}):(\d{2}),(\d{3}) --> (\d{2}):(\d{2}):(\d{2}),(\d{3})/,
      );
      expect(m).toBeTruthy();
      const start = parseTs(m![1]!, m![2]!, m![3]!, m![4]!);
      const end = parseTs(m![5]!, m![6]!, m![7]!, m![8]!);
      expect(start).toBe(prevEnd);
      expect(end).toBeGreaterThan(start);
      prevEnd = end;
    }
  });
});

function parseTs(hh: string, mm: string, ss: string, ms: string): number {
  return Number(hh) * 3600 + Number(mm) * 60 + Number(ss) + Number(ms) / 1000;
}

/* ---------------------------------------------------------------------------
 * Render pipeline — graceful degradation + adapter integration
 * ------------------------------------------------------------------------ */

function mockVoiceover(): VoiceoverAdapter {
  return {
    isConfigured: () => true,
    synthesize: vi.fn(async ({ text }) => ({
      url: `https://cdn.gofunnelai.com/voice/${encodeURIComponent(text.slice(0, 16))}.mp3`,
      durationSec: Math.max(1, Math.round(text.length / 18)),
    })),
  };
}

function mockGenerative(provider: GenerativeVideoAdapter["provider"]): GenerativeVideoAdapter {
  return {
    provider,
    isConfigured: () => true,
    generateScene: vi.fn(async ({ durationSec }) => ({
      url: `https://cdn.gofunnelai.com/${provider}/scene-${Math.random().toString(36).slice(2, 8)}.mp4`,
      durationSec,
      costCents: Math.round(durationSec * 4),
    })),
  };
}

describe("Launch Video Render — graceful degradation", () => {
  it("no adapters → draft_only with hosted artifacts", async () => {
    resetLaunchEventSink();
    const asset = await runVideoScript(briefFor("solar"), "explainer", { durationSec: 30 });
    const result = await programmaticRender(asset);
    expect(result.status).toBe("draft_only");
    expect(result.voiceover.status).toBe("stubbed");
    expect(result.scenes.every((s) => s.status === "stubbed")).toBe(true);
    expect(result.artifacts.captionsSrtUrl).toContain("data:application/x-subrip;base64,");
    expect(result.artifacts.voiceoverScriptUrl).toContain("data:text/plain;base64,");
    expect(result.artifacts.storyboardJsonUrl).toContain("data:application/json;base64,");
    expect(result.notes.some((n) => n.startsWith("scene_1_stubbed"))).toBe(true);
  });

  it("voiceover only → VO rendered, scenes still stubbed", async () => {
    resetLaunchEventSink();
    const asset = await runVideoScript(briefFor("dental"), "short_form");
    const voiceover = mockVoiceover();
    const result = await programmaticRender(asset, { voiceover });
    expect(result.voiceover.status).toBe("rendered");
    expect(result.voiceover.voiceLines.every((l) => l.url)).toBe(true);
    expect(voiceover.synthesize).toHaveBeenCalledTimes(asset.storyboard.length);
    expect(result.status).toBe("draft_only");
  });

  it("generative + voiceover but no remotion → still draft_only", async () => {
    resetLaunchEventSink();
    const asset = await runVideoScript(briefFor("saas"), "saas_demo");
    const voiceover = mockVoiceover();
    const generative = {
      runway: mockGenerative("runway"),
      pika: mockGenerative("pika"),
    };
    const result = await programmaticRender(asset, {
      voiceover,
      generative,
    });
    expect(result.scenes.every((s) => s.status === "rendered")).toBe(true);
    expect(result.status).toBe("draft_only");
    expect(result.totalCostCents).toBeGreaterThan(0);
  });

  it("all adapters → rendered with R2 url", async () => {
    resetLaunchEventSink();
    const asset = await runVideoScript(briefFor("saas"), "saas_demo");
    const voiceover = mockVoiceover();
    const generative = { runway: mockGenerative("runway"), pika: mockGenerative("pika") };
    const remotion = {
      isConfigured: () => true,
      render: vi.fn(async () => ({
        mp4Url: "https://render-farm.example.com/out.mp4",
        durationSec: 45,
        costCents: 12,
      })),
    };
    const r2 = {
      hasCredentials: () => true,
      uploadFromUrl: vi.fn(async () => ({
        cdnUrl: "https://cdn.gofunnelai.com/funnels/fnl_saas/final.mp4",
        key: "funnels/fnl_saas/final.mp4",
      })),
    };
    const result = await programmaticRender(asset, {
      voiceover,
      generative,
      remotion,
      r2,
      funnelId: "fnl_saas",
    });
    expect(result.status).toBe("rendered");
    expect(result.finalUrl).toBe("https://cdn.gofunnelai.com/funnels/fnl_saas/final.mp4");
    expect(remotion.render).toHaveBeenCalledOnce();
    expect(r2.uploadFromUrl).toHaveBeenCalledOnce();
  });

  it("generative provider failure marks scene failed and continues", async () => {
    resetLaunchEventSink();
    const asset = await runVideoScript(briefFor("solar"), "explainer", { durationSec: 30 });
    const flaky: GenerativeVideoAdapter = {
      provider: "runway",
      isConfigured: () => true,
      generateScene: vi.fn(async ({ durationSec }) => {
        if (durationSec > 5) throw new Error("queue_timeout");
        return {
          url: "https://cdn.gofunnelai.com/runway/ok.mp4",
          durationSec,
          costCents: 4,
        };
      }),
    };
    const result = await programmaticRender(asset, {
      voiceover: mockVoiceover(),
      generative: { runway: flaky },
    });
    const failed = result.scenes.filter((s) => s.status === "failed");
    expect(failed.length).toBeGreaterThan(0);
    // Result is still draft_only (no remotion) but failures are recorded
    expect(result.status).toBe("draft_only");
  });
});
