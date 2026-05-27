/**
 * Magic-link login.
 *
 * Voice (doc 22 Â§B "Onboarding screens"): warm, encouraging, fast. No
 * exclamation marks. Acknowledge effort once, then move them along.
 */
import { useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiFetch } from "../../lib/api";
import { useAuthStore } from "../../lib/auth";
import { analytics } from "../../lib/analytics";

type Stage = "enter_email" | "code_sent" | "verifying";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<Stage>("enter_email");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const signIn = useAuthStore((s) => s.signIn);

  async function sendMagicLink() {
    setError(null);
    setLoading(true);
    try {
      await apiFetch("/v1/auth/magic-link", {
        method: "POST",
        body: JSON.stringify({ email: email.trim().toLowerCase(), channel: "mobile" }),
      });
      setStage("code_sent");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn't send the code. Check the email and try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode() {
    setStage("verifying");
    setError(null);
    try {
      const result = await apiFetch<{
        token: string;
        refreshToken?: string;
        user: { id: string; email: string; name?: string; avatarUrl?: string };
        workspaceId: string;
      }>("/v1/auth/magic-link/verify", {
        method: "POST",
        body: JSON.stringify({ email: email.trim().toLowerCase(), code: code.trim() }),
      });
      await signIn({
        token: result.token,
        refreshToken: result.refreshToken,
        user: result.user,
        workspaceId: result.workspaceId,
      });
      analytics.identify(result.user.id);
      analytics.track("app.signed_in", { method: "magic_link" });
      router.replace("/(tabs)");
    } catch (err) {
      const message = err instanceof Error ? err.message : "That code didn't match. Check the email and try again.";
      setError(message);
      setStage("code_sent");
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-900">
      <View className="flex-1 px-6 justify-center">
        <Text
          className="text-h2 font-semibold text-slate-900 dark:text-slate-50 mb-2"
          accessibilityRole="header"
        >
          Welcome back.
        </Text>
        <Text className="text-body text-slate-600 dark:text-slate-300 mb-8">
          {stage === "enter_email"
            ? "Sign in with the email on your GoFunnelAI account."
            : "Check your email â€” we sent a six-digit code."}
        </Text>

        {stage === "enter_email" ? (
          <>
            <Text className="text-body-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
              Email
            </Text>
            <TextInput
              accessibilityLabel="Email address"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              value={email}
              onChangeText={setEmail}
              placeholder="you@company.com"
              placeholderTextColor="#A8A39A"
              className="border border-slate-200 dark:border-slate-700 rounded-md px-3 py-3 text-body text-slate-900 dark:text-slate-50 bg-white dark:bg-slate-800"
            />
            <PrimaryButton
              onPress={sendMagicLink}
              loading={loading}
              disabled={!email.includes("@")}
              label="Send the code"
            />
          </>
        ) : (
          <>
            <Text className="text-body-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
              Six-digit code
            </Text>
            <TextInput
              accessibilityLabel="One-time code from email"
              autoCapitalize="none"
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              value={code}
              onChangeText={setCode}
              placeholder="000000"
              placeholderTextColor="#A8A39A"
              maxLength={6}
              className="border border-slate-200 dark:border-slate-700 rounded-md px-3 py-3 text-body font-mono text-slate-900 dark:text-slate-50 bg-white dark:bg-slate-800 tracking-widest"
            />
            <PrimaryButton
              onPress={verifyCode}
              loading={stage === "verifying"}
              disabled={code.length < 6}
              label="Sign in"
            />
            <Pressable onPress={() => setStage("enter_email")} className="py-3 mt-2">
              <Text className="text-body-sm text-slate-500 text-center">Use a different email</Text>
            </Pressable>
          </>
        )}

        {error ? (
          <Text accessibilityRole="alert" className="text-body-sm text-error-500 mt-4">
            {error}
          </Text>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function PrimaryButton({
  label,
  onPress,
  loading,
  disabled,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
      onPress={onPress}
      disabled={disabled || loading}
      className={`mt-6 rounded-md min-h-[44px] justify-center items-center ${
        disabled || loading ? "bg-signal-300" : "bg-signal-500 active:bg-signal-600"
      }`}
    >
      {loading ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <Text className="text-white text-body font-semibold">{label}</Text>
      )}
    </Pressable>
  );
}
