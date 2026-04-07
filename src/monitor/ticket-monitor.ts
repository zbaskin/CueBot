import type { Showtime } from '../scraper/types.js';
import type { OnSaleWatch } from '../config.js';
import { hasAlerted, markAlerted, getKnownMovies, setKnownMovies } from './state.js';
import { normalizeTitle, titleMatches } from '../utils/title-match.js';

export interface Alert {
  type: 'on-sale' | 'seat-available';
  movieTitle: string;
  date?: string;
  time?: string;
  format?: string;
  url: string;
  message: string;
}

export function checkOnSale(showtimes: Showtime[], watches: OnSaleWatch[]): Alert[] {
  const alerts: Alert[] = [];
  const currentMovies = [...new Set(showtimes.map(s => s.movieTitle))];

  for (const watch of watches) {
    const matchingShowtimes = showtimes.filter(s =>
      titleMatches(s.movieTitle, watch.movieTitle)
    );

    if (matchingShowtimes.length === 0) continue;

    const matchedTitle = matchingShowtimes[0].movieTitle;
    const alertKey = `on-sale:${normalizeTitle(watch.movieTitle)}`;

    if (hasAlerted(alertKey)) continue;

    // Only fire if this is a newly seen movie (wasn't in the previous known list)
    const knownMovies = getKnownMovies();
    const wasKnown = knownMovies.some(m => titleMatches(m, watch.movieTitle));

    if (wasKnown) {
      // Mark as alerted so we don't keep checking
      markAlerted(alertKey);
      continue;
    }

    const sample = matchingShowtimes[0];
    alerts.push({
      type: 'on-sale',
      movieTitle: matchedTitle,
      url: sample.url,
      message: `Tickets on sale for "${matchedTitle}"! ${matchingShowtimes.length} showtime(s) available.`,
    });
    markAlerted(alertKey);
  }

  // Update known movies list after processing
  setKnownMovies(currentMovies);

  return alerts;
}
