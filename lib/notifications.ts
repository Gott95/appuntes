import * as Notifications from 'expo-notifications';
import { Linking, Platform } from 'react-native';

export async function requestNotificationPermission(): Promise<boolean> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();

  if (existingStatus === 'granted') {
    return true;
  }

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function openNotificationSettings(): Promise<void> {
  if (Platform.OS === 'android') {
    await Linking.openSettings();
  } else {
    await Linking.openURL('app-settings:');
  }
}

export async function sendBudgetAlert(_weekNumber: number, _spent: number, _budget: number): Promise<void> {
  const hasPermission = await requestNotificationPermission();
  if (!hasPermission) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: '⚠️ Presupuesto excedido',
      body: `Semana ${_weekNumber}: gastaste $${_spent.toLocaleString()} de $${_budget.toLocaleString()}`,
    },
    trigger: null,
  });
}
