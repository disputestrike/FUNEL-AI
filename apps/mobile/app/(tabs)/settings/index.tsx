/**
 * Settings â€” profile, notification prefs, biometric, MFA, sign out.
 *
 * Notification prefs let the user mute by `PushKind`:
 *   - lead.new       â€” default ON
 *   - milestone.hit  â€” default ON
 *   - ab.winner      â€” default ON, often muted by power users
 *   - payment.failed â€” ALWAYS ON, not togglable (per doc 22 Â§B billing tone)
 */
import { useState } from "react";
import { Alert, Pressable, ScrollView, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as LocalAuthentication from "expo-local-authentication";
import { Feather } from "@expo/vector-icons";
import { useAuthStore } from "../../../lib/auth";
import { useTheme, type ThemePreference } from "../../../lib/theme";
import { storage } from "../../../lib/storage";
import { analytics } from "../../../lib/analytics";

export default function SettingsScreen() {
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const biometricEnabled = useAuthStore((s) => s.biometricEnabled);
  const setBiometricEnabled = useAuthStore((s) => s.setBiometricEnabled);
  const { preference, setPreference } = useTheme();

  const [leadPush, setLeadPush] = useState(storage.getBoolean("push.lead.new") ?? true);
  const [milestonePush, setMilestonePush] = useState(storage.getBoolean("push.milestone.hit") ?? true);
  const [abPush, setAbPush] = useState(storage.getBoolean("push.ab.winner") ?? true);

  function persistPush(key: string, value: boolean, setter: (v: boolean) => void) {
    storage.set(key, value);
    setter(value);
  }

  async function toggleBiometric(next: boolean) {
    if (next) {
      const hardware = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hardware || !enrolled) {
        Alert.alert(
          "Biometrics aren't set up",
          "Set up Face ID or fingerprint in your phone's settings, then come back.",
        );
        return;
      }
    }
    setBiometricEnabled(next);
  }

  function confirmSignOut() {
    Alert.alert("Sign out of GoFunnelAI?", "We'll keep your data safe. You can sign back in anytime.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          analytics.track("app.signed_out");
          analytics.reset();
          await signOut();
        },
      },
    ]);
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-900" edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <Text
          accessibilityRole="header"
          className="text-h3 font-semibold text-slate-900 dark:text-slate-50 mb-1"
        >
          Settings
        </Text>

        {/* Profile */}
        <View className="mt-6 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 flex-row items-center">
          <View className="w-12 h-12 rounded-full bg-signal-50 dark:bg-signal-900 items-center justify-center">
            <Text className="text-h5 font-semibold text-signal-700 dark:text-signal-200">
              {(user?.name ?? user?.email ?? "?").slice(0, 1).toUpperCase()}
            </Text>
          </View>
          <View className="flex-1 ml-3">
            <Text className="text-body font-semibold text-slate-900 dark:text-slate-50">
              {user?.name ?? "â€”"}
            </Text>
            <Text className="text-body-sm text-slate-500">{user?.email ?? "â€”"}</Text>
            {user?.plan ? (
              <Text className="text-caption text-signal-600 dark:text-signal-300 mt-1">
                {user.plan} plan
              </Text>
            ) : null}
          </View>
        </View>

        {/* Theme */}
        <Section title="Appearance">
          <View className="flex-row gap-2">
            {(["system", "light", "dark"] as const).map((p) => (
              <Pressable
                key={p}
                onPress={() => setPreference(p as ThemePreference)}
                accessibilityRole="button"
                accessibilityState={{ selected: preference === p }}
                className={`flex-1 px-3 py-2 rounded-md border ${
                  preference === p
                    ? "bg-signal-50 border-signal-200 dark:bg-signal-900 dark:border-signal-700"
                    : "bg-white border-slate-200 dark:bg-slate-800 dark:border-slate-700"
                }`}
              >
                <Text
                  className={`text-body-sm text-center ${
                    preference === p
                      ? "text-signal-700 dark:text-signal-100 font-semibold"
                      : "text-slate-700 dark:text-slate-300"
                  }`}
                >
                  {p[0].toUpperCase() + p.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>
        </Section>

        {/* Notifications */}
        <Section title="Notifications">
          <Toggle
            label="New leads"
            hint="Push, sound, and haptic."
            value={leadPush}
            onChange={(v) => persistPush("push.lead.new", v, setLeadPush)}
          />
          <Toggle
            label="Milestones"
            hint="First lead, $1k MRR, etc."
            value={milestonePush}
            onChange={(v) => persistPush("push.milestone.hit", v, setMilestonePush)}
          />
          <Toggle
            label="A/B winners"
            hint="When an experiment closes."
            value={abPush}
            onChange={(v) => persistPush("push.ab.winner", v, setAbPush)}
          />
          <View className="mt-3">
            <Text className="text-caption text-slate-500">
              Billing alerts can't be muted. We only send them when we need a thing from you.
            </Text>
          </View>
        </Section>

        {/* Security */}
        <Section title="Security">
          <Toggle
            label="Unlock with Face ID / fingerprint"
            hint="Required each time the app opens."
            value={biometricEnabled}
            onChange={toggleBiometric}
          />
          <Row
            icon="shield"
            label="Two-factor authentication"
            hint="Manage on the web app."
          />
        </Section>

        <Pressable
          onPress={confirmSignOut}
          accessibilityRole="button"
          className="mt-8 py-3 items-center"
        >
          <Text className="text-body font-semibold text-error-500">Sign out</Text>
        </Pressable>

        <Text className="text-caption text-slate-400 text-center mt-6">
          GoFunnelAI mobile Â· v0.1.0
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mt-8">
      <Text className="text-h6 font-semibold text-slate-900 dark:text-slate-50 mb-3">{title}</Text>
      <View className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
        {children}
      </View>
    </View>
  );
}

function Toggle({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View className="flex-row items-center py-2">
      <View className="flex-1 pr-3">
        <Text className="text-body text-slate-900 dark:text-slate-50">{label}</Text>
        {hint ? <Text className="text-caption text-slate-500 mt-0.5">{hint}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: "#D4D1CB", true: "#5B4FFF" }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

function Row({
  icon,
  label,
  hint,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  hint?: string;
}) {
  return (
    <View className="flex-row items-center py-2">
      <Feather name={icon} size={18} color="#75716A" />
      <View className="flex-1 ml-3">
        <Text className="text-body text-slate-900 dark:text-slate-50">{label}</Text>
        {hint ? <Text className="text-caption text-slate-500 mt-0.5">{hint}</Text> : null}
      </View>
    </View>
  );
}
