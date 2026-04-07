import * as cheerio from 'cheerio';
import type { Showtime, ShowtimeStatus, TheaterSchedule } from './types.js';

const BASE_URL = 'https://www.amctheatres.com';
const THEATER_ID = 'amc-lincoln-square-13';
const THEATER_NAME = 'AMC Lincoln Square 13';

function parseStatus(srOnlyText: string, isDisabled: boolean): ShowtimeStatus {
  if (isDisabled) return 'soldOut';
  const text = srOnlyText.toLowerCase();
  if (text.includes('sold out')) return 'soldOut';
  if (text.includes('almost full')) return 'almostSoldOut';
  return 'available';
}

export function parseShowtimes(html: string, date: string): TheaterSchedule {
  const $ = cheerio.load(html);
  const showtimes: Showtime[] = [];

  // Each movie has a section with aria-label="Showtimes for {title}"
  $('[aria-label^="Showtimes for "]').each((_, movieSection) => {
    const ariaLabel = $(movieSection).attr('aria-label') ?? '';
    const movieTitle = ariaLabel.replace('Showtimes for ', '').trim();

    // Within each movie section, find format subsections
    $(movieSection).find('[aria-label$=" Showtimes"]').each((_, formatSection) => {
      const formatLabel = $(formatSection).attr('aria-label') ?? '';
      const format = formatLabel.replace(' Showtimes', '').trim();

      // Find all showtime links within this format section
      $(formatSection).find('a[href^="/showtimes/"]').each((_, link) => {
        const href = $(link).attr('href') ?? '';
        const showtimeId = href.replace('/showtimes/', '');
        const isDisabled = $(link).attr('aria-disabled') === 'true';

        // Time is the text content minus the sr-only span text
        const srOnlyText = $(link).find('.sr-only').text().trim();
        const fullText = $(link).text().trim();
        const time = fullText.replace(srOnlyText, '').trim();

        // Only include entries that look like times
        if (!time || !/^\d{1,2}:\d{2}[ap]m$/i.test(time)) return;

        const status = parseStatus(srOnlyText, isDisabled);

        showtimes.push({
          movieTitle,
          date,
          time,
          format,
          status,
          url: `${BASE_URL}/showtimes/${showtimeId}`,
        });
      });
    });
  });

  return {
    theaterId: THEATER_ID,
    theaterName: THEATER_NAME,
    fetchedAt: new Date().toISOString(),
    showtimes,
  };
}
