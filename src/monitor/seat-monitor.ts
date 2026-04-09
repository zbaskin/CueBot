import type { Showtime } from '../scraper/types.js';
import type { SeatWatch } from '../config.js';
import { hasAlerted, markAlerted } from './state.js';
import type { Alert } from './ticket-monitor.js';
import { normalizeTitle, titleMatches } from '../utils/title-match.js';

export function checkSeats(showtimes: Showtime[], watches: SeatWatch[], ttlMs: number): Alert[] {
  const alerts: Alert[] = [];

  for (const watch of watches) {
    const alertKey = `seat-available:${normalizeTitle(watch.movieTitle)}:${watch.date}:${watch.time.toLowerCase()}:${(watch.format ?? '').toLowerCase()}`;

    if (hasAlerted(alertKey, ttlMs)) continue;

    const match = showtimes.find(s =>
      // Prefer exact ID match when showtimeId is configured
      watch.showtimeId
        ? s.showtimeId === watch.showtimeId
        : titleMatches(s.movieTitle, watch.movieTitle) &&
          s.date === watch.date &&
          s.time.toLowerCase() === watch.time.toLowerCase() &&
          (!watch.format || normalizeTitle(s.format).includes(normalizeTitle(watch.format)) || normalizeTitle(watch.format).includes(normalizeTitle(s.format)))
    );

    if (!match) continue;

    if (match.status === 'soldOut') continue;

    const statusLabel = match.status === 'almostSoldOut' ? 'Almost Full' : 'Available';
    alerts.push({
      type: 'seat-available',
      movieTitle: match.movieTitle,
      date: match.date,
      time: match.time,
      format: match.format,
      url: match.url,
      message: `Seats ${statusLabel} for "${match.movieTitle}" on ${match.date} at ${match.time} (${match.format})!`,
    });
    markAlerted(alertKey, false);
  }

  return alerts;
}
