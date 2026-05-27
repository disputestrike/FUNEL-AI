/**
 * Funnel detail — live preview (WebView), quality score, quick actions,
 * voice command (hold-to-talk).
 *
 * Quick actions are limited to mobile-safe edits:
 *  - Regenerate hero copy
 *  - Swap hero image
 *  - Pause / resume campaign
 *
 * Anything bigger (restructure, multi-page) routes back to desktop.
 */
import { useCallback, useRef, useState } from "react";
import { Alert, Animated, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { apiFetch } from "../../../lib/api";
import { queryKeys } from "../../../lib/query";
import { recorder, processVoiceCommand, type VoiceResult } from "../../../lib/voice-commands";

type FunnelDetail = {
  id: string;
  name: string;
  status: "draft" | "live" | "paused" | "archived";
  liveUrl?: string;
  qualityScore: number;
  qualityFactors: Array<{ name: string; score: number }>;
  primaryCampaignId?: string;
};

async function fetchFunnel(id: string): Promise<FunnelDetail> {
  return apiFetch<FunnelDetail>(`/v1/funnels/${id}`);
}

export default function FunnelDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: funnel } = useQuery({
    queryKey: queryKeys.funnel(id),
    queryFn: () => fetchFunnel(id),
    enabled: !!id,
  });

  const regenerateHero = useMutation({
    mutationFn: () => apiFetch(`/v1/funnels/${id}/actions/regenerate-hero`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.funnel(id) }),
  });
  const swapImage = useMutation({
    mutationFn: () => apiFetch(`/v1/funnels/${id}/actions/swap-image`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.funnel(id) }),
  });
  const togglePause = useMutation({
    mutationFn: () =>
      apiFetch(`/v1/funnels/${id}/actions/${funnel?.status === "paused" ? "resume" : "pause"}-campaign`, {
        method: "POST",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.funnel(id) }),
  });

  // Voice recording state + pulse animation on the mic button.
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState<VoiceResult | null>(null);
  const pulse = useRef(new Animated.Value(1)).current;

  const startVoice = useCallback(async () => {
    try {
      await recorder.start("funnel_detail");
      setRecording(true);
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.15, duration: 600, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
        ]),
      ).start();
    } catch (err) {
      Alert.alert(
        "Mic isn't available",
        err instanceof Error ? err.message : "Check microphone permission in Settings.",
      );
    }
  }, [pulse]);

  const stopVoice = useCallback(async () => {
    if (!recording) return;
    setRecording(false);
    pulse.stopAnimation();
    pulse.setValue(1);
    const result = await recorder.stop();
    if (!result) return;
    try {
      const voice = await processVoiceCommand({
        uri: result.uri,
        surface: "funnel_detail",
        context: { funnelId: id },
      });
      setTranscript(voice);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      // Refresh the funnel after a voice command completes — the orchestrator
      // may have already applied the change.
      queryClient.invalidateQueries({ queryKey: queryKeys.funnel(id) });
    } catch (err) {
      Alert.alert(
        "We didn't catch that",
        err instanceof Error ? err.message : "Try again with a quieter background.",
      );
    }
  }, [recording, id, pulse, queryClient]);

  if (!funnel) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-900" edges={["top"]}>
        <View className="p-4">
          <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button">
            <Feather name="chevron-left" size={24} color="#525048" />
          </Pressable>
          <View className="h-6 w-32 bg-slate-100 dark:bg-slate-800 rounded-sm mt-4" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-900" edges={["top"]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="px-4 pt-2 pb-4 flex-row items-center">
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Back to funnels"
            hitSlop={12}
          >
            <Feather name="chevron-left" size={28} color="#525048" />
          </Pressable>
          <Text className="text-h5 font-semibold text-slate-900 dark:text-slate-50 ml-2">
            Funnel
          </Text>
        </View>

        <View className="px-4">
          <Text className="text-h2 font-semibold text-slate-900 dark:text-slate-50">
            {funnel.name}
          </Text>
          <Text className="text-body-sm text-slate-500 mt-1">
            Quality {funnel.qualityScore} out of 100
          </Text>
        </View>

        {/* Live preview — placeholder card. Swap in <WebView source={{ uri: funnel.liveUrl }} /> when react-native-webview is added. */}
        <View className="mx-4 mt-6 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 aspect-[9/16] max-h-[400px] justify-center items-center">
          {funnel.liveUrl ? (
            <Text className="text-body-sm text-slate-500">
              Preview: {funnel.liveUrl}
            </Text>
          ) : (
            <Text className="text-body-sm text-slate-500">Not published yet.</Text>
          )}
        </View>

        {/* Quick actions */}
        <View className="px-4 mt-6">
          <Text className="text-h6 font-semibold text-slate-900 dark:text-slate-50 mb-3">
            Quick edits
          </Text>
          <View className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
            <QuickAction
              icon="refresh-cw"
              label="Regenerate hero"
              hint="Funnel rewrites the headline and subhead."
              onPress={() => regenerateHero.mutate()}
              loading={regenerateHero.isPending}
            />
            <Separator />
            <QuickAction
              icon="image"
              label="Swap image"
              hint="Picks a new hero shot from the library."
              onPress={() => swapImage.mutate()}
              loading={swapImage.isPending}
            />
            <Separator />
            <QuickAction
              icon={funnel.status === "paused" ? "play" : "pause"}
              label={funnel.status === "paused" ? "Resume campaign" : "Pause campaign"}
              hint={funnel.status === "paused" ? "Bring the ad set back online." : "Stops new spend immediately."}
              onPress={() => togglePause.mutate()}
              loading={togglePause.isPending}
            />
          </View>
        </View>

        {/* Voice command */}
        <View className="px-4 mt-8 items-center">
          <Text className="text-body-sm text-slate-600 dark:text-slate-300 mb-3 text-center">
            Hold to talk. Try: <Text className="italic">"Generate a Black Friday landing page for my course."</Text>
          </Text>
          <Pressable
            onPressIn={startVoice}
            onPressOut={stopVoice}
            accessibilityRole="button"
            accessibilityLabel="Hold to record a voice command"
            accessibilityHint="Releases the button to send the command to Funnel."
          >
            <Animated.View
              style={{ transform: [{ scale: pulse }] }}
              className={`w-20 h-20 rounded-full items-center justify-center ${
                recording ? "bg-error-500" : "bg-signal-500"
              }`}
            >
              <Feather name="mic" size={32} color="#FFFFFF" />
            </Animated.View>
          </Pressable>
          {transcript ? (
            <View className="mt-4 px-4 py-3 rounded-md bg-signal-50 dark:bg-signal-900 max-w-full">
              <Text className="text-body-sm text-signal-800 dark:text-signal-100">
                "{transcript.transcript}"
              </Text>
              {transcript.acknowledgment ? (
                <Text className="text-caption text-signal-700 dark:text-signal-200 mt-1">
                  {transcript.acknowledgment}
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>

        {/* Quality factors */}
        <View className="px-4 mt-8">
          <Text className="text-h6 font-semibold text-slate-900 dark:text-slate-50 mb-3">
            Quality factors
          </Text>
          <View className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
            {funnel.qualityFactors?.length ? (
              funnel.qualityFactors.map((f) => (
                <View key={f.name} className="flex-row justify-between py-1">
                  <Text className="text-body-sm text-slate-700 dark:text-slate-200">{f.name}</Text>
                  <Text
                    className="text-body-sm font-semibold text-slate-900 dark:text-slate-50"
                    style={{ fontVariant: ["tabular-nums"] }}
                  >
                    {f.score}
                  </Text>
                </View>
              ))
            ) : (
              <Text className="text-body-sm text-slate-500">No quality scoring yet.</Text>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function QuickAction({
  icon,
  label,
  hint,
  onPress,
  loading,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  hint: string;
  onPress: () => void;
  loading?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      accessibilityRole="button"
      accessibilityState={{ busy: loading }}
      className="flex-row items-center px-4 py-3 active:bg-slate-50 dark:active:bg-slate-700"
    >
      <View className="w-10 h-10 rounded-full bg-signal-50 dark:bg-signal-900 items-center justify-center">
        <Feather name={icon} size={18} color="#5B4FFF" />
      </View>
      <View className="flex-1 ml-3">
        <Text className="text-body font-semibold text-slate-900 dark:text-slate-50">
          {label}
        </Text>
        <Text className="text-caption text-slate-500">{hint}</Text>
      </View>
      {loading ? (
        <Text className="text-caption text-slate-500">Working...</Text>
      ) : (
        <Feather name="chevron-right" size={18} color="#A8A39A" />
      )}
    </Pressable>
  );
}

function Separator() {
  return <View className="h-px bg-slate-100 dark:bg-slate-700 ml-14" />;
}
