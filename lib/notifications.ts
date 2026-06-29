export async function requestNotificationPermission(): Promise<boolean> {
  return false;
}

export async function sendBudgetAlert(_weekNumber: number, _spent: number, _budget: number): Promise<void> {
  // Notifications require a development build or APK
}
