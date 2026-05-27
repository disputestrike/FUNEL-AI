/**
 * Hydrate the widget snapshot on every app foreground.
 *
 * iOS: writes to the App Group UserDefaults via a small native module
 *      (configured at prebuild time — see widgets/ios/).
 * Android: writes to SharedPreferences ('funnel_widget_snapshot').
 *
 * The native module isn't included in this skeleton — we expose a JS
 * fallback that simply caches to MMKV so the app continues to work; the
 * native bridge can be wired in once `expo prebuild` has run and the
 * widget extension is set up.
 */
import { Platform, NativeModules, AppState } from "react-native";
import { apiFetch } from "./api";
import { storage } from "./storage";

export type WidgetSnapshot = {
  leadCountToday: number;
  leadCountYesterday: number;
  activeFunnels: number;
  conversionsBy15m: number[];
  lastLeadName?: string;
  lastLeadCapturedAt?: string;
  refreshedAt: string;
};

const SNAPSHOT_KEY = "widget.snapshot";

/** Fetch fresh data and persist to the platform widget container. */
export async function refreshWidgetSnapshot(): Promise<WidgetSnapshot | null> {
  try {
    const snapshot = await apiFetch<WidgetSnapshot>("/v1/widgets/snapshot");
    persist(snapshot);
    return snapshot;
  } catch {
    // Best-effort — widget will keep showing the last good snapshot.
    return null;
  }
}

function persist(snapshot: WidgetSnapshot): void {
  storage.set(SNAPSHOT_KEY, JSON.stringify(snapshot));
  const bridge =
    Platform.OS === "ios"
      ? (NativeModules as Record<string, { writeSnapshot?: (json: string) => void }>)
          .FunnelWidgetBridge
      : (NativeModules as Record<string, { writeSnapshot?: (json: string) => void }>)
          .FunnelWidgetBridge;
  bridge?.writeSnapshot?.(JSON.stringify(snapshot));
}

/** Install AppState listener that refreshes the snapshot on foreground. */
export function installWidgetRefresher(): () => void {
  const sub = AppState.addEventListener("change", (state) => {
    if (state === "active") void refreshWidgetSnapshot();
  });
  return () => sub.remove();
}
