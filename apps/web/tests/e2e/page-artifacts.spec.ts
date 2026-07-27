import { expect, test } from '@playwright/test';

/**
 * Animated artifacts on the non-homepage public pages — e2e contracts.
 *
 * The founder mandate: "nearly all pages should have an animated visual."
 * These pin the deployment of that mandate to /employers, /trust, and
 * /pilot, and hold the same motion honesty the homepage holds: play once on
 * entry, then rest (CD-11); the base frame is complete without JS; nothing
 * moves under prefers-reduced-motion.
 */

const PAGES = [
  { path: '/employers', artifact: 'A consented packet arriving' },
  { path: '/trust', artifact: 'One claim connected to its named source' },
  { path: '/pilot', artifact: 'A timeline from accepted offer' },
] as const;

for (const { path, artifact } of PAGES) {
  test(`${path}: carries its animated artifact, which rests after entry`, async ({ page }) => {
    await page.goto(path, { waitUntil: 'domcontentloaded' });

    const figure = page.locator('.vt-artifact');
    await expect(figure).toHaveCount(1);
    const svg = figure.locator('svg.ask-art--wide');
    await expect(svg).toHaveAttribute('role', 'img');
    await expect(svg).toHaveAttribute('aria-label', new RegExp(artifact.slice(0, 24)));

    // The artifact is genuinely big — over half the content column.
    const width = await svg.evaluate((el) => el.getBoundingClientRect().width);
    expect(width, `${path} artifact width`).toBeGreaterThan(500);

    // Entry: scrolling it into view starts the sequence...
    await figure.scrollIntoViewIfNeeded();
    await expect(figure).toHaveClass(/ask-art-play/);

    // ...and after the longest sequence (step 6 ends ~2.7s) everything rests.
    await page.waitForTimeout(3400);
    const running = await page.evaluate(
      () =>
        document
          .getAnimations()
          .filter(
            (a) =>
              'animationName' in a &&
              String((a as CSSAnimation).animationName).startsWith('ask-art') &&
              a.playState === 'running',
          ).length,
    );
    expect(running, `${path}: no artifact animation may idle`).toBe(0);
  });

  test(`${path}: reduced motion keeps the complete artifact, still`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(path, { waitUntil: 'domcontentloaded' });

    const figure = page.locator('.vt-artifact');
    await figure.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);

    // The full drawing is present (base CSS is the final frame)...
    const svg = figure.locator('svg.ask-art--wide');
    const box = await svg.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThan(500);

    // ...and nothing animates.
    const animating = await page.evaluate(
      () =>
        document
          .getAnimations()
          .filter((a) => 'animationName' in a && String((a as CSSAnimation).animationName).startsWith('ask-art'))
          .length,
    );
    expect(animating, `${path}: reduced motion must disable the sequence entirely`).toBe(0);
  });
}
