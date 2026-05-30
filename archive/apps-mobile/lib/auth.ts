/**
 * Auth state — Zustand store backed by expo-secure-store for the token and
 * MMKV for everything else.
 *
 * The mobile app does NOT support password login by default — magic-link is
 * the primary path (doc 12 PRD §authentication). Password is a fallback for
 * environments where magic-link can't be delivered (corporate spam filters).
 *
 * Biometric (Face ID / Touch ID) is a SECOND factor that unlocks the locally
 * cached token — not a replacement for the magic link.
 */
import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import { storage } from "./storage";

const TOKEN_KEY = "funnel.auth.token";
const REFRESH_KEY = "funnel.auth.refresh";

export type AuthUser = {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  /** Plan tier per doc 22 §C. */
  plan?: "Starter" | "Growth" | "Scale" | "Enterprise";
};

type AuthState = {
  ready: boolean;
  token: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  workspaceId: string | null;
  biometricEnabled: boolean;

  hydrate: () => Promise<void>;
  signIn: (args: { token: string; refreshToken?: string; user: AuthUser; workspaceId: string }) => Promise<void>;
  signOut: () => Promise<void>;
  setBiometricEnabled: (enabled: boolean) => void;
  switchWorkspace: (workspaceId: string) => void;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  ready: false,
  token: null,
  refreshToken: null,
  user: null,
  workspaceId: null,
  biometricEnabled: false,

  async hydrate() {
    const [token, refreshToken] = await Promise.all([
      SecureStore.getItemAsync(TOKEN_KEY).catch(() => null),
      SecureStore.getItemAsync(REFRESH_KEY).catch(() => null),
    ]);
    const userJson = storage.getString("user");
    const workspaceId = storage.getString("workspaceId");
    const biometricEnabled = storage.getBoolean("biometricEnabled") ?? false;
    set({
      token,
      refreshToken,
      user: userJson ? (JSON.parse(userJson) as AuthUser) : null,
      workspaceId: workspaceId ?? null,
      biometricEnabled,
      ready: true,
    });
  },

  async signIn({ token, refreshToken, user, workspaceId }) {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    if (refreshToken) await SecureStore.setItemAsync(REFRESH_KEY, refreshToken);
    storage.set("user", JSON.stringify(user));
    storage.set("workspaceId", workspaceId);
    set({ token, refreshToken: refreshToken ?? null, user, workspaceId });
  },

  async signOut() {
    await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => undefined);
    await SecureStore.deleteItemAsync(REFRESH_KEY).catch(() => undefined);
    storage.delete("user");
    storage.delete("workspaceId");
    set({ token: null, refreshToken: null, user: null, workspaceId: null });
  },

  setBiometricEnabled(enabled) {
    storage.set("biometricEnabled", enabled);
    set({ biometricEnabled: enabled });
  },

  switchWorkspace(workspaceId) {
    storage.set("workspaceId", workspaceId);
    set({ workspaceId });
  },
}));

/** Convenience hook: returns true if there is a signed-in user. */
export function useIsAuthenticated(): boolean {
  return useAuthStore((s) => Boolean(s.token && s.user));
}
