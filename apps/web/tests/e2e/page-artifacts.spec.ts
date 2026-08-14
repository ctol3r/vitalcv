import { expect, test } from '@playwright/test';

/**
 * Animated artifacts on the non-homepage public pages — e2e contracts.
 *
 * The founder mandate: "nearly all pages should have an animated visual."
 * These pin the deployment of that mandate to the public routes that still
 * mount AskVitalCV SVG artifacts, and hold the same motion honesty the
 * homepage holds: play once on entry, then rest (CD-11); the base frame is
 * complete without JS; nothing moves under prefers-reduced-motion.
 */

/**
 * A page may carry MORE than one artifact, so each entry names the artifact it
 * is asserting by aria-label rather than assuming the page has exactly one,
 * and the rest-check below covers every artifact on the page. WO-15 replaces
 * the employers elevation with manifest-owned documentary and tactile scenes;
 * their static/motion contract is covered by employers-experience.spec.ts.
 * WO-16 does the same for /pilot through the activation_path VisualScene; its
 * static, reduced-motion, and no-JS contract lives in
 * activation-path-experience.spec.ts.
 */
const PAGES = [
  { path: '/employers/how-it-works', artifact: 'A consented packet arriving' },
  { path: '/trust', artifact: 'One claim connected to its named source' },
  { path: '/matcha/experience', artifact: 'A drawn clinician beside the record' },
  { path: '/matcha/experience', artifact: 'Six medical specialties drawn at equal weight' },
] as const;

/**
 * The longest sequence. Step 10 starts at 4060ms and runs 480ms; the clinician's
 * travel trace starts at 3050ms and runs 900ms. 5600ms clears both with room —
 * a too-short wait here reads as "an animation is idling" when in fact it had
 * simply not finished, which is the kind of flake that gets a gate disabled.
 */
const REST_AFTER_MS = 5600;

for (const { path, artifact } of PAGES) {
  test(`${path}: ${artifact.slice(0, 32)}… plays, then rests`, async ({ page }) => {
    await page.goto(path, { waitUntil: 'domcontentloaded' });

    const svg = page.locator(
      `svg.ask-art--wide[aria-label*="${artifact.slice(0, 24)}"]`,
    );
    await expect(svg).toHaveCount(1);
    await expect(svg).toHaveAttribute('role', 'img');
    const figure = page.locator('.vt-artifact').filter({ has: svg });

    // The artifact is genuinely big — over half the content column.
    await svg.scrollIntoViewIfNeeded();
    const width = await svg.evaluate((el) => el.getBoundingClientRect().width);
    expect(width, `${path} artifact width`).toBeGreaterThan(500);

    // Entry: scrolling it into view starts the sequence...
    await expect(figure.first()).toHaveClass(/ask-art-play/);

    // ...and once the longest sequence has run, EVERY artifact on the page
    // rests. Checked page-wide, not just for this one: a second artifact that
    // idled would be just as much a CD-11 breach.
    await page.waitForTimeout(REST_AFTER_MS);
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

  test(`${path}: ${artifact.slice(0, 32)}… stays complete under reduced motion`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(path, { waitUntil: 'domcontentloaded' });

    const svg = page.locator(
      `svg.ask-art--wide[aria-label*="${artifact.slice(0, 24)}"]`,
    );
    await svg.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);

    // The full drawing is present (base CSS is the final frame)...
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
