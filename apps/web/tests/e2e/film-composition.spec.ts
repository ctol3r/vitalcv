import { expect, test } from '@playwright/test';

/**
 * COMPETE-1 — the composition-independent contracts of the homepage.
 *
 * These are SALVAGED, not new. `homepage-motion.spec.ts`,
 * `scrub-headings.spec.ts` and `homepage-journey-rail.spec.ts` were retired
 * with the mechanisms they tested (mandate R2/R3/R6/R8: the journey grid, the
 * scrub-heading treatment, the chapter rail). But those files also carried
 * assertions that had nothing to do with the retired mechanism and everything
 * to do with whether the page is usable:
 *
 *   - AUD-1.1: no fixed/sticky overlay may cover the H1 or the NPI action
 *   - the ambient scene layer must ride UNDER content and never eat input
 *   - the primary heading must expose exactly ONE accessible name
 *   - no animation may gate the NPI form or its CTA
 *   - heading assembly must cause no layout shift
 *   - the document must never scroll horizontally
 *
 * Deleting those with the rest would have been a silent loss of coverage, so
 * they live here, re-expressed against the film. Deterministic only — no
 * screenshot baselines (the retired specs' baselines were of a composition that
 * no longer exists).
 */

const DESKTOP = { width: 1366, height: 900 };
const NPI_FIELD = { name: /start with your npi/i };

test.describe('homepage composition contracts (COMPETE-1)', () => {
  test('no fixed/sticky overlay covers the primary heading or the NPI action (AUD-1.1)', async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/', { waitUntil: 'networkidle' });

    // The removed left-floating outline must not return (R5).
    await expect(page.locator('[data-home-outline-panel]')).toHaveCount(0);

    for (const sel of ['h1', '#film-npi-input', '[data-home-primary-cta]']) {
      const overlay = await page
        .locator(sel)
        .first()
        .evaluate((el) => {
          const r = el.getBoundingClientRect();
          const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          if (!top || el.contains(top) || top.contains(el)) return null;
          for (let n: Element | null = top; n; n = n.parentElement) {
            const pos = getComputedStyle(n).position;
            if (pos === 'fixed' || pos === 'sticky') return n.className || n.tagName;
          }
          return null;
        });
      expect(overlay, `fixed/sticky overlay covering ${sel}`).toBeNull();
    }
  });

  test('the ambient evidence layer rides under content and never blocks input', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/', { waitUntil: 'networkidle' });

    // The atmosphere is decoration. It must be non-interactive and hidden from
    // assistive tech, or it becomes a transparent wall over the only action.
    const atmosphere = await page.evaluate(() => {
      const el = document.querySelector('.film-stage canvas, [data-evidence-atmosphere]');
      if (!el) return { present: false, pointerEvents: '', ariaHidden: '' };
      const cs = getComputedStyle(el);
      return {
        present: true,
        pointerEvents: cs.pointerEvents,
        ariaHidden: el.getAttribute('aria-hidden') ?? '',
      };
    });
    if (atmosphere.present) {
      expect(atmosphere.pointerEvents, 'ambient layer must not receive pointer events').toBe('none');
      expect(atmosphere.ariaHidden, 'ambient layer must be aria-hidden').toBe('true');
    }

    // The field is genuinely typable — the real proof that nothing overlays it.
    const input = page.getByRole('textbox', NPI_FIELD);
    await input.fill('1234567893');
    await expect(input).toHaveValue('1234567893');
  });

  test('the primary heading exposes exactly one accessible name', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/', { waitUntil: 'networkidle' });

    // `KineticPhrase` renders the phrase twice by design — an `sr-only` copy for
    // assistive tech and an `aria-hidden` per-word copy for the animation. The
    // accessible name must still be ONE clean sentence, never the doubled text.
    await expect(page.locator('h1').first()).toHaveAccessibleName('Get hired faster.');
    await expect(page.locator('h1')).toHaveCount(1);
  });

  test('no animation gates the NPI form or its CTA', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/', { waitUntil: 'networkidle' });

    // The gate under test is CHOREOGRAPHY, not hydration: without scrolling,
    // settling the film, or waiting out any reveal, the action must already be
    // operable at rest. (Enablement does legitimately require hydration — the
    // validity check is client state — so this waits for the page to be ready
    // and then does nothing else. It never scrolls.)
    const input = page.getByRole('textbox', NPI_FIELD);
    await expect(input).toBeVisible();
    await input.fill('1234567893');
    await expect(page.getByRole('button', { name: /check what.s ready/i })).toBeEnabled();

    const scrolled = await page.evaluate(() => window.scrollY);
    expect(scrolled, 'the action must be reachable without scrolling').toBe(0);
  });

  test('heading assembly causes no layout shift', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/', { waitUntil: 'networkidle' });

    const before = await page
      .locator('h1')
      .first()
      .evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { top: Math.round(r.top), height: Math.round(r.height) };
      });

    // Drive the film a little; the phrase animates per word.
    await page.mouse.move(683, 450);
    await page.mouse.wheel(0, 200);
    await page.waitForTimeout(400);
    await page.mouse.wheel(0, -200);
    await page.waitForTimeout(400);

    const after = await page
      .locator('h1')
      .first()
      .evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { top: Math.round(r.top), height: Math.round(r.height) };
      });

    // Word-level opacity/transform must not reflow the box it sits in.
    expect(Math.abs(after.height - before.height), 'heading height shifted').toBeLessThanOrEqual(2);
  });

  test('the document never scrolls horizontally, at any viewport', async ({ page }) => {
    for (const vp of [DESKTOP, { width: 1024, height: 768 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(vp);
      await page.goto('/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `horizontal overflow at ${vp.width}px`).toBeLessThanOrEqual(1);
    }
  });

  test('mobile keeps the heading in normal flow, complete and readable', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/', { waitUntil: 'networkidle' });

    await expect(page.locator('.film')).toHaveAttribute('data-film-mode', 'vertical');
    await expect(page.locator('h1').first()).toHaveAccessibleName('Get hired faster.');
    // No pinned runway on touch: the scenes are ordinary blocks.
    await expect(page.locator('.film-track')).toHaveCount(1);
    const transform = await page
      .locator('.film-track')
      .evaluate((el) => getComputedStyle(el).transform);
    expect(['none', 'matrix(1, 0, 0, 1, 0, 0)']).toContain(transform);
  });
  /**
   * Every scene's copy must sit on a scrim.
   *
   * The atmosphere draws horizontal record fragments at text height, so copy
   * on unscrimmed paper reads as STRUCK THROUGH. That shipped to the live `/`:
   * the two `.film-record` scenes carried `background: none`, on the reasoning
   * that the record "carries the right-hand weight" — which conflates the
   * compositional fade with the legibility floor.
   *
   * Asserted as an invariant over ALL scenes rather than a value on the two
   * that were broken, so a new scene or artifact layout cannot opt out of it
   * silently. Scenes with no atmosphere behind them would be a legitimate
   * exemption; there are none, and adding one should be a deliberate edit here.
   */
  test('no scene renders its copy on unscrimmed paper', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);

    const unscrimmed = await page.evaluate(() =>
      [...document.querySelectorAll('[data-film-scene]')]
        .map((scene) => {
          const copy = scene.querySelector('.film-copy');
          if (!copy) return null;
          const cs = getComputedStyle(copy);
          const painted =
            (cs.backgroundImage && cs.backgroundImage !== 'none') ||
            !/^rgba\(0, 0, 0, 0\)$|^transparent$/.test(cs.backgroundColor);
          return painted ? null : (scene as HTMLElement).dataset.filmScene;
        })
        .filter(Boolean),
    );

    expect(unscrimmed, 'scenes whose copy has no scrim behind it').toEqual([]);
  });
});
