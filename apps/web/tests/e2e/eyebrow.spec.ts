import { expect, test, type Page } from '@playwright/test';

/**
 * The UX-V1 architectural eyebrow (shared public chrome).
 *
 * Pins the browser-measured half of the contract the unit suite cannot see:
 * the constant 64px geometry across scroll, the dark→light inversion over
 * the homepage's light employer band, the full-takeover menu's modality, the
 * 56px mobile recomposition, and reduced-motion behavior. Runs in the
 * default (easy) project — the chrome must hold on the shipping homepage.
 */

const eyebrow = (page: Page) => page.locator('header.vcv-eb');

/**
 * Open-the-menu interactions click-and-poll, clicking only while collapsed —
 * a bare retry-click would TOGGLE an already-open takeover straight back
 * shut, and a single pre-hydration click is silently lost (the repo's known
 * fill()-races-hydration failure mode).
 */
async function openMenu(page: Page) {
  const trigger = page.locator('.vcv-eb__menu-btn');
  await expect(async () => {
    if ((await trigger.getAttribute('aria-expanded')) !== 'true') {
      await trigger.click();
    }
    await expect(page.locator('#vcv-eb-menu')).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 15000 });
}

async function scrollToLightBand(page: Page) {
  await page.evaluate(() => {
    const el = document.querySelector('.ezh-emp');
    if (!el) throw new Error('missing .ezh-emp light band');
    window.scrollTo({
      top: el.getBoundingClientRect().top + window.scrollY + 200,
      behavior: 'instant' as ScrollBehavior,
    });
  });
}

test.describe('eyebrow — desktop', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await expect(eyebrow(page)).toBeVisible();
  });

  test('is a constant 64px instrument — geometry identical before and after scroll', async ({ page }) => {
    const before = await eyebrow(page).boundingBox();
    expect(before).not.toBeNull();
    expect(Math.round(before!.height)).toBe(64);
    expect(Math.round(before!.y)).toBe(0);
    expect(Math.round(before!.width)).toBe(1440);

    await page.evaluate(() => window.scrollTo({ top: 900, behavior: 'instant' as ScrollBehavior }));
    const after = await eyebrow(page).boundingBox();
    expect(Math.round(after!.height)).toBe(64);
    expect(Math.round(after!.y)).toBe(0);
    expect(Math.round(after!.width)).toBe(1440);
  });

  test('rests dark on the homepage and inverts over the light employer band', async ({ page }) => {
    await expect(eyebrow(page)).toHaveAttribute('data-eb-theme', 'dark');
    await scrollToLightBand(page);
    await expect(eyebrow(page)).toHaveAttribute('data-eb-theme', 'light', { timeout: 10000 });
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }));
    await expect(eyebrow(page)).toHaveAttribute('data-eb-theme', 'dark', { timeout: 10000 });
  });

  test('carries one quiet sign-in and one dominant action pointing at the real entry', async ({ page }) => {
    await expect(eyebrow(page).locator('a[href="/sign-in"]')).toHaveCount(1);
    const cta = eyebrow(page).locator('.vcv-eb__cta');
    await expect(cta).toHaveCount(1);
    await expect(cta).toHaveAttribute('href', '/#npi');
  });

  test('the takeover menu is modal: scroll locks, Escape closes, focus returns', async ({ page }) => {
    await openMenu(page);
    const menu = page.locator('#vcv-eb-menu');
    await expect(menu).toHaveAttribute('aria-modal', 'true');
    await expect
      .poll(() => page.evaluate(() => document.body.style.overflow))
      .toBe('hidden');

    // Tab stays inside the takeover.
    for (let i = 0; i < 15; i += 1) {
      await page.keyboard.press('Tab');
      const inside = await page.evaluate(() =>
        Boolean(document.activeElement?.closest('#vcv-eb-menu')),
      );
      expect(inside).toBe(true);
    }

    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
    await expect
      .poll(() => page.evaluate(() => document.body.style.overflow))
      .toBe('');
    const focused = await page.evaluate(() =>
      document.activeElement?.className ?? '',
    );
    expect(focused).toContain('vcv-eb__menu-btn');
  });

  test('the menu lists the complete navigation registry in large type', async ({ page }) => {
    await openMenu(page);
    const menu = page.locator('#vcv-eb-menu');
    for (const label of ['Clinicians', 'Employers', 'Trust']) {
      await expect(menu.getByText(label, { exact: true })).toBeVisible();
    }
    // W1079 swapped the clinician group's jobs destination from
    // /opportunities/discover — a redirect alias into the CLINICIAN-protected
    // /holder tree, which walled every signed-out visitor at sign-in — to
    // /explore, the public board written for exactly that reader.
    for (const href of ['/onboarding', '/explore', '/employers', '/pricing', '/trust', '/status', '/trust/attribution', '/evidence-network']) {
      await expect(menu.locator(`a[href="${href}"]`)).toHaveCount(1);
    }
    await expect(menu.locator('a[href="/opportunities/discover"]')).toHaveCount(0);
  });

  test('narrates the work surface, then settles back to the static label', async ({ page }) => {
    const ticker = page.locator('.vcv-eb__ticker');
    await expect(ticker).toBeVisible();
    // The surface plays on load; the ticker leaves the static label…
    await expect
      .poll(async () => ticker.textContent(), { timeout: 15000 })
      .not.toBe('How VitalCV works');
    // …and returns to it once the story completes.
    await expect
      .poll(async () => ticker.textContent(), { timeout: 20000 })
      .toBe('How VitalCV works');
  });
});

test.describe('eyebrow — off-homepage register', () => {
  test('defaults light with a route cue, not a horizontal destination row', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    // Pricing is a stable public off-home route for this shared-chrome contract.
    await page.goto('/pricing');
    await expect(eyebrow(page)).toBeVisible();
    await expect(eyebrow(page)).toHaveAttribute('data-eb-theme', 'light');
    await expect(eyebrow(page).locator('.vcv-eb__context')).toHaveText(
      'Your profile, ready for every move',
    );
    await expect(eyebrow(page).locator('.vcv-eb__navlink')).toHaveCount(0);
    await expect(eyebrow(page).locator('nav[aria-label="Primary"]')).toHaveCount(0);
    await expect(page.locator('footer nav a[href="/trust"]')).toHaveCount(1);
    await expect(page.locator('footer nav a[href="/status"]')).toHaveCount(1);
  });

  test('suppresses the dominant action on its own destination', async ({ page }) => {
    await page.goto('/employers');
    await expect(eyebrow(page)).toBeVisible();
    await expect(eyebrow(page).locator('.vcv-eb__cta')).toHaveCount(0);
  });
});

test.describe('eyebrow — mobile recomposition', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(eyebrow(page)).toBeVisible();
  });

  test('recomposes at 56px: wordmark + Start + menu box, no ticker, no sign-in', async ({ page }) => {
    const box = await eyebrow(page).boundingBox();
    expect(Math.round(box!.height)).toBe(56);
    await expect(page.locator('.vcv-eb__ticker')).toBeHidden();
    await expect(page.locator('.vcv-eb__signin')).toBeHidden();
    await expect(page.locator('.vcv-eb__cta-short')).toHaveText('Start');
    await expect(page.locator('.vcv-eb__menu-btn')).toBeVisible();
  });

  test('the takeover works on mobile', async ({ page }) => {
    await openMenu(page);
    await expect(page.locator('#vcv-eb-menu')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#vcv-eb-menu')).toHaveCount(0);
  });

  test('no horizontal overflow', async ({ page }) => {
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe('eyebrow — reduced motion', () => {
  // page.emulateMedia rather than test.use: with this config the context
  // option is not honored (@playwright/test 1.58.2), the CDP call is.
  test('the ticker holds the static label', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(eyebrow(page)).toBeVisible();
    const ticker = page.locator('.vcv-eb__ticker');
    await expect(ticker).toHaveText('How VitalCV works');
    // Give any stray timeline a beat to prove it stays put.
    await page.waitForTimeout(1500);
    await expect(ticker).toHaveText('How VitalCV works');
  });
});
