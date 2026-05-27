/**
 * @funnel/sdk client wrapper for the mobile app.
 *
 * The actual SDK lives in packages/sdk (built by the public-API agent). This
 * wrapper layers in:
 *  - Auth token injection from the Zustand auth store.
 *  - Workspace scoping (header injection).
 *  - Mobile-friendly error mapping (network errors â†’ user-visible strings
 *    that match the voice in doc 22 Â§B "Error messages").
 *  - A thin real-time subscription helper that wraps the SDK's WS client.
 *
 * If @funnel/sdk is not yet linked, we fall back to a minimal fetch client
 * so the app still type-checks and runs against a local API.
 */
import Constants from "expo-constants";

// Lazy require so the build doesn't fail before the public-API agent ships.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let SDK: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  SDK = require("@funnel/sdk");
} catch {
  SDK = null;
}

import { useAuthStore } from "./auth";

const extra = (Constants.expoConfig?.extra ?? {}) as {
  apiBaseUrl?: string;
  wsUrl?: string;
};

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  extra.apiBaseUrl ??
  "https://api.gofunnelai.com";

export const WS_URL =
  process.env.EXPO_PUBLIC_WS_URL ?? extra.wsUrl ?? "wss://api.gofunnelai.com/realtime";

export type ApiError = {
  /** Human-friendly message that follows doc 22 Â§B "Error messages" voice. */
  message: string;
  /** Machine code from the API, when available. */
  code?: string;
  status?: number;
};

function authHeaders(): Record<string, string> {
  const { token, workspaceId } = useAuthStore.getState();
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (token) h.Authorization = `Bearer ${token}`;
  if (workspaceId) h["X-Funnel-Workspace"] = workspaceId;
  return h;
}

/** Build the SDK client at module load if available; otherwise null. */
export const sdk = SDK
  ? new SDK.FunnelClient({
      baseUrl: API_BASE_URL,
      // Token resolver runs on every request â€” so refreshing the auth store
      // is automatically picked up without re-instantiating the client.
      getAuthToken: () => useAuthStore.getState().token ?? null,
      getWorkspaceId: () => useAuthStore.getState().workspaceId ?? null,
      userAgent: "FunnelAI-Mobile/0.1",
    })
  : null;

/** Minimal fetch fallback used when @funnel/sdk isn't installed yet. */
export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const url = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: { ...authHeaders(), ...(init.headers ?? {}) },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw mapApiError(res.status, text);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Map a raw HTTP error to a voice-compliant message (doc 22 Â§B). */
export function mapApiError(status: number, body: string): ApiError {
  // Try parsing structured error first.
  try {
    const parsed = JSON.parse(body) as { code?: string; message?: string };
    if (parsed.message) {
      return { status, code: parsed.code, message: parsed.message };
    }
  } catch {
    // Fall through to status-based mapping.
  }
  if (status === 401)
    return { status, code: "unauthenticated", message: "Signed out. Sign back in to continue." };
  if (status === 403)
    return { status, code: "forbidden", message: "You don't have access to this. Switch workspace?" };
  if (status === 404)
    return { status, code: "not_found", message: "We couldn't find that. It may have moved." };
  if (status === 429)
    return { status, code: "rate_limited", message: "Slow down â€” we'll let you try again in a moment." };
  if (status >= 500)
    return { status, code: "server_error", message: "Our side hiccuped. Pull to refresh in a few seconds." };
  return { status, code: "unknown", message: "Something didn't go through. Try once more." };
}

// ---------------------------------------------------------------------------
// Real-time lead inbox subscription.
// ---------------------------------------------------------------------------

export type LeadEvent =
  | { type: "lead.created"; lead: Lead }
  | { type: "lead.updated"; lead: Lead }
  | { type: "lead.scored"; leadId: string; score: LeadScore };

export type LeadScore = "hot" | "warm" | "cold";

export type Lead = {
  id: string;
  workspaceId: string;
  funnelId: string;
  funnelName?: string;
  name: string;
  email?: string;
  phone?: string;
  source?: string;
  score: LeadScore;
  capturedAt: string; // ISO 8601
  tags?: string[];
  notes?: string;
};

/**
 * Subscribe to the workspace's lead stream. Returns an unsubscribe function.
 *
 * Implementation note: we prefer WebSocket; the SDK auto-reconnects with
 * exponential backoff. Mobile clients should also pause the stream when the
 * app is backgrounded to save battery â€” see `app/(tabs)/leads/index.tsx`.
 */
export function subscribeLeads(
  onEvent: (event: LeadEvent) => void,
  onError?: (err: ApiError) => void,
): () => void {
  if (sdk?.subscribeLeads) {
    return sdk.subscribeLeads(onEvent, onError) as () => void;
  }

  const ws = new WebSocket(`${WS_URL}/leads`);
  ws.onmessage = (msg) => {
    try {
      onEvent(JSON.parse(msg.data) as LeadEvent);
    } catch {
      // ignore malformed frames
    }
  };
  ws.onerror = () => {
    onError?.({ message: "Live feed paused. We'll reconnect.", code: "ws_error" });
  };
  return () => ws.close();
}
