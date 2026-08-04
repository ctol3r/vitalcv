import { test, expect } from '@playwright/test';

/**
 * The homepage's accessibility floor on the control the page exists to get
 * pressed, carried across compositions (six-scene film → the Z1 product
 * story, 2026-08-03).
 *
 * The film-era companion test — "reset returns FOCUS to the field" — retired
 * with its subject: the Z1 activation has no reset control. Typing again IS
 * the reset (the field never unmounts and never loses focus), so the failure
 * mode that test guarded — a keyboard user dropped to the top of the document
 * when the result pane swapped the field out — cannot occur in this
 * composition. If a reset control returns, so must that test.
 */

test('the primary action meets the 44px touch floor', async ({ page }) => {
  // CD-15: "44px minimum touch target". The film's button once resolved to
  // 40px from padding alone — inside WCAG 2.2 AA's 24px minimum, but under
  // the floor this product commits to, on the control the homepage exists to
  // get pressed. Checked at the narrowest supported width, where it matters
  // most.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/', { waitUntil: 'load' });

  const cta = page.locator('.z1-npi-submit').first();
  const box = await cta.boundingBox();
  expect(box).not.toBeNull();
  expect(Math.round(box!.height)).toBeGreaterThanOrEqual(44);

  // The field is the other thing a thumb has to hit, and iOS zooms any input
  // under 16px on focus.
  const fontPx = await page
    .locator('#z1-npi-input')
    .evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize));
  expect(fontPx).toBeGreaterThanOrEqual(16);
});
