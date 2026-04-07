import { appendFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOG_FILE = resolve(__dirname, '../../data/cuebot.log');

export type LogLevel = 'info' | 'warn' | 'error';

export function log(level: LogLevel, message: string): void {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  console.log(line);
  try {
    mkdirSync(resolve(__dirname, '../../data'), { recursive: true });
    appendFileSync(LOG_FILE, line + '\n');
  } catch {
    // ignore log file errors
  }
}
