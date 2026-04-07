import notifier from 'node-notifier';
import type { Alert } from '../monitor/ticket-monitor.js';

export function sendDesktopNotification(alert: Alert): void {
  notifier.notify({
    title: 'CueBot - AMC Lincoln Square',
    message: alert.message,
    open: alert.url,
    sound: true,
    wait: false,
    icon: undefined,
  });
}
