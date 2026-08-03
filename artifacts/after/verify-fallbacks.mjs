import { chromium } from '@playwright/test';

const OUT = '/tmp/vitalcv-homepage-recovery-approved/artifacts/after';
const URL = 'http://localhost:4791/';
const browser = await chromium.launch();
const results = {};

// 1. Reduced motion — must be the complete linear document.
{
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
  });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-home-hero]');
  await page.waitForTimeout(900);
  results.reducedMotionMode = await page.locator('.film').getAttribute('data-film-mode');
  results.reducedMotionChapters = await page.locator('[data-film-scene]').count();
  // Every chapter's text must be readable — nothing left at opacity 0.
  results.reducedMotionHiddenReveals = await page.evaluate(
    () =>
      [...document.querySelectorAll('.film-reveal')].filter(
        (el) => parseFloat(getComputedStyle(el).opacity) < 0.99,
      ).length,
  );
  await page.screenshot({ path: `${OUT}/after-reduced-motion-1440x900.png` });
  await ctx.close();
}

// 2. No JavaScript — every chapter present and readable, in order.
{
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    javaScriptEnabled: false,
  });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);
  results.noJsChapters = await page.locator('[data-film-scene]').count();
  results.noJsHiddenReveals = await page.evaluate(
    () =>
      [...document.querySelectorAll('.film-reveal')].filter(
        (el) => parseFloat(getComputedStyle(el).opacity) < 0.99,
      ).length,
  );
  results.noJsInput = await page.locator('#film-npi-input').count();
  // The eyebrow detail must be legible without JS (the hydration guard).
  results.noJsEyebrowDetailVisible = await page.evaluate(() => {
    const eyebrow = document.querySelector('.film-ask-eyebrow');
    const detail = eyebrow?.querySelector('div');
    return detail ? parseFloat(getComputedStyle(detail).opacity) : null;
  });
  results.noJsChapterOrder = await page.evaluate(() =>
    [...document.querySelectorAll('[data-film-scene]')].map((el) =>
      el.getAttribute('data-film-scene'),
    ),
  );
  await page.screenshot({ path: `${OUT}/after-nojs-1440x900.png` });
  await ctx.close();
}

// 3. 320px — no clipping, no horizontal scroll.
{
  const ctx = await browser.newContext({ viewport: { width: 320, height: 720 } });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-home-hero]');
  await page.waitForTimeout(900);
  results.overflow320 = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  await page.screenshot({ path: `${OUT}/after-arrival-320x720.png` });
  await ctx.close();
}

// 4. Keyboard-only: reach the NPI field, and every chapter anchor.
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-home-hero]');
  await page.waitForTimeout(900);
  let stops = 0;
  let reachedInput = false;
  while (stops < 30 && !reachedInput) {
    await page.keyboard.press('Tab');
    stops += 1;
    reachedInput = (await page.evaluate(() => document.activeElement?.id)) === 'film-npi-input';
  }
  results.tabStopsToNpi = reachedInput ? stops : null;
  results.railLinks = await page.locator('.film-rail-link').count();
  // Touch-target floor on every interactive element in the composition.
  results.subMinTargets = await page.evaluate(() => {
    const els = [...document.querySelectorAll('.film a, .film button, .film input')];
    return els
      .map((el) => ({ tag: el.tagName, h: Math.round(el.getBoundingClientRect().height), t: (el.textContent || '').slice(0, 28) }))
      .filter((e) => e.h > 0 && e.h < 44);
  });
  await ctx.close();
}

console.log(JSON.stringify(results, null, 2));
await browser.close();
