import { expect, test } from '@playwright/test';

/**
 * Glass chrome — the frosted pointer lens and the single illustrative packet
 * housing. The lens is inert; eyebrows remain plain type; real evidence stays
 * solid. Glass makes the packet tactile without becoming the story.
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
    expect(style.opacity).toBe('0');

    await expect
      .poll(
        async () => {
          await page.mouse.move(400 + Math.random() * 20, 300 + Math.random() * 20);
          return lens.getAttribute('data-on');
        },
        { timeout: 10_000, message: 'the lens never activated after a pointer move' },
      )
      .toBe('');

    await page.mouse.click(640, 400);
    await page.locator('#npi-input').click();
    await expect(page.locator('#npi-input')).toBeFocused();
  });

  test('the lens yields over every actionable surface, not merely swells', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const lens = page.locator('[data-vt-cursor]');

    await expect
      .poll(async () => {
        await page.mouse.move(60 + Math.random() * 10, 620 + Math.random() * 10);
        return lens.getAttribute('data-on');
      }, { timeout: 10_000, message: 'lens never activated' })
      .toBe('');

    for (const target of ['#npi-input', '[data-home-primary-cta]', '[data-home-employer-cta]']) {
      const box = await page.locator(target).boundingBox();
      if (!box) throw new Error(`no box for ${target}`);
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await expect(lens, `${target} must make the lens yield`).toHaveAttribute('data-yield', '');
      await expect(lens).toHaveCSS('opacity', '0');
    }
  });

  test('the lens yields over the live result card', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const lens = page.locator('[data-vt-cursor]');
    const input = page.locator('#npi-input');
    await expect
      .poll(async () => {
        await input.fill('');
        await input.fill('1003000126');
        return (await page.locator('#ask-hint').innerText()).includes('10/10');
      }, { timeout: 15_000, message: 'NPI field never became interactive' })
      .toBe(true);
    await page.locator('[data-home-primary-cta]').click();
    const card = page.locator('.ask-answer');
    await expect(card).toBeVisible({ timeout: 20_000 });

    const box = await card.boundingBox();
    if (!box) throw new Error('no result card box');
    await page.mouse.move(box.x + box.width / 2, box.y + 24);
    await expect(lens, 'the result card is where the product delivers — no flourish').toHaveAttribute(
      'data-yield',
      '',
    );
    await expect(lens).toHaveCSS('opacity', '0');
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
  test('eyebrows are plain type — no plate, per the Palantir reference', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    for (const selector of ['.ask-eyebrow', '.spine-eyebrow']) {
      const style = await page
        .locator(selector)
        .first()
        .evaluate((el) => {
          const cs = getComputedStyle(el);
          return {
            backdrop: cs.backdropFilter || 'none',
            bg: cs.backgroundColor,
            borderWidth: cs.borderTopWidth,
            radius: cs.borderTopLeftRadius,
          };
        });
      expect(style.backdrop, `${selector} must carry no glass`).toBe('none');
      expect(style.bg, `${selector} must have no plate`).toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
      expect(style.borderWidth).toBe('0px');
      expect(style.radius).toBe('0px');
    }
  });

  test('glass is spent on the packet handoff, not on every spine surface', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const glassed = page.locator('.vt-artifact--glass');
    await expect(glassed).toHaveCount(1);
    await expect(glassed).toHaveAttribute('data-ask-artifact', 'packet');
    const backdrop = await glassed.evaluate(
      (el) => getComputedStyle(el).backdropFilter || 'none',
    );
    expect(backdrop).toContain('blur');

    for (const kind of ['checkrun', 'once']) {
      const element = page.locator(`[data-ask-artifact="${kind}"]`);
      await expect(element).toBeAttached();
      const elementBackdrop = await element.evaluate(
        (el) => getComputedStyle(el).backdropFilter || 'none',
      );
      expect(elementBackdrop, `${kind} must remain solid`).toBe('none');
    }
  });

  test('the four-step product spine is legible in order', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const steps = await page.locator('.spine-tab').allInnerTexts();
    expect(steps).toHaveLength(4);
    expect(steps[0]).toMatch(/Step 1[\s\S]*NPI/i);
    expect(steps[1]).toMatch(/Step 2[\s\S]*Source evidence/i);
    expect(steps[2]).toMatch(/Step 3[\s\S]*packet/i);
    expect(steps[3]).toMatch(/Step 4[\s\S]*Hospital review/i);
  });

  test('real evidence surfaces stay solid — no glass on the ledger or inspector', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    expect(await page.locator('[data-home-lane-ledger].vt-artifact--glass').count()).toBe(0);
    expect(await page.locator('[data-ask-artifact="once"].vt-artifact--glass').count()).toBe(0);
    expect(await page.locator('.vt-artifact--glass [data-proof-packet-inspector]').count()).toBe(0);
    const ledgerBackdrop = await page
      .locator('[data-home-lane-ledger]')
      .evaluate((el) => getComputedStyle(el).backdropFilter || 'none');
    expect(ledgerBackdrop).toBe('none');
  });
});
