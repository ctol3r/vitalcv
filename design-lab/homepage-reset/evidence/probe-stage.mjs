// Probe: viewport shots of a direction's explainer stage while __reset.play() runs.
// node probe-stage.mjs <a|b|c> [shots...]
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire('/Users/christoler/vitalcv/apps/web/package.json');
const { chromium } = require('@playwright/test');
const EV = dirname(fileURLToPath(import.meta.url));
const key = process.argv[2] || 'a';
const slug = `direction-${key}`;
const out = join(EV, slug, 'probe');
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
await page.goto(`http://localhost:4870/${slug}/`, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(600);
// scroll so the how-it-works sticky stage is active (top of track + 40% of one beat)
await page.evaluate(() => {
  const t = document.querySelector('#how-it-works');
  if (t) window.scrollTo(0, t.offsetTop + 10);
});
await page.waitForTimeout(700);
await page.screenshot({ path: join(out, 'stage-pre.png') });
await page.evaluate(() => window.__reset?.play?.());
for (const s of [1500, 4000, 7000, 10000, 13000, 16000]) {
  await page.waitForTimeout(s === 1500 ? 1500 : 2500 + (s === 4000 ? 0 : 500) - 500);
  await page.screenshot({ path: join(out, `stage-${s}.png`) });
}
console.log('probe done ->', out);
await browser.close();
