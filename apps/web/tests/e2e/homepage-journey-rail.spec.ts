import { expect, test, type Page } from '@playwright/test';

/**
 * W2 — the career journey rail on the LIVE homepage (production acceptance,
 * promoted from the dev-harness suite per the deep audit).
 *
 * Contract: on eligible desktop, native vertical scroll drives the pinned
 * four-chapter rail horizontally with rolodex leaf poses; forward and reverse
 * scrubbing agree (pure geometry); the rail's chapter navigator is the ONE
 * page-level in-page navigator; deep links land on chapters; the skip control
 * bypasses the story; and every fallback renders the same chapters vertically.
 */

const DESKTOP = { width: 1440, height: 900 };

async function scrollTo(page: Page, y: number) {
  await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), y);
  await page.waitForFunction((top) => Math.abs(window.scrollY - top) <= 1, y);
  await page.waitForTimeout(120);
}

/** Document-space scrollY that rests the rail at `progress` (0..1). */
async function railScrollFor(page: Page, progress: number): Promise<number> {
  return page.evaluate((p) => {
    const rail = document.querySelector('[data-story-rail]')!;
    const runway = rail.querySelector('.story-rail-runway') as HTMLElement;
    const top = runway.getBoundingClientRect().top + window.scrollY;
    const travel = runway.offsetHeight - window.innerHeight;
    return Math.round(top + travel * p);
  }, progress);
}

test.describe('homepage journey rail (W2)', () => {
  test('pins on desktop and translates the four chapters with scroll — forward and reverse', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/', { waitUntil: 'networkidle' });

    const rail = page.locator('[data-story-rail]');
    await expect(rail).toHaveAttribute('data-rail-pinned', 'true');
    await expect(page.locator('[data-journey-card]')).toHaveCount(4);

    // Chapter 0 at the runway start.
    await scrollTo(page, await railScrollFor(page, 0));
    await expect(rail).toHaveAttribute('data-rail-active', '0');

    // The track actually translates as scroll advances.
    const offsetAt = () =>
      page.locator('.story-rail-track').evaluate((n) => {
        const t = getComputedStyle(n).transform;
        return t === 'none' ? 0 : -new DOMMatrixReadOnly(t).m41;
      });
    const atStart = await offsetAt();

    await scrollTo(page, await railScrollFor(page, 0.67));
    await expect(rail).toHaveAttribute('data-rail-active', '2');
    expect(await offsetAt()).toBeGreaterThan(atStart);

    await scrollTo(page, await railScrollFor(page, 1));
    await expect(rail).toHaveAttribute('data-rail-active', '3');

    // Reverse scrub: pure function of scroll position — same states back.
    await scrollTo(page, await railScrollFor(page, 0.67));
    await expect(rail).toHaveAttribute('data-rail-active', '2');
    await scrollTo(page, await railScrollFor(page, 0));
    await expect(rail).toHaveAttribute('data-rail-active', '0');
  });

  test('the rolodex leaves pose from the shared curves: active centered, neighbors fanned', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/', { waitUntil: 'networkidle' });

    // Rest at chapter 1 (matcha): prev leans up/back, next waits below.
    await scrollTo(page, await railScrollFor(page, 1 / 3));
    const poses = await page.evaluate(() => {
      const read = (id: string) => {
        const el = document.querySelector(`[data-rail-chapter-id="${id}"]`) as HTMLElement;
        return {
          rx: parseFloat(el.style.getPropertyValue('--leaf-rx')),
          ty: parseFloat(el.style.getPropertyValue('--leaf-ty')),
          o: parseFloat(el.style.getPropertyValue('--leaf-o')),
        };
      };
      return { prev: read('readiness'), active: read('matcha'), next: read('apply') };
    });
    expect(Math.abs(poses.active.rx)).toBeLessThan(3); // centered, front-facing
    expect(poses.active.o).toBeGreaterThan(0.97);
    expect(poses.prev.rx).toBeGreaterThan(20); // completed leaf fans up/back
    expect(poses.prev.ty).toBeLessThan(0);
    expect(poses.next.rx).toBeLessThan(-20); // upcoming leaf fans down/forward
    expect(poses.next.o).toBeGreaterThan(0.4); // visibly part of the file

    // The card carries a real 3D transform (matrix3d), not a fade.
    const cardTransform = await page
      .locator('[data-rail-chapter-id="readiness"] .journey-card')
      .evaluate((n) => getComputedStyle(n).transform);
    expect(cardTransform).toContain('matrix3d');
  });

  test('the chapter navigator is the one page-level navigator and tracks + drives the journey', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/', { waitUntil: 'networkidle' });

    // W2.3 + composition gate: the retired navigators are gone.
    await expect(page.locator('[data-home-section-rail]')).toHaveCount(0);
    await expect(page.locator('[data-home-outline-panel]')).toHaveCount(0);

    const nav = page.locator('[data-story-rail-nav]');
    await expect(nav).toHaveCount(1);
    const buttons = nav.locator('button');
    await expect(buttons).toHaveCount(4);

    // Follows the scroll.
    await scrollTo(page, await railScrollFor(page, 1));
    await expect(buttons.nth(3)).toHaveAttribute('aria-current', 'step');

    // Drives the scroll (click → smooth-scroll to the chapter's rest).
    await buttons.nth(0).click();
    await expect
      .poll(async () => page.locator('[data-story-rail]').getAttribute('data-rail-active'), {
        timeout: 5000,
      })
      .toBe('0');
  });

  test('deep links land on their chapter inside the pin', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/#apply', { waitUntil: 'networkidle' });
    await expect
      .poll(async () => page.locator('[data-story-rail]').getAttribute('data-rail-active'), {
        timeout: 5000,
      })
      .toBe('2');
  });

  test('the skip control jumps past the story to the final CTA section', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/', { waitUntil: 'networkidle' });
    const skip = page.locator('[data-rail-skip]');
    await skip.focus();
    await expect(skip).toBeVisible(); // focus reveals it
    await skip.press('Enter');
    await expect
      .poll(async () =>
        page.evaluate(() => {
          const r = document.getElementById('employers')!.getBoundingClientRect();
          return r.top < window.innerHeight;
        }),
      )
      .toBe(true);
  });

  test('no horizontal document overflow with the rail pinned, mid-journey', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/', { waitUntil: 'networkidle' });
    await scrollTo(page, await railScrollFor(page, 0.5));
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test('the footer follows the rail in normal vertical flow', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/', { waitUntil: 'networkidle' });
    // The browser clamps to max scroll — no exact-position wait here.
    await page.evaluate(() =>
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }),
    );
    await expect(page.locator('[data-home-trust-footer]')).toBeInViewport();
  });

  test('keyboard focus inside an offscreen chapter brings that chapter into the pin', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/', { waitUntil: 'networkidle' });
    await scrollTo(page, await railScrollFor(page, 0));
    // Focus the LAST chapter's action link directly (as Tab traversal would).
    await page.locator('[data-journey-action="start"]').focus();
    await expect
      .poll(async () => page.locator('[data-story-rail]').getAttribute('data-rail-active'), {
        timeout: 5000,
      })
      .toBe('3');
  });
});
