import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Module-level mocks must be declared before any dynamic imports.
// We mock 'fs' so no real files are read/written during tests.
// We mock '../utils/logger.js' so we can spy on log calls.
// ---------------------------------------------------------------------------

vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

vi.mock('../utils/logger.js', () => ({
  log: vi.fn(),
}));

// Import mocks AFTER vi.mock declarations so hoisting works correctly.
import { readFileSync, writeFileSync } from 'fs';
import { log } from '../utils/logger.js';

// We re-import the module under test dynamically inside each describe block
// so we get a fresh module state between groups of tests.  Vitest's module
// registry is reset via `vi.resetModules()` in beforeEach.

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Re-import state module with a clean module registry. */
async function freshState() {
  vi.resetModules();
  return import('./state.js');
}

/** Make readFileSync return a specific JSON payload. */
function mockStateFile(payload: unknown) {
  vi.mocked(readFileSync).mockReturnValue(JSON.stringify(payload));
}

/** Make readFileSync throw (simulates missing file). */
function mockMissingFile() {
  vi.mocked(readFileSync).mockImplementation(() => {
    throw new Error('ENOENT');
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('hasAlerted', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  it('returns false for an unknown key', async () => {
    mockMissingFile();
    const { loadState, hasAlerted } = await freshState();
    loadState();
    expect(hasAlerted('seat-available:unknown:2026-12-17:7:00pm:imax 70mm', 30 * 60 * 1000)).toBe(false);
  });

  it('returns true for a permanent key (null value)', async () => {
    mockStateFile({
      alertedKeys: { 'on-sale:project hail mary': null },
      knownMovies: [],
    });
    const { loadState, hasAlerted } = await freshState();
    loadState();
    expect(hasAlerted('on-sale:project hail mary', null)).toBe(true);
  });

  it('returns true for a non-expired timestamped key', async () => {
    const now = 1_000_000_000_000;
    vi.setSystemTime(now);
    const ttlMs = 30 * 60 * 1000; // 30 minutes
    const recordedAt = now - ttlMs + 60_000; // 1 minute before expiry
    mockStateFile({
      alertedKeys: { 'seat-available:dune:2026-12-17:7:00pm:imax 70mm': recordedAt },
      knownMovies: [],
    });
    const { loadState, hasAlerted } = await freshState();
    loadState();
    expect(hasAlerted('seat-available:dune:2026-12-17:7:00pm:imax 70mm', ttlMs)).toBe(true);
  });

  it('returns false and deletes the key when the timestamp has expired', async () => {
    const now = 1_000_000_000_000;
    vi.setSystemTime(now);
    const ttlMs = 30 * 60 * 1000;
    const recordedAt = now - ttlMs - 1; // 1 ms past expiry
    mockStateFile({
      alertedKeys: { 'seat-available:dune:2026-12-17:7:00pm:imax 70mm': recordedAt },
      knownMovies: [],
    });
    const { loadState, hasAlerted } = await freshState();
    loadState();
    const result = hasAlerted('seat-available:dune:2026-12-17:7:00pm:imax 70mm', ttlMs);
    expect(result).toBe(false);
    // Calling again should also return false (key was deleted)
    expect(hasAlerted('seat-available:dune:2026-12-17:7:00pm:imax 70mm', ttlMs)).toBe(false);
  });

  it('logs an info message when a key expires', async () => {
    const now = 1_000_000_000_000;
    vi.setSystemTime(now);
    const ttlMs = 30 * 60 * 1000;
    const recordedAt = now - ttlMs - 1;
    const key = 'seat-available:dune:2026-12-17:7:00pm:imax 70mm';
    mockStateFile({
      alertedKeys: { [key]: recordedAt },
      knownMovies: [],
    });
    const { loadState, hasAlerted } = await freshState();
    loadState();
    hasAlerted(key, ttlMs);
    expect(vi.mocked(log)).toHaveBeenCalledWith(
      'info',
      `Alert key expired, will re-alert: ${key}`,
    );
  });

  it('treats a timestamped key as permanent when ttlMs is null', async () => {
    const now = 1_000_000_000_000;
    vi.setSystemTime(now);
    // Even though the timestamp is ancient, passing null should not expire it.
    const recordedAt = 0; // epoch – effectively expired if TTL were applied
    const key = 'seat-available:dune:2026-12-17:7:00pm:imax 70mm';
    mockStateFile({
      alertedKeys: { [key]: recordedAt },
      knownMovies: [],
    });
    const { loadState, hasAlerted } = await freshState();
    loadState();
    expect(hasAlerted(key, null)).toBe(true);
  });
});

describe('markAlerted', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  it('stores null for a permanent key (permanent=true)', async () => {
    mockMissingFile();
    const { loadState, markAlerted, saveState } = await freshState();
    loadState();
    markAlerted('on-sale:project hail mary', true);
    saveState();

    const written = vi.mocked(writeFileSync).mock.calls[0][1] as string;
    const saved = JSON.parse(written);
    expect(saved.alertedKeys['on-sale:project hail mary']).toBeNull();
  });

  it('stores a timestamp for a non-permanent key (permanent=false)', async () => {
    const now = 1_000_000_000_000;
    vi.setSystemTime(now);
    mockMissingFile();
    const { loadState, markAlerted, saveState } = await freshState();
    loadState();
    markAlerted('seat-available:dune:2026-12-17:7:00pm:imax 70mm', false);
    saveState();

    const written = vi.mocked(writeFileSync).mock.calls[0][1] as string;
    const saved = JSON.parse(written);
    expect(saved.alertedKeys['seat-available:dune:2026-12-17:7:00pm:imax 70mm']).toBe(now);
  });
});

describe('loadState migration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('migrates an old string[] alertedKeys to Record<string, null>', async () => {
    mockStateFile({
      alertedKeys: ['on-sale:project hail mary', 'seat-available:dune:2026-12-17:7:00pm:imax 70mm'],
      knownMovies: ['Project Hail Mary'],
    });
    const { loadState, hasAlerted } = await freshState();
    loadState();
    // Both migrated keys should be treated as permanent (null)
    expect(hasAlerted('on-sale:project hail mary', null)).toBe(true);
    expect(hasAlerted('seat-available:dune:2026-12-17:7:00pm:imax 70mm', null)).toBe(true);
    // Random unknown key remains false
    expect(hasAlerted('seat-available:unknown:2099-01-01:9:00pm:', null)).toBe(false);
  });

  it('handles a fresh state (missing file) with empty alertedKeys object', async () => {
    mockMissingFile();
    const { loadState, hasAlerted } = await freshState();
    loadState();
    expect(hasAlerted('any-key', null)).toBe(false);
  });
});
