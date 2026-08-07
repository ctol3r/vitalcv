import { expect, test } from '@playwright/test';

/**
 * Liquid mobile menu — the mobile navigation recomposition (VHS-2.5,
 * rebuilt by the 2026-08-06 shared-header wave). The bloom is decorative;
 * these tests pin the behaviour that must not break: it is a focus-trapped,
 * scroll-locked full-screen dialog that Escape closes and returns focus to
 * its trigger, it carries the journey rail plus every destination group
 * from the single navDestinations source, it is mobile-only, and reduced
 * motion drops the animation.
 */

test.describe('liquid mobile menu', () => {
  test('opens as a focus-trapped, scroll-locked dialog and Escape returns focus', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/', { waitUntil: 'networkidle' });

    const toggle = page.getByRole('button', { name: 'Open menu' });
    await expect(toggle).toBeVisible();
    await toggle.click();

    const dialog = page.locator('[data-liquid-menu]');
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    // Focus moved into the dialog (the brand link leads the panel).
    await expect(page.locator('.liquid-menu__panel a').first()).toBeFocused();
    // Background scroll is locked while open.
    expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).toBe('hidden');
    // The journey rail is present, vertical, with the current stage marked.
    await expect(dialog.locator('.vcv-rail--overlay')).toBeVisible();
    await expect(dialog.locator('[data-rail-state="active"]')).toHaveText(/Your Number/);
    // Every destination group from the single source is present.
    await expect(dialog.locator('.liquid-menu__group')).toHaveCount(3);
    for (const label of ['Build your profile', 'For employers', 'Source attribution']) {
      await expect(dialog.getByRole('link', { name: label })).toBeVisible();
    }
    // The CTA pair: Sign In plus the one contextual action.
    await expect(dialog.getByRole('link', { name: 'Build my profile' })).toBeVisible();
    await expect(dialog.getByRole('link', { name: 'Sign In' })).toBeVisible();

    // Escape closes, restores scroll, and returns focus to the trigger.
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe('hidden');
    await expect(page.getByRole('button', { name: 'Open menu' })).toBeFocused();
  });

  test('is mobile-only — the toggle is hidden on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/', { waitUntil: 'networkidle' });
    await expect(page.getByRole('button', { name: 'Open menu' })).toBeHidden();
    // Desktop carries the journey rail and the canvas trigger instead of a
    // row of category links.
    await expect(page.locator('.vcv-rail--bar')).toBeVisible();
    await expect(page.locator('.vcv-header__trigger')).toBeVisible();
  });

  test('reduced motion drops the bloom animation', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Open menu' }).click();
    const panel = page.locator('.liquid-menu__panel');
    await expect(panel).toBeVisible();
    const anim = await panel.evaluate((n) => getComputedStyle(n).animationName);
    expect(anim).toBe('none');
  });
});
