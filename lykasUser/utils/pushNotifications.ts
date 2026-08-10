import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { api } from "./api";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Completes the push-notification loop that was previously just a
 * declared dependency with no permission flow, no token registration,
 * and no send path (§6.6). Called once on first authenticated launch:
 * requests permission, registers for an Expo push token, and PUTs it
 * onto the user's record so the backend's notify() helper can reach
 * this device.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!Device.isDevice) {
    // Push tokens aren't meaningful on a simulator/emulator.
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    return null;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#1E6B45",
    });
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  const tokenResponse = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
  const pushToken = tokenResponse.data;

  try {
    await api.put("/api/auth/profile", { pushToken });
  } catch {
    // Registration failing shouldn't block app usage — the user just
    // won't receive push notifications until the next successful sync.
  }

  return pushToken;
}

/** Call when the user toggles notifications off in Settings — clears the token server-side. */
export async function unregisterPushNotifications(): Promise<void> {
  try {
    await api.put("/api/auth/profile", { pushToken: null, notificationsEnabled: false });
  } catch {
    // Best-effort.
  }
}
