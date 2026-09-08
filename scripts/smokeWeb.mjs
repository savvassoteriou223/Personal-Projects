/**
 * smokeWeb.mjs — boots the real app in a browser, signs in, and fails on any
 * page error.
 *
 * This exists because of a crash that shipped in four consecutive builds. A
 * useMemo was hoisted above the useState it read, so every LOGGED-IN render threw
 * "Cannot access 'profile' before initialization" and the Today screen died. The
 * 288-program generator audit and 50 unit tests all passed — none of them touch
 * component render order. Loading the logged-OUT launch screen also looked fine,
 * because the bad hook only runs once a profile exists.
 *
 * Signing in is therefore the whole point of this script. Anything less does not
 * exercise the screen where the app actually lives.
 *
 * Usage:
 *   npx expo start --web --port 8101
 *   SMOKE_EMAIL=... SMOKE_PASSWORD=... node scripts/smokeWeb.mjs
 *
 * Exits non-zero on a page error, so it can gate a build.
 */
import puppeteer from 'puppeteer-core';

const URL = process.env.SMOKE_URL || 'http://localhost:8101';
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const EMAIL = process.env.SMOKE_EMAIL;
const PASSWORD = process.env.SMOKE_PASSWORD;

if (!EMAIL || !PASSWORD) {
  console.error('SMOKE_EMAIL and SMOKE_PASSWORD are required — a logged-out boot does not exercise the app.');
  process.exit(2);
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage();
await page.setViewport({ width: 420, height: 1000 });

const fatal = [];
page.on('pageerror', e => fatal.push(e.message));
page.on('console', m => {
  const t = m.text();
  // A 401 on the anonymous session probe is expected before sign-in.
  if (m.type() === 'error' && !/401|Failed to load resource/.test(t)) fatal.push(t.slice(0, 300));
});

const wait = ms => new Promise(r => setTimeout(r, ms));
const clickText = async (txt) => {
  const ok = await page.evaluate((t) => {
    const el = [...document.querySelectorAll('div,span,button')].reverse()
      .find(e => e.innerText?.trim() === t && e.offsetParent !== null);
    if (el) { el.click(); return true; }
    return false;
  }, txt);
  await wait(3500);
  return ok;
};

console.log('loading', URL);
await page.goto(URL, { waitUntil: 'networkidle2', timeout: 180000 });
await wait(25000); // first Metro compile is slow

await clickText('I already have an account');
const inputs = await page.$$('input');
if (inputs.length < 2) {
  console.error('FAIL: no login form — the app did not render past the launch screen');
  await browser.close();
  process.exit(1);
}
await inputs[0].type(EMAIL, { delay: 15 });
await inputs[1].type(PASSWORD, { delay: 15 });
await clickText('Sign in');
await wait(22000);

const text = await page.evaluate(() => document.body.innerText || '');
const crashed = /App crashed/i.test(text);

console.log('\n--- first 300 chars of the signed-in screen ---');
console.log(text.slice(0, 300) || '(empty)');

if (crashed || fatal.length) {
  console.error(`\nFAIL — ${fatal.length} page error(s)${crashed ? ', and the app reported a crash' : ''}`);
  fatal.slice(0, 10).forEach(e => console.error('  ' + e));
  await page.screenshot({ path: 'smoke-failure.png' });
  console.error('screenshot: smoke-failure.png');
  await browser.close();
  process.exit(1);
}

console.log('\nPASS — signed in with no page errors');
await browser.close();
