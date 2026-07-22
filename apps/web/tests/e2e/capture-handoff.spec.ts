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

  // The evidence-truth panel and the product carousel were retired from the
  // composition (2026-07-21 rebuild), so there are no frames to capture for
  // them. The proof moment now carries this beat — and the truth boundary that
  // came off the retired panel is captured with it.
  await page.locator('[data-home-proof-moment]').scrollIntoViewIfNeeded();
  await shot(page, '07-proof-moment');
  await page.locator('[data-home-truth-boundary]').scrollIntoViewIfNeeded();
  await shot(page, '08-truth-boundary');
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
  // Was '12-mobile-carousel'; the carousel is retired. The evidence graph is
  // the more useful mobile frame now — it is the surface that changed most.
  await page.locator('[data-home-evidence-field]').scrollIntoViewIfNeeded();
  await shot(page, '12-mobile-evidence-graph');
});
