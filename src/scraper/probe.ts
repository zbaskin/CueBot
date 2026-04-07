/**
 * Probe script — run with: npm run probe
 * Fetches AMC Lincoln Square showtimes page and dumps what we find.
 * This determines whether we can use axios+cheerio or need Puppeteer.
 */

import axios from 'axios';

const THEATER_SLUG = 'amc-lincoln-square-13';
const BASE_URL = 'https://www.amctheatres.com';

const today = new Date().toISOString().split('T')[0];

const SHOWTIME_URL = `${BASE_URL}/movie-theatres/new-york-city/${THEATER_SLUG}/showtimes/all/${today}/${THEATER_SLUG}/all`;

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
};

async function probeAxios(): Promise<void> {
  console.log(`\n=== Probing AMC with axios ===`);
  console.log(`URL: ${SHOWTIME_URL}\n`);

  try {
    const response = await axios.get(SHOWTIME_URL, {
      headers: HEADERS,
      timeout: 15000,
    });

    const html: string = response.data;
    console.log(`Status: ${response.status}`);
    console.log(`Content-Length: ${html.length} bytes`);
    console.log(`Content-Type: ${response.headers['content-type']}\n`);

    // Check for server-rendered content indicators
    const hasNextData = html.includes('__NEXT_DATA__');
    const hasMovieTitles = html.includes('movie-title') || html.includes('movieTitle');
    const hasShowtimes = html.includes('showtime') || html.includes('Showtime');
    const hasReactRoot = html.includes('__reactFiber') || html.includes('_reactRootContainer');
    const hasCloudflare = html.includes('cf-ray') || html.includes('cloudflare') || html.includes('__cf_chl');

    console.log('Page analysis:');
    console.log(`  Has __NEXT_DATA__: ${hasNextData}`);
    console.log(`  Has movie-title elements: ${hasMovieTitles}`);
    console.log(`  Has showtime elements: ${hasShowtimes}`);
    console.log(`  Has React root: ${hasReactRoot}`);
    console.log(`  Has Cloudflare protection: ${hasCloudflare}`);

    // Try to extract __NEXT_DATA__ if present
    if (hasNextData) {
      const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
      if (match) {
        console.log('\n__NEXT_DATA__ found! Attempting to parse...');
        try {
          const data = JSON.parse(match[1]);
          console.log('__NEXT_DATA__ top-level keys:', Object.keys(data));
          if (data.props?.pageProps) {
            console.log('pageProps keys:', Object.keys(data.props.pageProps));
          }
          // Save for inspection
          const fs = await import('fs/promises');
          await fs.writeFile('./data/next-data-sample.json', JSON.stringify(data, null, 2));
          console.log('\nSaved full __NEXT_DATA__ to data/next-data-sample.json');
        } catch (e) {
          console.log('Failed to parse __NEXT_DATA__:', e);
        }
      }
    }

    // Save raw HTML for inspection
    const fs = await import('fs/promises');
    await fs.writeFile('./data/probe-sample.html', html);
    console.log(`\nSaved raw HTML to data/probe-sample.html (${html.length} bytes)`);

    // Print first 2000 chars of body content to spot structure
    const bodyMatch = html.match(/<body[^>]*>([\s\S]{0,2000})/);
    if (bodyMatch) {
      console.log('\nFirst 2000 chars of <body>:');
      console.log(bodyMatch[1]);
    }

  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      console.error(`axios error: ${err.message}`);
      console.error(`Status: ${err.response?.status}`);
      console.error(`Headers:`, err.response?.headers);
      if (err.response?.data) {
        const snippet = String(err.response.data).slice(0, 500);
        console.error('Response snippet:', snippet);
      }
    } else {
      console.error('Unexpected error:', err);
    }
  }
}

async function probePuppeteer(): Promise<void> {
  console.log('\n=== Probing AMC with Puppeteer (stealth) ===');

  let puppeteer;
  try {
    const puppeteerExtra = await import('puppeteer-extra');
    const StealthPlugin = await import('puppeteer-extra-plugin-stealth');
    puppeteer = puppeteerExtra.default;
    puppeteer.use(StealthPlugin.default());
  } catch {
    console.log('puppeteer-extra not available, using plain puppeteer');
    puppeteer = (await import('puppeteer')).default;
  }

  const browser = await puppeteer.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setUserAgent(HEADERS['User-Agent']);
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });

    console.log(`Navigating to: ${SHOWTIME_URL}`);
    await page.goto(SHOWTIME_URL, { waitUntil: 'networkidle2', timeout: 30000 });

    // Wait a moment for JS to render
    await new Promise(r => setTimeout(r, 3000));

    const html = await page.content();
    console.log(`Page content length: ${html.length} bytes`);

    // Check for movie listings
    const movieCount = await page.$$eval('[class*="movie-title"], [class*="MovieTitle"], h2, h3', els =>
      els.filter(el => el.textContent && el.textContent.trim().length > 0).map(el => el.textContent?.trim()).slice(0, 20)
    );
    console.log('\nPotential movie titles found:', movieCount);

    // Try to find showtime buttons
    const showtimeButtons = await page.$$eval(
      '[class*="showtime"], [class*="Showtime"], button[class*="time"]',
      els => els.map(el => ({ text: el.textContent?.trim(), class: el.className })).slice(0, 10)
    );
    console.log('\nShowtime elements found:', showtimeButtons);

    // Extract __NEXT_DATA__ after JS rendering
    const nextData = await page.evaluate(() => {
      const el = document.getElementById('__NEXT_DATA__');
      return el ? el.textContent : null;
    });

    if (nextData) {
      console.log('\n__NEXT_DATA__ found in rendered page!');
      try {
        const data = JSON.parse(nextData);
        console.log('Top-level keys:', Object.keys(data));
        if (data.props?.pageProps) {
          console.log('pageProps keys:', Object.keys(data.props.pageProps));
        }
        const fs = await import('fs/promises');
        await fs.writeFile('./data/puppeteer-next-data.json', JSON.stringify(data, null, 2));
        console.log('Saved to data/puppeteer-next-data.json');
      } catch (e) {
        console.log('Failed to parse __NEXT_DATA__:', e);
      }
    }

    const fs = await import('fs/promises');
    await fs.writeFile('./data/puppeteer-sample.html', html);
    console.log('\nSaved rendered HTML to data/puppeteer-sample.html');

  } finally {
    await browser.close();
  }
}

async function main(): Promise<void> {
  console.log('CueBot Probe Script');
  console.log('===================');
  console.log(`Target theater: AMC Lincoln Square 13`);
  console.log(`Date: ${today}`);

  // Try axios first (cheaper/faster)
  await probeAxios();

  const args = process.argv.slice(2);
  if (args.includes('--puppeteer')) {
    await probePuppeteer();
  } else {
    console.log('\nTo also probe with Puppeteer (headless browser): npm run probe -- --puppeteer');
  }
}

main().catch(console.error);
