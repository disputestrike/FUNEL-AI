/**
 * Voice command handler — hold-to-talk → Whisper transcript → orchestrator.
 *
 * Wiring:
 *  1. UI screen (funnel detail) calls `recorder.start()` on press-in.
 *  2. On press-out, calls `recorder.stop()` which returns the audio file URI.
 *  3. We POST the audio to /v1/voice/transcribe (Whisper-backed) and get back
 *     `{ transcript: string, intent?: VoiceIntent }`.
 *  4. The intent (or transcript fallback) is routed to the generation
 *     orchestrator at /v1/generation/voice — which is the same backend
 *     entry point used by the desktop voice loop (doc 19 §orchestrator).
 *
 * Brand voice: error states follow doc 22 §B "Error messages" — name what
 * failed, give one next action.
 */
import { Audio } from "expo-av";
import * as Haptics from "expo-haptics";
import { apiFetch, sdk } from "./api";
import { analytics } from "./analytics";

export type VoiceSurface = "funnel_detail" | "lead_detail" | "dashboard" | "global";

export type VoiceIntent =
  | { kind: "regenerate_section"; section: string; funnelId: string }
  | { kind: "swap_image"; funnelId: string }
  | { kind: "pause_campaign"; campaignId: string }
  | { kind: "create_funnel"; brief: string }
  | { kind: "send_sms"; leadId: string; template?: string }
  | { kind: "note"; leadId?: string; funnelId?: string; text: string }
  | { kind: "unknown"; text: string };

export type VoiceResult = {
  transcript: string;
  intent: VoiceIntent;
  /** Echoed-back from the orchestrator — what it will do, in plain words. */
  acknowledgment?: string;
};

class VoiceRecorder {
  private recording: Audio.Recording | null = null;
  private startedAt = 0;
  private surface: VoiceSurface = "global";

  async start(surface: VoiceSurface = "global"): Promise<void> {
    if (this.recording) return;
    this.surface = surface;

    const permission = await Audio.requestPermissionsAsync();
    if (!permission.granted) {
      throw new Error("Mic permission denied. Enable it in Settings to use voice commands.");
    }
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    });

    const { recording } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY,
    );
    this.recording = recording;
    this.startedAt = Date.now();
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  async stop(): Promise<{ uri: string; durationMs: number } | null> {
    if (!this.recording) return null;
    const rec = this.recording;
    this.recording = null;
    await rec.stopAndUnloadAsync();
    const uri = rec.getURI();
    if (!uri) return null;
    const durationMs = Date.now() - this.startedAt;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    analytics.track("voice.command.recorded", {
      duration_ms: durationMs,
      surface: this.surface,
    });
    return { uri, durationMs };
  }

  async cancel(): Promise<void> {
    if (!this.recording) return;
    try {
      await this.recording.stopAndUnloadAsync();
    } catch {
      // ignore
    }
    this.recording = null;
  }

  get isRecording(): boolean {
    return this.recording !== null;
  }
}

export const recorder = new VoiceRecorder();

/**
 * Send the recorded audio to the orchestrator and get back the structured
 * intent + acknowledgment.
 */
export async function processVoiceCommand(args: {
  uri: string;
  surface: VoiceSurface;
  /** Optional context — current funnel/lead/etc. — so the orchestrator can
   *  resolve pronouns ("regenerate the hero on THIS funnel"). */
  context?: {
    funnelId?: string;
    leadId?: string;
  };
}): Promise<VoiceResult> {
  const { uri, surface, context } = args;

  // Prefer the SDK if installed; falls back to multipart fetch otherwise.
  if (sdk?.voice?.command) {
    const result = (await sdk.voice.command({
      audioUri: uri,
      surface,
      context,
    })) as VoiceResult;
    analytics.track("voice.command.routed", { intent: result.intent.kind });
    return result;
  }

  const form = new FormData();
  // React Native FormData supports the { uri, name, type } shape for files.
  form.append(
    "audio",
    {
      // @ts-expect-error — RN-only FormData file payload
      uri,
      name: "command.m4a",
      type: "audio/m4a",
    },
  );
  form.append("surface", surface);
  if (context) form.append("context", JSON.stringify(context));

  const result = await apiFetch<VoiceResult>("/v1/voice/command", {
    method: "POST",
    body: form as unknown as BodyInit,
    headers: {}, // let fetch set the multipart boundary
  });
  analytics.track("voice.command.routed", { intent: result.intent.kind });
  return result;
}
