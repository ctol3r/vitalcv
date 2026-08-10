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

    // …while the wide rectangle and its instruments float at the reference
    // offsets. The wordmark is measured by the centre of its glyphs, because
    // the link itself is padded out to the 44px target floor.
    const wordmark = await page.locator('.vcv-eb__wordmark').boundingBox();
    expect(Math.round(wordmark!.x)).toBe(30);
    expect(Math.round(wordmark!.y + wordmark!.height / 2)).toBe(51);

    // Measured on the PAINTED boxes, not the hit areas: instruments carry 2px
    // of transparent padding to clear EC-5's 44px floor while the visible
    // geometry stays on the reference numbers.
    const lastBox = await page.locator('.vcv-eb__instr').last().boundingBox();
    expect(Math.round(lastBox!.y)).toBe(31);
    expect(Math.round(lastBox!.height)).toBe(40);
    expect(Math.round(lastBox!.x + lastBox!.width)).toBe(1440 - 30);

    await page.evaluate(() => window.scrollTo({ top: 900, behavior: 'instant' as ScrollBehavior }));
    const wordmarkAfter = await page.locator('.vcv-eb__wordmark').boundingBox();
    expect(Math.round(wordmarkAfter!.x)).toBe(30);
    expect(Math.round(wordmarkAfter!.y + wordmarkAfter!.height / 2)).toBe(51);
    const lastAfter = await page.locator('.vcv-eb__instr').last().boundingBox();
    expect(Math.round(lastAfter!.y)).toBe(31);
    expect(Math.round(lastAfter!.x + lastAfter!.width)).toBe(1440 - 30);
  });

  /**
   * Every other desktop assertion here runs at 1440 — BELOW the reference's
   * cap — which is exactly how the first rebuild shipped a chrome that kept
   * growing to the edge of a large display. The cap is invisible at 1440 by
   * construction, so it has to be measured where it bites.
   *
   * Reference, re-probed 2026-08-09 (headless, consent node removed):
   *   vp 1280 → 1260 @ x10 · 1440 → 1420 @ x10 · 1512 → 1480 @ x16
   *   vp 1728 → 1480 @ x124 · 1920 → 1480 @ x220 · 2560 → 1480 @ x540
   */
  test('the rectangle stops growing at 1480 and centres — instruments ride the band', async ({ page }) => {
    for (const width of [1512, 1728, 1920, 2560]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(brand(page)).toBeVisible();

      const shape = await page.locator('.vcv-eb__shape').boundingBox();
      expect(Math.round(shape!.width), `shape width @${width}`).toBe(1480);
      // Centred: the two side gutters are equal, not merely "inset".
      const leftGutter = Math.round(shape!.x);
      const rightGutter = Math.round(width - (shape!.x + shape!.width));
      expect(leftGutter, `left gutter @${width}`).toBe(rightGutter);
      expect(leftGutter, `band inset @${width}`).toBe(Math.round((width - 1480) / 2));

      // The instruments ride the band, not the viewport: 20px inside each edge.
      const wordmark = await page.locator('.vcv-eb__wordmark').boundingBox();
      expect(Math.round(wordmark!.x), `wordmark @${width}`).toBe(leftGutter + 20);

      const lastInstr = await page.locator('.vcv-eb__instr').last().boundingBox();
      expect(
        Math.round(width - (lastInstr!.x + lastInstr!.width)),
        `cluster right edge @${width}`,
      ).toBe(rightGutter + 20);
    }

    // Below the cap the band is the plain 10px inset it always was.
    await page.setViewportSize({ width: 1440, height: 900 });
    const uncapped = await page.locator('.vcv-eb__shape').boundingBox();
    expect(Math.round(uncapped!.x)).toBe(10);
    expect(Math.round(uncapped!.width)).toBe(1420);
  });

  test('the takeover rides the same band as the chrome above it', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1000 });
    await expect(brand(page)).toBeVisible();
    await openMenu(page);

    // Reference at 1920: columns open at 240 and the last one closes at 240.
    const cols = page.locator('.vcv-eb-menu__col');
    const count = await cols.count();
    expect(count).toBeGreaterThan(0);

    const first = await cols.first().boundingBox();
    const last = await cols.last().boundingBox();
    expect(Math.round(first!.x)).toBe(240);
    expect(Math.round(1920 - (last!.x + last!.width))).toBe(240);
  });

  test('the chrome is a wide rounded rectangle, inset and frosted, and never eats a click', async ({ page }) => {
    const shape = page.locator('.vcv-eb__shape');
    const box = await shape.boundingBox();
    expect(Math.round(box!.x)).toBe(10);
    expect(Math.round(box!.width)).toBe(1440 - 20);
    expect(Math.round(box!.y)).toBe(16);
    expect(Math.round(box!.height)).toBe(70);

    const style = await shape.evaluate((el) => {
      const c = getComputedStyle(el);
      return { radius: c.borderTopLeftRadius, backdrop: c.backdropFilter, pointer: c.pointerEvents };
    });
    expect(style.radius).toBe('10px');
    expect(style.backdrop).toContain('blur');
    // Decoration that spans the viewport must not intercept page clicks.
    expect(style.pointer).toBe('none');

    // Its geometry is as constant as the instruments': scroll changes colour,
    // never position.
    await page.evaluate(() => window.scrollTo({ top: 900, behavior: 'instant' as ScrollBehavior }));
    const after = await shape.boundingBox();
    expect(Math.round(after!.y)).toBe(16);
    expect(Math.round(after!.height)).toBe(70);

    // Every instrument sits inside it, not merely near it.
    const shapeBox = after!;
    for (const sel of ['.vcv-eb__wordmark', '.vcv-eb__cta-box', '.vcv-eb__instr']) {
      const el = await page.locator(sel).first().boundingBox();
      expect(el!.y).toBeGreaterThanOrEqual(shapeBox.y);
      expect(el!.y + el!.height).toBeLessThanOrEqual(shapeBox.y + shapeBox.height);
      expect(el!.x).toBeGreaterThanOrEqual(shapeBox.x);
    }
  });

  test('the instruments are sharp-cornered and the action is the 40px rectangle', async ({ page }) => {
    const box = await page.locator('.vcv-eb__cta-box').boundingBox();
    expect(Math.round(box!.height)).toBe(40);
    expect(box!.width).toBeGreaterThanOrEqual(205);
    const radius = await page
      .locator('.vcv-eb__cta-box')
      .evaluate((el) => getComputedStyle(el).borderRadius);
    expect(radius).toBe('0px');

    const painted = await page.locator('.vcv-eb__instr').first().boundingBox();
    expect(Math.round(painted!.width)).toBe(40);
    expect(Math.round(painted!.height)).toBe(40);

    // The two squares fuse: one shared hairline, not two adjacent borders.
    const first = await page.locator('.vcv-eb__instr').first().boundingBox();
    const second = await page.locator('.vcv-eb__instr').last().boundingBox();
    expect(Math.round(second!.x - (first!.x + first!.width))).toBe(-1);
  });

  test('every chrome control clears EC-5 44px, painted box notwithstanding', async ({ page }) => {
    // The reference's instruments are 40px; the constitution's floor is 44px.
    // The interactive element carries the floor, the painted box carries the
    // reference. Both have to hold, or the a11y baseline ratchet catches it.
    const undersized = await page.evaluate(() => {
      const header = document.querySelector('header.vcv-eb');
      if (!header) return ['no chrome'];
      return Array.from(header.querySelectorAll<HTMLElement>('a[href], button'))
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && (r.width < 44 || r.height < 44);
        })
        .map((el) => `${el.className}: ${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}`);
    });
    expect(undersized).toEqual([]);
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

  test('the rectangle goes full-bleed and square', async ({ page }) => {
    const box = await page.locator('.vcv-eb__shape').boundingBox();
    expect(Math.round(box!.x)).toBe(0);
    expect(Math.round(box!.width)).toBe(390);
    expect(Math.round(box!.y)).toBe(0);
    expect(Math.round(box!.height)).toBe(65);
    const radius = await page
      .locator('.vcv-eb__shape')
      .evaluate((el) => getComputedStyle(el).borderTopLeftRadius);
    expect(radius).toBe('0px');
  });

  test('wordmark floats up top; the controls pin to the viewport bottom', async ({ page }) => {
    const wordmark = await page.locator('.vcv-eb__wordmark').boundingBox();
    expect(Math.round(wordmark!.x)).toBe(20);
    expect(Math.round(wordmark!.y + wordmark!.height / 2)).toBe(32);

    // Painted boxes: pinned 20px above the viewport bottom, 40px tall.
    const painted = await page.locator('.vcv-eb__instr').first().boundingBox();
    expect(Math.round(painted!.y + painted!.height)).toBe(844 - 20);
    expect(Math.round(painted!.height)).toBe(40);
    // Menu and lookup sit left; the action sits right.
    const menuBox = await page.locator('.vcv-eb__menu-btn').boundingBox();
    const ctaBox = await page.locator('.vcv-eb__cta-box').boundingBox();
    expect(menuBox!.x).toBeLessThan(ctaBox!.x);
    expect(Math.round(ctaBox!.x + ctaBox!.width)).toBe(390 - 20);

    await expect(page.locator('.vcv-eb__signin')).toBeHidden();
    await expect(page.locator('.vcv-eb__cta-short')).toHaveText('Start');
  });

  test('the pinned controls hold through scroll', async ({ page }) => {
    await page.evaluate(() => window.scrollTo({ top: 1200, behavior: 'instant' as ScrollBehavior }));
    const painted = await page.locator('.vcv-eb__instr').first().boundingBox();
    expect(Math.round(painted!.y + painted!.height)).toBe(844 - 20);
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
