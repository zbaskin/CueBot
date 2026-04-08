import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Alert } from '../monitor/ticket-monitor.js';
import type { NtfyConfig } from '../config.js';

// ---------------------------------------------------------------------------
// Mock axios at the module level so no real HTTP calls are made.
// ---------------------------------------------------------------------------
vi.mock('axios');
import axios from 'axios';
const mockedAxios = vi.mocked(axios, true);

// ---------------------------------------------------------------------------
// Import the unit under test AFTER mocks are registered.
// ---------------------------------------------------------------------------
import { sendNtfyNotification } from './ntfy.js';

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------
const baseAlert: Alert = {
  type: 'on-sale',
  movieTitle: 'Mission: Impossible – Final Reckoning',
  url: 'https://www.amctheatres.com/movies/12345',
  message: 'Tickets on sale for "Mission: Impossible – Final Reckoning"! 4 showtime(s) available.',
};

const baseConfig: NtfyConfig = {
  enabled: true,
  topic: 'cuebot-xk29fmq7p3',
  server: 'https://ntfy.sh',
};

beforeEach(() => {
  vi.resetAllMocks();
  // Default: axios.post resolves successfully.
  mockedAxios.post = vi.fn().mockResolvedValue({ status: 200 });
});

// ---------------------------------------------------------------------------
// Unit tests
// ---------------------------------------------------------------------------

describe('sendNtfyNotification', () => {
  // -------------------------------------------------------------------------
  // Happy-path
  // -------------------------------------------------------------------------

  it('POSTs to {server}/{topic}', async () => {
    await sendNtfyNotification(baseAlert, baseConfig);

    expect(mockedAxios.post).toHaveBeenCalledOnce();
    const [url] = (mockedAxios.post as ReturnType<typeof vi.fn>).mock.calls[0] as [string, ...unknown[]];
    expect(url).toBe('https://ntfy.sh/cuebot-xk29fmq7p3');
  });

  it('sends the alert message as the plain-text body', async () => {
    await sendNtfyNotification(baseAlert, baseConfig);

    const [, body] = (mockedAxios.post as ReturnType<typeof vi.fn>).mock.calls[0] as [string, string, ...unknown[]];
    expect(body).toBe(baseAlert.message);
  });

  it('sends the Title header as "CueBot - AMC Lincoln Square" (hardcoded theater label)', async () => {
    // The Title header identifies the notification source.
    await sendNtfyNotification(baseAlert, baseConfig);

    const [, , options] = (mockedAxios.post as ReturnType<typeof vi.fn>).mock.calls[0] as [string, string, { headers: Record<string, string> }];
    expect(options.headers['Title']).toBe('CueBot Alert');
  });

  it('sends the Click header set to the alert URL', async () => {
    await sendNtfyNotification(baseAlert, baseConfig);

    const [, , options] = (mockedAxios.post as ReturnType<typeof vi.fn>).mock.calls[0] as [string, string, { headers: Record<string, string> }];
    expect(options.headers['Click']).toBe(baseAlert.url);
  });

  it('defaults server to https://ntfy.sh when the config omits the field', async () => {
    const configWithoutServer: NtfyConfig = { enabled: true, topic: 'my-topic' };

    await sendNtfyNotification(baseAlert, configWithoutServer);

    const [url] = (mockedAxios.post as ReturnType<typeof vi.fn>).mock.calls[0] as [string, ...unknown[]];
    expect(url).toBe('https://ntfy.sh/my-topic');
  });

  it('returns without making a request when enabled is false', async () => {
    const disabled: NtfyConfig = { ...baseConfig, enabled: false };

    await sendNtfyNotification(baseAlert, disabled);

    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // No try/catch inside ntfy.ts — errors must propagate to the caller.
  // -------------------------------------------------------------------------

  it('propagates axios errors to the caller (no internal catch)', async () => {
    mockedAxios.post = vi.fn().mockRejectedValue(new Error('network timeout'));

    await expect(sendNtfyNotification(baseAlert, baseConfig)).rejects.toThrow('network timeout');
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------

  it('handles an alert with an empty message string', async () => {
    const emptyMsgAlert: Alert = { ...baseAlert, message: '' };

    await sendNtfyNotification(emptyMsgAlert, baseConfig);

    const [, body] = (mockedAxios.post as ReturnType<typeof vi.fn>).mock.calls[0] as [string, string, ...unknown[]];
    expect(body).toBe('');
  });

  it('handles a topic that contains path-like special characters', async () => {
    const specialConfig: NtfyConfig = { enabled: true, topic: 'my/weird topic', server: 'https://ntfy.sh' };

    await sendNtfyNotification(baseAlert, specialConfig);

    // The function must interpolate the topic as-is; URL encoding is the
    // responsibility of the HTTP layer (axios).
    const [url] = (mockedAxios.post as ReturnType<typeof vi.fn>).mock.calls[0] as [string, ...unknown[]];
    expect(url).toBe('https://ntfy.sh/my/weird topic');
  });

  it('handles an alert URL that contains unicode characters', async () => {
    const unicodeAlert: Alert = { ...baseAlert, url: 'https://example.com/film/奇異博士' };

    await sendNtfyNotification(unicodeAlert, baseConfig);

    const [, , options] = (mockedAxios.post as ReturnType<typeof vi.fn>).mock.calls[0] as [string, string, { headers: Record<string, string> }];
    expect(options.headers['Click']).toBe('https://example.com/film/奇異博士');
  });

  it('works with a seat-available alert type', async () => {
    const seatAlert: Alert = {
      type: 'seat-available',
      movieTitle: 'Dune: Part Two',
      date: '2026-04-10',
      time: '7:00 PM',
      format: 'IMAX',
      url: 'https://www.amctheatres.com/movies/99999',
      message: 'Seat available for "Dune: Part Two" on 2026-04-10 at 7:00 PM (IMAX)',
    };

    await sendNtfyNotification(seatAlert, baseConfig);

    expect(mockedAxios.post).toHaveBeenCalledOnce();
    const [, body] = (mockedAxios.post as ReturnType<typeof vi.fn>).mock.calls[0] as [string, string, ...unknown[]];
    expect(body).toBe(seatAlert.message);
  });

  it('strips trailing slash from server before appending topic', async () => {
    const configWithSlash: NtfyConfig = { enabled: true, topic: 'my-topic', server: 'https://ntfy.sh/' };

    await sendNtfyNotification(baseAlert, configWithSlash);

    const [url] = (mockedAxios.post as ReturnType<typeof vi.fn>).mock.calls[0] as [string, ...unknown[]];
    expect(url).toBe('https://ntfy.sh/my-topic');
  });
});
