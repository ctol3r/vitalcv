// D′-00 ruling-board capture — static board, no server needed (file:// URL).
// Run from the repo root: node design-lab/2026-register/capture.mjs
// Evidence lands in design-lab/2026-register/evidence/ (untracked, regenerable).
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(HERE, '../../apps/web/package.json'));
const { chromium } = require('@playwright/test');

const BOARD = pathToFileURL(join(HERE, 'index.html')).href;
const OUT = join(HERE, 'evidence');
mkdirSync(OUT, { recursive: true });

const SHOTS = [
  { name: 'board-1440', viewport: { width: 1440, height: 900 } },
  { name: 'board-390', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
  { name: 'board-1440-reduced-motion', viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' },
];

const browser = await chromium.launch();
for (const { name, ...ctxOpts } of SHOTS) {
  const ctx = await browser.newContext({ deviceScaleFactor: 2, ...ctxOpts });
  const page = await ctx.newPage();
  await page.goto(BOARD);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(200);
  const path = join(OUT, `${name}.png`);
  await page.screenshot({ path, fullPage: true });
  console.log('saved', path);
  // Per-ruling section shots at desktop width only.
  if (!ctxOpts.isMobile && !ctxOpts.reducedMotion) {
    for (const id of ['cta', 'r-a', 'r-b', 'r-c', 'r-d']) {
      const el = page.locator(`#${id}`);
      await el.scrollIntoViewIfNeeded();
      const p = join(OUT, `${name}-${id}.png`);
      await el.screenshot({ path: p });
      console.log('saved', p);
    }
  }
  await ctx.close();
}
await browser.close();
