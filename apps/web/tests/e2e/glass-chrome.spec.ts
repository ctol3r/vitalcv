import { expect, test } from '@playwright/test';

/**
 * Chrome contract — the browser keeps its native cursor. The only glass on the
 * film is its opening orientation control; evidence artifacts stay solid.
 */

test.describe('native cursor', () => {
  test('mounts no decorative pointer follower and keeps the opening action operable', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('[data-vt-cursor], .vt-cursor')).toHaveCount(0);
    await expect(page.locator('.film')).toHaveAttribute('data-film-mode', 'film');

    const input = page.locator('#film-npi-input');
    await input.click();
    await expect(input).toBeFocused();
    await input.fill('1234567893');
    await expect(input).toHaveValue('1234567893');

    const primaryAction = page.locator('[data-home-primary-cta]');
    await expect(primaryAction).toBeVisible();
    await expect(primaryAction).toBeEnabled();
  });

  test('pointer movement lights the film without replacing the native cursor', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/', { waitUntil: 'networkidle' });
    await expect(page.locator('.film')).toHaveAttribute('data-film-mode', 'film');

    await page.locator('.film-stage').hover({ position: { x: 900, y: 480 } });

    await expect(page.locator('[data-vt-cursor], .vt-cursor')).toHaveCount(0);
    await expect(page.locator('.film-readinglight')).toBeVisible();
  });

  test('reduced motion has no alternate cursor implementation', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await page.mouse.move(400, 300);
    await expect(page.locator('[data-vt-cursor], .vt-cursor')).toHaveCount(0);
    await expect(page.locator('.film-readinglight')).toHaveCount(0);
    await expect(page.locator('#film-npi-input')).toBeVisible();
  });
});

test.describe('glass surfaces and movement', () => {
  test('the opening eyebrow expands its orientation cue when explicitly opened', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const eyebrow = page.getByRole('button', { name: /for clinicians/i });
    const detail = page.locator('.ask-eyebrow__detail');
    await expect(page.locator('.ask-eyebrow--expandable')).toHaveAttribute('data-hydrated', 'true');
    await expect(eyebrow).toHaveAttribute('aria-expanded', 'false');
    await expect(detail).toHaveCSS('opacity', '0');

    await eyebrow.click();

    await expect(eyebrow).toHaveAttribute('aria-expanded', 'true');
    await expect(detail).toHaveText('Scroll to move through the evidence.');
    await expect(detail).toHaveCSS('opacity', '1');
  });

  test('natural scroll translates the evidence panes and leaves source artifacts solid', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/', { waitUntil: 'networkidle' });

    const film = page.locator('.film');
    await expect(film).toHaveAttribute('data-film-mode', 'film');

    const track = page.locator('.film-track');
    const firstTransform = await track.evaluate((element) => getComputedStyle(element).transform);
    await page.evaluate(() => window.scrollTo({ top: window.innerHeight * 2 }));
    await expect.poll(() => track.evaluate((element) => getComputedStyle(element).transform)).not.toBe(firstTransform);

    const panel = page.locator('.film-record');
    await expect(panel).toBeAttached();
    expect(await panel.evaluate((element) => getComputedStyle(element).backdropFilter || 'none')).toBe('none');
  });
});
