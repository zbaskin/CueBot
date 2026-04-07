# CueBot

A local ticket-monitoring bot for AMC Lincoln Square 13 (New York). Polls the AMC website and sends a desktop notification (and optional email) when:

- **A movie goes on sale** — tickets just appeared in the listing
- **A sold-out showtime opens up** — seats become available again for a specific showing

Built with Node.js / TypeScript. Uses a headless Chromium browser (Puppeteer) to render AMC's JavaScript-heavy site.

---

## Requirements

- Node.js 18+
- Windows, macOS, or Linux (desktop notifications use the OS native system)

---

## Setup

```bash
git clone https://github.com/YOUR_USERNAME/CueBot.git
cd CueBot
npm install
cp config.example.json config.json
```

---

## Configuration

Edit `config.json` before running:

```json
{
  "pollingIntervalMinutes": 5,
  "watches": [
    {
      "type": "on-sale",
      "movieTitle": "Mission Impossible"
    },
    {
      "type": "seat-available",
      "movieTitle": "The Super Mario Galaxy Movie",
      "date": "2026-04-10",
      "time": "7:00pm",
      "format": "IMAX with Laser at AMC"
    }
  ],
  "notifications": {
    "desktop": true,
    "email": {
      "enabled": false,
      "to": "you@example.com"
    }
  }
}
```

### Watch types

| Type | Fires when |
|---|---|
| `on-sale` | The movie title first appears in today's Lincoln Square listing |
| `seat-available` | A specific showtime (date + time + format) has status other than sold out |

### Title matching

Movie titles are matched with punctuation-insensitive substring matching — you don't need the exact AMC title. For example, `"Mission Impossible"` matches `"Mission: Impossible – Dead Reckoning Part Two"`. Run `npm run probe` to see exactly how AMC lists current titles.

---

## Usage

```bash
# See what's playing today (no config needed)
npm run probe

# Run one poll cycle and exit
npm run once

# Run continuously (polls every N minutes from config.json)
npm start
```

`Ctrl+C` stops the continuous loop and saves state cleanly.

---

## Email notifications (optional)

Copy `.env.example` to `.env` and fill in your SMTP credentials:

```bash
cp .env.example .env
```

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=your-email@gmail.com
```

Then set `"email": { "enabled": true, "to": "you@example.com" }` in `config.json`.

> For Gmail, use an [App Password](https://myaccount.google.com/apppasswords) rather than your account password.

---

## How it works

1. **Fetcher** (`src/scraper/amc-client.ts`) — launches a stealth headless browser, navigates to the AMC Lincoln Square showtimes page for the target date, and waits for React to fully render
2. **Parser** (`src/scraper/parser.ts`) — uses cheerio to extract movie titles, formats, times, and availability status from the rendered DOM
3. **Monitors** (`src/monitor/`) — compare the current showtimes against your configured watches; fires an alert only once per watch (state is persisted to `data/state.json`)
4. **Notifiers** (`src/notify/`) — sends a Windows/macOS/Linux desktop notification and optionally an email

---

## State & logs

| Path | Contents |
|---|---|
| `data/state.json` | Which alerts have already fired (delete to reset) |
| `data/cuebot.log` | Timestamped log of every poll cycle and alert |

Both are git-ignored.

---

## Project structure

```
src/
  config.ts              Config loader
  index.ts               Poll loop entry point
  scraper/
    amc-client.ts        Puppeteer page fetcher
    parser.ts            Cheerio HTML parser
    probe.ts             CLI tool to inspect today's showtimes
    types.ts             Shared TypeScript types
  monitor/
    ticket-monitor.ts    on-sale watch logic
    seat-monitor.ts      seat-available watch logic
    state.ts             Alert state persistence
  notify/
    desktop.ts           Desktop notifications
    email.ts             Email via nodemailer
    notifier.ts          Dispatch to enabled channels
  utils/
    logger.ts            Console + file logger
    title-match.ts       Fuzzy title matching
```
