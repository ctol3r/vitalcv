/**
 * UX-V1 evidence capture — before/after renders for the founder gate.
 *
 * BEFORE = the live production homepage (https://vitalcv.com).
 * AFTER  = a local production build of this branch (`next start`).
 *
 * Usage:
 *   node docs/design/evidence/ux-v1-cutover/capture.mjs after http://127.0.0.1:4600
 *   node docs/design/evidence/ux-v1-cutover/capture.mjs before https://vitalcv.com
 *
 * Run from apps/web (playwright is a devDependency there):
 *   cd apps/web && node ../../docs/design/evidence/ux-v1-cutover/capture.mjs …
 *
 * Sticky chrome is pinned absolute before fullPage shots — Playwright's
 * stitcher repeats sticky elements otherwise (homepage-reset harness lesson).
 */

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const mode = process.argv[2];
const base = process.argv[3];
if (!['before', 'after'].includes(mode) || !base) {
  console.error('usage: capture.mjs <before|after> <baseURL>');
  process.exit(1);
}
const out = join(here, mode);
mkdirSync(out, { recursive: true });

const HEADER_SELECTOR = mode === 'after' ? 'header.vcv-eb' : 'header, .vcv-header';
const pinHeader = async (page) => {
  await page.addStyleTag({
    content: `${HEADER_SELECTOR} { position: absolute !important; }`,
  });
};

const settle = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch();

async function shoot(name, { width, height, reduced = false, fn }) {
  const context = await browser.newContext({
    viewport: { width, height },
    reducedMotion: reduced ? 'reduce' : 'no-preference',
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await page.goto(base, { waitUntil: 'networkidle', timeout: 60000 }).catch(async () => {
    await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 60000 });
  });
  await fn(page, name);
  await context.close();
}

const full = async (page, name) => {
  await settle(12500); // let the work surface finish its story
  await pinHeader(page);
  await page.screenshot({ path: join(out, `${name}.png`), fullPage: true });
};

const viewportShot = async (page, name, wait = 12500) => {
  await settle(wait);
  await page.screenshot({ path: join(out, `${name}.png`) });
};

// ── page composition at the four required widths ─────────────────────────
await shoot('1440-home-full', { width: 1440, height: 900, fn: full });
await shoot('1440-hero', { width: 1440, height: 900, fn: (p, n) => viewportShot(p, n) });
await shoot('1728-home-full', { width: 1728, height: 1000, fn: full });
await shoot('1728-hero', { width: 1728, height: 1000, fn: (p, n) => viewportShot(p, n) });
await shoot('768-home-full', { width: 768, height: 1024, fn: full });
await shoot('390-home-full', { width: 390, height: 844, fn: full });
await shoot('390-hero', { width: 390, height: 844, fn: (p, n) => viewportShot(p, n) });

// ── eyebrow states (after only — the subject of the acceptance spec) ─────
if (mode === 'after') {
  const clip = { x: 0, y: 0, width: 1440, height: 140 };

  await shoot('eyebrow-rest', {
    width: 1440,
    height: 900,
    fn: async (page, name) => {
      await settle(12500);
      await page.screenshot({ path: join(out, `${name}.png`), clip });
    },
  });

  await shoot('eyebrow-scrolled', {
    width: 1440,
    height: 900,
    fn: async (page, name) => {
      await settle(12500);
      await page.evaluate(() => window.scrollTo({ top: 900, behavior: 'instant' }));
      await settle(600);
      await page.screenshot({ path: join(out, `${name}.png`), clip });
    },
  });

  await shoot('eyebrow-inverted-light-band', {
    width: 1440,
    height: 900,
    fn: async (page, name) => {
      await settle(12500);
      await page.evaluate(() => {
        const el = document.querySelector('.ezh-emp');
        window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY + 200, behavior: 'instant' });
      });
      await settle(800);
      await page.screenshot({ path: join(out, `${name}.png`), clip: { ...clip, height: 700 } });
    },
  });

  await shoot('menu-open', {
    width: 1440,
    height: 900,
    fn: async (page, name) => {
      await settle(2000);
      await page.locator('.vcv-eb__menu-btn').click();
      await page.locator('#vcv-eb-menu').waitFor({ state: 'visible' });
      await settle(400);
      await page.screenshot({ path: join(out, `${name}.png`) });
    },
  });

  await shoot('390-menu-open', {
    width: 390,
    height: 844,
    fn: async (page, name) => {
      await settle(2000);
      await page.locator('.vcv-eb__menu-btn').click();
      await page.locator('#vcv-eb-menu').waitFor({ state: 'visible' });
      await settle(400);
      await page.screenshot({ path: join(out, `${name}.png`) });
    },
  });

  // ── the work surface's beats: start / middle / end ─────────────────────
  for (const [name, wait] of [
    ['motion-start', 1100],
    ['motion-middle', 5200],
    ['motion-end', 12500],
  ]) {
    await shoot(name, {
      width: 1440,
      height: 900,
      fn: (p, n) => viewportShot(p, n, wait),
    });
  }

  // ── reduced motion: the annotated static frame ──────────────────────────
  await shoot('reduced-motion-hero', {
    width: 1440,
    height: 900,
    reduced: true,
    fn: (p, n) => viewportShot(p, n, 1500),
  });
  await shoot('reduced-motion-full', {
    width: 1440,
    height: 900,
    reduced: true,
    fn: async (page, name) => {
      await settle(1500);
      await pinHeader(page);
      await page.screenshot({ path: join(out, `${name}.png`), fullPage: true });
    },
  });

  // ── motion capture: video of the load-through-story ────────────────────
  const videoContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: out, size: { width: 1440, height: 900 } },
    deviceScaleFactor: 1,
  });
  const videoPage = await videoContext.newPage();
  await videoPage.goto(base, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await settle(14000);
  await videoContext.close(); // flushes the webm into `out`
}

await browser.close();
console.log(`captured → ${out}`);
