import { loadConfig, type OnSaleWatch, type SeatWatch } from './config.js';
import { fetchShowtimesPage } from './scraper/amc-client.js';
import { parseShowtimes } from './scraper/parser.js';
import { checkOnSale } from './monitor/ticket-monitor.js';
import { checkSeats } from './monitor/seat-monitor.js';
import { loadState, saveState } from './monitor/state.js';
import { sendAlert } from './notify/notifier.js';
import { log } from './utils/logger.js';

async function runOnce(): Promise<void> {
  const config = loadConfig();

  // Gather all dates we need to check
  const dates = new Set<string>();
  const today = new Date().toISOString().split('T')[0];

  for (const watch of config.watches) {
    if (watch.type === 'on-sale') {
      const onSaleWatch = watch as OnSaleWatch;
      if (onSaleWatch.dates) {
        onSaleWatch.dates.forEach(d => dates.add(d));
      } else {
        // Check next 14 days for on-sale watches
        for (let i = 0; i < 14; i++) {
          const d = new Date();
          d.setDate(d.getDate() + i);
          dates.add(d.toISOString().split('T')[0]);
        }
      }
    } else if (watch.type === 'seat-available') {
      dates.add((watch as SeatWatch).date);
    }
  }

  // Deduplicate: if we have many dates for on-sale, just check today (movie appears on any day)
  // For seat-available we need the specific date
  const seatDates = new Set(
    config.watches
      .filter(w => w.type === 'seat-available')
      .map(w => (w as SeatWatch).date)
  );
  const hasOnSaleWatches = config.watches.some(w => w.type === 'on-sale');

  const datesToFetch = new Set<string>();
  if (hasOnSaleWatches) datesToFetch.add(today);
  seatDates.forEach(d => datesToFetch.add(d));

  const onSaleWatches = config.watches.filter(w => w.type === 'on-sale') as OnSaleWatch[];
  const seatWatches = config.watches.filter(w => w.type === 'seat-available') as SeatWatch[];

  for (const date of datesToFetch) {
    log('info', `Fetching showtimes for ${date}...`);
    try {
      const html = await fetchShowtimesPage(date);
      const schedule = parseShowtimes(html, date);
      log('info', `Found ${schedule.showtimes.length} showtimes for ${date}`);

      const alerts = [
        ...checkOnSale(schedule.showtimes, onSaleWatches),
        ...checkSeats(schedule.showtimes, seatWatches.filter(w => w.date === date)),
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
