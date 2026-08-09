import { expect, test, type Page } from '@playwright/test';

/**
 * The floating-chrome eyebrow (shared public chrome, palantir-grammar
 * rebuild).
 *
 * Pins the browser-measured half of the contract the unit suite cannot see:
 * the zero-height sticky group whose instruments hold constant positions
 * across scroll (wordmark at the 30px gutter, controls 30px from the top and
 * right edges), the dark→light inversion over the homepage's light employer
 * band, the full-takeover menu's modality below the live chrome, the mobile
 * recomposition (wordmark up top, controls pinned to the viewport bottom),
 * and reduced-motion behavior. Runs in the default (easy) project — the
 * chrome must hold on the shipping homepage.
 */

const eyebrow = (page: Page) => page.locator('header.vcv-eb');
const brand = (page: Page) => page.locator('.vcv-eb__brand');
const controls = (page: Page) => page.locator('.vcv-eb__controls');

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
    await expect(brand(page)).toBeVisible();
  });

  test('is a zero-height floating group — instrument positions identical before and after scroll', async ({ page }) => {
    // The group itself takes no layout space…
    const group = await eyebrow(page).boundingBox();
    expect(group).not.toBeNull();
    expect(Math.round(group!.height)).toBe(0);
    expect(Math.round(group!.y)).toBe(0);

    // …while its instruments float at the reference offsets.
    const wordmark = await page.locator('.vcv-eb__wordmark').boundingBox();
    expect(Math.round(wordmark!.x)).toBe(30);
    expect(Math.round(wordmark!.y)).toBe(30);

    const cluster = await controls(page).boundingBox();
    expect(Math.round(cluster!.y)).toBe(30);
    expect(Math.round(cluster!.height)).toBe(40);
    expect(Math.round(cluster!.x + cluster!.width)).toBe(1440 - 30);

    await page.evaluate(() => window.scrollTo({ top: 900, behavior: 'instant' as ScrollBehavior }));
    const wordmarkAfter = await page.locator('.vcv-eb__wordmark').boundingBox();
    expect(Math.round(wordmarkAfter!.x)).toBe(30);
    expect(Math.round(wordmarkAfter!.y)).toBe(30);
    const clusterAfter = await controls(page).boundingBox();
    expect(Math.round(clusterAfter!.y)).toBe(30);
    expect(Math.round(clusterAfter!.x + clusterAfter!.width)).toBe(1440 - 30);
  });

  test('the instruments are sharp-cornered and the action is the 40px rectangle', async ({ page }) => {
    const cta = page.locator('.vcv-eb__cta');
    const box = await cta.boundingBox();
    expect(Math.round(box!.height)).toBe(40);
    expect(box!.width).toBeGreaterThanOrEqual(205);
    const radius = await cta.evaluate((el) => getComputedStyle(el).borderRadius);
    expect(radius).toBe('0px');

    const icon = page.locator('.vcv-eb__icon-btn').first();
    const iconBox = await icon.boundingBox();
    expect(Math.round(iconBox!.width)).toBe(40);
    expect(Math.round(iconBox!.height)).toBe(40);
  });

  test('rests dark on the homepage and inverts over the light employer band', async ({ page }) => {
    await expect(eyebrow(page)).toHaveAttribute('data-eb-theme', 'dark');
    await scrollToLightBand(page);
    await expect(eyebrow(page)).toHaveAttribute('data-eb-theme', 'light', { timeout: 10000 });
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }));
    await expect(eyebrow(page)).toHaveAttribute('data-eb-theme', 'dark', { timeout: 10000 });
  });

  test('carries one quiet sign-in, one dominant action, and the real lookup', async ({ page }) => {
    await expect(eyebrow(page).locator('a[href="/sign-in"]')).toHaveCount(1);
    const cta = eyebrow(page).locator('.vcv-eb__cta');
    await expect(cta).toHaveCount(1);
    await expect(cta).toHaveAttribute('href', '/#npi');
    await expect(eyebrow(page).locator('.vcv-eb__lookup')).toHaveAttribute('href', '/verify');
  });

  test('carries no center content — no ticker, no route cue, no link row', async ({ page }) => {
    await expect(page.locator('.vcv-eb__ticker')).toHaveCount(0);
    await expect(page.locator('.vcv-eb__context')).toHaveCount(0);
    await expect(page.locator('.vcv-eb__navlink')).toHaveCount(0);
    await expect(page.locator('nav[aria-label="Primary"]')).toHaveCount(0);
  });

  test('the takeover menu is modal below the live chrome: scroll locks, Escape closes, focus returns', async ({ page }) => {
    await openMenu(page);
    const menu = page.locator('#vcv-eb-menu');
    await expect(menu).toHaveAttribute('aria-modal', 'true');
    await expect
      .poll(() => page.evaluate(() => document.body.style.overflow))
      .toBe('hidden');

    // The chrome stays live over the takeover: the trap spans the header,
    // so Tab cycles through menu destinations AND the floating instruments.
    for (let i = 0; i < 15; i += 1) {
      await page.keyboard.press('Tab');
      const inside = await page.evaluate(() =>
        Boolean(document.activeElement?.closest('header.vcv-eb')),
      );
      expect(inside).toBe(true);
    }

    // While open, the chrome holds the dark register and the toggle reads
    // as the close control.
    await expect(eyebrow(page)).toHaveAttribute('data-eb-theme', 'dark');
    await expect(page.locator('.vcv-eb__menu-btn')).toHaveAttribute('aria-label', 'Close menu');

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
    // Column heads specifically: "Trust" is both a register label and a
    // destination, so a bare text match is ambiguous by construction.
    for (const label of ['Clinicians', 'Employers', 'Trust']) {
      await expect(
        menu.locator('.vcv-eb-menu__label', { hasText: new RegExp(`^${label}$`) }),
      ).toBeVisible();
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
});

test.describe('eyebrow — off-homepage register', () => {
  test('defaults light with the spacer, never a horizontal destination row', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    // Pricing is a stable public off-home route for this shared-chrome contract.
    await page.goto('/pricing');
    await expect(brand(page)).toBeVisible();
    await expect(eyebrow(page)).toHaveAttribute('data-eb-theme', 'light');
    // Off-home compositions sit below the floating instruments.
    const spacer = await page.locator('.vcv-eb__space').boundingBox();
    expect(Math.round(spacer!.height)).toBe(104);
    await expect(page.locator('.vcv-eb__navlink')).toHaveCount(0);
    await expect(page.locator('nav[aria-label="Primary"]')).toHaveCount(0);
    await expect(page.locator('footer nav a[href="/trust"]')).toHaveCount(1);
    await expect(page.locator('footer nav a[href="/status"]')).toHaveCount(1);
  });

  test('suppresses the dominant action on its own destination', async ({ page }) => {
    await page.goto('/employers');
    await expect(brand(page)).toBeVisible();
    await expect(eyebrow(page).locator('.vcv-eb__cta')).toHaveCount(0);
  });
});

test.describe('eyebrow — mobile recomposition', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(brand(page)).toBeVisible();
  });

  test('wordmark floats up top; the controls pin to the viewport bottom', async ({ page }) => {
    const wordmark = await page.locator('.vcv-eb__wordmark').boundingBox();
    expect(Math.round(wordmark!.x)).toBe(20);
    expect(Math.round(wordmark!.y)).toBe(20);

    const cluster = await controls(page).boundingBox();
    // Pinned 20px above the viewport bottom, 40px tall.
    expect(Math.round(cluster!.y + cluster!.height)).toBe(844 - 20);
    expect(Math.round(cluster!.height)).toBe(40);
    // Menu and lookup sit left; the action sits right.
    const menuBox = await page.locator('.vcv-eb__menu-btn').boundingBox();
    const ctaBox = await page.locator('.vcv-eb__cta').boundingBox();
    expect(menuBox!.x).toBeLessThan(ctaBox!.x);
    expect(Math.round(ctaBox!.x + ctaBox!.width)).toBe(390 - 20);

    await expect(page.locator('.vcv-eb__signin')).toBeHidden();
    await expect(page.locator('.vcv-eb__cta-short')).toHaveText('Start');
  });

  test('the pinned controls hold through scroll', async ({ page }) => {
    await page.evaluate(() => window.scrollTo({ top: 1200, behavior: 'instant' as ScrollBehavior }));
    const cluster = await controls(page).boundingBox();
    expect(Math.round(cluster!.y + cluster!.height)).toBe(844 - 20);
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
  test('the chrome is complete without motion and the takeover opens readable', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(brand(page)).toBeVisible();
    await expect(controls(page)).toBeVisible();
    await openMenu(page);
    await expect(page.locator('#vcv-eb-menu')).toBeVisible();
    await expect(
      page.locator('.vcv-eb-menu__link-label').first(),
    ).toBeVisible();
  });
});
