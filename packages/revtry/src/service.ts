/**
 * RevTry public service façade.
 *
 * The Hono routes in `apps/api/src/public-api/routes/v1/voice-calls.ts`
 * call into this object. We keep the surface small + serializable so the
 * API layer doesn't need to know about CallStore / R2 / transcripts.
 *
 * Production wiring binds a real store + R2 signer at boot via
 * `configureRevtryService`. Until then we serve from the in-memory store
 * so dev + tests just work.
 */

import { InMemoryCallStore, type CallStore } from "./store.js";
import type { Call } from "./types.js";

export interface VoiceCallRow {
  id: string;
  workspace_id: string;
  lead_id: string | null;
  direction: "inbound" | "outbound";
  status: "queued" | "ringing" | "in-progress" | "completed" | "failed" | "no-answer";
  from_e164: string;
  to_e164: string;
  duration_sec: number | null;
  recording_url: string | null;
  transcript_ready: boolean;
  started_at: string | null;
  ended_at: string | null;
}

export interface TranscriptSegment {
  speaker: "agent" | "lead";
  start_sec: number;
  end_sec: number;
  text: string;
}

export interface TranscriptDoc {
  call_id: string;
  segments: TranscriptSegment[];
}

export interface RecordingSigner {
  signUrl(args: { call_id: string; workspace_id: string; ttl_sec: number }): Promise<{
    url: string;
    expiresAt: string;
  }>;
}

export interface TranscriptStore {
  get(call_id: string): Promise<TranscriptDoc | null>;
}

interface ServiceConfig {
  store: CallStore;
  recordingSigner?: RecordingSigner;
  transcriptStore?: TranscriptStore;
}

let cfg: ServiceConfig = { store: new InMemoryCallStore() };

export function configureRevtryService(next: Partial<ServiceConfig>): void {
  cfg = { ...cfg, ...next };
}

function toApiStatus(state: Call["state"]): VoiceCallRow["status"] {
  switch (state) {
    case "queued":
      return "queued";
    case "ringing":
      return "ringing";
    case "in_progress":
    case "transferring":
      return "in-progress";
    case "completed":
    case "voicemail":
      return "completed";
    case "no_answer":
      return "no-answer";
    case "busy":
    case "failed":
    case "blocked_dnc":
    case "blocked_consent":
    case "blocked_quiet_hours":
      return "failed";
    default:
      return "failed";
  }
}

function toApi(c: Call): VoiceCallRow {
  return {
    id: c.id,
    workspace_id: c.workspace_id,
    lead_id: c.lead_id,
    direction: c.direction,
    status: toApiStatus(c.state),
    from_e164: c.from_e164,
    to_e164: c.to_e164,
    duration_sec: c.duration_sec || null,
    recording_url: c.recording_url,
    transcript_ready: c.transcript_url !== null,
    started_at: c.started_at,
    ended_at: c.ended_at,
  };
}

export const revtryService = {
  async listCalls(args: {
    workspaceId: string;
    lead_id?: string;
    direction?: "inbound" | "outbound";
    cursor?: string;
    limit?: number;
  }): Promise<{ data: VoiceCallRow[]; next_cursor: string | null }> {
    // The store doesn't yet expose `listByWorkspace`; we synthesize via the
    // lead filter when available, else return an empty page (the production
    // store will swap this for a real query path).
    if (args.lead_id) {
      const rows = await cfg.store.listByLead(args.lead_id);
      const filtered = rows
        .filter((r) => r.workspace_id === args.workspaceId)
        .filter((r) => !args.direction || r.direction === args.direction)
        .slice(0, args.limit ?? 50)
        .map(toApi);
      return { data: filtered, next_cursor: null };
    }
    return { data: [], next_cursor: null };
  },

  async getCall(args: { workspaceId: string; id: string }): Promise<VoiceCallRow> {
    const row = await cfg.store.get(args.id);
    if (!row || row.workspace_id !== args.workspaceId) {
      throw new Error(`voice_call_not_found:${args.id}`);
    }
    return toApi(row);
  },

  async getTranscript(args: { workspaceId: string; callId: string }): Promise<TranscriptDoc> {
    const row = await cfg.store.get(args.callId);
    if (!row || row.workspace_id !== args.workspaceId) {
      throw new Error(`voice_call_not_found:${args.callId}`);
    }
    const doc = (await cfg.transcriptStore?.get(args.callId)) ?? null;
    return doc ?? { call_id: args.callId, segments: [] };
  },

  async signRecordingUrl(args: {
    workspaceId: string;
    callId: string;
    ttlSec: number;
  }): Promise<{ url: string; expiresAt: string }> {
    const row = await cfg.store.get(args.callId);
    if (!row || row.workspace_id !== args.workspaceId) {
      throw new Error(`voice_call_not_found:${args.callId}`);
    }
    if (!row.recording_url) {
      throw new Error(`no_recording:${args.callId}`);
    }
    if (cfg.recordingSigner) {
      return cfg.recordingSigner.signUrl({
        call_id: args.callId,
        workspace_id: args.workspaceId,
        ttl_sec: args.ttlSec,
      });
    }
    // Dev fallback: return the raw URL with a synthetic expiry — production
    // MUST register a real signer (R2 presign or equivalent).
    return {
      url: row.recording_url,
      expiresAt: new Date(Date.now() + args.ttlSec * 1000).toISOString(),
    };
  },
};
