/**
 * Root layout — providers, auth gate, and the route stack.
 *
 * Stack:
 *   /(auth)/login          ← magic link
 *   /(auth)/biometric      ← Face ID / Touch ID unlock for returning users
 *   /(tabs)/...            ← main app with bottom tabs
 *
 * The auth gate hydrates the Zustand store from secure storage before the
 * first render, then sends the user to the right segment. We avoid a flicker
 * by keeping the splash screen visible until hydration finishes.
 */
import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { QueryClientProvider } from "@tanstack/react-query";

import "../styles/global.css";

import { ThemeProvider, useTheme } from "../lib/theme";
import { useAuthStore, useIsAuthenticated } from "../lib/auth";
import { queryClient } from "../lib/query";
import { installNotificationHandlers, registerForPushNotificationsAsync, syncPushToken } from "../lib/push-notifications";
import { analytics } from "../lib/analytics";

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <RootInner />
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function RootInner() {
  const { active } = useTheme();
  const hydrate = useAuthStore((s) => s.hydrate);
  const ready = useAuthStore((s) => s.ready);

  useEffect(() => {
    void hydrate().finally(() => {
      void SplashScreen.hideAsync();
    });
  }, [hydrate]);

  useEffect(() => {
    if (!ready) return;
    analytics.track("app.opened");
    const cleanup = installNotificationHandlers();
    // Fire-and-forget push registration. If permission was denied earlier
    // this returns null and we move on quietly — settings has a reactivation
    // CTA.
    void (async () => {
      const token = await registerForPushNotificationsAsync();
      if (token) await syncPushToken(token);
    })();
    return cleanup;
  }, [ready]);

  useAuthRedirect();

  if (!ready) return null;

  return (
    <>
      <StatusBar style={active === "dark" ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  );
}

function useAuthRedirect(): void {
  const segments = useSegments();
  const router = useRouter();
  const isAuthed = useIsAuthenticated();
  const ready = useAuthStore((s) => s.ready);
  const biometricEnabled = useAuthStore((s) => s.biometricEnabled);

  useEffect(() => {
    if (!ready) return;
    const inAuthGroup = segments[0] === "(auth)";
    if (!isAuthed && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (isAuthed && inAuthGroup) {
      // If biometric is enabled, force the unlock screen before tabs.
      if (biometricEnabled && segments[1] !== "biometric") {
        router.replace("/(auth)/biometric");
      } else {
        router.replace("/(tabs)");
      }
    }
  }, [ready, isAuthed, biometricEnabled, segments, router]);
}
