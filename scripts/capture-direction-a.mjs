/**
 * Founder-visual-gate evidence capture for the Direction A recomposition.
 *
 * Screenshots `/` from a PRODUCTION build at the two viewports the gate asks
 * for, plus a reduced-motion pass and a no-JS pass — the two states amendment
 * E's Motion row makes load-bearing (the settled cycling word must be the
 * server frame, not something script produces).
 *
 * Usage: node scripts/capture-direction-a.mjs <baseUrl> <outDir>
 */

import { chromium } from '@playwright/test'; // resolved from apps/web — run it from there
import { mkdir } from 'node:fs/promises';

const base = process.argv[2] ?? 'http://localhost:3031';
const outDir = process.argv[3] ?? '/tmp/direction-a-evidence';

const VIEWPORTS = [
  { name: 'desktop-1280', width: 1280, height: 900 },
  { name: 'mobile-390', width: 390, height: 844 },
];

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();

for (const vp of VIEWPORTS) {
  for (const variant of ['default', 'reduced-motion', 'no-js']) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2,
      reducedMotion: variant === 'reduced-motion' ? 'reduce' : 'no-preference',
      javaScriptEnabled: variant !== 'no-js',
    });
    const page = await context.newPage();
    await page.goto(base, { waitUntil: variant === 'no-js' ? 'domcontentloaded' : 'load' });
    // Let the single-pass cycling word settle before capture; it is ~1.2s total.
    if (variant === 'default') await page.waitForTimeout(2000);
    await page.screenshot({
      path: `${outDir}/${vp.name}-${variant}.png`,
      fullPage: true,
    });

    // Measured facts, not eyeballed ones.
    if (variant === 'default') {
      const facts = await page.evaluate(() => {
        const q = (s) => document.querySelector(s);
        const rect = (s) => {
          const e = q(s);
          return e ? Math.round(e.getBoundingClientRect().top + window.scrollY) : null;
        };
        const shown = (s) =>
          [...document.querySelectorAll(s)].filter((e) => e.getBoundingClientRect().width > 0).length;
        return {
          payoffWord: q('.ezh-payoff-cycle')?.textContent,
          figuresVisible: shown('.ezh-fig svg'),
          figureCaptions: document.querySelectorAll('.ezh-fig-cap').length,
          walletOnPage: document.body.innerText.includes('Wallet'),
          order: {
            roles: rect('[data-home-roles]'),
            feed: rect('[data-home-opportunity-horizon]'),
            attribution: rect('.ezh-attr'),
            darkBand: rect('[data-home-mobility-sequence]'),
            standingWatch: rect('[data-home-standing-watch]'),
            employerBand: rect('.ezh-emp'),
          },
          docHeight: document.documentElement.scrollHeight,
        };
      });
      console.log(`\n== ${vp.name} ==`);
      console.log(JSON.stringify(facts, null, 2));
    }

    if (variant === 'no-js') {
      const settled = await page.evaluate(() => ({
        payoffWord: document.querySelector('.ezh-payoff-cycle')?.textContent,
        heroFigureRows: [...document.querySelectorAll('.ezh-fig-hero text')].length,
      }));
      console.log(`  no-js ${vp.name}:`, JSON.stringify(settled));
    }

    await context.close();
  }
}

await browser.close();
console.log(`\nwrote ${VIEWPORTS.length * 3} screenshots to ${outDir}`);
