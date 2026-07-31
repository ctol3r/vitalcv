import { expect, test } from '@playwright/test';

/**
 * Chrome contract — VitalCV uses the native operating-system/browser cursor.
 * Glass is reserved for one illustrative packet surface; eyebrows and real
 * evidence remain solid.
 */

test.describe('native cursor', () => {
  test('mounts no decorative pointer follower and keeps controls directly operable', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('[data-vt-cursor], .vt-cursor')).toHaveCount(0);

    const input = page.locator('#npi-input');
    await input.click();
    await expect(input).toBeFocused();
    await input.fill('1003000126');
    await expect(input).toHaveValue('1003000126');

    const primaryAction = page.locator('[data-home-primary-cta]');
    await expect(primaryAction).toBeVisible();
    await expect(primaryAction).toBeEnabled();
  });

  test('pointer movement creates no tracking element', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    for (const point of [
      [40, 40],
      [400, 300],
      [900, 600],
    ] as const) {
      await page.mouse.move(point[0], point[1]);
    }

    await expect(page.locator('[data-vt-cursor], .vt-cursor')).toHaveCount(0);
  });

  test('reduced motion needs no alternate cursor implementation', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await page.mouse.move(400, 300);
    await page.mouse.move(420, 320);
    await expect(page.locator('[data-vt-cursor], .vt-cursor')).toHaveCount(0);
    await expect(page.locator('#npi-input')).toBeVisible();
  });
});

test.describe('glass surfaces', () => {
  test('eyebrows are plain type — no plate, per the Palantir reference', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    for (const selector of ['.ask-eyebrow', '.spine-eyebrow']) {
      const style = await page
        .locator(selector)
        .first()
        .evaluate((el) => {
          const cs = getComputedStyle(el);
          return {
            backdrop: cs.backdropFilter || 'none',
            bg: cs.backgroundColor,
            borderWidth: cs.borderTopWidth,
            radius: cs.borderTopLeftRadius,
          };
        });
      expect(style.backdrop, `${selector} must carry no glass`).toBe('none');
      expect(style.bg, `${selector} must have no plate`).toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
      expect(style.borderWidth).toBe('0px');
      expect(style.radius).toBe('0px');
    }
  });

  test('glass is spent on the packet handoff, not on every spine surface', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const glassed = page.locator('.vt-artifact--glass');
    await expect(glassed).toHaveCount(1);
    await expect(glassed).toHaveAttribute('data-ask-artifact', 'packet');
    const backdrop = await glassed.evaluate(
      (el) => getComputedStyle(el).backdropFilter || 'none',
    );
    expect(backdrop).toContain('blur');

    for (const kind of ['checkrun', 'once']) {
      const element = page.locator(`[data-ask-artifact="${kind}"]`);
      await expect(element).toBeAttached();
      const elementBackdrop = await element.evaluate(
        (el) => getComputedStyle(el).backdropFilter || 'none',
      );
      expect(elementBackdrop, `${kind} must remain solid`).toBe('none');
    }
  });

  test('the four-step product spine is legible in order', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const steps = await page.locator('.spine-tab').allInnerTexts();
    expect(steps).toHaveLength(4);
    expect(steps[0]).toMatch(/Step 1[\s\S]*NPI/i);
    expect(steps[1]).toMatch(/Step 2[\s\S]*Source evidence/i);
    expect(steps[2]).toMatch(/Step 3[\s\S]*packet/i);
    expect(steps[3]).toMatch(/Step 4[\s\S]*Hospital review/i);
  });

  test('real evidence surfaces stay solid — no glass on the ledger or inspector', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    expect(await page.locator('[data-home-lane-ledger].vt-artifact--glass').count()).toBe(0);
    expect(await page.locator('[data-ask-artifact="once"].vt-artifact--glass').count()).toBe(0);
    expect(await page.locator('.vt-artifact--glass [data-proof-packet-inspector]').count()).toBe(0);
    const ledgerBackdrop = await page
      .locator('[data-home-lane-ledger]')
      .evaluate((el) => getComputedStyle(el).backdropFilter || 'none');
    expect(ledgerBackdrop).toBe('none');
  });
});
