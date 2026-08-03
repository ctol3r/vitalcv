import { expect, test } from '@playwright/test';

/**
 * Evidence-film atmosphere is orientation, not product state. Pointer movement
 * never impersonates a custom cursor, turns a source lane into a result, or
 * breaks the vertical fallback.
 *
 * The #1060 recovery RETIRED the pointer-tracked reading light (`.film-readinglight`)
 * and the atmosphere canvas outright — there is no ambient layer on this route
 * any more. The assertions that named those mechanisms are gone with them; the
 * ones that survive are the ones about what a reader actually gets: no cursor
 * follower, a six-lane record stamped with its true pre-lookup state, and no
 * clipping at any supported width.
 */

test.describe('home evidence-film atmosphere', () => {
  test('adds no cursor follower and stamps every lane in the opening record', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/', { waitUntil: 'networkidle' });
    await expect(page.locator('.film')).toHaveAttribute('data-film-mode', 'film');

    await page.locator('.film-stage').hover({ position: { x: 980, y: 430 } });
    // RETIRED: `.film-readinglight` visible — the reading light was removed in
    // the #1060 recovery and has no successor mechanism to assert.
    await expect(page.locator('[data-vt-cursor], .vt-cursor')).toHaveCount(0);
    // Was `.film-record .film-panel-stamp` ×6: the record is `.film-summon` and
    // each lane's stamp is a ProvenanceChip carrying `data-provenance-state`.
    await expect(page.locator('.film-summon [data-provenance-state]')).toHaveCount(6);
  });

  test('retains the complete evidence record under reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/', { waitUntil: 'networkidle' });

    await page.mouse.move(980, 430);
    // RETIRED: `.film-readinglight` count 0 — nothing tracks the pointer now,
    // so there is no reduced-motion suppression left to prove.
    await expect(page.locator('[data-vt-cursor], .vt-cursor')).toHaveCount(0);
    await expect(page.locator('.film')).toHaveAttribute('data-film-mode', 'vertical');
    await expect(page.locator('.film-summon .film-strip')).toHaveCount(6);
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

      const arrival = page.locator('[data-film-scene="arrival"] .film-strip');
      await expect(arrival).toHaveCount(6);
      for (const lane of await arrival.all()) {
        const box = await lane.boundingBox();
        expect(box?.x ?? -1, `lane clipped left at ${width}px`).toBeGreaterThanOrEqual(-1);
        expect(box ? box.x + box.width : width + 1, `lane clipped right at ${width}px`).toBeLessThanOrEqual(width + 1);
      }
    }
  });
});
