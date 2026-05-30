/**
 * MMKV wrapper for fast (synchronous) offline caching.
 *
 * Use MMKV for:
 *  - User preferences (theme override, biometric on/off)
 *  - Cached lead list snapshots (when the app reopens, show last known data
 *    immediately, then refresh).
 *  - Workspace ID, current funnel ID, draft note text.
 *
 * Do NOT use MMKV for:
 *  - Auth tokens (use expo-secure-store — keychain on iOS, EncryptedSharedPreferences on Android).
 *  - Anything sensitive that needs to be wiped on logout but survive a crash.
 */
import { MMKV } from "react-native-mmkv";

export const storage = new MMKV({ id: "funnel.mobile" });

/** Type-safe getter helpers. */
export const cache = {
  getJSON<T>(key: string): T | null {
    const raw = storage.getString(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },
  setJSON<T>(key: string, value: T): void {
    storage.set(key, JSON.stringify(value));
  },
  remove(key: string): void {
    storage.delete(key);
  },
  /** Wipe everything except auth-tracked keys. Useful on workspace switch. */
  resetExcept(keys: string[]): void {
    const keep = new Set(keys);
    for (const k of storage.getAllKeys()) {
      if (!keep.has(k)) storage.delete(k);
    }
  },
};
