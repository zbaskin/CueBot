import axios from 'axios';
import type { Alert } from '../monitor/ticket-monitor.js';
import type { NtfyConfig } from '../config.js';

const DEFAULT_SERVER = 'https://ntfy.sh';

export async function sendNtfyNotification(alert: Alert, config: NtfyConfig): Promise<void> {
  if (!config.enabled) return;

  const server = (config.server ?? DEFAULT_SERVER).replace(/\/$/, '');
  const url = `${server}/${config.topic}`;

  await axios.post(url, alert.message, {
    headers: {
      'Title': 'CueBot Alert',
      'Click': alert.url,
    },
  });
}
