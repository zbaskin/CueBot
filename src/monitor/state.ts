import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_FILE = resolve(__dirname, '../../data/state.json');

interface State {
  alertedKeys: string[];
  // movie titles we've seen on sale (to detect new ones)
  knownMovies: string[];
}

let state: State = { alertedKeys: [], knownMovies: [] };

export function loadState(): void {
  try {
    const raw = readFileSync(STATE_FILE, 'utf8');
    state = JSON.parse(raw) as State;
  } catch {
    state = { alertedKeys: [], knownMovies: [] };
  }
}

export function saveState(): void {
  mkdirSync(resolve(__dirname, '../../data'), { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

export function hasAlerted(key: string): boolean {
  return state.alertedKeys.includes(key);
}

export function markAlerted(key: string): void {
  if (!state.alertedKeys.includes(key)) {
    state.alertedKeys.push(key);
  }
}

export function getKnownMovies(): string[] {
  return state.knownMovies;
}

export function setKnownMovies(movies: string[]): void {
  state.knownMovies = movies;
}
