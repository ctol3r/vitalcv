/**
 * capture-promises-motion.mjs — evidence capture for the ThreePromises motion pass.
 *
 * Runs against a PRODUCTION build (next start), because the local dev build
 * renders differently and has repeatedly produced misleading design evidence.
 *
 * Usage: node scripts/design-evidence/capture-promises-motion.mjs <outDir> [baseUrl]
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const outDir = process.argv[2] ?? 'evidence';
const base = process.argv[3] ?? 'http://localhost:3311';

const VIEWPORTS = [
  { name: 'desktop-1280', width: 1280, height: 800 },
  { name: 'wide-1728', width: 1728, height: 900 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'mobile-390', width: 390, height: 844 },
];

mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const results = [];

for (const vp of VIEWPORTS) {
  for (const reduced of [false, true]) {
    if (reduced && vp.name !== 'desktop-1280' && vp.name !== 'mobile-390') continue;
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      reducedMotion: reduced ? 'reduce' : 'no-preference',
    });
    const page = await ctx.newPage();
    await page.goto(base, { waitUntil: 'load' });
    await page.waitForSelector('.ezh-promises');

    const section = page.locator('.ezh-promises');
    await section.scrollIntoViewIfNeeded();
    await page.waitForTimeout(900);

    const geom = await page.evaluate(() => {
      const grid = document.querySelector('.ezh-promise-grid');
      const cards = [...document.querySelectorAll('.ezh-promise')];
      const cs = getComputedStyle(grid);
      return {
        gridCols: cs.gridTemplateColumns,
        cards: cards.map((c) => {
          const b = c.getBoundingClientRect();
          const s = getComputedStyle(c);
          return {
            w: Math.round(b.width),
            h: Math.round(b.height),
            top: Math.round(b.top),
            position: s.position,
            stickyTop: s.top,
            opacity: s.opacity,
            zIndex: s.zIndex,
          };
        }),
        docH: document.documentElement.scrollHeight,
        overflowX: document.documentElement.scrollWidth > window.innerWidth,
      };
    });

    const tag = `${vp.name}${reduced ? '-reduced' : ''}`;
    results.push({ viewport: tag, ...geom });
    await section.screenshot({ path: path.join(outDir, `promises-${tag}.png`) });
    await ctx.close();
  }
}

// no-JS pass
{
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    javaScriptEnabled: false,
  });
  const page = await ctx.newPage();
  await page.goto(base, { waitUntil: 'load' });
  await page.waitForSelector('.ezh-promises');
  const visible = await page.evaluate === undefined ? null : null;
  const section = page.locator('.ezh-promises');
  await section.scrollIntoViewIfNeeded();
  await section.screenshot({ path: path.join(outDir, 'promises-desktop-1280-nojs.png') });
  const text = await section.innerText();
  results.push({
    viewport: 'desktop-1280-nojs',
    headingsPresent: (text.match(/Build it once|You say what|We keep watch/g) || []).length,
    charCount: text.length,
  });
  await ctx.close();
}

await browser.close();
console.log(JSON.stringify(results, null, 2));
