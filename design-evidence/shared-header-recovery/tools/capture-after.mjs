// AFTER-evidence capture for the shared-header recovery wave, against a
// local PRODUCTION build (next start). Stills + recordings per the founder
// visual gate: 1440×900, 390×844, 768×1024, 1728×1117, reduced motion,
// 200%-zoom-equivalent reflow, desktop/mobile/reduced-motion recordings.
import { chromium } from '@playwright/test';
import { mkdirSync, renameSync } from 'node:fs';

const BASE = process.env.BASE ?? 'http://localhost:3067';
const OUT = process.env.OUT_DIR;
if (!OUT) throw new Error('OUT_DIR required');
mkdirSync(OUT, { recursive: true });
mkdirSync(`${OUT}/video-tmp`, { recursive: true });

const browser = await chromium.launch();

const settle = (page, ms = 1200) => page.waitForTimeout(ms);

async function hydrate(page) {
  await page.evaluate(() => window.scrollTo({ top: 2, behavior: 'instant' }));
  await page.waitForSelector('header.vcv-header[data-nav-lifted]', { timeout: 20000 });
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForSelector('header.vcv-header:not([data-nav-lifted])', { timeout: 20000 });
  await settle(page, 500);
}

async function toSection(page, id, offset = 160) {
  await page.evaluate(
    ([sectionId, off]) => {
      const el = document.getElementById(sectionId);
      window.scrollTo({
        top: el.getBoundingClientRect().top + window.scrollY + off,
        behavior: 'instant',
      });
    },
    [id, offset],
  );
  await settle(page, 900);
}

const shot = (page, name, opts = {}) =>
  page.screenshot({ path: `${OUT}/${name}.png`, ...opts });

// ── Desktop 1440×900, recorded ─────────────────────────────────────────────
{
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: `${OUT}/video-tmp`, size: { width: 1440, height: 900 } },
  });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await hydrate(page);
  await shot(page, 'after-desktop-01-home-rest');

  // Smooth pass through the narrative for the recording, with stills at
  // each stage.
  await page.evaluate(() => window.scrollTo({ top: 420, behavior: 'smooth' }));
  await settle(page);
  await shot(page, 'after-desktop-02-scrolled-compact');

  await toSection(page, 'sources');
  await shot(page, 'after-desktop-03-stage-sources-ink-scene');
  await toSection(page, 'permission');
  await shot(page, 'after-desktop-04-stage-permission-indigo-scene');
  await toSection(page, 'review');
  await shot(page, 'after-desktop-05-stage-review-light-scene');

  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await settle(page, 1500);
  await page.locator('.vcv-header__trigger').click();
  await page.waitForSelector('#vcv-header-menu:not([hidden])');
  await settle(page, 800);
  await shot(page, 'after-desktop-06-navigation-canvas');
  await page.keyboard.press('Escape');
  await settle(page, 600);

  await page.goto(BASE + '/onboarding', { waitUntil: 'domcontentloaded' });
  await settle(page, 1500);
  await shot(page, 'after-desktop-07-clinician-activation-route');
  await page.goto(BASE + '/employers', { waitUntil: 'domcontentloaded' });
  await settle(page, 1500);
  await shot(page, 'after-desktop-08-employer-route');
  await page.goto(BASE + '/trust', { waitUntil: 'domcontentloaded' });
  await settle(page, 1500);
  await shot(page, 'after-desktop-09-trust-route');

  await page.close();
  const video = await page.video()?.path();
  await ctx.close();
  if (video) renameSync(video, `${OUT}/after-desktop-journey.webm`);
}

// ── Desktop reduced motion, recorded ───────────────────────────────────────
{
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
    recordVideo: { dir: `${OUT}/video-tmp`, size: { width: 1440, height: 900 } },
  });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await hydrate(page);
  await shot(page, 'after-desktop-10-reduced-motion-rest');
  await toSection(page, 'sources');
  await shot(page, 'after-desktop-11-reduced-motion-ink');
  await page.locator('.vcv-header__trigger').click();
  await page.waitForSelector('#vcv-header-menu:not([hidden])');
  await settle(page, 400);
  await shot(page, 'after-desktop-12-reduced-motion-canvas');
  await page.close();
  const video = await page.video()?.path();
  await ctx.close();
  if (video) renameSync(video, `${OUT}/after-desktop-reduced-motion.webm`);
}

// ── Tablet 768×1024 and wide 1728×1117 ────────────────────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 768, height: 1024 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await settle(page, 2000);
  await shot(page, 'after-tablet-768-home');
  await ctx.close();
}
{
  const ctx = await browser.newContext({ viewport: { width: 1728, height: 1117 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await hydrate(page);
  await shot(page, 'after-wide-1728-home-rest');
  await page.locator('.vcv-header__trigger').click();
  await page.waitForSelector('#vcv-header-menu:not([hidden])');
  await settle(page, 800);
  await shot(page, 'after-wide-1728-canvas');
  await ctx.close();
}

// ── 200%-zoom-equivalent reflow (half-width viewport) ──────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 720, height: 450 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await settle(page, 2000);
  await shot(page, 'after-zoom-200pct-equivalent');
  await ctx.close();
}

// ── Mobile 390×844, recorded ───────────────────────────────────────────────
{
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    recordVideo: { dir: `${OUT}/video-tmp`, size: { width: 390, height: 844 } },
  });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await hydrate(page);
  await shot(page, 'after-mobile-01-rest');
  await shot(page, 'after-mobile-02-stage-in-bar', {
    clip: { x: 0, y: 0, width: 390, height: 64 },
  });

  // The overlay: open, journey first, groups, close.
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.waitForSelector('[data-liquid-menu]');
  await settle(page, 900);
  await shot(page, 'after-mobile-03-overlay-journey');
  await page.locator('.liquid-menu__panel').evaluate((el) => {
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  });
  await settle(page, 900);
  await shot(page, 'after-mobile-04-overlay-groups');
  await page.keyboard.press('Escape');
  await settle(page, 600);
  await shot(page, 'after-mobile-05-closed-focus-restored');

  // Journey progression: the dark scene takes the compact bar.
  await toSection(page, 'sources', 200);
  await shot(page, 'after-mobile-06-dark-scene-bar');
  await toSection(page, 'permission', 200);
  await shot(page, 'after-mobile-07-stage-permission');

  await page.close();
  const video = await page.video()?.path();
  await ctx.close();
  if (video) renameSync(video, `${OUT}/after-mobile-journey.webm`);
}

await browser.close();
console.log('after-evidence captured to', OUT);
