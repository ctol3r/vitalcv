import { expect, test } from '@playwright/test';

/**
 * The career journey is intentionally ordinary document flow. This prevents a
 * product-tour carousel from taking control of desktop scrolling while keeping
 * every chapter available as a real anchor.
 */
test.describe('homepage career journey', () => {
  test('renders all four chapters in a visible non-carousel grid', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/', { waitUntil: 'networkidle' });

    await expect(page.locator('[data-home-journey-grid]')).toHaveCount(1);
    await expect(page.locator('[data-journey-card]')).toHaveCount(4);
    await expect(page.locator('[data-story-rail]')).toHaveCount(0);
    await expect(page.locator('[data-home-product-carousel]')).toHaveCount(0);
    await expect(page.locator('[data-story-rail-nav]')).toHaveCount(0);
  });

  test('keeps chapter anchors reachable by ordinary scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/#apply', { waitUntil: 'networkidle' });

    const apply = page.locator('#apply');
    await expect(apply).toBeInViewport();
    await expect(apply.locator('[data-journey-card="apply"]')).toHaveCount(1);
  });

  test('does not create horizontal document overflow', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/', { waitUntil: 'networkidle' });

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
