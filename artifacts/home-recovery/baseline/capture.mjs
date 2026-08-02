/**
 * R2 baseline capture for the homepage recovery program.
 *
 * Captures the CURRENT homepage (origin/main 9aade909f == prod f7e8002 for `/`)
 * across the required viewports and states. Local production build on :4790 is
 * the primary subject; production URL captures prove parity for the opening.
 *
 * No `networkidle` waits anywhere — it never settles on this app locally.
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = dirname(fileURLToPath(import.meta.url));
const LOCAL = 'http://localhost:4790/';
const PROD = 'https://vitalcv.com/';
// Valid Luhn check digit; the canonical documentation example NPI, never a
// person we choose. Used only for input-state screenshots against LOCAL.
const VALID_FORMAT_NPI = '1234567893';
const INVALID_NPI = '1234567890';

const VIEWPORTS = [
  { name: '320x720', width: 320, height: 720 },
  { name: '390x844', width: 390, height: 844 },
  { name: '430x932', width: 430, height: 932 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '1024x768', width: 1024, height: 768 },
  { name: '1280x800', width: 1280, height: 800 },
  { name: '1440x900', width: 1440, height: 900 },
  { name: '1728x1117', width: 1728, height: 1117 },
];

const shot = (page, name) =>
  page.screenshot({ path: join(OUT, `${name}.png`) });

async function openHome(page, url = LOCAL) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-home-hero]', { timeout: 15000 });
  // Let hydration + tier detection settle.
  await page.waitForTimeout(1200);
}

async function scrollFilmTo(page, fraction) {
  // Film runway = scenes*100vh spacer; progress = -top/travel.
  await page.evaluate((f) => {
    const runway = document.querySelector('.film-runway');
    if (!runway) return;
    const rect = runway.getBoundingClientRect();
    const travel = rect.height - window.innerHeight;
    window.scrollTo(0, rect.top + window.scrollY + Math.max(0, travel) * f);
  }, fraction);
  await page.waitForTimeout(700);
}

async function captureViewportSweep(browser) {
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: vp });
    const page = await ctx.newPage();
    await openHome(page);
    const mode = await page
      .locator('.film')
      .getAttribute('data-film-mode')
      .catch(() => 'unknown');
    console.log(`${vp.name}: mode=${mode}`);
    await shot(page, `initial-${vp.name}`);

    // Scene sweep. Film mode: 5 scenes at progress 0, .25, .5, .75, 1.
    if (mode === 'film') {
      for (const [i, f] of [0.25, 0.5, 0.75, 1].entries()) {
        await scrollFilmTo(page, f);
        await shot(page, `scene${i + 2}-${vp.name}`);
      }
    } else {
      // Vertical composition: screenshot each scene block.
      const scenes = page.locator('.film-scene');
      const n = await scenes.count();
      for (let i = 1; i < n; i++) {
        await scenes.nth(i).scrollIntoViewIfNeeded();
        await page.waitForTimeout(400);
        await shot(page, `scene${i + 1}-${vp.name}`);
      }
    }
    await ctx.close();
  }
}

async function captureNpiStates(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await openHome(page);
  const input = page.locator('#film-npi-input');

  await input.click();
  await shot(page, 'npi-focused-1440x900');

  // fill() races hydration on SSR inputs — click first (done), then type.
  await input.pressSequentially('12345', { delay: 30 });
  await shot(page, 'npi-partial-1440x900');

  await input.fill('');
  await input.pressSequentially(INVALID_NPI, { delay: 20 });
  await page.locator('.film-npi-submit').click({ force: true }).catch(() => {});
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  await shot(page, 'npi-invalid-1440x900');

  await input.fill('');
  await input.pressSequentially(VALID_FORMAT_NPI, { delay: 20 });
  await page.waitForTimeout(300);
  await shot(page, 'npi-validformat-1440x900');

  // Submit against LOCAL (no backend configured): captures resolving state and
  // then whatever honest failure/returned state the surface renders.
  await page.keyboard.press('Enter');
  await page.waitForTimeout(250);
  await shot(page, 'npi-resolving-1440x900');
  await page.waitForTimeout(6000);
  await shot(page, 'npi-settled-1440x900');
  await ctx.close();
}

async function captureAccessModes(browser) {
  // Reduced motion (1440 desktop) — must render vertical composition.
  let ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
  });
  let page = await ctx.newPage();
  await openHome(page);
  console.log(
    'reduced-motion mode =',
    await page.locator('.film').getAttribute('data-film-mode'),
  );
  await shot(page, 'reduced-motion-initial-1440x900');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.5));
  await page.waitForTimeout(500);
  await shot(page, 'reduced-motion-mid-1440x900');
  await ctx.close();

  // JavaScript disabled.
  ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    javaScriptEnabled: false,
  });
  page = await ctx.newPage();
  await page.goto(LOCAL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  await shot(page, 'nojs-initial-1440x900');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => {});
  await shot(page, 'nojs-bottom-1440x900');
  await ctx.close();

  // 200% zoom approximation: halve viewport w/h with deviceScaleFactor 2 is not
  // zoom; use CSS zoom via 720x450 viewport (layout-equivalent of 200% at 1440x900).
  ctx = await browser.newContext({ viewport: { width: 720, height: 450 } });
  page = await ctx.newPage();
  await openHome(page);
  await shot(page, 'zoom200-equiv-720x450');
  await ctx.close();

  // Mobile landscape.
  ctx = await browser.newContext({
    viewport: { width: 844, height: 390 },
    hasTouch: true,
    isMobile: true,
  });
  page = await ctx.newPage();
  await openHome(page);
  await shot(page, 'mobile-landscape-844x390');
  await ctx.close();
}

async function captureProdParity(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await openHome(page, PROD);
  await shot(page, 'PROD-initial-1440x900');
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page2 = await ctx2.newPage();
  await openHome(page2, PROD);
  await shot(page2, 'PROD-initial-390x844');
  await ctx.close();
  await ctx2.close();
}

async function measureComposition(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await openHome(page);
  const m = await page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const r = (el) => (el ? el.getBoundingClientRect() : null);
    const header = r(q('header'));
    const phrase = r(q('.film-phrase'));
    const input = r(q('#film-npi-input'));
    const submit = r(q('.film-npi-submit'));
    const record = r(q('.film-scene[data-film-scene="arrival"] > :last-child'));
    const artifact = r(q('.film-record')) ?? r(q('[class*="record"]'));
    const copy = r(q('.film-copy'));
    const runway = q('.film-runway');
    const docWidth = document.documentElement.scrollWidth;
    return {
      viewport: { w: window.innerWidth, h: window.innerHeight },
      headerHeight: header?.height ?? null,
      phraseWidth: phrase?.width ?? null,
      phraseTop: phrase?.top ?? null,
      inputTop: input?.top ?? null,
      submitBottom: submit?.bottom ?? null,
      copyWidth: copy?.width ?? null,
      artifactRect: artifact
        ? { x: artifact.x, y: artifact.y, w: artifact.width, h: artifact.height }
        : null,
      recordRect: record
        ? { x: record.x, y: record.y, w: record.width, h: record.height }
        : null,
      runwayHeight: runway ? runway.getBoundingClientRect().height : null,
      horizontalOverflow: docWidth > window.innerWidth ? docWidth - window.innerWidth : 0,
      bodyFontSizePx: parseFloat(getComputedStyle(document.body).fontSize),
    };
  });
  console.log('MEASUREMENTS', JSON.stringify(m, null, 2));
  await ctx.close();
}

const browser = await chromium.launch();
try {
  await captureViewportSweep(browser);
  await captureNpiStates(browser);
  await captureAccessModes(browser);
  await measureComposition(browser);
  await captureProdParity(browser);
} finally {
  await browser.close();
}
console.log('DONE');
