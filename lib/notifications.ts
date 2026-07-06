import { Linking, Platform } from 'react-native';

async function getNotifications() {
  try {
    const mod = await import('expo-notifications');
    return mod;
  } catch {
    return null;
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  const Notifications = await getNotifications();
  if (!Notifications) return false;

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    if (existingStatus === 'granted') return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

export async function openNotificationSettings(): Promise<void> {
  if (Platform.OS === 'android') {
    await Linking.openSettings();
  } else {
    await Linking.openURL('app-settings:');
  }
}

export async function sendBudgetAlert(_weekNumber: number, _spent: number, _budget: number): Promise<void> {
  const Notifications = await getNotifications();
  if (!Notifications) return;

  try {
    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '⚠️ Presupuesto excedido',
        body: `Semana ${_weekNumber}: gastaste $${_spent.toLocaleString()} de $${_budget.toLocaleString()}`,
      },
      trigger: null,
    });
  } catch {}
}
