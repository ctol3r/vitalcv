import { expect, test } from '@playwright/test';

/**
 * SHD-6.1 — the scene degradation matrix.
 *
 * The old GPU scene system is retired. These tests preserve the useful floor it
 * represented: the NPI action, source cadence, and four-step explanation remain
 * complete under static, no-JS, reduced-motion, and mobile conditions.
 */

const DESKTOP = { width: 1440, height: 900 };

function collectPageErrors(page: import('@playwright/test').Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  return errors;
}

async function expectNoHorizontalOverflow(page: import('@playwright/test').Page) {
  const overflow = await page.evaluate(() => {
    const documentElement = document.documentElement;
    return documentElement.scrollWidth - documentElement.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(1);
}

/**
 * The field's accessible name, in full. The label still floats, but only
 * typographically — its text is one string in every state (#1006), so this can
 * name the field instead of matching the three letters `/npi/i` found.
 *
 * This spec also renders with JavaScript disabled. The name is identical
 * there: it is a server-rendered `<label for>`, and the float that used to
 * change the wording was removed, so SSR and hydrated markup now agree.
 */
const NPI_FIELD = { name: 'Your 10-digit NPI', exact: true };

async function expectNpiActionUsable(page: import('@playwright/test').Page) {
  const input = page.getByRole('textbox', NPI_FIELD);
  await expect(input).toBeVisible();
  await input.fill('1234567893');
  await expect(page.getByRole('button', { name: /check what’s ready/i })).toBeEnabled();
}

test.describe('scene degradation matrix (SHD-6.1)', () => {
  test('static tier: NPI remains fully usable without a public graph', async ({ page }) => {
    const errors = collectPageErrors(page);
    await page.setViewportSize(DESKTOP);
    await page.goto('/?sceneTier=static', { waitUntil: 'networkidle' });

    await expect(page.locator('[data-scene-boundary]')).toHaveCount(0);
    await expect(
      page.locator('[data-home-evidence-field], [data-field-poster], [data-field-edges]'),
    ).toHaveCount(0);

    await expectNpiActionUsable(page);
    await expectNoHorizontalOverflow(page);
    expect(errors).toEqual([]);
  });

  test('no-JS SSR floor: heading, NPI form, source cadence, and spine are served', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, viewport: DESKTOP });
    const page = await context.newPage();
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('h1').first()).toBeVisible();
    await expect(page.getByRole('textbox', NPI_FIELD)).toBeAttached();
    await expect(page.locator('[data-home-source-cadence]')).toBeAttached();
    await expect(page.locator('[data-home-spine] .spine-panel')).toHaveCount(4);
    await expect(page.locator('[data-home-spine] .spine-panel[hidden]')).toHaveCount(0);
    await expect(
      page.locator('[data-home-evidence-field], [data-field-poster], [data-field-edges]'),
    ).toHaveCount(0);

    await context.close();
  });

  test('keyboard reaches the NPI input from the top of the page — no trap before the primary action', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/', { waitUntil: 'networkidle' });

    let reached = false;
    for (let index = 0; index < 25; index += 1) {
      await page.keyboard.press('Tab');
      const isNpi = await page.evaluate(() => {
        const element = document.activeElement as HTMLElement | null;
        return Boolean(element && element.id === 'npi-input');
      });
      if (isNpi) {
        reached = true;
        break;
      }
    }
    expect(reached, 'Tab order must reach the NPI input within 25 stops').toBe(true);
  });
});

/**
 * HERO-RESET-1 — the clinician sell and perceived visibility.
 */
test.describe('hero reset — clinician sell and field visibility (HERO-RESET-1)', () => {
  test('the clinician message leads: outcome, mechanism, action — no category jargon above the fold', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/', { waitUntil: 'networkidle' });

    await expect(page.locator('h1').first()).toHaveAccessibleName(
      'Your career evidence, ready before your next job.',
    );
    await expect(page.getByText('Start with your NPI', { exact: false }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /check what’s ready/i })).toBeVisible();
    await expect(page.getByText('Free for clinicians · No account required')).toBeVisible();

    const heroText = (await page.locator('[data-home-hero]').innerText()).toLowerCase();
    for (const jargon of ['career evidence network', 'matcha', 'proof packet', 'recognition']) {
      expect(heroText, `category jargon "${jargon}" leaked above the fold`).not.toContain(jargon);
    }
    expect(heroText).not.toContain('recognizes your identity');
    await expect(
      page.locator('[data-narrative-state], [data-narrative-words], [data-narrative-complete]'),
    ).toHaveCount(0);
  });

  test('Cloud Dancer is the global paper token, not a route-scoped style injection', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/', { waitUntil: 'networkidle' });

    const home = await page.evaluate(() => {
      const root = document.querySelector('.ask') as HTMLElement;
      return {
        body: getComputedStyle(document.body).backgroundColor,
        token: getComputedStyle(root).getPropertyValue('--vt-cloud-dancer').trim(),
        routeScopedRules: [...document.querySelectorAll('style')].filter((style) =>
          (style.textContent ?? '').includes('body{background:var(--vt-cloud-dancer)}'),
        ).length,
      };
    });
    expect(home.token.toLowerCase()).toBe('#f0eee9');
    expect(home.body).toBe('rgb(240, 238, 233)');
    expect(home.routeScopedRules, 'paper is global after CD-W2; the homepage injects no local override').toBe(0);

    await page.goto('/trust', { waitUntil: 'networkidle' });
    const trust = await page.evaluate(() => ({
      homeComposition: document.querySelectorAll('.ask').length,
      body: getComputedStyle(document.body).backgroundColor,
      token: getComputedStyle(document.documentElement).getPropertyValue('--vt-cloud-dancer').trim(),
      routeScopedRules: [...document.querySelectorAll('style')].filter((style) =>
        (style.textContent ?? '').includes('body{background:var(--vt-cloud-dancer)}'),
      ).length,
    }));
    expect(trust.homeComposition).toBe(0);
    expect(trust.token.toLowerCase()).toBe('#f0eee9');
    expect(trust.body).toBe('rgb(240, 238, 233)');
    expect(trust.routeScopedRules).toBe(0);
  });

  test('static tier: the hero keeps the NPI action without a public graph', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/?sceneTier=static', { waitUntil: 'networkidle' });

    await expectNpiActionUsable(page);
    await expect(
      page.locator('[data-home-evidence-field], [data-field-poster], [data-field-edges]'),
    ).toHaveCount(0);
  });

  test('reduced motion: the NPI action and source strip stay complete without graph motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize(DESKTOP);
    await page.goto('/', { waitUntil: 'networkidle' });

    await expectNpiActionUsable(page);
    await expect(page.locator('[data-home-source-cadence]')).toBeAttached();
    await expect(
      page.locator('[data-home-evidence-field], [data-field-poster], [data-field-edges]'),
    ).toHaveCount(0);
  });

  test('mobile: the NPI action remains visible and never overflows', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/?sceneTier=static', { waitUntil: 'networkidle' });

    await expectNpiActionUsable(page);
    await expect(
      page.locator('[data-home-evidence-field], [data-field-poster], [data-field-edges]'),
    ).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  });
});
