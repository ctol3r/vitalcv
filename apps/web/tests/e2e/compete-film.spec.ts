import { expect, test } from '@playwright/test';

/**
 * COMPETE-2 film spike — scene-boundary contract.
 *
 * These are the browser-level guards the vitest suite cannot express: the film
 * only exists after hydration, and its whole value is that it degrades. Each
 * test pins one rung of the fallback ladder in
 * docs/design/homepage-composition-ownership.md §3.
 *
 * The route is dev-gated, so this suite runs against the dev server (the
 * default e2e target) and is skipped when the harness is not reachable.
 */

const ROUTE = '/dev/compete-film';

/**
 * Scroll the film runway to a fraction of its travel and settle a frame.
 *
 * `behavior: 'instant'` is REQUIRED: the app sets `html { scroll-behavior:
 * smooth }` globally, so a plain `scrollTo` animates and the assertion samples
 * a frame mid-flight. That reads as the film being ~74px misaligned at every
 * scene boundary when it is in fact exact.
 */
async function scrubTo(page: import('@playwright/test').Page, fraction: number) {
  await page.evaluate((f) => {
    const runway = document.querySelector('.film-runway');
    if (!runway) return;
    const rect = runway.getBoundingClientRect();
    const top = window.scrollY + rect.top;
    window.scrollTo({ top: top + (rect.height - window.innerHeight) * f, behavior: 'instant' });
  }, fraction);
  await page.waitForTimeout(300);
}

const trackX = async (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const t = document.querySelector('.film-track');
    if (!t) return null;
    const m = new DOMMatrixReadOnly(getComputedStyle(t).transform);
    return Math.round(m.m41);
  });

test.describe('COMPETE-2 horizontal film', () => {
  test.beforeEach(async ({ page }) => {
    const response = await page.goto(ROUTE);
    test.skip(!response || response.status() === 404, 'film harness is not enabled here');
  });

  test('desktop: vertical scroll advances one horizontal film', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(300);

    await expect(page.locator('.film')).toHaveAttribute('data-film-mode', 'film');

    // Travel must be monotonic and leftward across the whole runway — that IS
    // the film. A flat or reversing sequence means the driver is broken.
    const samples: number[] = [];
    for (const f of [0, 0.25, 0.5, 0.75, 1]) {
      await scrubTo(page, f);
      samples.push((await trackX(page)) ?? 0);
    }
    expect(samples[0]).toBe(0);
    for (let i = 1; i < samples.length; i += 1) {
      expect(samples[i]!).toBeLessThan(samples[i - 1]!);
    }
    // One full viewport of travel per transition.
    const viewport = page.viewportSize()!.width;
    const transitions = await page.locator('[data-film-scene]').count() - 1;
    expect(samples.at(-1)!).toBeCloseTo(-viewport * transitions, -1);
  });

  test('desktop: every scene lands exactly in frame at its boundary', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(300);

    const count = await page.locator('[data-film-scene]').count();
    for (let i = 0; i < count; i += 1) {
      await scrubTo(page, i / (count - 1));
      const left = await page.evaluate((idx) => {
        const el = document.querySelectorAll('[data-film-scene]')[idx] as HTMLElement;
        return Math.round(el.getBoundingClientRect().left);
      }, i);
      // Exact, not approximate: a drifting scene is a broken film.
      expect(left).toBe(0);
    }
  });

  /**
   * Paint-order guard.
   *
   * This bug shipped TWICE: the atmosphere canvas carries `z-index: 1`, while
   * `.film-track` is a stacking context with `z-index: auto` (level 0) because
   * of `will-change: transform`. Record fragments therefore drew straight over
   * the headline.
   *
   * Two instruments were tried and REJECTED, which is why this test asserts
   * computed style instead:
   *
   *  - `document.elementFromPoint` is VACUOUS here. `.film-atmosphere` is
   *    `pointer-events: none`, so the canvas can never be the hit-test result
   *    no matter how far in front it paints. That test passed with the bug
   *    deliberately reintroduced.
   *  - A full-page screenshot diff does not separate signal from noise for
   *    this bug: measured on 2026-07-22 the regression moved 91 px while the
   *    run-to-run noise floor is 33 px, against a 0.001 ratio budget of
   *    ~1296 px. The screenshot suite catches gross regressions (copy
   *    blanking, scene drift); it cannot catch this one.
   *
   * The stacking level is the actual invariant, so assert it directly.
   */
  test('the film track paints in front of the atmosphere', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(300);

    const order = await page.evaluate(() => {
      const z = (sel: string) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const raw = getComputedStyle(el).zIndex;
        return raw === 'auto' ? 'auto' : Number(raw);
      };
      return { track: z('.film-track'), canvas: z('.film-atmosphere-canvas') };
    });

    expect(order.canvas, 'atmosphere canvas should be present in film mode').not.toBeNull();
    // `auto` is the failure mode: it paints at level 0, behind the canvas's 1.
    expect(order.track, '.film-track must declare an explicit stacking level').not.toBe('auto');
    expect(typeof order.track).toBe('number');
    expect(order.track as number).toBeGreaterThanOrEqual(order.canvas as number);
  });

  test('no scene overflows the pinned stage', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(300);

    const count = await page.locator('[data-film-scene]').count();
    for (let i = 0; i < count; i += 1) {
      await scrubTo(page, i / (count - 1));
      const overflow = await page.evaluate((idx) => {
        const el = document.querySelectorAll('[data-film-scene]')[idx] as HTMLElement;
        const stage = document.querySelector('.film-stage')!.getBoundingClientRect();
        const kids = [...el.querySelectorAll('*')]
          .map((k) => k.getBoundingClientRect())
          .filter((r) => r.height > 0);
        return Math.round(Math.max(...kids.map((k) => k.bottom)) - stage.bottom);
      }, i);
      // A pinned stage cannot scroll, so anything below the fold is lost.
      expect(overflow).toBeLessThanOrEqual(0);
    }
  });

  test('desktop: the vertical axis is never hijacked', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(300);

    // Ordinary wheel input must move the document by an ordinary amount — the
    // film translates scroll, it never captures it.
    await page.mouse.move(720, 450);
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(250);
    const afterDown = await page.evaluate(() => window.scrollY);
    expect(afterDown).toBeGreaterThan(0);

    // And it must reverse. A one-way trap is the classic scroll-jack symptom.
    await page.mouse.wheel(0, -400);
    await page.waitForTimeout(250);
    expect(await page.evaluate(() => window.scrollY)).toBeLessThan(afterDown);

    // The end of the document must be reachable — a pin that never releases
    // would leave scrollY short of the maximum forever.
    await scrubTo(page, 1);
    const { scrollY, max } = await page.evaluate(() => ({
      scrollY: Math.round(window.scrollY),
      max: Math.round(document.documentElement.scrollHeight - window.innerHeight),
    }));
    expect(scrollY).toBe(max);
  });

  test('mobile: an ordinary vertical document, no horizontal travel', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);

    await expect(page.locator('.film')).toHaveAttribute('data-film-mode', 'vertical');
    expect(await trackX(page)).toBe(0);

    // Both scenes readable, in order, with no sideways overflow.
    await expect(page.locator('[data-film-scene="arrival"]')).toBeVisible();
    await expect(page.locator('[data-film-scene="recognition"]')).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test('reduced motion: still, vertical, and no render loop', async ({ browser }) => {
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: 'reduce',
    });
    const page = await ctx.newPage();
    const response = await page.goto(ROUTE);
    test.skip(!response || response.status() === 404, 'film harness is not enabled here');
    await page.waitForTimeout(300);

    await expect(page.locator('.film')).toHaveAttribute('data-film-mode', 'vertical');
    await expect(page.locator('.film')).toHaveAttribute('data-film-tier', 'static');
    // The static tier draws no canvas at all — the poster is the whole render.
    await expect(page.locator('.film-atmosphere-canvas')).toHaveCount(0);
    await expect(page.locator('.film-atmosphere-poster')).toBeVisible();
    await ctx.close();
  });

  test('static tier: the poster carries the composition, never a blank stage', async ({ page }) => {
    await page.goto(`${ROUTE}?sceneTier=static`);
    await page.waitForTimeout(300);

    await expect(page.locator('.film-atmosphere-canvas')).toHaveCount(0);
    // Real geometry, not an empty frame.
    const rects = await page.locator('.film-atmosphere-poster rect').count();
    expect(rects).toBeGreaterThan(50);
  });

  test('canvas2d tier: the film still runs without WebGPU', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${ROUTE}?sceneTier=canvas2d`);
    await page.waitForTimeout(400);

    await expect(page.locator('.film')).toHaveAttribute('data-film-tier', 'canvas2d');
    await expect(page.locator('.film')).toHaveAttribute('data-film-mode', 'film');
    await expect(page.locator('.film-atmosphere-canvas')).toBeVisible();
  });

  test('keyboard: the NPI field is the first stop and shows a focus ring', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(300);

    await page.keyboard.press('Tab');
    await expect(page.locator('#film-npi-input')).toBeFocused();

    const outline = await page.evaluate(() => {
      const el = document.querySelector('#film-npi-input')!;
      return getComputedStyle(el).outlineStyle;
    });
    expect(outline).not.toBe('none');
  });

  test('renders nothing personal or fabricated before a lookup', async ({ page }) => {
    await page.waitForTimeout(300);
    const text = await page.locator('.film').innerText();

    // Retired mechanism R4 — no counter, no readiness percentage.
    expect(text).not.toMatch(/\d+\s*%/);
    // No fabricated clinician.
    expect(text).not.toMatch(/\bDr\.\s|\bMD\b|\bRN\b/);
    // Retired copy R7.
    expect(text).not.toContain('Find the opportunity');
    expect(text).not.toContain('VitalCV recognizes');
  });

  test('the NPI field validates locally without claiming a lookup', async ({ page }) => {
    await page.waitForTimeout(300);
    await page.locator('#film-npi-input').fill('123');
    // The hint also carries the standing "free / no account" line, so match
    // the digit counter within it rather than the whole string.
    await expect(page.locator('#film-npi-hint')).toContainText('3/10 digits');

    // A checksum-valid NPI enables submit and says nothing about the person.
    await page.locator('#film-npi-input').fill('1234567893');
    await expect(page.locator('.film-npi-submit')).toBeEnabled();
    // A checksum-INVALID full-length number is caught before any lookup.
    await page.locator('#film-npi-input').fill('1234567890');
    await expect(page.locator('.film-npi-submit')).toBeDisabled();

    // Recognition still shows no personal state until a lookup returns.
    await expect(page.locator('.film')).toContainText(
      'Nothing personal is shown until a real lookup returns',
    );
  });

  test('no graph: no nodes, edges, or drag controls anywhere (R1)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(300);

    // The atmosphere is fragments and one radial core — no strokes, no paths.
    expect(await page.locator('.film-atmosphere svg line').count()).toBe(0);
    expect(await page.locator('.film-atmosphere svg path').count()).toBe(0);
    expect(await page.locator('.film [draggable="true"]').count()).toBe(0);

    const text = await page.locator('.film').innerText();
    expect(text.toLowerCase()).not.toContain('drag to');
    expect(text.toLowerCase()).not.toContain('constellation');
  });
});
