import { expect, test } from '@playwright/test';

import { readingCorridor } from './film-reading-corridor';

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

  /**
   * Three viewports, three navigations, one test — which is why this was the
   * only spec in the file needing a retry to pass.
   *
   * On main's CI it failed at 30.1s and passed on retry #1 in 10.1s, every run.
   * The retry made it look healthy while it was in fact one slow runner away
   * from failing both attempts and blocking a merge for no product reason.
   *
   * Two changes, no loss of coverage:
   *  - `waitUntil: 'load'`, not `'networkidle'`. This measures LAYOUT overflow;
   *    it does not need every analytics beacon and font request to fall quiet,
   *    and `networkidle` on a page with a rAF loop and third-party widgets is
   *    the slowest possible way to ask "is the DOM laid out yet".
   *  - `test.slow()` for an honest budget, since three navigations in one test
   *    legitimately need more than a single-navigation default.
   */
  test('the document never scrolls horizontally, at any viewport', async ({ page }) => {
    test.slow();
    for (const vp of [DESKTOP, { width: 1024, height: 768 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(vp);
      await page.goto('/', { waitUntil: 'load' });
      // The film only pins after hydration resolves capabilities, and the
      // pinned track is the thing most likely to overflow — so wait for the
      // mode to be decided rather than for a fixed interval.
      await page.locator('.film[data-film-mode]').first().waitFor({ state: 'attached' });
      // ...and then POLL rather than sleep-then-sample (#893). Dropping
      // `networkidle` above removed the dominant race; this removes the other
      // half of it. A single read at a fixed 300ms measures one instant of a
      // page that may still be settling, so it can only ever be a bet on how
      // fast the runner is. Polling asserts the settled state instead, which is
      // what the contract actually means, and reports the last value it saw on
      // failure rather than a bare number.
      //
      // The threshold is unchanged, so this cannot hide a real regression: the
      // page measures 0px of overflow at all three of these viewports (36
      // direct samples), meaning a genuine overflow has the full budget to
      // cross and will still fail here.
      await expect
        .poll(
          () =>
            page.evaluate(
              () =>
                document.documentElement.scrollWidth -
                document.documentElement.clientWidth,
            ),
          { message: `horizontal overflow at ${vp.width}px`, timeout: 5_000 },
        )
        .toBeLessThanOrEqual(1);
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
   * DOM half of the copy-legibility invariant.
   *
   * #886 fixed the shipped bug — atmosphere fragments running through the
   * headline and the honesty line — by confining the field to a top and a
   * bottom margin band. `film-reading-corridor.test.ts` proves the model keeps
   * out of the space between them; this proves the copy actually LIVES there.
   * Neither half is sufficient: fragments could avoid a corridor the copy does
   * not occupy, or copy could sit in a corridor the fragments invade.
   *
   * The corridor is measured from `fragmentPose`, never hardcoded, so widening
   * the bands fails this test instead of silently shrinking the safe zone.
   *
   * Checked at scene boundaries AND mid-transition: the copy translates with
   * the track, and a frame in flight is where an overlap would first appear.
   */
  test('every scene keeps its copy inside the atmosphere reading corridor', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);

    // Only meaningful while the film is pinned; the vertical fallback is an
    // ordinary document where the atmosphere spans the whole runway.
    const mode = await page.locator('.film').getAttribute('data-film-mode');
    test.skip(mode !== 'film', 'corridor geometry applies to the pinned film');

    const { top, bottom } = readingCorridor();
    const sceneCount = await page.locator('[data-film-scene]').count();

    // Boundaries plus the midpoint of each transition.
    const stops: number[] = [];
    for (let i = 0; i < sceneCount; i += 1) {
      stops.push(i / (sceneCount - 1));
      if (i < sceneCount - 1) stops.push((i + 0.5) / (sceneCount - 1));
    }

    const offenders: string[] = [];
    for (const fraction of stops) {
      await page.evaluate((f) => {
        const runway = document.querySelector('.film-runway');
        if (!runway) return;
        const rect = runway.getBoundingClientRect();
        window.scrollTo({
          top: window.scrollY + rect.top + (rect.height - window.innerHeight) * f,
          behavior: 'instant',
        });
      }, fraction);
      await page.waitForTimeout(220);

      const bad = await page.evaluate(
        ({ top: t, bottom: b }) => {
          const stage = document.querySelector('.film-stage')?.getBoundingClientRect();
          if (!stage || stage.height === 0) return [];
          const out: string[] = [];
          for (const scene of document.querySelectorAll('[data-film-scene]')) {
            const box = scene.getBoundingClientRect();
            // Only the scene currently in frame.
            if (box.right < stage.left + 8 || box.left > stage.right - 8) continue;
            const copy = scene.querySelector('.film-copy');
            if (!copy) continue;
            const r = copy.getBoundingClientRect();
            if (r.height === 0) continue;
            const yTop = (r.top - stage.top) / stage.height;
            const yBottom = (r.bottom - stage.top) / stage.height;
            if (yTop < t || yBottom > b) {
              out.push(
                `${(scene as HTMLElement).dataset.filmScene}: copy spans ` +
                  `${yTop.toFixed(3)}–${yBottom.toFixed(3)}, corridor ${t.toFixed(3)}–${b.toFixed(3)}`,
              );
            }
          }
          return out;
        },
        { top, bottom },
      );
      offenders.push(...bad);
    }

    expect(offenders, 'copy overlapping an atmosphere margin band').toEqual([]);
  });
});
