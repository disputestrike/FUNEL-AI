/**
 * Biometric unlock — Face ID / Touch ID / Android biometric prompt.
 *
 * Only shown when the user is signed in AND has enabled biometrics in
 * settings. If biometrics fail or aren't enrolled, fall back to magic-link
 * (we don't make them remember a password the app never asked for).
 */
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthStore } from "../../lib/auth";
import { analytics } from "../../lib/analytics";

export default function BiometricScreen() {
  const router = useRouter();
  const signOut = useAuthStore((s) => s.signOut);
  const [error, setError] = useState<string | null>(null);
  const [supportsFaceId, setSupportsFaceId] = useState(false);

  useEffect(() => {
    (async () => {
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      setSupportsFaceId(types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION));
      await attempt();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function attempt() {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (!hasHardware || !enrolled) {
      // Skip biometric entirely on this device — they can re-enable later.
      router.replace("/(tabs)");
      return;
    }
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Unlock GoFunnelAI",
      cancelLabel: "Sign in another way",
      disableDeviceFallback: false,
    });
    if (result.success) {
      analytics.track("app.signed_in", { method: "biometric" });
      router.replace("/(tabs)");
    } else {
      setError("That didn't unlock. Try again or sign in with email.");
    }
  }

  async function signInWithEmailInstead() {
    await signOut();
    router.replace("/(auth)/login");
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-900">
      <View className="flex-1 px-6 justify-center items-center">
        <Text className="text-h3 font-semibold text-slate-900 dark:text-slate-50 mb-4 text-center">
          {supportsFaceId ? "Look at your phone." : "Touch the sensor."}
        </Text>
        <Text className="text-body text-slate-600 dark:text-slate-300 text-center mb-12">
          {supportsFaceId
            ? "Face ID will unlock the app."
            : "Use your fingerprint to unlock."}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={attempt}
          className="px-6 py-3 rounded-md bg-signal-500 active:bg-signal-600 min-h-[44px] justify-center"
        >
          <Text className="text-white font-semibold">Try again</Text>
        </Pressable>
        <Pressable onPress={signInWithEmailInstead} className="mt-6 py-3">
          <Text className="text-body-sm text-slate-500">Sign in with email instead</Text>
        </Pressable>
        {error ? (
          <Text accessibilityRole="alert" className="text-body-sm text-error-500 mt-4 text-center">
            {error}
          </Text>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
