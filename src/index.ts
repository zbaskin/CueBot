import { loadConfig, type OnSaleWatch, type SeatWatch } from './config.js';
import { fetchShowtimesPage } from './scraper/amc-client.js';
import { parseShowtimes } from './scraper/parser.js';
import { checkOnSale } from './monitor/ticket-monitor.js';
import { checkSeats } from './monitor/seat-monitor.js';
import { loadState, saveState } from './monitor/state.js';
import { sendAlert } from './notify/notifier.js';
import { log, logScanSeparator } from './utils/logger.js';

// Given a Friday release date, return Thu–Sun (the opening weekend window).
function openingWeekendDates(releaseDate: string): string[] {
  const friday = new Date(releaseDate + 'T12:00:00');
  return [-1, 0, 1, 2].map(offset => {
    const d = new Date(friday);
    d.setDate(d.getDate() + offset);
    return d.toISOString().split('T')[0];
  });
}

async function runOnce(): Promise<void> {
  const config = loadConfig();

  logScanSeparator();

  const today = new Date().toISOString().split('T')[0];

  // Each on-sale watch fetches its releaseDate expanded to Thu–Sun (or today if not specified).
  // Each seat-available watch fetches its specific date.
  // Deduplicate so we only fetch each date once even if multiple watches share it.
  const onSaleDateMap = new Map<string, OnSaleWatch[]>();
  for (const watch of config.watches.filter(w => w.type === 'on-sale') as OnSaleWatch[]) {
    const dates = watch.releaseDate ? openingWeekendDates(watch.releaseDate) : [today];
    for (const date of dates) {
      if (!onSaleDateMap.has(date)) onSaleDateMap.set(date, []);
      onSaleDateMap.get(date)!.push(watch);
    }
  }

  const seatDateMap = new Map<string, SeatWatch[]>();
  for (const watch of config.watches.filter(w => w.type === 'seat-available') as SeatWatch[]) {
    if (!seatDateMap.has(watch.date)) seatDateMap.set(watch.date, []);
    seatDateMap.get(watch.date)!.push(watch);
  }

  const datesToFetch = new Set([...onSaleDateMap.keys(), ...seatDateMap.keys()]);

  for (const date of datesToFetch) {
    log('info', `Fetching showtimes for ${date}...`);
    try {
      const html = await fetchShowtimesPage(date);
      const schedule = parseShowtimes(html, date);
      log('info', `Found ${schedule.showtimes.length} showtimes for ${date}`);

      const alerts = [
        ...checkOnSale(schedule.showtimes, onSaleDateMap.get(date) ?? []),
        ...checkSeats(schedule.showtimes, seatDateMap.get(date) ?? [], config.seatAlertTtlMinutes * 60 * 1000),
      ];

      for (const alert of alerts) {
        await sendAlert(alert, config);
      }

      saveState();
    } catch (err) {
      log('error', `Failed to fetch/parse showtimes for ${date}: ${err}`);
    }
  }
}

async function main(): Promise<void> {
  const config = loadConfig();
  const once = process.argv.includes('--once');

  log('info', `CueBot started. Watching ${config.watches.length} item(s).`);
  log('info', `Seat alert TTL: ${config.seatAlertTtlMinutes} minute(s).`);
  if (once) log('info', 'Running one poll cycle then exiting (--once).');
  else log('info', `Polling every ${config.pollingIntervalMinutes} minute(s). Ctrl+C to stop.`);

  loadState();

  let consecutiveErrors = 0;

  do {
    try {
      await runOnce();
      consecutiveErrors = 0;
    } catch (err) {
      consecutiveErrors++;
      log('error', `Poll cycle failed (${consecutiveErrors} consecutive): ${err}`);
      if (consecutiveErrors >= 5) {
        log('error', 'Too many consecutive failures. Check your config and network connection.');
      }
    }

    if (!once) {
      log('info', `Next check in ${config.pollingIntervalMinutes} minute(s)...`);
      await new Promise(r => setTimeout(r, config.pollingIntervalMinutes * 60 * 1000));
    }
  } while (!once);
}

process.on('SIGINT', () => {
  log('info', 'Shutting down CueBot...');
  saveState();
  process.exit(0);
});

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
