import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { router } from 'expo-router';

import { supabase } from '@/lib/supabase';

const CHANNEL_ID = 'case-updates';
let registeredToken: string | null = null;
let registeredUserId: string | null = null;
let handledResponseId: string | null = null;

if (Platform.OS === 'android') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

async function ensureChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Case updates',
    description: 'New cases, defenses, and AI Judge verdicts',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 150, 250],
    sound: 'default',
  });
}

async function storePushToken(userId: string, token: string) {
  const { error } = await supabase.functions.invoke('dispatch-case-notifications', {
    body: { action: 'register', expoPushToken: token },
  });
  if (error) throw error;
  registeredToken = token;
  registeredUserId = userId;
}

export async function registerAndroidPushNotifications(userId: string, requestPermission = true) {
  if (Platform.OS !== 'android') return false;
  await ensureChannel();

  let permissions = await Notifications.getPermissionsAsync();
  if (!permissions.granted && requestPermission) {
    permissions = await Notifications.requestPermissionsAsync();
  }
  if (!permissions.granted) return false;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) throw new Error('The EAS project ID is missing from the app configuration.');

  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  await storePushToken(userId, token);
  return true;
}

export async function unregisterAndroidPushNotifications(userId: string) {
  if (Platform.OS !== 'android' || registeredUserId !== userId || !registeredToken) return;
  const { error } = await supabase.functions.invoke('dispatch-case-notifications', {
    body: { action: 'unregister', expoPushToken: registeredToken },
  });
  if (!error) {
    registeredToken = null;
    registeredUserId = null;
  }
}

export async function dispatchPendingCaseNotifications() {
  if (Platform.OS !== 'android') return;
  try {
    await supabase.functions.invoke('dispatch-case-notifications', { body: { action: 'dispatch' } });
  } catch {
    // The database outbox keeps failed deliveries available for the next app session.
  }
}

export function subscribeToCaseNotificationNavigation() {
  if (Platform.OS !== 'android') return () => {};

  const openCase = (response: Notifications.NotificationResponse) => {
    const caseId = response.notification.request.content.data?.caseId;
    const responseId = response.notification.request.identifier;
    if (typeof caseId !== 'string' || responseId === handledResponseId) return;
    handledResponseId = responseId;
    router.push(`/explore?caseId=${encodeURIComponent(caseId)}`);
    void Notifications.clearLastNotificationResponseAsync();
  };

  const previousResponse = Notifications.getLastNotificationResponse();
  if (previousResponse) openCase(previousResponse);

  const responseSubscription = Notifications.addNotificationResponseReceivedListener(openCase);
  const tokenSubscription = Notifications.addPushTokenListener(() => {
    if (registeredUserId) {
      void registerAndroidPushNotifications(registeredUserId, false).catch(() => {});
    }
  });
  return () => {
    responseSubscription.remove();
    tokenSubscription.remove();
  };
}
