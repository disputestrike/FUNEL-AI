/**
 * Dashboard — KPI cards, sparkline, recent activity feed, pull-to-refresh.
 *
 * Per doc 22 §B "Dashboard empty states": helpful, action-oriented, slight wit.
 * Never blame the user for the empty state.
 */
import { useCallback } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { apiFetch } from "../../lib/api";
import { queryKeys } from "../../lib/query";
import { formatCurrencyUSD, formatRelativeTime } from "../../lib/format";
import { useTheme } from "../../lib/theme";

type DashboardData = {
  activeFunnels: number;
  leadsThisMonth: number;
  revTryMinutesUsed: number;
  revTryMinutesLimit: number;
  adSpendCents: number;
  conversionsSparkline: number[]; // 24 hourly buckets
  recentActivity: Array<{
    id: string;
    kind: "lead" | "publish" | "ab_winner" | "rev_try_call" | "payment";
    summary: string;
    occurredAt: string;
  }>;
};

async function fetchDashboard(): Promise<DashboardData> {
  return apiFetch<DashboardData>("/v1/dashboard");
}

export default function DashboardScreen() {
  const { data, refetch, isRefetching } = useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: fetchDashboard,
  });
  const { tokens } = useTheme();
  const onRefresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-900" edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={tokens.brand} />
        }
      >
        <Text
          accessibilityRole="header"
          className="text-h3 font-semibold text-slate-900 dark:text-slate-50 mb-1"
        >
          Today
        </Text>
        <Text className="text-body-sm text-slate-500 mb-6">
          {data ? "Your funnels have been busy." : "Pulling fresh numbers."}
        </Text>

        <View className="flex-row flex-wrap -mx-1">
          <KpiCard label="Active funnels" value={data ? `${data.activeFunnels}` : "—"} />
          <KpiCard label="Leads this month" value={data ? data.leadsThisMonth.toLocaleString() : "—"} />
          <KpiCard
            label="RevTry minutes"
            value={data ? `${data.revTryMinutesUsed} / ${data.revTryMinutesLimit}` : "—"}
            hint={data ? `${Math.round((data.revTryMinutesUsed / Math.max(1, data.revTryMinutesLimit)) * 100)}% used` : undefined}
          />
          <KpiCard label="Ad spend" value={data ? formatCurrencyUSD(data.adSpendCents, { compact: true }) : "—"} />
        </View>

        <Sparkline buckets={data?.conversionsSparkline ?? []} />

        <Text className="text-h5 font-semibold text-slate-900 dark:text-slate-50 mt-8 mb-3">
          Recent activity
        </Text>
        {data?.recentActivity?.length ? (
          <View className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
            {data.recentActivity.map((event, idx) => (
              <View
                key={event.id}
                className={`px-4 py-3 flex-row items-start ${
                  idx > 0 ? "border-t border-slate-100 dark:border-slate-700" : ""
                }`}
              >
                <ActivityIcon kind={event.kind} />
                <View className="flex-1 ml-3">
                  <Text className="text-body-sm text-slate-900 dark:text-slate-50">
                    {event.summary}
                  </Text>
                  <Text className="text-caption text-slate-500 mt-1">
                    {formatRelativeTime(event.occurredAt)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <EmptyActivity />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function KpiCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <View className="w-1/2 px-1 mb-2">
      <View className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
        <Text className="text-caption text-slate-500 uppercase">{label}</Text>
        <Text
          className="text-h4 font-semibold text-slate-900 dark:text-slate-50 mt-1"
          style={{ fontVariant: ["tabular-nums"] }}
        >
          {value}
        </Text>
        {hint ? <Text className="text-caption text-slate-500 mt-1">{hint}</Text> : null}
      </View>
    </View>
  );
}

/**
 * Tiny inline sparkline. Pure layout — no SVG required for the skeleton.
 * Replace with react-native-svg path-based rendering when more polish is needed.
 */
function Sparkline({ buckets }: { buckets: number[] }) {
  const max = Math.max(1, ...buckets);
  return (
    <View className="mt-6 p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
      <Text className="text-caption text-slate-500 uppercase mb-3">Conversions (24h)</Text>
      <View className="flex-row items-end h-16">
        {buckets.length === 0
          ? Array.from({ length: 24 }).map((_, i) => (
              <View key={i} className="flex-1 mx-px h-1 bg-slate-200 dark:bg-slate-700 rounded-sm" />
            ))
          : buckets.map((v, i) => (
              <View
                key={i}
                accessibilityLabel={`Hour ${i}: ${v} conversions`}
                className="flex-1 mx-px bg-signal-500 rounded-sm"
                style={{ height: `${Math.max(4, (v / max) * 100)}%` }}
              />
            ))}
      </View>
    </View>
  );
}

function ActivityIcon({ kind }: { kind: DashboardData["recentActivity"][number]["kind"] }) {
  const name: keyof typeof Feather.glyphMap = (() => {
    switch (kind) {
      case "lead":
        return "user-plus";
      case "publish":
        return "send";
      case "ab_winner":
        return "award";
      case "rev_try_call":
        return "phone";
      case "payment":
        return "credit-card";
    }
  })();
  return (
    <View className="w-8 h-8 rounded-full bg-signal-50 dark:bg-signal-900 items-center justify-center mt-0.5">
      <Feather name={name} size={16} color="#5B4FFF" />
    </View>
  );
}

function EmptyActivity() {
  return (
    <View className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
      <Text className="text-body text-slate-900 dark:text-slate-50 font-semibold mb-1">
        Nothing yet today.
      </Text>
      <Text className="text-body-sm text-slate-600 dark:text-slate-300">
        When a lead arrives or a funnel publishes, you'll see it here first.
      </Text>
    </View>
  );
}
