import { expect, test } from '@playwright/test';

/**
 * The homepage ask — end-to-end contracts.
 *
 * This file replaces `compete-film.spec.ts`, which pinned the retired
 * horizontal film. The split follows the method recorded in
 * `docs/design/homepage-film-flip-plan.md`, and applying it to my OWN change is
 * the point: a composition swap must retire the specs whose sections it
 * retires, PORT the guarantees that were never about the composition, and add
 * real coverage for what replaced it.
 *
 * RETIRED with the film (composition-specific, and the mandate retires them):
 *   scroll-advances-one-film, scenes-land-in-frame, track-paints-in-front,
 *   no-scene-overflows-pinned-stage, vertical-axis-never-hijacked,
 *   mobile-column-stretch, mobile-no-horizontal-travel, static-tier poster,
 *   canvas2d tier. All of these describe a pinned horizontal stage that no
 *   longer exists; keeping them would be the orphan pattern again.
 *
 * PORTED here unchanged in intent — none of these were ever about the film:
 *   keyboard reachability + focus ring, nothing personal or fabricated before a
 *   lookup, local NPI validation without claiming a lookup, no-graph (R1), and
 *   reduced-motion's "no render loop" (the durable half of that test).
 *
 * ADDED for the ask: the answer replaces the question in place, the employer
 * door is present and secondary, and the first screen carries no wall of state.
 */

const HOME = '/';

/**
 * Wait until React has hydrated the NPI field.
 *
 * Not a courtesy sleep — a correctness requirement. The field is a CONTROLLED
 * input, so a value written into the DOM before hydration is erased the moment
 * React renders `value={digits}` from its own empty state. A test that fills
 * too early sees the counter stuck at `0/10` for good, and Playwright's
 * auto-retry cannot save it because the DOM never changes again.
 *
 * So probe with a real keystroke and confirm it STICKS. `waitForTimeout` cannot
 * express this: the page is fully painted and interactive-looking the whole
 * time it is still wrong. (Which is also why this deserves a product note —
 * see the hydration comment in AskHome.tsx.)
 */
async function hydrated(page: import('@playwright/test').Page) {
  const input = page.locator('#npi-input');
  await expect
    .poll(
      async () => {
        // Clear FIRST. `fill()` is a no-op when the value already matches, and
        // it dispatches no input event when it no-ops — so a poll that just
        // re-filled '1' wrote the DOM once before hydration and then went
        // silent forever, and React never heard a thing. Alternating '' → '1'
        // guarantees a real event every iteration.
        await input.fill('');
        await input.fill('1');
        return (await page.locator('#ask-hint').innerText()).includes('1/10');
      },
      { timeout: 15_000, message: 'NPI field never became interactive' },
    )
    .toBe(true);
  await input.fill('');
}

test.describe('homepage ask', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HOME, { waitUntil: 'domcontentloaded' });
  });

  // ── ported: accessibility of the one primary action ──────────────

  test('keyboard: the NPI field is an early stop and shows a focus ring', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(300);

    // Intent, not literal position: the skip link correctly takes the first
    // stop. What matters is the single primary action is reachable within an
    // ordinary chrome's worth of stops rather than buried behind the nav.
    await hydrated(page);
    // `hydrated()` types into the field, which leaves focus sitting IN it —
    // tabbing from there walks away through the whole chrome before returning,
    // and the count measures the wrong journey entirely. Reset to the top of
    // the document so the first Tab is a real visitor's first Tab.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.locator('body').click({ position: { x: 2, y: 2 } });
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());

    const MAX_STOPS = 12;
    let stops = 0;
    for (; stops < MAX_STOPS; stops += 1) {
      await page.keyboard.press('Tab');
      if (await page.evaluate(() => document.activeElement?.id === 'npi-input')) break;
    }
    expect(
      stops,
      `the NPI field was not reachable within ${MAX_STOPS} tab stops — it is the ` +
        'only primary action on the page and must not sit behind the nav',
    ).toBeLessThan(MAX_STOPS);
    await expect(page.locator('#npi-input')).toBeFocused();

    // The field's focus ring lives on its container, since the input itself is
    // a bare ruled line: assert the visible affordance, not the element that
    // happens to own it.
    const ringed = await page.evaluate(() => {
      const input = document.querySelector('#npi-input')!;
      const field = input.closest('.ask-field')!;
      return getComputedStyle(field).borderBottomColor !== getComputedStyle(document.body).color;
    });
    expect(ringed, 'the focused field must be visually distinguishable').toBe(true);
  });

  // ── ported: the truth floor before any lookup ────────────────────

  test('renders nothing personal or fabricated before a lookup', async ({ page }) => {
    await page.waitForTimeout(300);
    const text = await page.locator('.ask').innerText();

    expect(text).not.toMatch(/\d+\s*%/); // no readiness percentage
    expect(text).not.toMatch(/\bDr\.\s|\bMD\b|\bRN\b/); // no fabricated clinician
    expect(text).not.toContain('Find the opportunity');
    expect(text).not.toContain('VitalCV recognizes');
  });

  test('the NPI field validates locally without claiming a lookup', async ({ page }) => {
    await hydrated(page);

    await page.locator('#npi-input').fill('123');
    await expect(page.locator('#ask-hint')).toContainText('3/10 digits');

    // Checksum-valid enables submit and says nothing about the person.
    await page.locator('#npi-input').fill('1234567893');
    await expect(page.locator('[data-home-primary-cta]')).toBeEnabled();

    // Checksum-INVALID full-length is caught before any network call.
    await page.locator('#npi-input').fill('1234567890');
    await expect(page.locator('[data-home-primary-cta]')).toBeDisabled();
  });

  test('no graph: no nodes, edges, or drag controls anywhere (R1)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(300);

    expect(await page.locator('.ask [draggable="true"]').count()).toBe(0);
    const text = (await page.locator('.ask').innerText()).toLowerCase();
    expect(text).not.toContain('drag to');
    expect(text).not.toContain('constellation');
  });

  // ── added: what the new composition promises ─────────────────────

  test('the first screen is an act, not a wall of state', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(300);

    // The defect this page exists to fix: the old hero showed six source rows,
    // four of them NOT CHECKED / ACCESS REQUIRED, before the visitor did
    // anything. No state label may appear until a lookup has been asked for.
    const firstScreen = await page.locator('[data-home-hero]').innerText();
    for (const label of ['NOT CHECKED', 'ACCESS REQUIRED', 'SOURCE-BACKED', 'SELF-ATTESTED']) {
      expect(
        firstScreen.toUpperCase(),
        `"${label}" appeared before the visitor asked for anything — the first ` +
          'screen must not be a wall of state (mandate guardrail 7)',
      ).not.toContain(label);
    }

    // And the field is the largest thing on it.
    const sizes = await page.evaluate(() => ({
      input: parseFloat(getComputedStyle(document.querySelector('#npi-input')!).fontSize),
      title: parseFloat(getComputedStyle(document.querySelector('h1')!).fontSize),
    }));
    expect(
      sizes.input,
      'the NPI field must be the hero — larger than the headline that introduces it',
    ).toBeGreaterThan(sizes.title);
  });

  test('the employer door is present, real, and secondary to the clinician act', async ({
    page,
  }) => {
    await page.waitForTimeout(300);

    const employer = page.locator('[data-home-employer-cta]');
    await expect(employer).toHaveAttribute('href', '/employers');
    expect((await employer.innerText()).trim().length).toBeGreaterThanOrEqual(10);

    // Secondary: it must not out-shout the clinician's action.
    const weight = await page.evaluate(() => {
      const e = document.querySelector('[data-home-employer-cta]')!;
      const p = document.querySelector('[data-home-primary-cta]')!;
      return {
        employer: parseFloat(getComputedStyle(e).fontSize),
        primary: parseFloat(getComputedStyle(p).fontSize),
      };
    });
    expect(weight.employer).toBeLessThanOrEqual(weight.primary);
  });

  test('reduced motion: the page is still, and holds no animation machinery', async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto(HOME, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(400);

    // Measure stillness directly rather than counting frames from a loop this
    // test drives itself — that number rises on a perfectly static page and
    // proves nothing. Sample the geometry twice and require it not to move.
    const sample = () =>
      page.evaluate(() =>
        [...document.querySelectorAll('.ask h1, .ask-field, .ask-beat')]
          .map((el) => {
            const r = el.getBoundingClientRect();
            return `${Math.round(r.top)},${Math.round(r.left)},${Math.round(r.width)}`;
          })
          .join('|'),
      );
    const before = await sample();
    await page.waitForTimeout(600);
    expect(await sample(), 'nothing may move under prefers-reduced-motion').toBe(before);

    // And no animation machinery is mounted at all.
    expect(await page.locator('.ask canvas').count()).toBe(0);
    expect(
      await page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').length),
      'no running animations under reduced motion',
    ).toBe(0);

    await ctx.close();
  });

  // ── ported from the retired film-composition spec ────────────────
  // These four never described the film — they describe any homepage that has
  // one heading and one primary action. Carried over rather than deleted with
  // the composition that happened to be under them.

  test('no fixed or sticky overlay covers the heading or the NPI action', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(300);

    const covered = await page.evaluate(() => {
      const targets = ['h1', '#npi-input', '[data-home-primary-cta]'];
      const hits: string[] = [];
      for (const sel of targets) {
        const el = document.querySelector(sel);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        if (top && !el.contains(top) && !top.contains(el)) {
          hits.push(`${sel} covered by ${top.tagName}.${top.className}`);
        }
      }
      return hits;
    });
    expect(covered, 'nothing may sit on top of the heading or the primary action').toEqual([]);
  });

  test('the primary heading exposes exactly one accessible name', async ({ page }) => {
    await page.waitForTimeout(300);
    const h1s = await page.locator('h1').count();
    expect(h1s, 'exactly one h1 — a duplicated heading reads twice to a screen reader').toBe(1);
    const name = (await page.locator('h1').innerText()).trim();
    // The retired film rendered its headline twice (a visible copy plus a
    // scrub layer), which screen readers announced as "Get hired faster. Get
    // hired faster." Assert the name is not simply itself repeated.
    const half = name.slice(0, Math.floor(name.length / 2)).trim();
    expect(half.length > 0 && name === `${half} ${half}`).toBe(false);
  });

  test('no animation gates the NPI form or its CTA', async ({ page }) => {
    await page.waitForTimeout(300);
    const gated = await page.evaluate(() =>
      ['#npi-input', '[data-home-primary-cta]'].filter((sel) => {
        const el = document.querySelector(sel);
        if (!el) return true;
        const cs = getComputedStyle(el);
        return cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.99;
      }),
    );
    expect(gated, 'the form must be usable immediately, not after an entrance').toEqual([]);
  });

  test('the document never scrolls horizontally, at any viewport', async ({ page }) => {
    for (const [width, height] of [
      [360, 740],
      [768, 1024],
      [1440, 900],
      [1920, 1080],
    ]) {
      await page.setViewportSize({ width, height });
      await page.waitForTimeout(250);
      const over = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      );
      expect(over, `horizontal overflow at ${width}×${height}`).toBe(false);
    }
  });

  test('mobile: an ordinary vertical document with no horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(400);

    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    expect(overflows, 'the page must never scroll sideways on a phone').toBe(false);

    // The cadence line used to sit underneath the floating Feedback widget.
    const clear = await page.evaluate(() => {
      const c = document.querySelector('[data-home-source-cadence]');
      if (!c) return false;
      const r = c.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
    expect(clear, 'the source-cadence line must render with real area').toBe(true);
  });
});
