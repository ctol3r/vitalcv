import { expect, test, type TestInfo } from '@playwright/test';

const viewports = [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'tablet', width: 1024, height: 768 },
  { name: 'mobile', width: 390, height: 844 },
] as const;

const publicSurfaces = [
  // `marketing`, not `focused-form`: /employers stopped being a form page.
  // It opened with an NPI input and a disabled button — setup before the buyer
  // had been given a reason — and now leads with the outcome beside the packet
  // a buyer receives, with the claim form demoted to a step below. This entry
  // records DECLARED INTENT, so it is the right thing to change when the intent
  // genuinely changes; what it must never do is drift silently.
  { name: 'employers', path: '/employers', mode: 'marketing', action: true },
  { name: 'cvo', path: '/for/cvo', mode: 'marketing', action: true },
  { name: 'trust', path: '/trust', mode: 'marketing', action: false },
  { name: 'status', path: '/status', mode: 'marketing', action: false },
] as const;

async function attachViewport(testInfo: TestInfo, name: string, body: Buffer) {
  await testInfo.attach(`density-${name}`, { body, contentType: 'image/png' });
}

test.describe('Intentional page density', () => {
  for (const viewport of viewports) {
    for (const surface of publicSurfaces) {
      test(`${surface.name} uses the ${surface.mode} frame at ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
        await page.setViewportSize(viewport);
        await page.goto(surface.path, { waitUntil: 'networkidle' });

        const frame = page.locator(`[data-page-density="${surface.mode}"]`).first();
        await expect(frame).toBeVisible();

        const heading = page.getByRole('heading', { level: 1 }).first();
        await expect(heading).toBeVisible();
        const headingBox = await heading.boundingBox();
        expect(headingBox, 'primary heading must have a layout box').not.toBeNull();
        expect(headingBox!.y, 'primary purpose must begin in the opening viewport').toBeLessThan(viewport.height * 0.72);

        if (surface.action) {
          const action = frame.locator('a[href], button, input:not([type="hidden"])').first();
          await expect(action).toBeVisible();
          const actionBox = await action.boundingBox();
          expect(actionBox, 'primary action must have a layout box').not.toBeNull();
          expect(actionBox!.y, 'primary action must remain near the opening viewport').toBeLessThan(viewport.height * 1.1);
        }

        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow, 'page must not overflow horizontally').toBeLessThanOrEqual(1);

        const screenshot = await page.screenshot({ animations: 'disabled' });
        await attachViewport(testInfo, `${surface.name}-${viewport.name}`, screenshot);
      });
    }
  }

  /**
   * Samples the mode the page ACTUALLY serves.
   *
   * This read `[data-page-density="focused-form"]` on `/employers`, which was
   * the only route in that mode. When the page moved to `marketing` the
   * selector matched nothing and the test failed with "element(s) not found" —
   * not because the token contract broke, but because the guard was pinned to
   * a route rather than to the thing it verifies.
   *
   * `focused-form` now has ZERO consumers. Its tokens are still defined in
   * page-density.css, so the mode is dead code rather than a broken contract —
   * worth deleting, but not silently inside a redesign PR.
   */
  test('density modes expose deliberate width, gutter, and rhythm tokens', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/employers', { waitUntil: 'networkidle' });

    const tokens = await page.locator('[data-page-density="marketing"]').evaluate((node) => {
      const style = getComputedStyle(node);
      return {
        maxWidth: style.maxWidth,
        paddingLeft: style.paddingLeft,
        block: style.getPropertyValue('--vcv-page-block').trim(),
        sectionGap: style.getPropertyValue('--vcv-page-section-gap').trim(),
        cardGap: style.getPropertyValue('--vcv-page-card-gap').trim(),
      };
    });

    // marketing: --vcv-page-max: 82.5rem
    expect(tokens.maxWidth).toBe('1320px');
    expect(Number.parseFloat(tokens.paddingLeft)).toBeGreaterThanOrEqual(16);
    expect(tokens.block).not.toBe('');
    expect(tokens.sectionGap).not.toBe('');
    expect(tokens.cardGap).not.toBe('');
  });
});
