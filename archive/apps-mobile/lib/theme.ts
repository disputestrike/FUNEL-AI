/**
 * Theme provider — light + dark, matching doc 22 brand tokens.
 *
 * Approach:
 *  - We default to system color scheme.
 *  - User can override in Settings; override persisted to MMKV.
 *  - Theme tokens are exported as plain JS objects so non-NativeWind code
 *    (e.g. native modal styles, status bar) can reference them.
 */
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme as useSystemColorScheme } from "react-native";
import { colorScheme as nwColorScheme } from "nativewind";
import { storage } from "./storage";

export type ThemeName = "light" | "dark";
export type ThemePreference = ThemeName | "system";

export const tokens = {
  light: {
    background: "#FAFAF9", // slate-50
    surface: "#FFFFFF",
    surfaceElevated: "#FFFFFF",
    border: "#E8E6E2", // slate-200
    textPrimary: "#17150F", // slate-900
    textSecondary: "#525048", // slate-600
    textMuted: "#75716A", // slate-500
    brand: "#5B4FFF", // signal-500
    brandPressed: "#4A3FE0", // signal-600
    success: "#10A37F",
    warning: "#E0A030",
    error: "#DC4A4A",
    info: "#3D7CE0",
  },
  dark: {
    background: "#17150F", // slate-900
    surface: "#28261F", // slate-800
    surfaceElevated: "#3D3B35", // slate-700
    border: "#3D3B35", // slate-700
    textPrimary: "#FAFAF9", // slate-50
    textSecondary: "#D4D1CB", // slate-300
    textMuted: "#A8A39A", // slate-400
    brand: "#827AFF", // signal-400 (muted for dark mode per doc 22 §M)
    brandPressed: "#5B4FFF",
    success: "#34D399",
    warning: "#FBBF24",
    error: "#F87171",
    info: "#60A5FA",
  },
} as const;

type ThemeContextValue = {
  preference: ThemePreference;
  active: ThemeName;
  setPreference: (p: ThemePreference) => void;
  tokens: typeof tokens.light;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const PREF_KEY = "theme.preference";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useSystemColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>(
    (storage.getString(PREF_KEY) as ThemePreference | undefined) ?? "system",
  );

  const active: ThemeName = preference === "system" ? (system ?? "light") : preference;

  useEffect(() => {
    nwColorScheme.set(active);
  }, [active]);

  const setPreference = (p: ThemePreference) => {
    storage.set(PREF_KEY, p);
    setPreferenceState(p);
  };

  const value = useMemo<ThemeContextValue>(
    () => ({
      preference,
      active,
      setPreference,
      tokens: tokens[active],
    }),
    [preference, active],
  );

  return React.createElement(ThemeContext.Provider, { value }, children);
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Fall back gracefully — tests / storybook may render without provider.
    return {
      preference: "light",
      active: "light",
      setPreference: () => undefined,
      tokens: tokens.light,
    };
  }
  return ctx;
}
