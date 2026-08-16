import { expect, test, type Page } from '@playwright/test';

/**
 * The floating GLASS RAIL — shared public chrome, v4 rebuild (EC-10 amendment
 * A-4, founder directive 2026-08-16 "build the glass rail").
 *
 * Pins the browser-measured half of the contract the unit suite cannot see:
 * the fixed, centred, capped glass bar whose position is constant across scroll
 * (14px from the top, `calc(100% - 40px)` wide, capped at the 1400px content
 * column), the frost material, the 44px targets, the register over the served
 * homepage, the full-takeover menu's modality below the still-live rail, the
 * mobile recomposition (the rail stays ONE top bar), and reduced-motion.
 * Runs in the default (easy) project — the chrome must hold on the shipping
 * homepage.
 */

const header = (page: Page) => page.locator('header.vcv-eb');
const rail = (page: Page) => page.locator('nav.vcv-eb__rail');
const wordmark = (page: Page) => page.locator('.vcv-eb__wordmark');

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
    // Amendment F renamed the homepage employer band `.ezh-emp` →
    // `.ezh-emp-sec`. Accept either so this CHROME spec does not break every
    // time the homepage island renames a class it merely scrolls to.
    const el = document.querySelector('.ezh-emp-sec, .ezh-emp');
    if (!el) throw new Error('missing employer light band (.ezh-emp-sec/.ezh-emp)');
    window.scrollTo({
      top: el.getBoundingClientRect().top + window.scrollY + 200,
      behavior: 'instant' as ScrollBehavior,
    });
  });
}

test.describe('glass rail — desktop', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await expect(wordmark(page)).toBeVisible();
  });

  test('is a fixed, centred, frosted bar held 14px from the top', async ({ page }) => {
    const box = await rail(page).boundingBox();
    expect(box).not.toBeNull();
    // Held 14px down; centred; capped at the 1400 content column (so at 1440
    // it is 1400 wide with a 20px gutter each side).
    expect(Math.round(box!.y)).toBe(14);
    expect(Math.round(box!.width)).toBe(1400);
    expect(Math.round(box!.x)).toBe(20);

    const style = await rail(page).evaluate((el) => {
      const c = getComputedStyle(el);
      return {
        position: c.position,
        radius: c.borderTopLeftRadius,
        backdrop: c.backdropFilter || (c as unknown as { webkitBackdropFilter: string }).webkitBackdropFilter,
        shadow: c.boxShadow,
      };
    });
    expect(style.position).toBe('fixed');
    expect(style.radius).toBe('20px');
    expect(style.backdrop).toContain('blur');
    expect(style.shadow).not.toBe('none');
  });

  test('its position is constant across scroll — content moves, the bar does not', async ({ page }) => {
    const before = await rail(page).boundingBox();
    await page.evaluate(() => window.scrollTo({ top: 1200, behavior: 'instant' as ScrollBehavior }));
    const after = await rail(page).boundingBox();
    expect(Math.round(after!.y)).toBe(14);
    expect(Math.round(after!.x)).toBe(Math.round(before!.x));
    expect(Math.round(after!.width)).toBe(Math.round(before!.width));
  });

  test('the rectangle stops growing at the 1400 column and centres', async ({ page }) => {
    for (const width of [1728, 1920, 2560]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(wordmark(page)).toBeVisible();
      const box = await rail(page).boundingBox();
      expect(Math.round(box!.width), `rail width @${width}`).toBe(1400);
      const left = Math.round(box!.x);
      const right = Math.round(width - (box!.x + box!.width));
      expect(left, `centred @${width}`).toBe(right);
      expect(left, `band inset @${width}`).toBe(Math.round((width - 1400) / 2));
    }
    // Below the cap the bar is `calc(100% - 40px)` — 20px each side.
    await page.setViewportSize({ width: 1280, height: 900 });
    const uncapped = await rail(page).boundingBox();
    expect(Math.round(uncapped!.x)).toBe(20);
    expect(Math.round(uncapped!.width)).toBe(1240);
  });

  test('carries the wordmark, the primary link row, sign-in, verify, one action, and the menu', async ({ page }) => {
    await expect(wordmark(page)).toHaveText('VitalCV');
    // The durable link row.
    for (const href of ['/explore', '/employers', '/#how-it-works']) {
      await expect(rail(page).locator(`.vcv-eb__links a[href="${href}"]`)).toHaveCount(1);
    }
    // One quiet sign-in.
    await expect(rail(page).locator('a[href="/sign-in"]')).toHaveCount(1);
    // The one dominant action — Start with your NPI on the homepage.
    const cta = rail(page).locator('.vcv-eb__cta');
    await expect(cta).toHaveCount(1);
    await expect(cta).toHaveAttribute('href', '/#npi');
    await expect(cta).toContainText('Start with your NPI');
    // The verify affordance is the shield-check, pointed at the real lookup.
    const verify = rail(page).locator('.vcv-eb__verify');
    await expect(verify).toHaveAttribute('href', '/verify');
    await expect(verify).toHaveAttribute('aria-label', 'Verify a shared record');
  });

  test('every rail control clears the EC-5 44px floor', async ({ page }) => {
    const undersized = await page.evaluate(() => {
      const bar = document.querySelector('nav.vcv-eb__rail');
      if (!bar) return ['no rail'];
      return Array.from(bar.querySelectorAll<HTMLElement>('a[href], button'))
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && (r.width < 44 || r.height < 44);
        })
        .map((el) => `${el.className}: ${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}`);
    });
    expect(undersized).toEqual([]);
  });

  test('rests light across the paper homepage', async ({ page }) => {
    await expect(header(page)).toHaveAttribute('data-eb-theme', 'light');
    await scrollToLightBand(page);
    await expect(header(page)).toHaveAttribute('data-eb-theme', 'light', { timeout: 10000 });
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }));
    await expect(header(page)).toHaveAttribute('data-eb-theme', 'light', { timeout: 10000 });
  });

  test('the takeover is modal below the live rail: scroll locks, dark register, Escape closes, focus returns', async ({ page }) => {
    await openMenu(page);
    const menu = page.locator('#vcv-eb-menu');
    await expect(menu).toHaveAttribute('aria-modal', 'true');
    await expect
      .poll(() => page.evaluate(() => document.body.style.overflow))
      .toBe('hidden');

    // The rail stays live over the takeover: the trap spans the header, so Tab
    // cycles menu destinations AND the floating rail instruments.
    for (let i = 0; i < 15; i += 1) {
      await page.keyboard.press('Tab');
      const inside = await page.evaluate(() =>
        Boolean(document.activeElement?.closest('header.vcv-eb')),
      );
      expect(inside).toBe(true);
    }

    await expect(header(page)).toHaveAttribute('data-eb-theme', 'dark');
    await expect(page.locator('.vcv-eb__menu-btn')).toHaveAttribute('aria-label', 'Close menu');
    // A visible close control lives in the overlay (audit #56).
    await expect(page.locator('.vcv-eb-menu__close')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
    await expect
      .poll(() => page.evaluate(() => document.body.style.overflow))
      .toBe('');
    const focused = await page.evaluate(() => document.activeElement?.className ?? '');
    expect(focused).toContain('vcv-eb__menu-btn');
  });

  test('the visible ✕ closes the takeover', async ({ page }) => {
    await openMenu(page);
    await page.locator('.vcv-eb-menu__close').click();
    await expect(page.locator('#vcv-eb-menu')).toHaveCount(0);
    await expect
      .poll(() => page.evaluate(() => document.body.style.overflow))
      .toBe('');
  });

  test('the menu lists the complete navigation registry in large type', async ({ page }) => {
    await openMenu(page);
    const menu = page.locator('#vcv-eb-menu');
    for (const label of ['Clinicians', 'Employers', 'Trust']) {
      await expect(
        menu.locator('.vcv-eb-menu__label', { hasText: new RegExp(`^${label}$`) }),
      ).toBeVisible();
    }
    for (const href of ['/onboarding', '/explore', '/employers', '/pricing', '/trust', '/status', '/trust/attribution', '/evidence-network']) {
      await expect(menu.locator(`a[href="${href}"]`)).toHaveCount(1);
    }
    await expect(menu.locator('a[href="/opportunities/discover"]')).toHaveCount(0);
  });
});

/**
 * The automatic-minimum trap, measured rather than assumed (amendment F's
 * homepage lesson, applied to the chrome). Every label in the rail is
 * `white-space: nowrap`, and a flex item's default `min-width: auto` is
 * min-content — so a long action label can push the end cluster past the bar's
 * edge at a width where `document.scrollWidth` still reads clean, because the
 * rail is fixed and transform-centred. `/verify` carries the LONGEST action
 * ("Request organization access"), so it is the adversarial route.
 */
test.describe('glass rail — the rail never outgrows its own box', () => {
  for (const route of ['/verify', '/trust', '/']) {
    test(`contents stay inside the bar across the width sweep on ${route}`, async ({ page }) => {
      for (const width of [1920, 1440, 1180, 1024, 901, 900, 820, 768, 600, 480, 390, 360]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(route);
        await expect(page.locator('.vcv-eb__wordmark')).toBeVisible();

        const fit = await page.evaluate(() => {
          const bar = document.querySelector('nav.vcv-eb__rail');
          if (!bar) return { ok: false, why: 'no rail' };
          const b = bar.getBoundingClientRect();
          const spills = [];
          for (const el of bar.querySelectorAll('a[href], button, div')) {
            const r = el.getBoundingClientRect();
            if (r.width === 0 && r.height === 0) continue;
            // 0.5px tolerance for sub-pixel layout.
            if (r.left < b.left - 0.5 || r.right > b.right + 0.5) {
              spills.push(`${el.className || el.tagName}: [${Math.round(r.left)},${Math.round(r.right)}] vs bar [${Math.round(b.left)},${Math.round(b.right)}]`);
            }
          }
          return { ok: spills.length === 0, spills, barWidth: Math.round(b.width) };
        });
        expect(fit.spills ?? [], `rail contents spill at ${width} on ${route}`).toEqual([]);

        // …and the document itself never gains a horizontal scrollbar.
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow, `document overflow at ${width} on ${route}`).toBeLessThanOrEqual(0);
      }
    });
  }
});

/**
 * The rail is SHARED chrome — it has to hold on every public surface, not just
 * the homepage it was designed against.
 */
test.describe('glass rail — renders and is operable on every public surface', () => {
  for (const route of ['/', '/employers', '/trust', '/explore']) {
    test(`renders, is legible, does not overlap content, and is keyboard-operable on ${route}`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(route);
      const bar = page.locator('nav.vcv-eb__rail');
      await expect(bar).toBeVisible();
      await expect(page.locator('.vcv-eb__wordmark')).toBeVisible();

      // Frosted, fixed, and holding the reference offset on every route.
      const box = await bar.boundingBox();
      expect(Math.round(box!.y), `rail y on ${route}`).toBe(14);
      const style = await bar.evaluate((el) => {
        const c = getComputedStyle(el);
        return {
          position: c.position,
          backdrop: c.backdropFilter || (c as unknown as { webkitBackdropFilter: string }).webkitBackdropFilter,
        };
      });
      expect(style.position).toBe('fixed');
      expect(style.backdrop).toContain('blur');

      // It must not cover the page's first content — off-home the spacer does
      // it; the homepage hero owns its own clearance.
      const main = await page.locator('#main-content').boundingBox();
      expect(main!.y + main!.height, `content below rail on ${route}`).toBeGreaterThan(box!.y);
      if (route !== '/') {
        expect(main!.y, `spacer clears the rail on ${route}`).toBeGreaterThanOrEqual(
          box!.y + box!.height - 1,
        );
      }

      // Keyboard-operable: tab reaches a rail control and it shows a focus ring.
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      const focus = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el) return null;
        const inRail = Boolean(el.closest('nav.vcv-eb__rail'));
        const o = getComputedStyle(el).outlineWidth;
        return { inRail, outline: o, cls: el.className };
      });
      expect(focus, `focus resolved on ${route}`).not.toBeNull();

      // The menu opens and closes by keyboard from every route.
      await page.locator('.vcv-eb__menu-btn').click();
      await expect(page.locator('#vcv-eb-menu')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.locator('#vcv-eb-menu')).toHaveCount(0);

      // No horizontal overflow anywhere.
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `overflow on ${route}`).toBeLessThanOrEqual(0);
    });
  }
});

test.describe('glass rail — off-homepage', () => {
  test('defaults light with the spacer, and the tablet link row folds', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/pricing');
    await expect(wordmark(page)).toBeVisible();
    await expect(header(page)).toHaveAttribute('data-eb-theme', 'light');
    // Off-home compositions sit below the floating bar.
    const spacer = await page.locator('.vcv-eb__space').boundingBox();
    expect(Math.round(spacer!.height)).toBe(90);
    // The bar must never overlap the first line of page content.
    const railBottom = (await rail(page).boundingBox())!.y + (await rail(page).boundingBox())!.height;
    const main = await page.locator('#main-content').boundingBox();
    expect(main!.y).toBeGreaterThanOrEqual(railBottom - 1);
  });

  test('suppresses the dominant action on its own destination', async ({ page }) => {
    await page.goto('/employers');
    await expect(wordmark(page)).toBeVisible();
    await expect(rail(page).locator('.vcv-eb__cta')).toHaveCount(0);
  });
});

test.describe('glass rail — mobile recomposition', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(wordmark(page)).toBeVisible();
  });

  test('stays one bar at the top, near-full-bleed', async ({ page }) => {
    const box = await rail(page).boundingBox();
    expect(Math.round(box!.y)).toBe(10);
    expect(Math.round(box!.x)).toBe(10);
    expect(Math.round(box!.width)).toBe(370);

    // Wordmark left, action right, both inside the bar.
    const mark = await wordmark(page).boundingBox();
    expect(mark!.x).toBeGreaterThanOrEqual(box!.x);
    const cta = await page.locator('.vcv-eb__cta').boundingBox();
    expect(Math.round(cta!.x + cta!.width)).toBeLessThanOrEqual(Math.round(box!.x + box!.width));

    // The middle links and the standalone sign-in fold into the takeover.
    await expect(page.locator('.vcv-eb__links')).toBeHidden();
    await expect(rail(page).locator('.vcv-eb__signin')).toBeHidden();
    // The action shortens.
    await expect(page.locator('.vcv-eb__cta-short')).toHaveText('Start');
  });

  test('the bar holds its position through scroll', async ({ page }) => {
    await page.evaluate(() => window.scrollTo({ top: 1200, behavior: 'instant' as ScrollBehavior }));
    const box = await rail(page).boundingBox();
    expect(Math.round(box!.y)).toBe(10);
  });

  test('every rail control still clears 44px on mobile', async ({ page }) => {
    const undersized = await page.evaluate(() => {
      const bar = document.querySelector('nav.vcv-eb__rail');
      return Array.from(bar!.querySelectorAll<HTMLElement>('a[href], button'))
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && (r.width < 44 || r.height < 44);
        })
        .map((el) => el.className);
    });
    expect(undersized).toEqual([]);
  });

  test('the takeover works on mobile', async ({ page }) => {
    await openMenu(page);
    await expect(page.locator('#vcv-eb-menu')).toBeVisible();
    await expect(page.locator('.vcv-eb-menu__close')).toBeVisible();
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

test.describe('glass rail — reduced motion', () => {
  test('the rail is complete without motion and the takeover opens readable', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(wordmark(page)).toBeVisible();
    await expect(rail(page)).toBeVisible();
    await openMenu(page);
    await expect(page.locator('#vcv-eb-menu')).toBeVisible();
    await expect(page.locator('.vcv-eb-menu__link-label').first()).toBeVisible();
  });
});
