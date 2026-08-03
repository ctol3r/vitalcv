import { expect, test } from '@playwright/test';

/**
 * Chrome contract — the browser keeps its native cursor. The only glass on the
 * film is its opening orientation control; evidence artifacts stay solid.
 *
 * The #1060 recovery RETIRED the pointer-tracked reading light
 * (`.film-readinglight`); the assertions that named it are gone rather than
 * re-pointed, because nothing replaced it. What the reader is owed — a native
 * cursor, an operable opening action, and evidence rendered SOLID rather than
 * as glass — is unchanged and still asserted below.
 */

test.describe('native cursor', () => {
  test('mounts no decorative pointer follower and keeps the opening action operable', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('[data-vt-cursor], .vt-cursor')).toHaveCount(0);
    // Page-wide horizontal travel is RETIRED (founder directive, 2026-08-03):
    // the document scrolls vertically and horizontal movement happens inside a
    // sticky chapter stage instead. `vertical` is therefore the correct and
    // only mode. Asserting 'film' here would be a guard enforcing doctrine that
    // was deliberately withdrawn.
    await expect(page.locator('.film')).toHaveAttribute('data-film-mode', 'vertical');

    const input = page.locator('#film-npi-input');
    await input.click();
    await expect(input).toBeFocused();
    await input.fill('1234567893');
    await expect(input).toHaveValue('1234567893');

    const primaryAction = page.locator('[data-home-primary-cta]');
    await expect(primaryAction).toBeVisible();
    await expect(primaryAction).toBeEnabled();
  });

  test('pointer movement never replaces the native cursor', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/', { waitUntil: 'networkidle' });
    // Page-wide horizontal travel is RETIRED (founder directive, 2026-08-03):
    // the document scrolls vertically and horizontal movement happens inside a
    // sticky chapter stage instead. `vertical` is therefore the correct and
    // only mode. Asserting 'film' here would be a guard enforcing doctrine that
    // was deliberately withdrawn.
    await expect(page.locator('.film')).toHaveAttribute('data-film-mode', 'vertical');

    await page.locator('.film-stage').hover({ position: { x: 900, y: 480 } });

    await expect(page.locator('[data-vt-cursor], .vt-cursor')).toHaveCount(0);
    // RETIRED: `.film-readinglight` visible — no pointer-tracked light exists.
  });

  test('reduced motion has no alternate cursor implementation', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await page.mouse.move(400, 300);
    await expect(page.locator('[data-vt-cursor], .vt-cursor')).toHaveCount(0);
    // RETIRED: `.film-readinglight` count 0 — see the file header.
    await expect(page.locator('#film-npi-input')).toBeVisible();
  });
});

test.describe('glass surfaces and movement', () => {
  test('the opening eyebrow expands its orientation cue when explicitly opened', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // #1060 resolved the duplicate eyebrow implementations onto the design-system
    // component: the wrapper is `.film-ask-eyebrow`, the hydration guard is a
    // BARE `data-hydrated` attribute (not `="true"`), and the detail is a plain
    // div addressed through the trigger's `aria-controls` rather than by class.
    // The guard is load-bearing, not cosmetic — without it the detail would be
    // present-but-invisible for every no-JS reader, so it is still asserted.
    const eyebrow = page.getByRole('button', { name: /for clinicians/i });
    await expect(page.locator('.film-ask-eyebrow')).toHaveAttribute('data-hydrated', '');

    const detailId = await eyebrow.getAttribute('aria-controls');
    expect(detailId, 'the eyebrow trigger must name the detail it controls').toBeTruthy();
    const detail = page.locator(`[id="${detailId}"]`);

    await expect(eyebrow).toHaveAttribute('aria-expanded', 'false');
    await expect(detail).toHaveCSS('opacity', '0');

    // The reveal is asserted on BOTH explicit paths instead of on `click()`.
    // The design-system eyebrow opens on hover as well as on focus, and
    // Playwright's `click()` hovers first — so the pointer opened it and the
    // click then TOGGLED IT SHUT, which is why the old one-line click stopped
    // proving anything. Pointer first, then keyboard.
    await eyebrow.hover();
    await expect(eyebrow).toHaveAttribute('aria-expanded', 'true');
    await expect(detail).toHaveText(
      'Your number, what the sources returned, what you release, and who decides.',
    );
    await expect(detail).toHaveCSS('opacity', '1');

    // Move the pointer off and confirm it rests closed again, so the keyboard
    // check below cannot pass on a leftover hover state.
    await page.mouse.move(0, 0);
    await expect(eyebrow).toHaveAttribute('aria-expanded', 'false');

    // Keyboard alone must reveal the cue — the detail is enrichment, never the
    // only carrier of the orientation it holds (CD-2.3).
    await eyebrow.focus();
    await expect(eyebrow).toHaveAttribute('aria-expanded', 'true');
    await expect(detail).toHaveCSS('opacity', '1');
  });

  test('natural scroll translates the evidence panes and leaves source artifacts solid', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/', { waitUntil: 'networkidle' });

    const film = page.locator('.film');
    await expect(film).toHaveAttribute('data-film-mode', 'vertical'); // page-wide travel retired 2026-08-03

    const track = page.locator('.film-track');
    const firstTransform = await track.evaluate((element) => getComputedStyle(element).transform);
    await page.evaluate(() => window.scrollTo({ top: window.innerHeight * 2 }));
    await expect.poll(() => track.evaluate((element) => getComputedStyle(element).transform)).not.toBe(firstTransform);

    // `.film-record` is gone; the evidence artifacts are now the `.film-summon`
    // record with its `.film-strip` lanes, and the `.evidence-capsule` faces.
    // The ruling is unchanged — glass on chrome, SOLID on evidence — so this
    // asserts it across every one of them rather than a single container.
    const record = page.locator('.film-summon');
    await expect(record).toBeAttached();
    const glassy = await page.evaluate(() =>
      [...document.querySelectorAll('.film-summon, .film-strip, .evidence-capsule')]
        .filter((element) => (getComputedStyle(element).backdropFilter || 'none') !== 'none')
        .map((element) => (element.className?.toString() ?? '').split(/\s+/)[0]),
    );
    expect(glassy, 'evidence artifacts must never render as glass').toEqual([]);
  });
});
