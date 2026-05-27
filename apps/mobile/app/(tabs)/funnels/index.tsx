/**
 * Funnel list — name, status, quality score, last published.
 *
 * Building funnels stays desktop / voice (per the spec). Mobile is for
 * monitoring + quick edits.
 */
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../../../lib/api";
import { queryKeys } from "../../../lib/query";
import { formatRelativeTime } from "../../../lib/format";
import { useTheme } from "../../../lib/theme";

type FunnelSummary = {
  id: string;
  name: string;
  status: "draft" | "live" | "paused" | "archived";
  qualityScore: number; // 0-100
  publishedAt?: string;
  updatedAt: string;
  industry?: string;
};

async function fetchFunnels(): Promise<FunnelSummary[]> {
  return apiFetch<FunnelSummary[]>("/v1/funnels");
}

export default function FunnelListScreen() {
  const router = useRouter();
  const { tokens } = useTheme();
  const { data, refetch, isRefetching } = useQuery({
    queryKey: queryKeys.funnels,
    queryFn: fetchFunnels,
  });

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-900" edges={["top"]}>
      <View className="px-4 pt-2 pb-4">
        <Text
          accessibilityRole="header"
          className="text-h3 font-semibold text-slate-900 dark:text-slate-50"
        >
          Funnels
        </Text>
        <Text className="text-body-sm text-slate-500 mt-1">
          Monitor live funnels. Build new ones from your desktop.
        </Text>
      </View>

      <FlatList
        data={data ?? []}
        keyExtractor={(f) => f.id}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => void refetch()}
            tintColor={tokens.brand}
          />
        }
        contentContainerStyle={{ paddingHorizontal: 16 }}
        ItemSeparatorComponent={() => <View className="h-2" />}
        ListEmptyComponent={
          <View className="py-16">
            <Text className="text-body font-semibold text-slate-900 dark:text-slate-50 mb-2">
              No funnels yet.
            </Text>
            <Text className="text-body-sm text-slate-600 dark:text-slate-300">
              Build your first one from the desktop app — it's quicker on a bigger screen.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/(tabs)/funnels/${item.id}`)}
            accessibilityRole="button"
            accessibilityLabel={`${item.name}, ${item.status}, quality ${item.qualityScore} out of 100`}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 active:bg-slate-50 dark:active:bg-slate-700"
          >
            <View className="flex-row items-center justify-between">
              <Text className="text-body-lg font-semibold text-slate-900 dark:text-slate-50 flex-1 pr-2">
                {item.name}
              </Text>
              <StatusPill status={item.status} />
            </View>
            <View className="flex-row items-center justify-between mt-2">
              <Text className="text-body-sm text-slate-500">
                {item.publishedAt ? `Live ${formatRelativeTime(item.publishedAt)}` : `Updated ${formatRelativeTime(item.updatedAt)}`}
              </Text>
              <Text className="text-body-sm text-slate-700 dark:text-slate-200" style={{ fontVariant: ["tabular-nums"] }}>
                Quality {item.qualityScore}
              </Text>
            </View>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

function StatusPill({ status }: { status: FunnelSummary["status"] }) {
  const map: Record<FunnelSummary["status"], { label: string; bg: string; fg: string }> = {
    draft: { label: "Draft", bg: "bg-slate-100 dark:bg-slate-700", fg: "text-slate-700 dark:text-slate-200" },
    live: { label: "Live", bg: "bg-success-500", fg: "text-white" },
    paused: { label: "Paused", bg: "bg-warning-500", fg: "text-white" },
    archived: { label: "Archived", bg: "bg-slate-300 dark:bg-slate-600", fg: "text-slate-800 dark:text-slate-100" },
  };
  const s = map[status];
  return (
    <View className={`px-2 py-1 rounded-sm ${s.bg}`}>
      <Text className={`text-caption font-semibold ${s.fg}`}>{s.label}</Text>
    </View>
  );
}
