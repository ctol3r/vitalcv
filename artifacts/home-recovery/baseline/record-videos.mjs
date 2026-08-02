/**
 * R2 baseline motion recordings. Videos stay LOCAL (not committed) per repo
 * policy; frames + screenshots are the committed evidence.
 */
import { chromium } from '@playwright/test';

const OUT = '/tmp/vitalcv-homepage-recovery-concepts/artifacts/home-recovery/baseline/video';
const LOCAL = 'http://localhost:4790/';

async function withVideo(browser, name, opts, fn) {
  const ctx = await browser.newContext({
    recordVideo: { dir: OUT, size: opts.viewport },
    ...opts,
  });
  const page = await ctx.newPage();
  await page.goto(LOCAL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-home-hero]', { timeout: 15000 });
  await page.waitForTimeout(1000);
  await fn(page);
  const video = page.video();
  await ctx.close();
  if (video) {
    const path = await video.path();
    console.log(`${name}: ${path}`);
  }
}

async function smoothScroll(page, to, steps = 60) {
  await page.evaluate(
    async ({ to, steps }) => {
      const from = window.scrollY;
      for (let i = 1; i <= steps; i++) {
        window.scrollTo(0, from + ((to - from) * i) / steps);
        await new Promise((r) => requestAnimationFrame(r));
        await new Promise((r) => setTimeout(r, 16));
      }
    },
    { to, steps },
  );
}

const desktop = { viewport: { width: 1440, height: 900 } };
const browser = await chromium.launch();

// 1. Normal desktop scroll through the full film, then reverse.
await withVideo(browser, 'desktop-journey', desktop, async (page) => {
  const end = await page.evaluate(() => document.body.scrollHeight - window.innerHeight);
  await smoothScroll(page, end, 180);
  await page.waitForTimeout(600);
  await smoothScroll(page, 0, 120); // reverse scroll
  await page.waitForTimeout(400);
});

// 2. NPI submission + result reset.
await withVideo(browser, 'npi-submit-reset', desktop, async (page) => {
  const input = page.locator('#film-npi-input');
  await input.click();
  await input.pressSequentially('1234567893', { delay: 60 });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(6000);
  const reset = page.getByRole('button', { name: /another|reset|try/i }).first();
  await reset.click().catch(() => {});
  await page.waitForTimeout(1500);
});

// 3. Mobile scroll.
await withVideo(
  browser,
  'mobile-journey',
  { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true },
  async (page) => {
    const end = await page.evaluate(() => document.body.scrollHeight - window.innerHeight);
    await smoothScroll(page, end, 150);
  },
);

// 4. Reduced-motion journey.
await withVideo(
  browser,
  'reduced-motion-journey',
  { viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' },
  async (page) => {
    const end = await page.evaluate(() => document.body.scrollHeight - window.innerHeight);
    await smoothScroll(page, end, 120);
  },
);

await browser.close();
console.log('VIDEOS DONE');
