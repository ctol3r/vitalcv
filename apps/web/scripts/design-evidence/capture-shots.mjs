import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE || 'http://localhost:4319';
const OUT = process.env.OUT || './design-evidence-out';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
for (const width of [1280, 1440]) {
  const ctx = await browser.newContext({ viewport: { width, height: 1000 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForTimeout(13000);
  const rec = page.locator('.ezh-record').first();
  if (await rec.count()) await rec.screenshot({ path: `${OUT}/record-rows-${width}.png` });
  const surf = page.locator('.ezh-surface').first();
  if (await surf.count()) await surf.screenshot({ path: `${OUT}/worksurface-${width}.png` });
  await ctx.close();
}
await browser.close();
console.log('shots done');
