/**
 * filmstrip-promises-motion.mjs — frames of the ThreePromises arrival, so the
 * motion can be reviewed without a video player.
 *
 * Captures the real transition as it plays (no slowdown, no faked frames), then
 * writes a stacked filmstrip contact sheet.
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const outDir = process.argv[2] ?? 'evidence';
const base = process.argv[3] ?? 'http://localhost:3311';
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

await page.goto(base, { waitUntil: 'load' });
await page.waitForSelector('.ezh-promise-grid');

// Park the section just below the observer threshold, then release it.
await page.evaluate(() => {
  const grid = document.querySelector('.ezh-promise-grid');
  window.scrollTo(0, grid.getBoundingClientRect().top + window.scrollY - window.innerHeight);
});
await page.waitForTimeout(400);

const section = page.locator('.ezh-promises');
const frames = [];

// Release into view and grab frames as fast as the harness allows.
await page.evaluate(() => {
  const grid = document.querySelector('.ezh-promise-grid');
  grid.scrollIntoView({ block: 'center' });
});

for (let i = 0; i < 6; i++) {
  const state = await page.evaluate(() => {
    const grid = document.querySelector('.ezh-promise-grid');
    return {
      motion: grid.getAttribute('data-motion'),
      o: [...document.querySelectorAll('.ezh-promise')].map((c) =>
        Number(getComputedStyle(c).opacity).toFixed(2),
      ),
    };
  });
  await section.screenshot({ path: path.join(outDir, `frame-${i}.png`) });
  frames.push({ frame: i, ...state });
}

await ctx.close();
await browser.close();
console.log(JSON.stringify(frames, null, 2));
