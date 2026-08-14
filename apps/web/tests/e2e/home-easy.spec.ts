import { expect, test, type Page } from '@playwright/test';

/**
 * The UX-V1 homepage in a real browser.
 *
 * Pins what renderToStaticMarkup cannot: the record assembly never hides its
 * content, the reduced-motion static frame is annotated and complete, the
 * real NPI entry validates locally and is
 * keyboard-reachable, and the composition holds without horizontal overflow
 * across six viewports.
 *
 * Live registry resolution deliberately has NO spec here — the e2e server is
 * backend-deterministic, and the resolution path is exercised against
 * production during deploy verification instead.
 */

const surface = (page: Page) => page.locator('[data-home-work-surface]');

test.describe('home — the Easy Button hero', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
  });

  test('one h1, and it is the record-first thesis', async ({ page }) => {
    const h1 = page.locator('h1');
    await expect(h1).toHaveCount(1);
    await expect(h1).toContainText('Your career record,');
    await expect(h1).toContainText('ready when work moves.');
  });

  test('the hero never blocks: copy, entry, and surface are visible together on load', async ({ page }) => {
    await expect(page.locator('[data-home-hero]')).toBeVisible();
    await expect(page.locator('#ezh-npi')).toBeVisible();
    await expect(page.locator('[data-home-primary-cta]')).toBeVisible();
    await expect(surface(page)).toBeVisible();
  });

  test('the record is complete and visible before its optional assembly settles', async ({ page }) => {
    await expect(surface(page).locator('.ezh-watch-row')).toHaveCount(4);
    await expect(surface(page).getByText('Source-backed', { exact: true })).toBeVisible();
    await expect(surface(page).getByText('Access required', { exact: true })).toBeVisible();
    await expect
      .poll(async () => surface(page).getAttribute('data-motion'), { timeout: 5000 })
      .toBe('assembling');
  });

  test('the NPI entry validates locally and states progress honestly', async ({ page }) => {
    const input = page.locator('#ezh-npi');
    await expect(page.getByText('0/10 digits')).toBeVisible();
    // Type-and-poll: a pre-hydration fill is silently lost.
    await expect(async () => {
      await input.fill('123');
      await expect(page.getByText('3/10 digits')).toBeVisible({ timeout: 1500 });
    }).toPass({ timeout: 15000 });
    await page.locator('[data-home-primary-cta]').click();
    await expect(page.getByText(/An NPI is 10 digits/)).toBeVisible();
  });

  test('the NPI action is keyboard-reachable from the top of the document', async ({ page }) => {
    await page.keyboard.press('Tab'); // skip link
    let reached = false;
    for (let i = 0; i < 25; i += 1) {
      await page.keyboard.press('Tab');
      const id = await page.evaluate(() => document.activeElement?.id ?? '');
      if (id === 'ezh-npi') {
        reached = true;
        break;
      }
    }
    expect(reached).toBe(true);
  });

  test('the employer doorway is subordinate: after the clinician action, quiet, and real', async ({ page }) => {
    const employer = page.locator('[data-home-employer-cta]');
    await expect(employer).toHaveAttribute('href', '/employers');
    const order = await page.evaluate(() => {
      const primary = document.querySelector('[data-home-primary-cta]');
      const emp = document.querySelector('[data-home-employer-cta]');
      if (!primary || !emp) return false;
      return Boolean(primary.compareDocumentPosition(emp) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    expect(order).toBe(true);
  });

  test('the final action returns to the real entry', async ({ page }) => {
    await expect(page.locator('.ezh-start-cta')).toHaveAttribute('href', '#npi');
  });

  test('the first action uses the approved 8px control radius', async ({ page }) => {
    await expect(page.locator('[data-home-primary-cta]')).toHaveCSS('border-top-left-radius', '8px');
  });
});

test.describe('home — layout integrity across viewports', () => {
  for (const [width, height] of [
    [1728, 1000],
    [1440, 900],
    [1280, 832],
    [1024, 768],
    [768, 1024],
    [390, 844],
  ] as const) {
    test(`no horizontal overflow at ${width}×${height}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto('/');
      await expect(page.locator('[data-home-hero]')).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
      // scrollWidth is blind when an ancestor hides overflow-x — a clipped
      // page measures "no overflow" while the CTA hangs off screen. Assert
      // the interactive elements actually END inside the viewport.
      for (const selector of ['#ezh-npi', '[data-home-primary-cta]', '[data-home-work-surface]']) {
        const box = await page.locator(selector).boundingBox();
        expect(box, `${selector} missing at ${width}`).not.toBeNull();
        expect(
          box!.x + box!.width,
          `${selector} clipped past the ${width}px viewport`,
        ).toBeLessThanOrEqual(width + 1);
      }
    });
  }
});

test.describe('home — reduced motion', () => {
  // page.emulateMedia rather than test.use: with this config the context
  // option is not honored (@playwright/test 1.58.2), the CDP call is.
  test('the static frame is complete, annotated, and loses no meaning', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(surface(page)).toHaveAttribute('data-motion', 'static');
    await expect(surface(page).getByText('Identity', { exact: true })).toBeVisible();
    await expect(surface(page).getByText('Needs your review', { exact: true })).toBeVisible();
    await expect(surface(page).locator('.ezh-rm-legend')).toBeVisible();
  });
});
