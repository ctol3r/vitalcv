// One-off evidence capture for the eyebrow + How VitalCV works wave.
// Run from apps/web: node capture-eyebrow-evidence.mjs
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = 'http://localhost:3081';
const OUT = '../../design-evidence/eyebrow-journey-2026-08-07';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();

async function desktopPage() {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(BASE + '/');
  // Hydration probe (the repo's known pattern): lifted appears on a 2px scroll.
  await page.evaluate(() => window.scrollTo({ top: 2, behavior: 'instant' }));
  await page.locator('header.vcv-header[data-nav-lifted]').waitFor({ timeout: 20000 });
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForTimeout(400);
  return page;
}

// 1 — the eyebrow at rest over the hero.
let page = await desktopPage();
await page.screenshot({ path: `${OUT}/01-eyebrow-rest-desktop.png` });

// 2 — the walkthrough: resting state (stage 1), then the walk's end state.
await page.evaluate(() => {
  document.getElementById('how-it-works').scrollIntoView({ behavior: 'instant', block: 'center' });
});
await page.waitForTimeout(600); // walk begun: your-number still active at t<2s
await page.locator('#how-it-works').screenshot({ path: `${OUT}/02-how-it-works-walk-start.png` });
await page.waitForTimeout(6500); // walk complete: review active, all passed
await page.locator('#how-it-works').screenshot({ path: `${OUT}/03-how-it-works-walk-end.png` });

// 3 — scene inversion: the eyebrow over the dark sources room.
await page.evaluate(() => {
  const el = document.getElementById('sources');
  window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY + 160, behavior: 'instant' });
});
await page.locator('header.vcv-header[data-header-theme="dark"]').waitFor({ timeout: 10000 });
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/04-eyebrow-dark-room.png` });

// 4 — the navigation canvas unfolding edge to edge.
await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
await page.waitForTimeout(400);
await page.locator('.vcv-header__trigger').click();
await page.locator('#vcv-header-menu').waitFor({ state: 'visible', timeout: 5000 });
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/05-eyebrow-canvas-open.png` });
await page.close();

// 5 — mobile: compact bar + the walkthrough stacked as a spine.
page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto(BASE + '/');
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/06-mobile-top.png` });
await page.evaluate(() => {
  document.getElementById('how-it-works').scrollIntoView({ behavior: 'instant', block: 'start' });
});
await page.waitForTimeout(1000);
await page.screenshot({ path: `${OUT}/07-mobile-how-it-works.png` });
await page.close();

// 6 — reduced motion: everything visible with no walk.
page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  reducedMotion: 'reduce',
});
await page.goto(BASE + '/');
await page.evaluate(() => {
  document.getElementById('how-it-works').scrollIntoView({ behavior: 'instant', block: 'center' });
});
await page.waitForTimeout(800);
await page.locator('#how-it-works').screenshot({ path: `${OUT}/08-how-it-works-reduced-motion.png` });
await page.close();

await browser.close();
console.log('evidence written to', OUT);
