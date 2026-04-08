import type { Alert } from '../monitor/ticket-monitor.js';
import type { Config } from '../config.js';
import { sendDesktopNotification } from './desktop.js';
import { sendEmailNotification } from './email.js';
import { sendNtfyNotification } from './ntfy.js';
import { log } from '../utils/logger.js';

export async function sendAlert(alert: Alert, config: Config): Promise<void> {
  log('info', `ALERT: ${alert.message}`);

  if (config.notifications.desktop) {
    sendDesktopNotification(alert);
  }

  if (config.notifications.email?.enabled) {
    try {
      await sendEmailNotification(alert, config.notifications.email);
      log('info', `Email sent to ${config.notifications.email.to}`);
    } catch (err) {
      log('error', `Email failed: ${err}`);
    }
  }

  if (config.notifications.ntfy?.enabled) {
    try {
      await sendNtfyNotification(alert, config.notifications.ntfy);
      log('info', `ntfy notification sent to topic "${config.notifications.ntfy.topic}"`);
    } catch (err) {
      log('error', `ntfy failed: ${err}`);
    }
  }
}
