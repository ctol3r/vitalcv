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
type Page = import('@playwright/test').Page;

const active = (page: Page) =>
  page.locator('[data-story-rail]').getAttribute('data-rail-active');

// Chapter count and per-id indices are READ FROM THE DOM, never hardcoded.
// This spec used to pin `5 // last of six chapters`, `#matcha is index 2` and
// `toHaveCount(6)` — all inherited from a harness that hardcoded six chapters
// including `evidence` and `recognition`, neither of which exists in the
// shipped four-chapter journey. The harness now renders JOURNEY_CHAPTERS, so
// literals here would just relocate the same drift into the test.
const chapterCount = (page: Page) => page.locator('[data-rail-chapter]').count();

const chapterIndex = (page: Page, id: string) =>
  page.evaluate((chapterId) => {
    const ids = [...document.querySelectorAll('[data-rail-chapter]')].map((el) =>
      el.getAttribute('data-rail-chapter-id'),
    );
    return ids.indexOf(chapterId);
  }, id);

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
    expect(Number(await active(page))).toBe((await chapterCount(page)) - 1);

    await expect(page.locator('#rail-end')).toBeVisible();
  });

  test('deep link scrolls to the target chapter', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${URL}#matcha`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    const matcha = await chapterIndex(page, 'matcha');
    expect(matcha, 'the matcha chapter must exist to deep-link to it').toBeGreaterThanOrEqual(0);
    expect(Number(await active(page))).toBe(matcha);
  });

  test('keyboard focus pulls an off-screen chapter into the pin', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(URL, { waitUntil: 'networkidle' });

    await page.locator('[data-chapter-cta="apply"]').focus();
    await page.waitForTimeout(600);
    expect(Number(await active(page))).toBe(await chapterIndex(page, 'apply'));
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
    // The invariant that matters is not a magic number — it is that the
    // fallback carries the SAME chapters as the pinned rail, in DOM order.
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(URL, { waitUntil: 'networkidle' });
    const pinnedCount = await chapterCount(page);
    expect(pinnedCount).toBeGreaterThan(0);

    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto(URL, { waitUntil: 'networkidle' });
    const rail = page.locator('[data-story-rail]');
    await expect(rail).toHaveAttribute('data-rail-pinned', 'false');
    await expect(page.locator('[data-rail-chapter]')).toHaveCount(pinnedCount);
    await expect(page.locator('.story-rail-track')).toHaveCount(0);
  });

  test('reduced motion falls back to the vertical stack', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(URL, { waitUntil: 'networkidle' });
    await expect(page.locator('[data-story-rail]')).toHaveAttribute('data-rail-pinned', 'false');
  });
});
