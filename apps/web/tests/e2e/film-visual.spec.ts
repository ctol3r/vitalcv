import { existsSync } from 'node:fs';

import { expect, test, type Page } from '@playwright/test';

/**
 * DG-18.3 — visual-regression matrix, scoped to the horizontal film.
 *
 * WHAT THIS CATCHES — AND WHAT IT DOES NOT. Two bugs shipped in this
 * composition that no DOM assertion could see: a `z-index: -1` scrim that
 * pushed the copy behind the whole scene, and an atmosphere canvas that
 * painted *over* the headline. `getComputedStyle` reported the text visible at
 * opacity 1 with a correct box in both cases.
 *
 * These baselines catch the FIRST class — gross regressions where content
 * blanks, shifts, or grows an edge. They do NOT catch the second. Measured
 * 2026-07-22: reintroducing the paint-order bug moved 91 px, while the
 * run-to-run noise floor is 33 px, against a 0.001 ratio budget of ~1296 px.
 * Signal and noise overlap, so no threshold separates them. Paint order is
 * asserted directly instead — see `compete-film.spec.ts`, "the film track
 * paints in front of the atmosphere". Do not widen this suite's remit on the
 * assumption that a screenshot sees everything a person would.
 *
 * DETERMINISM. The atmosphere drifts continuously, so a naive screenshot is
 * flaky by construction. `?filmFreeze=1` renders one frame at time 0 — the
 * same frame the static tier and the SSR poster draw — so the capture is a
 * real frame of the composition, not a special test-only rendering path.
 * Reduced motion is deliberately NOT used to stabilise the film: it resolves
 * the static tier, which disables the film entirely and would silently
 * baseline the vertical fallback instead.
 *
 * MASKING. Dynamic content is masked by the `data-vr-mask` attribute, never by
 * pixel coordinate, and never silently mocked. The film carries no timestamps
 * today, so the mask list is empty here — the helper exists so matrix routes
 * with freshness stamps can adopt it without inventing a second convention.
 *
 * BASELINES ARE PER-PLATFORM. Playwright tags them (`-chromium-darwin`,
 * `-chromium-linux`), so macOS and CI baselines coexist rather than fight.
 * CI runs ubuntu-latest; generate its set with the `Visual Baselines`
 * workflow (workflow_dispatch) and commit the artifact. Until then this suite
 * skips on that platform — see `requireBaseline` below.
 */

const ROUTE = '/dev/compete-film?filmFreeze=1';

/** DG-18.3 thresholds. */
const SHOT = {
  maxDiffPixelRatio: 0.001,
  animations: 'disabled',
} as const;

/** Elements whose content legitimately changes between runs. */
const maskOf = (page: Page) => page.locator('[data-vr-mask]');

/**
 * Skip when this platform has no baselines yet, instead of failing.
 *
 * Playwright names baselines per platform (`-chromium-darwin`,
 * `-chromium-linux`). Baselines generated on a developer's macOS machine are
 * useless to the ubuntu CI runner — font rasterisation differs — and a missing
 * baseline is a hard failure in CI mode, which would turn the whole e2e job
 * red for a suite that has simply never been generated there.
 *
 * So the suite ARMS ITSELF: it skips while its platform baselines are absent
 * and enforces the moment they exist. Generate them with the
 * `Visual Baselines` workflow (workflow_dispatch) and commit the artifact.
 *
 * This is deliberately not `if (CI) skip` — once Linux baselines land, CI
 * enforces with no further change.
 */
function requireBaseline(name: string) {
  const path = test.info().snapshotPath(name);
  test.skip(
    !existsSync(path),
    `no baseline for this platform yet (${path.split('/').pop()}) — run the Visual Baselines workflow`,
  );
}

async function settle(page: Page) {
  // Fonts must be resolved or the first capture bakes in a fallback face.
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
}

async function scrubTo(page: Page, fraction: number) {
  await page.evaluate((f) => {
    const runway = document.querySelector('.film-runway');
    if (!runway) return;
    const rect = runway.getBoundingClientRect();
    const top = window.scrollY + rect.top;
    // `instant` is required — the app sets html { scroll-behavior: smooth },
    // so a plain scrollTo captures a frame mid-animation.
    window.scrollTo({ top: top + (rect.height - window.innerHeight) * f, behavior: 'instant' });
  }, fraction);
  await page.waitForTimeout(300);
}

test.describe('DG-18.3 film visual regression', () => {
  test.beforeEach(async ({ page }) => {
    const response = await page.goto(ROUTE);
    test.skip(!response || response.status() === 404, 'film harness is not enabled here');
  });

  test('desktop 1440×900 — every scene boundary', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await settle(page);
    await expect(page.locator('.film')).toHaveAttribute('data-film-mode', 'film');

    const scenes = await page.locator('[data-film-scene]').evaluateAll((els) =>
      els.map((e) => (e as HTMLElement).dataset.filmScene ?? 'unknown'),
    );

    for (let i = 0; i < scenes.length; i += 1) {
      await scrubTo(page, i / (scenes.length - 1));
      requireBaseline(`film-desktop-${i}-${scenes[i]}.png`);
      await expect(page).toHaveScreenshot(`film-desktop-${i}-${scenes[i]}.png`, {
        ...SHOT,
        mask: [maskOf(page)],
      });
    }
  });

  test('desktop — mid-transition frame', async ({ page }) => {
    // The crossfade is where kinetic type and the atmosphere overlap most, and
    // therefore where a paint-order regression shows first.
    await page.setViewportSize({ width: 1440, height: 900 });
    await settle(page);
    await scrubTo(page, 0.12);
    requireBaseline('film-desktop-mid-transition.png');
    await expect(page).toHaveScreenshot('film-desktop-mid-transition.png', {
      ...SHOT,
      mask: [maskOf(page)],
    });
  });

  test('tablet 768×1024 — vertical composition', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await settle(page);
    await expect(page.locator('.film')).toHaveAttribute('data-film-mode', 'vertical');
    requireBaseline('film-tablet-vertical.png');
    await expect(page).toHaveScreenshot('film-tablet-vertical.png', {
      ...SHOT,
      fullPage: false,
      mask: [maskOf(page)],
    });
  });

  test('mobile 360×740 — vertical composition', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await settle(page);
    await expect(page.locator('.film')).toHaveAttribute('data-film-mode', 'vertical');
    requireBaseline('film-mobile-vertical.png');
    await expect(page).toHaveScreenshot('film-mobile-vertical.png', {
      ...SHOT,
      fullPage: false,
      mask: [maskOf(page)],
    });
  });

  test('static tier — the poster carries the composition', async ({ page }) => {
    await page.goto('/dev/compete-film?sceneTier=static');
    await page.setViewportSize({ width: 1440, height: 900 });
    await settle(page);
    await expect(page.locator('.film-atmosphere-canvas')).toHaveCount(0);
    requireBaseline('film-tier-static.png');
    await expect(page).toHaveScreenshot('film-tier-static.png', {
      ...SHOT,
      mask: [maskOf(page)],
    });
  });
});

test.describe('DG-18.3 film visual regression — reduced motion', () => {
  /**
   * An explicitly-constructed context, NOT `test.use({ reducedMotion })`.
   * With `test.use` the emulation did not reach the page — the film stayed in
   * `film` mode on the `webgpu` tier, i.e. the capture would have baselined the
   * FULL film while claiming to be the reduced-motion fallback. That is worse
   * than no baseline: a green test asserting the opposite of what it says.
   */
  test('reduced motion — still, vertical, readable', async ({ browser, baseURL }) => {
    const context = await browser.newContext({
      reducedMotion: 'reduce',
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();
    const response = await page.goto(`${baseURL ?? ''}/dev/compete-film`);
    test.skip(!response || response.status() === 404, 'film harness is not enabled here');
    await settle(page);

    // Reduced motion must resolve the static tier, which disables the film.
    await expect(page.locator('.film')).toHaveAttribute('data-film-mode', 'vertical');
    await expect(page.locator('.film')).toHaveAttribute('data-film-tier', 'static');
    requireBaseline('film-reduced-motion.png');
    await expect(page).toHaveScreenshot('film-reduced-motion.png', {
      ...SHOT,
      mask: [maskOf(page)],
    });
    await context.close();
  });
});
