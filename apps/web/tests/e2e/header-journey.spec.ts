import { expect, test, type Page } from '@playwright/test';

/**
 * The scene-aware journey header (FR-6, shared-header wave 2026-08-06).
 *
 * Pins the behaviors the wave requires: transparent resting header, the
 * compact scrolled surface, stage transitions as the narrative sections
 * enter the observation band, dark/light inversion over the declared rooms,
 * the expanded navigation canvas, the mobile full-screen overlay, keyboard
 * navigation, and no horizontal overflow. Runs in the default (career-loop)
 * project — the shared chrome must hold on the shipping homepage, not only
 * in the film rollback.
 */

const header = (page: Page) => page.locator('header.vcv-header');
const plate = (page: Page) => page.locator('.vcv-header__plate');

/**
 * Deterministic hydration probe. The header's sentinel IntersectionObserver
 * registers only after React attaches, so `data-nav-lifted` appearing on a
 * 2px scroll is a real "the component is listening" signal — unlike a bare
 * click, which pre-hydration is silently lost (the repo's known
 * fill()-races-hydration failure mode).
 */
async function waitForHeaderHydration(page: Page) {
  const el = header(page);
  await page.evaluate(() => window.scrollTo({ top: 2, behavior: 'instant' as ScrollBehavior }));
  await expect(el).toHaveAttribute('data-nav-lifted', '', { timeout: 20000 });
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }));
  await expect(el).not.toHaveAttribute('data-nav-lifted', '', { timeout: 20000 });
}

/**
 * Open-the-canvas interactions still click-and-poll on top of the hydration
 * probe, clicking only while collapsed — a bare retry-click would TOGGLE an
 * already-open canvas straight back shut.
 */
async function openCanvas(page: Page) {
  const trigger = page.locator('.vcv-header__trigger');
  await expect(async () => {
    if ((await trigger.getAttribute('aria-expanded')) !== 'true') {
      await trigger.click();
    }
    await expect(page.locator('#vcv-header-menu')).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 15000 });
}

async function scrollToSection(page: Page, id: string) {
  await page.evaluate((sectionId) => {
    const el = document.getElementById(sectionId);
    if (!el) throw new Error(`missing #${sectionId}`);
    window.scrollTo({
      top: el.getBoundingClientRect().top + window.scrollY + 160,
      behavior: 'instant' as ScrollBehavior,
    });
  }, id);
}

test.describe('journey header — desktop', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await expect(header(page)).toBeVisible();
    await waitForHeaderHydration(page);
  });

  test('rests transparent with the journey rail centered and Your Number active', async ({ page }) => {
    await expect(header(page)).not.toHaveAttribute('data-nav-lifted');
    // Poll: the hydration probe's scroll leaves a 300ms fade-out settling.
    await expect
      .poll(async () => plate(page).evaluate((el) => getComputedStyle(el).backgroundColor))
      .toMatch(/rgba\(0, 0, 0, 0\)|\/ 0\)$/);

    const rail = page.locator('.vcv-rail--bar');
    await expect(rail).toBeVisible();
    await expect(rail.locator('[data-rail-state="active"]')).toHaveText(/Your Number/);
    await expect(
      rail.locator('[data-rail-state="active"] .vcv-rail__stage'),
    ).toHaveAttribute('aria-current', 'step');
    // The rail is honest anchor navigation on the homepage.
    await expect(rail.locator('a[href="/#sources"]')).toHaveCount(1);
  });

  test('earns its surface on scroll without layout shift', async ({ page }) => {
    const heightBefore = await header(page).evaluate((el) => el.getBoundingClientRect().height);
    await page.evaluate(() => window.scrollTo({ top: 400, behavior: 'instant' as ScrollBehavior }));
    await expect(header(page)).toHaveAttribute('data-nav-lifted', '');
    await expect
      .poll(async () => plate(page).evaluate((el) => getComputedStyle(el).backgroundColor))
      .not.toMatch(/rgba\(0, 0, 0, 0\)|\/ 0\)$/);
    const heightAfter = await header(page).evaluate((el) => el.getBoundingClientRect().height);
    expect(heightAfter).toBe(heightBefore);
  });

  test('follows the narrative: stage and theme change with the declared sections', async ({ page }) => {
    await scrollToSection(page, 'sources');
    await expect(header(page)).toHaveAttribute('data-header-stage', 'sources');
    await expect(header(page)).toHaveAttribute('data-header-theme', 'dark');

    await scrollToSection(page, 'permission');
    await expect(header(page)).toHaveAttribute('data-header-stage', 'permission');
    await expect(header(page)).toHaveAttribute('data-header-theme', 'dark');

    await scrollToSection(page, 'review');
    await expect(header(page)).toHaveAttribute('data-header-stage', 'review');
    await expect(header(page)).toHaveAttribute('data-header-theme', 'light');

    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }));
    await expect(header(page)).toHaveAttribute('data-header-stage', 'your-number');
  });

  test('inverts to the warm-ink treatment over a dark room', async ({ page }) => {
    await scrollToSection(page, 'sources');
    await expect(header(page)).toHaveAttribute('data-header-theme', 'dark');
    await expect
      .poll(async () =>
        plate(page).evaluate((el) => {
          const bg = getComputedStyle(el).backgroundColor;
          const m = bg.match(/oklab\((\d*\.?\d+)/);
          return m ? parseFloat(m[1]) : 1;
        }),
      )
      // Lightness well under paper: the plate resolved to ink, not cream.
      .toBeLessThan(0.5);
  });

  test('opens the navigation canvas; Escape closes it and returns focus', async ({ page }) => {
    const trigger = page.locator('.vcv-header__trigger');
    await openCanvas(page);
    const canvas = page.locator('#vcv-header-menu');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    // Every destination group is present in one panel.
    await expect(canvas.locator('.vcv-menu__group')).toHaveCount(3);
    // The canvas restates the journey beside the destinations.
    await expect(canvas.locator('.vcv-rail--overlay')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(canvas).toBeHidden();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger).toBeFocused();
  });

  test('closes the canvas on outside interaction', async ({ page }) => {
    await openCanvas(page);
    await page.mouse.click(720, 700);
    await expect(page.locator('#vcv-header-menu')).toBeHidden();
  });

  test('is keyboard navigable: rail and canvas destinations reachable by Tab', async ({ page }) => {
    // Retry the walk from the top until hydration is listening.
    await expect(async () => {
      await page.locator('.vcv-header__wordmark').focus();
      await page.keyboard.press('Tab');
      await expect(page.locator('.vcv-rail--bar a').first()).toBeFocused({ timeout: 500 });
    }).toPass({ timeout: 15000 });
    // Through the rail to the controls.
    for (let i = 0; i < 4; i++) await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Sign In' })).toBeFocused();
    // Open the canvas from the keyboard and reach a destination.
    await expect(async () => {
      await page.locator('.vcv-header__trigger').focus();
      await page.keyboard.press('Enter');
      await expect(page.locator('#vcv-header-menu')).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 15000 });
    await page.keyboard.press('Tab');
    const inCanvas = await page.evaluate(
      () => !!document.activeElement?.closest('#vcv-header-menu'),
    );
    expect(inCanvas).toBe(true);
  });

  test('no horizontal overflow with the rail and canvas present', async ({ page }) => {
    await openCanvas(page);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe('journey header — route context', () => {
  test('employer surface: Review stage, no bar CTA, indicator-only rail', async ({ page }) => {
    await page.goto('/employers');
    await expect(header(page)).toHaveAttribute('data-header-stage', 'review');
    await expect(page.locator('.vcv-header__cta')).toHaveCount(0);
    const activeTag = await page
      .locator('.vcv-rail--bar [data-rail-state="active"] .vcv-rail__stage')
      .evaluate((el) => el.tagName);
    expect(activeTag).toBe('SPAN');
  });

  test('trust surface: Sources stage with the clinician action', async ({ page }) => {
    await page.goto('/trust');
    await expect(header(page)).toHaveAttribute('data-header-stage', 'sources');
    await expect(page.locator('.vcv-header__cta')).toHaveText('Build my profile');
  });

  test('the evidence-network destination now renders the shared chrome', async ({ page }) => {
    await page.goto('/evidence-network');
    await expect(header(page)).toBeVisible();
  });
});

test.describe('journey header — mobile', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await waitForHeaderHydration(page);
  });

  test('keeps the current stage visible in the compact bar', async ({ page }) => {
    await expect(page.locator('.vcv-header__stage')).toHaveText('Your Number');
  });

  test('opens a full-screen journey-first overlay with modal semantics', async ({ page }) => {
    await page.getByRole('button', { name: 'Open menu' }).click();
    const dialog = page.locator('[data-liquid-menu]');
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    // Full-screen, not an inset card.
    const panelBox = await page.locator('.liquid-menu__panel').boundingBox();
    expect(panelBox!.width).toBeGreaterThanOrEqual(389);
    // Journey first, then every destination group.
    await expect(dialog.locator('.vcv-rail--overlay')).toBeVisible();
    await expect(dialog.locator('.liquid-menu__group')).toHaveCount(3);
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
    await expect(page.getByRole('button', { name: 'Open menu' })).toBeFocused();
  });

  test('no horizontal overflow on mobile', async ({ page }) => {
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe('journey header — reduced motion', () => {
  test('every treatment resolves immediately; hierarchy survives', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    // House convention: durations collapse to 0.01ms, effectively immediate.
    const duration = await plate(page).evaluate(
      (el) => getComputedStyle(el).transitionDuration,
    );
    expect(parseFloat(duration)).toBeLessThanOrEqual(0.001);
    // The rail still communicates the full hierarchy.
    const rail = page.locator('.vcv-rail--bar');
    await expect(rail.locator('[data-rail-state="active"]')).toHaveText(/Your Number/);
    await expect(rail.locator('li')).toHaveCount(4);
  });
});
