/**
 * StockPilot — Native Notifications
 * On native: uses @capacitor/local-notifications.
 * On web: uses browser Notification API (if permission granted).
 */
import { isNative } from './index';

export async function requestNotificationPermission(): Promise<boolean> {
  if (!isNative()) {
    if (typeof Notification === 'undefined') return false;
    if (Notification.permission === 'granted') return true;
    const perm = await Notification.requestPermission();
    return perm === 'granted';
  }
  const { LocalNotifications } = await import(/* webpackIgnore: true */ '@capacitor/local-notifications');
  const perm = await LocalNotifications.requestPermissions();
  return perm.display === 'granted';
}

export async function scheduleLocal(opts: {
  title: string;
  body: string;
  at?: number;
  id?: number;
  smallIcon?: string;
}): Promise<number> {
  if (!isNative()) {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(opts.title, { body: opts.body });
    }
    return Date.now();
  }
  const { LocalNotifications } = await import(/* webpackIgnore: true */ '@capacitor/local-notifications');
  const id = opts.id ?? Date.now();
  const schedule: any = { id, title: opts.title, body: opts.body, smallIcon: opts.smallIcon ?? 'ic_stat_stockpilot' };
  if (opts.at && opts.at > Date.now()) schedule.schedule = { at: new Date(opts.at) };
  await LocalNotifications.schedule({ notifications: [schedule] });
  return id;
}

export async function notifyLowStock(productName: string, qty: number): Promise<void> {
  await scheduleLocal({
    title: 'Low Stock Alert',
    body: `${productName} has only ${qty} units left. Reorder soon.`,
    smallIcon: 'ic_stat_warning',
  });
}

export async function notifyCreditDue(creditorName: string, amount: number, dueMs: number): Promise<void> {
  const reminderMs = dueMs - 3 * 24 * 60 * 60 * 1000;
  if (reminderMs <= Date.now()) {
    await scheduleLocal({
      title: 'Credit Payment Due',
      body: `${creditorName} owes ₦${amount.toFixed(2)}. Due ${new Date(dueMs).toLocaleDateString()}.`,
    });
  } else {
    await scheduleLocal({
      title: 'Credit Payment Due Soon',
      body: `${creditorName} owes ₦${amount.toFixed(2)}, due in 3 days.`,
      at: reminderMs,
    });
  }
}

export async function notifySyncFailure(failedCount: number): Promise<void> {
  if (failedCount === 0) return;
  await scheduleLocal({
    title: 'Sync Failed',
    body: `${failedCount} record(s) failed to sync. Tap to review.`,
    smallIcon: 'ic_stat_error',
  });
}

export async function cancelNotification(id: number): Promise<void> {
  if (!isNative()) return;
  const { LocalNotifications } = await import(/* webpackIgnore: true */ '@capacitor/local-notifications');
  await LocalNotifications.cancel({ notifications: [{ id }] });
}

export async function cancelAllNotifications(): Promise<void> {
  if (!isNative()) return;
  const { LocalNotifications } = await import(/* webpackIgnore: true */ '@capacitor/local-notifications');
  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length > 0) {
    await LocalNotifications.cancel({ notifications: pending.notifications });
  }
}
