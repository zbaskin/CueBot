import { readFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

export interface OnSaleWatch {
  type: 'on-sale';
  movieTitle: string;
  releaseDate?: string;  // YYYY-MM-DD: the date the movie opens — fetches that page instead of today
}

export interface SeatWatch {
  type: 'seat-available';
  movieTitle: string;
  date: string;
  time: string;
  format?: string;
}

export type Watch = OnSaleWatch | SeatWatch;

export interface EmailConfig {
  enabled: boolean;
  to: string;
}

export interface NtfyConfig {
  enabled: boolean;
  topic: string;
  server?: string;
}

export interface Config {
  theater: string;
  pollingIntervalMinutes: number;
  seatAlertTtlMinutes: number;
  watches: Watch[];
  notifications: {
    desktop: boolean;
    email: EmailConfig;
    ntfy?: NtfyConfig;
  };
}

function loadEnv(): void {
  try {
    const envPath = resolve(ROOT, '.env');
    const content = readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx < 0) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const value = trimmed.slice(eqIdx + 1).trim();
      if (key && !(key in process.env)) {
        process.env[key] = value;
      }
    }
  } catch {
    // .env is optional
  }
}

export function loadConfig(): Config {
  loadEnv();
  const configPath = resolve(ROOT, 'config.json');
  const raw = JSON.parse(readFileSync(configPath, 'utf8')) as Config;

  if (!raw.watches || raw.watches.length === 0) {
    throw new Error('config.json: "watches" array is empty. Add at least one watch.');
  }

  if (!raw.pollingIntervalMinutes || raw.pollingIntervalMinutes < 1) {
    throw new Error('config.json: pollingIntervalMinutes must be >= 1');
  }

  if (!raw.seatAlertTtlMinutes || raw.seatAlertTtlMinutes < 1) {
    raw.seatAlertTtlMinutes = 30;
  }

  const dateFormat = /^\d{4}-\d{2}-\d{2}$/;

  for (const watch of raw.watches) {
    if (watch.type === 'seat-available') {
      if (!watch.date || !watch.time) {
        throw new Error(`seat-available watch for "${watch.movieTitle}" must have date and time`);
      }
      if (!dateFormat.test(watch.date)) {
        throw new Error(`seat-available watch for "${watch.movieTitle}": date "${watch.date}" must be YYYY-MM-DD (e.g. 2026-09-12)`);
      }
    }
    if (watch.type === 'on-sale') {
      if (watch.releaseDate && !dateFormat.test(watch.releaseDate)) {
        throw new Error(`on-sale watch for "${watch.movieTitle}": releaseDate "${watch.releaseDate}" must be YYYY-MM-DD (e.g. 2026-09-12)`);
      }
    }
  }

  return raw;
}
