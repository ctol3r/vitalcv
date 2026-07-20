import { test, type Page } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

const OUT = process.env.CAPTURE_OUT ?? '/tmp/motion-handoff';

async function shot(page: Page, name: string) {
  await page.waitForTimeout(220);
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
}

async function scrollWithin(page: Page, selector: string, fraction: number) {
  const metrics = await page.locator(selector).evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return { top: rect.top + window.scrollY, height: rect.height };
  });
  const distance = Math.max(1, metrics.height - page.viewportSize()!.height);
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), metrics.top + distance * fraction);
}

test('capture desktop motion frames', async ({ page }) => {
  fs.mkdirSync(OUT, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/', { waitUntil: 'networkidle' });

  await shot(page, '01-hero-rest');
  await scrollWithin(page, '#wallet', 0.45);
  await shot(page, '02-hero-typing-mid');
  await scrollWithin(page, '#wallet', 0.9);
  await shot(page, '03-hero-typing-complete');

  // W2: the journey is the pinned horizontal rail — capture its runway scrub.
  await scrollWithin(page, '[data-story-rail] .story-rail-runway', 0);
  await shot(page, '04-journey-start-readiness');
  await scrollWithin(page, '[data-story-rail] .story-rail-runway', 0.5);
  await shot(page, '05-journey-middle');
  await scrollWithin(page, '[data-story-rail] .story-rail-runway', 1);
  await shot(page, '06-journey-end-start-faster');

  await page.locator('[data-home-evidence-trace]').scrollIntoViewIfNeeded();
  await shot(page, '07-evidence-truth-panel');
  await page.locator('[data-home-product-carousel]').scrollIntoViewIfNeeded();
  await shot(page, '08-product-carousel');
  await page.locator('[data-home-dual-cta]').scrollIntoViewIfNeeded();
  await shot(page, '09-metrics-dual-cta');
});

test('capture mobile frames', async ({ page }) => {
  fs.mkdirSync(OUT, { recursive: true });
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto('/', { waitUntil: 'networkidle' });
  await shot(page, '10-mobile-hero');
  await page.locator('[data-journey-card="matcha"]').scrollIntoViewIfNeeded();
  await shot(page, '11-mobile-journey-stack');
  await page.locator('.product-carousel-track').scrollIntoViewIfNeeded();
  await shot(page, '12-mobile-carousel');
});
