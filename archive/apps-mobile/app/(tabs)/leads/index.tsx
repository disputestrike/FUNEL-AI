/**
 * Lead inbox — real-time list of incoming leads.
 *
 * Behaviour:
 *  - Initial load via React Query.
 *  - Live WebSocket subscription via `subscribeLeads` pushes new rows to the
 *    top of the list with a brief signal-50 flash.
 *  - When the screen blurs (user tabs away), the subscription is paused to
 *    save battery and reopens on focus.
 *  - Per-row: name, funnel name, score chip (hot/warm/cold), captured time.
 *  - Tap row → /(tabs)/leads/[id]
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { apiFetch, subscribeLeads, type Lead, type LeadScore } from "../../../lib/api";
import { queryKeys } from "../../../lib/query";
import { formatRelativeTime, formatLeadScoreLabel } from "../../../lib/format";
import { useTheme } from "../../../lib/theme";

async function fetchLeads(): Promise<Lead[]> {
  return apiFetch<Lead[]>("/v1/leads?limit=100");
}

export default function LeadsInboxScreen() {
  const router = useRouter();
  const { tokens } = useTheme();
  const { data, refetch, isRefetching } = useQuery({
    queryKey: queryKeys.leads("inbox"),
    queryFn: fetchLeads,
  });
  const [liveOverlay, setLiveOverlay] = useState<Lead[]>([]);
  const [filter, setFilter] = useState<"all" | LeadScore>("all");

  // Subscribe to live leads while the screen is focused.
  useFocusEffect(
    useCallback(() => {
      const unsubscribe = subscribeLeads((event) => {
        if (event.type === "lead.created") {
          setLiveOverlay((prev) => [event.lead, ...prev]);
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else if (event.type === "lead.updated") {
          setLiveOverlay((prev) =>
            prev.map((l) => (l.id === event.lead.id ? event.lead : l)),
          );
        }
      });
      return unsubscribe;
    }, []),
  );

  // Reset live overlay when the underlying query refetches.
  useEffect(() => {
    if (data) setLiveOverlay([]);
  }, [data]);

  const combined = useMemo(() => {
    const seen = new Set<string>();
    const all: Lead[] = [];
    for (const l of [...liveOverlay, ...(data ?? [])]) {
      if (seen.has(l.id)) continue;
      seen.add(l.id);
      all.push(l);
    }
    if (filter === "all") return all;
    return all.filter((l) => l.score === filter);
  }, [liveOverlay, data, filter]);

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-900" edges={["top"]}>
      <View className="px-4 pt-2 pb-4">
        <Text
          accessibilityRole="header"
          className="text-h3 font-semibold text-slate-900 dark:text-slate-50"
        >
          Leads
        </Text>
        <Text className="text-body-sm text-slate-500 mt-1">
          {combined.length} {combined.length === 1 ? "lead" : "leads"} in your inbox
        </Text>

        <View className="flex-row mt-4 gap-2">
          {(["all", "hot", "warm", "cold"] as const).map((f) => (
            <Pressable
              key={f}
              onPress={() => setFilter(f)}
              accessibilityRole="button"
              accessibilityState={{ selected: filter === f }}
              className={`px-3 py-1.5 rounded-full border ${
                filter === f
                  ? "bg-signal-50 border-signal-200 dark:bg-signal-900 dark:border-signal-700"
                  : "bg-white border-slate-200 dark:bg-slate-800 dark:border-slate-700"
              }`}
            >
              <Text
                className={`text-body-sm ${
                  filter === f
                    ? "text-signal-700 dark:text-signal-200 font-semibold"
                    : "text-slate-700 dark:text-slate-300"
                }`}
              >
                {f === "all" ? "All" : formatLeadScoreLabel(f)}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <FlatList
        data={combined}
        keyExtractor={(lead) => lead.id}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={tokens.brand} />
        }
        ItemSeparatorComponent={() => (
          <View className="h-px bg-slate-100 dark:bg-slate-700 ml-4" />
        )}
        ListEmptyComponent={
          <View className="px-6 py-16">
            <Text className="text-body text-slate-900 dark:text-slate-50 font-semibold mb-2">
              No leads yet.
            </Text>
            <Text className="text-body-sm text-slate-600 dark:text-slate-300">
              Your funnel is live, but the traffic hasn't found it. Share it on the channel that knows your buyer best.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/(tabs)/leads/${item.id}`)}
            accessibilityRole="button"
            accessibilityLabel={`${item.name}, ${formatLeadScoreLabel(item.score)} lead from ${item.funnelName ?? "unknown funnel"}`}
            className="px-4 py-3 flex-row items-center active:bg-slate-100 dark:active:bg-slate-800"
          >
            <ScoreDot score={item.score} />
            <View className="flex-1 ml-3">
              <View className="flex-row items-baseline">
                <Text className="text-body font-semibold text-slate-900 dark:text-slate-50">
                  {item.name}
                </Text>
                <Text className="text-caption text-slate-500 ml-2">
                  {item.funnelName ?? "Funnel"}
                </Text>
              </View>
              <Text className="text-body-sm text-slate-500 mt-0.5">
                {formatRelativeTime(item.capturedAt)}
                {item.source ? ` · ${item.source}` : ""}
              </Text>
            </View>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

function ScoreDot({ score }: { score: LeadScore }) {
  const color = score === "hot" ? "bg-error-500" : score === "warm" ? "bg-ember-500" : "bg-slate-400";
  return (
    <View
      className={`w-2 h-2 rounded-full ${color}`}
      accessibilityLabel={`${formatLeadScoreLabel(score)} score`}
    />
  );
}
