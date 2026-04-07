import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteerExtra.use(StealthPlugin());

const THEATER_SLUG = 'amc-lincoln-square-13';
const BASE_URL = 'https://www.amctheatres.com';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export function showtimeUrl(date: string): string {
  return `${BASE_URL}/movie-theatres/new-york-city/${THEATER_SLUG}/showtimes/all/${date}/${THEATER_SLUG}/all`;
}

export async function fetchShowtimesPage(date: string): Promise<string> {
  const url = showtimeUrl(date);
  const browser = await puppeteerExtra.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    // Extra wait for React hydration
    await new Promise(r => setTimeout(r, 3000));

    return await page.content();
  } finally {
    await browser.close();
  }
}
