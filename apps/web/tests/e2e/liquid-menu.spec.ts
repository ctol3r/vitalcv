import { expect, test } from '@playwright/test';

/**
 * Liquid mobile menu (VHS-2.5) — the accessible modal nav overlay. The bloom is
 * decorative; these tests pin the behaviour that must not break: it is a focus-
 * trapped, scroll-locked dialog that Escape closes and returns focus to its
 * trigger, it is mobile-only, and reduced motion drops the animation.
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
    // Focus moved into the dialog (the first destination).
    await expect(page.locator('[data-liquid-menu] a').first()).toBeFocused();
    // Background scroll is locked while open.
    expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).toBe('hidden');
    // Every required destination is present.
    for (const label of ['Home', 'For Clinicians', 'For Employers', 'Trust']) {
      await expect(dialog.getByRole('link', { name: label })).toBeVisible();
    }
    await expect(dialog.getByRole('link', { name: 'Check Readiness' })).toBeVisible();
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
    // Desktop nav is the conventional bar.
    await expect(page.getByRole('link', { name: 'For Employers' }).first()).toBeVisible();
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
