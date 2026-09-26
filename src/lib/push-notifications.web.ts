export async function registerAndroidPushNotifications(_userId: string, _requestPermission = true) {
  return false;
}

export async function unregisterAndroidPushNotifications(_userId: string) {}

export async function dispatchPendingCaseNotifications() {}

export function subscribeToCaseNotificationNavigation() {
  return () => {};
}
