import { expect, test } from '@playwright/test';

/**
 * The homepage degradation floor — SHD-6.1's useful residue, carried across
 * compositions (GPU scenes → six-scene film → the Z1 product story,
 * 2026-08-03): the NPI action, the source-cadence truth, and the complete
 * story remain usable under no-JS, reduced-motion, keyboard-only, and mobile
 * conditions. The scene-tier switches retired with the scene system.
 */

const DESKTOP = { width: 1440, height: 900 };

function collectPageErrors(page: import('@playwright/test').Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  return errors;
}

async function expectNoHorizontalOverflow(page: import('@playwright/test').Page) {
  const overflow = await page.evaluate(() => {
    const documentElement = document.documentElement;
    return documentElement.scrollWidth - documentElement.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(1);
}

/**
 * The field's accessible name, in full. A server-rendered `<label for>` (sr-only),
 * identical before and after hydration, so the no-JS test can use the same name.
 */
const NPI_FIELD = { name: 'Your 10-digit NPI', exact: true };

async function expectNpiActionUsable(page: import('@playwright/test').Page) {
  const input = page.getByRole('textbox', NPI_FIELD);
  await expect(input).toBeVisible();
  await input.fill('1234567893');
  await expect(page.getByRole('button', { name: /start with your npi/i })).toBeEnabled();
}

test.describe('homepage degradation floor', () => {
  test('desktop: NPI action usable, no overflow, no page errors', async ({ page }) => {
    const errors = collectPageErrors(page);
    await page.setViewportSize(DESKTOP);
    await page.goto('/', { waitUntil: 'networkidle' });
    await expectNpiActionUsable(page);
    await expectNoHorizontalOverflow(page);
    expect(errors).toEqual([]);
  });

  test('no-JS SSR floor: heading, NPI form, source cadence, and every chapter are served', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.setViewportSize(DESKTOP);
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('h1')).toBeVisible();
    await expect(page.getByRole('textbox', NPI_FIELD)).toBeVisible();
    // the cadence truth and the institution boundary are server-rendered
    await expect(page.locator('[data-home-source-cadence]')).toBeAttached();
    await expect(page.locator('[data-home-truth-boundary]')).toBeAttached();
    // all four chapters ship in the HTML — nothing is animation-only
    for (const heading of [
      /find work that fits more than your résumé/i,
      /apply once/i,
      /move from hired to ready sooner/i,
      /your career record keeps moving with you/i,
    ]) {
      await expect(page.getByRole('heading', { name: heading })).toBeAttached();
    }
    await context.close();
  });

  test('keyboard reaches the NPI input from the top of the page — no trap before the primary action', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/', { waitUntil: 'networkidle' });
    for (let i = 0; i < 40; i += 1) {
      const focused = await page.evaluate(() => document.activeElement?.id ?? '');
      if (focused === 'z1-npi-input') break;
      await page.keyboard.press('Tab');
    }
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('z1-npi-input');
  });

  test('the clinician message leads: outcome before mechanism, no category jargon above the fold', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/', { waitUntil: 'networkidle' });
    const h1 = await page.locator('h1').textContent();
    expect(h1?.toLowerCase()).toContain('get hired');
    // no credentialing-industry jargon in the first viewport's own copy
    const hero = await page.locator('[data-home-hero]').textContent();
    for (const jargon of ['primary source verification', 'psv', 'credentialing workflow', 'compliance suite']) {
      expect(hero?.toLowerCase()).not.toContain(jargon);
    }
  });

  test('Cloud Dancer is the global paper token, not a route-scoped style injection', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/', { waitUntil: 'networkidle' });
    const homeBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    await page.goto('/trust', { waitUntil: 'networkidle' });
    const trustBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(homeBg).toBe(trustBg);
  });

  test('reduced motion: the NPI action and the full story stay complete without motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize(DESKTOP);
    await page.goto('/', { waitUntil: 'networkidle' });
    await expectNpiActionUsable(page);
    await expect(page.locator('[data-home-truth-boundary]')).toBeAttached();
    await expectNoHorizontalOverflow(page);
  });

  test('mobile: the NPI action remains visible and never overflows', async ({ page }) => {
    const errors = collectPageErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/', { waitUntil: 'networkidle' });
    await expect(page.getByRole('textbox', NPI_FIELD)).toBeVisible();
    await expectNoHorizontalOverflow(page);
    expect(errors).toEqual([]);
  });
});
