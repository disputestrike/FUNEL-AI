/**
 * Lead detail — contact info, score breakdown, activity timeline, actions.
 *
 * CRITICAL action: one-tap RevTry call.
 *   - Tapping the call button:
 *     1. Logs `lead.action.call` to analytics.
 *     2. POSTs to /v1/leads/:id/call so the backend can mark a call attempt
 *        on the lead's timeline BEFORE the OS leaves our app.
 *     3. Opens the phone dialer via `tel:` deep link (Linking.openURL).
 *   - We don't dial through RevTry from the phone itself — the desktop /
 *     server handles outbound RevTry. The mobile button is for the operator
 *     to follow up personally, with the attempt logged for attribution.
 */
import { useCallback } from "react";
import { Alert, Linking, Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { apiFetch, type Lead } from "../../../lib/api";
import { queryKeys } from "../../../lib/query";
import { formatRelativeTime, formatLeadScoreLabel, normalizePhoneForTel } from "../../../lib/format";
import { analytics } from "../../../lib/analytics";

type LeadDetail = Lead & {
  scoreBreakdown: Array<{ factor: string; weight: number; note?: string }>;
  timeline: Array<{
    id: string;
    kind: "form_submit" | "page_view" | "ad_click" | "call" | "sms" | "email" | "note";
    summary: string;
    occurredAt: string;
  }>;
};

async function fetchLead(id: string): Promise<LeadDetail> {
  return apiFetch<LeadDetail>(`/v1/leads/${id}`);
}

export default function LeadDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: lead } = useQuery({
    queryKey: queryKeys.lead(id),
    queryFn: () => fetchLead(id),
    enabled: !!id,
  });

  const logCall = useMutation({
    mutationFn: () => apiFetch(`/v1/leads/${id}/call`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.lead(id) });
    },
  });

  const callLead = useCallback(async () => {
    if (!lead?.phone) {
      Alert.alert(
        "No phone on file",
        "This lead didn't give a phone number. Try email or SMS to a different channel.",
      );
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    analytics.track("lead.action.call", { lead_id: id });
    // Log the attempt BEFORE we leave the app (fire-and-forget — don't block dialing).
    logCall.mutate();
    const url = `tel:${normalizePhoneForTel(lead.phone)}`;
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    } else {
      Alert.alert("Can't dial from this device", "Try opening the contact in your phone app instead.");
    }
  }, [lead, id, logCall]);

  const smsLead = useCallback(async () => {
    if (!lead?.phone) return;
    analytics.track("lead.action.sms", { lead_id: id });
    const body = encodeURIComponent(`Hi ${lead.name.split(" ")[0]} — `);
    const url = `sms:${normalizePhoneForTel(lead.phone)}?body=${body}`;
    if (await Linking.canOpenURL(url)) await Linking.openURL(url);
  }, [lead, id]);

  const emailLead = useCallback(async () => {
    if (!lead?.email) return;
    analytics.track("lead.action.email", { lead_id: id });
    const url = `mailto:${lead.email}`;
    if (await Linking.canOpenURL(url)) await Linking.openURL(url);
  }, [lead, id]);

  if (!lead) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-900" edges={["top"]}>
        <View className="p-4">
          <Pressable onPress={() => router.back()} accessibilityRole="button" className="mb-4">
            <Feather name="chevron-left" size={24} color="#525048" />
          </Pressable>
          <View className="h-6 w-32 bg-slate-100 dark:bg-slate-800 rounded-sm" />
          <View className="h-4 w-48 bg-slate-100 dark:bg-slate-800 rounded-sm mt-2" />
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
            accessibilityLabel="Back to leads"
            hitSlop={12}
          >
            <Feather name="chevron-left" size={28} color="#525048" />
          </Pressable>
          <Text className="text-h5 font-semibold text-slate-900 dark:text-slate-50 ml-2">
            Lead
          </Text>
        </View>

        <View className="px-4">
          <Text className="text-h2 font-semibold text-slate-900 dark:text-slate-50">
            {lead.name}
          </Text>
          <Text className="text-body-sm text-slate-500 mt-1">
            {formatLeadScoreLabel(lead.score)} · {lead.funnelName ?? "Funnel"} · {formatRelativeTime(lead.capturedAt)}
          </Text>
        </View>

        {/* Primary action — one-tap RevTry call */}
        <View className="px-4 mt-6">
          <Pressable
            onPress={callLead}
            accessibilityRole="button"
            accessibilityLabel={lead.phone ? `Call ${lead.name} at ${lead.phone}` : "No phone number on file"}
            disabled={!lead.phone}
            className={`rounded-md min-h-[56px] flex-row items-center justify-center ${
              lead.phone ? "bg-signal-500 active:bg-signal-600" : "bg-slate-300 dark:bg-slate-700"
            }`}
          >
            <Feather name="phone" size={20} color="#FFFFFF" />
            <Text className="text-white text-body-lg font-semibold ml-2">
              {lead.phone ? "Call now" : "No phone on file"}
            </Text>
          </Pressable>

          <View className="flex-row gap-2 mt-2">
            <Pressable
              onPress={smsLead}
              disabled={!lead.phone}
              accessibilityRole="button"
              className="flex-1 rounded-md min-h-[44px] border border-slate-300 dark:border-slate-700 flex-row items-center justify-center bg-white dark:bg-slate-800"
            >
              <Feather name="message-square" size={16} color="#3D3B35" />
              <Text className="text-body-sm font-semibold text-slate-900 dark:text-slate-50 ml-2">
                SMS
              </Text>
            </Pressable>
            <Pressable
              onPress={emailLead}
              disabled={!lead.email}
              accessibilityRole="button"
              className="flex-1 rounded-md min-h-[44px] border border-slate-300 dark:border-slate-700 flex-row items-center justify-center bg-white dark:bg-slate-800"
            >
              <Feather name="mail" size={16} color="#3D3B35" />
              <Text className="text-body-sm font-semibold text-slate-900 dark:text-slate-50 ml-2">
                Email
              </Text>
            </Pressable>
          </View>
        </View>

        <Section title="Contact">
          <KeyValue label="Email" value={lead.email ?? "—"} />
          <KeyValue label="Phone" value={lead.phone ?? "—"} />
          <KeyValue label="Source" value={lead.source ?? "Unknown"} />
        </Section>

        <Section title="Score breakdown">
          {lead.scoreBreakdown?.length ? (
            lead.scoreBreakdown.map((factor) => (
              <View key={factor.factor} className="flex-row justify-between py-1">
                <Text className="text-body-sm text-slate-700 dark:text-slate-200">
                  {factor.factor}
                </Text>
                <Text
                  className="text-body-sm font-semibold text-slate-900 dark:text-slate-50"
                  style={{ fontVariant: ["tabular-nums"] }}
                >
                  {factor.weight > 0 ? `+${factor.weight}` : `${factor.weight}`}
                </Text>
              </View>
            ))
          ) : (
            <Text className="text-body-sm text-slate-500">
              We haven't scored this lead yet. Hold on a moment.
            </Text>
          )}
        </Section>

        <Section title="Timeline">
          {lead.timeline?.length ? (
            lead.timeline.map((event) => (
              <View key={event.id} className="flex-row py-2">
                <View className="w-2 h-2 mt-2 rounded-full bg-signal-500" />
                <View className="flex-1 ml-3">
                  <Text className="text-body-sm text-slate-900 dark:text-slate-50">
                    {event.summary}
                  </Text>
                  <Text className="text-caption text-slate-500">
                    {formatRelativeTime(event.occurredAt)}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <Text className="text-body-sm text-slate-500">No activity yet.</Text>
          )}
        </Section>

        {lead.tags?.length ? (
          <Section title="Tags">
            <View className="flex-row flex-wrap gap-2">
              {lead.tags.map((t) => (
                <View
                  key={t}
                  className="px-2 py-1 rounded-sm bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                >
                  <Text className="text-caption text-slate-700 dark:text-slate-200">{t}</Text>
                </View>
              ))}
            </View>
          </Section>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="px-4 mt-8">
      <Text className="text-h6 font-semibold text-slate-900 dark:text-slate-50 mb-3">{title}</Text>
      <View className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
        {children}
      </View>
    </View>
  );
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between py-1">
      <Text className="text-body-sm text-slate-500">{label}</Text>
      <Text className="text-body-sm text-slate-900 dark:text-slate-50">{value}</Text>
    </View>
  );
}
