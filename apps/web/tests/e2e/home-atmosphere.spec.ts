import { expect, test } from '@playwright/test';

/**
 * Evidence-film atmosphere is orientation, not product state. The cursor only
 * lights the current frame; it never impersonates a custom cursor, turns a
 * source lane into a result, or breaks the vertical fallback.
 */

test.describe('home evidence-film atmosphere', () => {
  test('uses pointer position as a reading light without adding a cursor follower', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/', { waitUntil: 'networkidle' });
    await expect(page.locator('.film')).toHaveAttribute('data-film-mode', 'film');

    await page.locator('.film-stage').hover({ position: { x: 980, y: 430 } });
    await expect(page.locator('.film-readinglight')).toBeVisible();
    await expect(page.locator('[data-vt-cursor], .vt-cursor')).toHaveCount(0);
    await expect(page.locator('.film-record .film-panel-stamp')).toHaveCount(6);
  });

  test('drops the reading light with reduced motion while retaining the evidence record', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/', { waitUntil: 'networkidle' });

    await page.mouse.move(980, 430);
    await expect(page.locator('.film-readinglight')).toHaveCount(0);
    await expect(page.locator('.film')).toHaveAttribute('data-film-mode', 'vertical');
    await expect(page.locator('.film-record .film-panel-lane')).toHaveCount(6);
  });

  test('keeps visual artifacts within the viewport at supported widths', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    for (const width of [360, 390, 768, 899, 1080, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.waitForTimeout(150);
      await page.evaluate(() => window.scrollTo({ top: 0 }));

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      );
      expect(overflow, `horizontal overflow at ${width}px`).toBe(true);

      const arrival = page.locator('[data-film-scene="arrival"] .film-panel-lane');
      await expect(arrival).toHaveCount(6);
      for (const lane of await arrival.all()) {
        const box = await lane.boundingBox();
        expect(box?.x ?? -1, `lane clipped left at ${width}px`).toBeGreaterThanOrEqual(-1);
        expect(box ? box.x + box.width : width + 1, `lane clipped right at ${width}px`).toBeLessThanOrEqual(width + 1);
      }
    }
  });
});
