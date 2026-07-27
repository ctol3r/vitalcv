import { expect, test } from '@playwright/test';

/**
 * Glass chrome — the frosted pointer lens, eyebrow plates, and artifact
 * housings (founder direction, 2026-07-27: "more glassmorphism... not too
 * distracting").
 *
 * The contracts that keep "more glass" from becoming a regression:
 * - the lens can never intercept input or reach the a11y tree;
 * - reduced motion removes the lens entirely;
 * - glass goes on chrome and illustrative housings ONLY — the real evidence
 *   surfaces (lane ledger, proof inspector) stay solid (CD-12).
 */

test.describe('glass cursor', () => {
  test('rides with the pointer, inert and accessible-invisible', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const lens = page.locator('[data-vt-cursor]');
    await expect(lens).toHaveCount(1);
    await expect(lens).toHaveAttribute('aria-hidden', 'true');

    const style = await lens.evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        pointerEvents: cs.pointerEvents,
        backdrop: cs.backdropFilter || (cs as unknown as { webkitBackdropFilter?: string }).webkitBackdropFilter,
        opacity: cs.opacity,
      };
    });
    expect(style.pointerEvents).toBe('none');
    expect(style.backdrop).toContain('blur');
    // Invisible until the pointer moves...
    expect(style.opacity).toBe('0');

    // ...then it appears and tracks.
    //
    // Poll rather than move-once: the lens attaches its listeners in a React
    // effect, so a move dispatched before hydration lands on nothing and the
    // lens stays dark forever — the page looks fully painted the whole time
    // it is still inert. (Same hydration race the NPI field's `hydrated()`
    // helper exists for; a single move here failed exactly this way.)
    await expect
      .poll(
        async () => {
          await page.mouse.move(400 + Math.random() * 20, 300 + Math.random() * 20);
          return lens.getAttribute('data-on');
        },
        { timeout: 10_000, message: 'the lens never activated after a pointer move' },
      )
      .toBe('');

    // The lens must not block the NPI field — click straight through it.
    await page.mouse.click(640, 400);
    await page.locator('#npi-input').click();
    await expect(page.locator('#npi-input')).toBeFocused();
  });

  test('reduced motion: the lens is display:none and never activates', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const lens = page.locator('[data-vt-cursor]');
    await expect(lens).toHaveCount(1);
    await expect(lens).toBeHidden();
    await page.mouse.move(400, 300);
    await page.mouse.move(420, 320);
    await page.waitForTimeout(200);
    await expect(lens).toBeHidden();
    expect(await lens.getAttribute('data-on')).toBeNull();
  });
});

test.describe('glass surfaces', () => {
  test('eyebrow plates and artifact housings are real glass', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    for (const selector of ['.ask-eyebrow', '.ask-chapter-eyebrow']) {
      const backdrop = await page
        .locator(selector)
        .first()
        .evaluate((el) => {
          const cs = getComputedStyle(el);
          return cs.backdropFilter || (cs as unknown as { webkitBackdropFilter?: string }).webkitBackdropFilter || '';
        });
      expect(backdrop, `${selector} must carry backdrop-filter glass`).toContain('blur');
    }
  });

  test('glass is spent on the PACKET, not on every drawing', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    // Founder direction: glass makes the packet tactile; it must not become
    // the story. Exactly one glass housing on the homepage — the packet.
    const glassed = page.locator('.vt-artifact--glass');
    await expect(glassed).toHaveCount(1);
    await expect(glassed).toHaveAttribute('data-ask-artifact', 'packet');
    const backdrop = await glassed.evaluate(
      (el) => getComputedStyle(el).backdropFilter || 'none',
    );
    expect(backdrop).toContain('blur');
    // The other artifacts sit on bare paper.
    for (const kind of ['checkrun', 'fit', 'consent']) {
      const bd = await page
        .locator(`[data-ask-artifact="${kind}"]`)
        .evaluate((el) => getComputedStyle(el).backdropFilter || 'none');
      expect(bd, `${kind} must not be glassed`).toBe('none');
    }
  });

  test('the four-step product spine is legible in order', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    // NPI → source evidence → the packet you choose → hospital review.
    const steps = await page
      .locator('.ask-spine-step, .ask-spine')
      .allInnerTexts();
    expect(steps).toHaveLength(4);
    expect(steps[0]).toMatch(/Step 1 .* NPI/i);
    expect(steps[1]).toMatch(/Step 2 .* Source evidence/i);
    expect(steps[2]).toMatch(/Step 3 .* packet/i);
    expect(steps[3]).toMatch(/Step 4 .* Hospital review/i);
  });

  test('real evidence surfaces stay solid — no glass on the ledger or inspector', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    // The lane ledger renders REAL registry states; the proof beat carries the
    // REAL inspector. Neither may take the glass housing (CD-12).
    expect(await page.locator('[data-home-lane-ledger].vt-artifact--glass').count()).toBe(0);
    expect(await page.locator('[data-ask-artifact="once"].vt-artifact--glass').count()).toBe(0);
    const ledgerBackdrop = await page
      .locator('[data-home-lane-ledger]')
      .evaluate((el) => getComputedStyle(el).backdropFilter || 'none');
    expect(ledgerBackdrop).toBe('none');
  });
});
