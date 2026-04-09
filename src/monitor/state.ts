import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { log } from '../utils/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_FILE = resolve(__dirname, '../../data/state.json');

interface State {
  alertedKeys: Record<string, number | null>;
  // movie titles we've seen on sale (to detect new ones)
  knownMovies: string[];
}

let state: State = { alertedKeys: {}, knownMovies: [] };

export function loadState(): void {
  try {
    const raw = readFileSync(STATE_FILE, 'utf8');
    const parsed = JSON.parse(raw) as {
      alertedKeys: string[] | Record<string, number | null>;
      knownMovies: string[];
    };

    // Migrate old string[] format to Record<string, null>
    if (Array.isArray(parsed.alertedKeys)) {
      const migrated: Record<string, null> = {};
      for (const key of parsed.alertedKeys) {
        migrated[key] = null;
      }
      state = { alertedKeys: migrated, knownMovies: parsed.knownMovies ?? [] };
    } else {
      state = {
        alertedKeys: parsed.alertedKeys ?? {},
        knownMovies: parsed.knownMovies ?? [],
      };
    }
  } catch {
    state = { alertedKeys: {}, knownMovies: [] };
  }
}

export function saveState(): void {
  mkdirSync(resolve(__dirname, '../../data'), { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

export function hasAlerted(key: string, ttlMs: number | null): boolean {
  if (!(key in state.alertedKeys)) return false;

  const value = state.alertedKeys[key];

  // Permanent entries (null value) never expire
  if (value === null) return true;

  // If caller passes null for ttlMs, treat any existing entry as permanent
  if (ttlMs === null) return true;

  // Timestamped entry: check if still within TTL window
  if (Date.now() - value < ttlMs) return true;

  // Expired — remove key and signal re-alert
  delete state.alertedKeys[key];
  log('info', `Alert key expired, will re-alert: ${key}`);
  return false;
}

export function markAlerted(key: string, permanent: boolean): void {
  state.alertedKeys[key] = permanent ? null : Date.now();
}

export function getKnownMovies(): string[] {
  return state.knownMovies;
}

export function setKnownMovies(movies: string[]): void {
  state.knownMovies = movies;
}
