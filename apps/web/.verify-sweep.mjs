/* Headerless-sweep verification: the five bucket-A routes render the journey
   chrome without layout damage. Run: node .verify-sweep.mjs <baseUrl> <outDir> */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('@playwright/test');

const [BASE = 'http://localhost:3057', OUT = '/tmp/sweep-proof'] = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });

// Parameterized routes use a syntactically well-formed but check-digit-invalid
// NPI so no real person's record is fetched; a not-found state under chrome
// still proves the chrome.
const ROUTES = ['/pricing', '/concierge', '/directory/0000000000', '/profile/0000000000', '/investigate/0000000000'];

let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'} ${l}`); };

const browser = await chromium.launch();
try {
  for (const route of ROUTES) {
    const slug = route.replace(/\//g, '_').replace(/^_/, '');
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(BASE + route, { waitUntil: 'load', timeout: 60_000 });
    await page.waitForTimeout(900);

    const header = page.locator('header').first();
    ok(await header.isVisible(), `${route}: header renders`);
    ok(await page.locator('header a[href="/#your-number"], header nav').first().isVisible(), `${route}: journey rail present`);
    ok(await page.locator('footer').first().isVisible().catch(() => false), `${route}: footer renders`);
    const m = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > window.innerWidth,
      headerBottom: document.querySelector('header')?.getBoundingClientRect().bottom ?? 0,
      firstHeadingTop: document.querySelector('main h1, main h2, h1, h2')?.getBoundingClientRect().top ?? 999,
    }));
    ok(!m.overflow, `${route}: no horizontal overflow`);
    ok(m.firstHeadingTop >= m.headerBottom - 4, `${route}: content clears the header (h@${Math.round(m.firstHeadingTop)} vs hdr@${Math.round(m.headerBottom)})`);
    await page.screenshot({ path: join(OUT, `${slug}-1440x900.png`) });
    await ctx.close();

    const mob = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const mp = await mob.newPage();
    await mp.goto(BASE + route, { waitUntil: 'load', timeout: 60_000 });
    await mp.waitForTimeout(700);
    const mm = await mp.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > window.innerWidth,
      header: !!document.querySelector('header'),
    }));
    ok(mm.header && !mm.overflow, `${route} mobile: chrome present, no overflow`);
    await mp.screenshot({ path: join(OUT, `${slug}-390x844.png`) });
    await mob.close();
  }
} finally {
  await browser.close();
}
console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail === 0 ? 0 : 1);
