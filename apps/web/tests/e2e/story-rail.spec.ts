import { expect, test } from '@playwright/test';

// SHD-3.1 horizontal story rail — verified through the dev harness
// (/dev/story-rail). The rail is a desktop enhancement over a vertical
// fallback; these tests pin both modes and the never-trap-scroll contract.
//
// NOTE on scrolling: the app pins html/body with `overflow: clip`, so
// `page.evaluate(() => window.scrollBy(...))` is a no-op. Real input gestures
// (page.mouse.wheel) and app-initiated smooth scrolls DO move the window —
// which is exactly the never-trap-scroll behavior we want. Tests use real
// wheel gestures and read the deterministic `data-rail-active` the driver
// writes each frame.

const URL = '/dev/story-rail';
const active = (page: import('@playwright/test').Page) =>
  page.locator('[data-story-rail]').getAttribute('data-rail-active');

test.describe('horizontal story rail (SHD-3.1)', () => {
  test('pins on eligible desktop and translates chapters horizontally on scroll', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(URL, { waitUntil: 'networkidle' });

    const rail = page.locator('[data-story-rail]');
    await expect(rail).toHaveAttribute('data-rail-pinned', 'true');

    const track = page.locator('.story-rail-track');
    const before = await track.evaluate((el) => getComputedStyle(el).transform);

    await page.mouse.move(700, 450);
    await page.mouse.wheel(0, 1600);
    await page.waitForTimeout(150);

    const after = await track.evaluate((el) => getComputedStyle(el).transform);
    expect(after).not.toBe(before);
    expect(Number(await active(page))).toBeGreaterThan(0);
  });

  test('reaching the runway end lands the final chapter, and the footer is past it', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(URL, { waitUntil: 'networkidle' });

    await page.mouse.move(700, 450);
    // Wheel well past the runway travel (~4500px) so progress clamps to 1.
    for (let i = 0; i < 6; i++) await page.mouse.wheel(0, 1500);
    await page.waitForTimeout(200);
    expect(Number(await active(page))).toBe(5); // last of six chapters

    await expect(page.locator('#rail-end')).toBeVisible();
  });

  test('deep link scrolls to the target chapter', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${URL}#matcha`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    expect(Number(await active(page))).toBe(2); // #matcha is index 2
  });

  test('keyboard focus pulls an off-screen chapter into the pin', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(URL, { waitUntil: 'networkidle' });

    await page.locator('[data-chapter-cta="apply"]').focus();
    await page.waitForTimeout(600);
    expect(Number(await active(page))).toBe(3); // apply is index 3
  });

  test('skip-story control is keyboard-reachable and lands past the rail', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(URL, { waitUntil: 'networkidle' });
    const skip = page.locator('[data-rail-skip]');
    await skip.focus();
    await expect(skip).toBeFocused();
    await skip.click();
    await page.waitForTimeout(300);
    await expect(page.locator('#rail-end')).toBeInViewport();
  });

  test('narrow viewport falls back to a vertical stack (no pin, no transform)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto(URL, { waitUntil: 'networkidle' });
    const rail = page.locator('[data-story-rail]');
    await expect(rail).toHaveAttribute('data-rail-pinned', 'false');
    await expect(page.locator('[data-rail-chapter]')).toHaveCount(6);
    await expect(page.locator('.story-rail-track')).toHaveCount(0);
  });

  test('reduced motion falls back to the vertical stack', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(URL, { waitUntil: 'networkidle' });
    await expect(page.locator('[data-story-rail]')).toHaveAttribute('data-rail-pinned', 'false');
  });
});
