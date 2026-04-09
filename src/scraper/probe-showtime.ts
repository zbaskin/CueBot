/**
 * Probes an individual AMC showtime page to intercept API calls.
 * Run with: npx tsx src/scraper/probe-showtime.ts {showtimeId}
 */

import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { writeFile, mkdir } from 'fs/promises';

puppeteerExtra.use(StealthPlugin());

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

async function probeShowtime(showtimeId: string): Promise<void> {
  const url = `https://www.amctheatres.com/showtimes/${showtimeId}`;
  console.log(`\nProbing showtime page: ${url}`);

  const browser = await puppeteerExtra.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });

    const apiCalls: { url: string; method: string; type: string; postData?: string }[] = [];
    const apiResponses: { url: string; status: number; body: string }[] = [];

    // Intercept requests
    page.on('request', req => {
      const u = req.url();
      const type = req.resourceType();
      if (type === 'xhr' || type === 'fetch' || u.includes('/api/') || u.includes('graphql') || u.includes('seat') || u.includes('ticket')) {
        apiCalls.push({ url: u, method: req.method(), type, postData: req.postData() ?? undefined });
      }
    });

    // Intercept responses for AMC domains only
    page.on('response', async res => {
      const u = res.url();
      if ((u.includes('amctheatres.com') || u.includes('amcapi') || u.includes('seat') || u.includes('ticket')) &&
          (res.request().resourceType() === 'xhr' || res.request().resourceType() === 'fetch')) {
        try {
          const body = await res.text();
          if (body && body.length < 100000) {
            apiResponses.push({ url: u, status: res.status(), body });
          }
        } catch {
          // ignore
        }
      }
    });

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 5000));

    console.log(`\n=== API/XHR/Fetch calls (${apiCalls.length}) ===`);
    apiCalls.forEach(c => {
      console.log(`  [${c.method}] [${c.type}] ${c.url}`);
      if (c.postData) console.log(`    Body: ${c.postData.slice(0, 200)}`);
    });

    console.log(`\n=== AMC API Responses (${apiResponses.length}) ===`);
    apiResponses.forEach(r => {
      console.log(`\n  [${r.status}] ${r.url}`);
      // Try to parse as JSON
      try {
        const json = JSON.parse(r.body);
        console.log('  JSON keys:', Object.keys(json));
        // Look for seat/availability data
        const str = JSON.stringify(json);
        if (str.includes('seat') || str.includes('Seat') || str.includes('remain') || str.includes('available') || str.includes('capacity')) {
          console.log('  *** CONTAINS SEAT/AVAILABILITY DATA ***');
          console.log('  Preview:', str.slice(0, 500));
        }
      } catch {
        console.log('  Non-JSON body preview:', r.body.slice(0, 200));
      }
    });

    // Also check the page itself for seat data in window state
    const windowData = await page.evaluate(() => {
      const keys = Object.keys(window).filter(k =>
        k.toLowerCase().includes('seat') ||
        k.toLowerCase().includes('ticket') ||
        k.toLowerCase().includes('show') ||
        k.toLowerCase().includes('amc')
      );
      return keys;
    });
    console.log('\n=== Relevant window globals ===', windowData);

    await mkdir('./data', { recursive: true });
    await writeFile('./data/showtime-probe.json', JSON.stringify({ apiCalls, apiResponses }, null, 2));
    console.log('\nSaved full results to data/showtime-probe.json');

  } finally {
    await browser.close();
  }
}

const showtimeId = process.argv[2] ?? '141261104';
probeShowtime(showtimeId).catch(console.error);
