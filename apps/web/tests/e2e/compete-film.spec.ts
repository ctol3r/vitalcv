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

/** Scroll the film runway to a fraction of its travel and settle a frame. */
async function scrubTo(page: import('@playwright/test').Page, fraction: number) {
  await page.evaluate((f) => {
    const runway = document.querySelector('.film-runway');
    if (!runway) return;
    const rect = runway.getBoundingClientRect();
    const top = window.scrollY + rect.top;
    window.scrollTo(0, top + (rect.height - window.innerHeight) * f);
  }, fraction);
  await page.waitForTimeout(250);
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
    // One full viewport of travel per transition (2 scenes → 1 transition).
    expect(samples.at(-1)!).toBeLessThanOrEqual(-1400);
  });

  test('desktop: the vertical axis is never hijacked', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(300);

    // Scrolling past the end of the film must keep scrolling the document.
    await scrubTo(page, 1);
    const atEnd = await page.evaluate(() => window.scrollY);
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(atEnd);
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
    await expect(page.locator('#film-npi-hint')).toHaveText('3/10 digits');

    // A checksum-valid NPI reports only that the NUMBER is well formed.
    await page.locator('#film-npi-input').fill('1234567893');
    await expect(page.locator('#film-npi-hint')).toContainText('Checksum');
    await expect(page.locator('.film')).toContainText('does not look anything up');
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
