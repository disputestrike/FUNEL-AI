/**
 * Activity tab — combined feed of community moments + system notifications.
 *
 * Community items come from packages/integrations/community (Discourse or
 * the internal community service). System items are workspace-scoped:
 * "Funnel published", "Payment succeeded", "RevTry handled 4 calls today".
 */
import { FlatList, RefreshControl, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { apiFetch } from "../../../lib/api";
import { queryKeys } from "../../../lib/query";
import { formatRelativeTime } from "../../../lib/format";
import { useTheme } from "../../../lib/theme";

type ActivityItem = {
  id: string;
  source: "community" | "system";
  kind: string;
  title: string;
  body?: string;
  occurredAt: string;
  authorName?: string;
};

async function fetchActivity(): Promise<ActivityItem[]> {
  return apiFetch<ActivityItem[]>("/v1/activity");
}

export default function ActivityScreen() {
  const { tokens } = useTheme();
  const { data, refetch, isRefetching } = useQuery({
    queryKey: queryKeys.activity,
    queryFn: fetchActivity,
  });

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-900" edges={["top"]}>
      <View className="px-4 pt-2 pb-4">
        <Text
          accessibilityRole="header"
          className="text-h3 font-semibold text-slate-900 dark:text-slate-50"
        >
          Activity
        </Text>
        <Text className="text-body-sm text-slate-500 mt-1">
          Your workspace and the community.
        </Text>
      </View>

      <FlatList
        data={data ?? []}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => void refetch()}
            tintColor={tokens.brand}
          />
        }
        ItemSeparatorComponent={() => <View className="h-px bg-slate-100 dark:bg-slate-700" />}
        ListEmptyComponent={
          <View className="px-6 py-16">
            <Text className="text-body font-semibold text-slate-900 dark:text-slate-50 mb-2">
              Nothing to review.
            </Text>
            <Text className="text-body-sm text-slate-600 dark:text-slate-300">
              Your queue is clean.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View className="px-4 py-3 flex-row items-start">
            <View
              className={`w-8 h-8 rounded-full items-center justify-center mt-0.5 ${
                item.source === "community" ? "bg-aqua-50 dark:bg-aqua-900" : "bg-signal-50 dark:bg-signal-900"
              }`}
            >
              <Feather
                name={item.source === "community" ? "users" : "bell"}
                size={16}
                color={item.source === "community" ? "#15A8A8" : "#5B4FFF"}
              />
            </View>
            <View className="flex-1 ml-3">
              <Text className="text-body-sm font-semibold text-slate-900 dark:text-slate-50">
                {item.title}
              </Text>
              {item.body ? (
                <Text className="text-body-sm text-slate-600 dark:text-slate-300 mt-1" numberOfLines={3}>
                  {item.body}
                </Text>
              ) : null}
              <Text className="text-caption text-slate-500 mt-1">
                {item.authorName ? `${item.authorName} · ` : ""}
                {formatRelativeTime(item.occurredAt)}
              </Text>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}
