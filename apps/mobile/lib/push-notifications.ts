/**
 * Push notifications — Expo push registration + foreground handler + tap router.
 *
 * Four payload "kinds" we expect from the backend (doc 12 PRD):
 *  1. lead.new      — new lead captured. Custom sound (`new-lead.wav`) +
 *                     haptic. Tap → /(tabs)/leads/[id].
 *  2. milestone.hit — e.g. "$1k MRR" or "100 leads". Default sound. Tap → /(tabs)/index.
 *  3. ab.winner     — A/B test winner declared. Configurable (user can mute
 *                     this kind without muting lead alerts). Tap → /(tabs)/funnels/[id].
 *  4. payment.failed — urgent push. Default sound, persistent on Android,
 *                      interruption-level "time-sensitive" on iOS. Tap → /(tabs)/settings.
 *
 * Brand voice: doc 22 §B "Billing emails" applies here too — never use the
 * word "URGENT" in the notification title. State the action.
 */
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";
import { router } from "expo-router";
import { apiFetch } from "./api";
import { analytics } from "./analytics";
import { storage } from "./storage";

export type PushKind = "lead.new" | "milestone.hit" | "ab.winner" | "payment.failed";

export type PushPayload = {
  kind: PushKind;
  /** ID of the entity the user is being notified about. */
  entityId: string;
  /** Optional workspace ID — needed when user is in multiple. */
  workspaceId?: string;
  /** Pre-rendered title and body from the server (voice-checked). */
  title: string;
  body: string;
};

// Foreground display behavior — show banner + play sound, but the OS still
// runs our `handleNotification` to allow per-kind tweaks.
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data as Partial<PushPayload>;
    const isLead = data.kind === "lead.new";
    return {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: isLead, // only increment badge for new leads
    };
  },
});

/** Register the device for push, returning the Expo push token (or null). */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!Device.isDevice) {
    // Push doesn't work in simulators — bail quietly in dev.
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
        // Time-sensitive interruption level for payment.failed (iOS 15+).
        allowCriticalAlerts: false,
        provideAppNotificationSettings: true,
      },
    });
    finalStatus = status;
  }
  if (finalStatus !== "granted") {
    storage.set("push.permission", finalStatus);
    return null;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("leads", {
      name: "New leads",
      importance: Notifications.AndroidImportance.HIGH,
      sound: "new-lead.wav",
      vibrationPattern: [0, 250, 100, 250],
      lightColor: "#5B4FFF",
    });
    await Notifications.setNotificationChannelAsync("billing", {
      name: "Billing",
      importance: Notifications.AndroidImportance.MAX,
    });
    await Notifications.setNotificationChannelAsync("milestones", {
      name: "Milestones",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
    await Notifications.setNotificationChannelAsync("experiments", {
      name: "Experiments and A/B",
      importance: Notifications.AndroidImportance.LOW,
    });
  }

  const tokenResponse = await Notifications.getExpoPushTokenAsync();
  const token = tokenResponse.data;
  storage.set("push.token", token);
  return token;
}

/** Send the device token to our API so the server can target it. */
export async function syncPushToken(token: string): Promise<void> {
  try {
    await apiFetch("/v1/devices/push", {
      method: "POST",
      body: JSON.stringify({
        token,
        platform: Platform.OS,
      }),
    });
  } catch (err) {
    // Non-fatal — we'll retry on next app open.
    if (__DEV__) console.warn("[push] token sync failed", err);
  }
}

/**
 * Install foreground + tap listeners. Returns a cleanup function.
 *
 * Tap routing rules:
 *  - lead.new      → /(tabs)/leads/[id]
 *  - milestone.hit → /(tabs)
 *  - ab.winner     → /(tabs)/funnels/[id]
 *  - payment.failed → /(tabs)/settings
 */
export function installNotificationHandlers(): () => void {
  const receivedSub = Notifications.addNotificationReceivedListener((n) => {
    const data = n.request.content.data as Partial<PushPayload>;
    analytics.track("push.received", { kind: data.kind ?? "unknown" });
    if (data.kind === "lead.new") {
      // Light haptic on top of OS notification — feels like a fresh lead.
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (data.kind === "payment.failed") {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  });

  const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as Partial<PushPayload>;
    analytics.track("push.opened", { kind: data.kind ?? "unknown" });
    routePushTap(data);
  });

  return () => {
    receivedSub.remove();
    responseSub.remove();
  };
}

function routePushTap(data: Partial<PushPayload>): void {
  if (!data.kind || !data.entityId) {
    router.push("/(tabs)");
    return;
  }
  switch (data.kind) {
    case "lead.new":
      router.push(`/(tabs)/leads/${data.entityId}`);
      break;
    case "milestone.hit":
      router.push("/(tabs)");
      break;
    case "ab.winner":
      router.push(`/(tabs)/funnels/${data.entityId}`);
      break;
    case "payment.failed":
      router.push("/(tabs)/settings");
      break;
    default:
      router.push("/(tabs)");
  }
}
