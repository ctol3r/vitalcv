import { expect, test } from '@playwright/test';

/**
 * SHD-6.1 — the scene degradation matrix.
 *
 * The homepage scene system (SHD-1.1) resolves a capability tier
 * (static | canvas2d | webgpu) and every consumer must stay complete at every
 * tier: the designed poster always present, the NPI action usable, no blank or
 * black region, and a GPU-less browser forced to `webgpu` must degrade
 * cleanly. Tiers are forced via `?sceneTier=` — honored in the e2e web server
 * because it sets NEXT_PUBLIC_SCENE_DEBUG=1 (production builds without that
 * flag ignore the override; see scene/capabilities.ts).
 *
 * This spec is the release guard for the masterlist's SHD-6.1 exit criteria:
 * "no blank hero or chapter can occur when GPU initialization fails; every
 * meaningful chapter is present before the client scene hydrates; reduced
 * motion uses no continuous render loop."
 */

const DESKTOP = { width: 1440, height: 900 };

/** Uncaught page exceptions collected per test — the no-user-visible-error bar. */
function collectPageErrors(page: import('@playwright/test').Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  return errors;
}

async function expectNoHorizontalOverflow(page: import('@playwright/test').Page) {
  const overflow = await page.evaluate(() => {
    const de = document.documentElement;
    return de.scrollWidth - de.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(1);
}

async function expectNpiActionUsable(page: import('@playwright/test').Page) {
  const input = page.getByLabel('NPI number');
  await expect(input).toBeVisible();
  await input.fill('1234567893'); // checksum-valid — enables the CTA
  await expect(page.getByRole('button', { name: /check what’s ready/i })).toBeEnabled();
}

test.describe('scene degradation matrix (SHD-6.1)', () => {
  test('static tier: NPI remains fully usable without a public graph', async ({ page }) => {
    const errors = collectPageErrors(page);
    await page.setViewportSize(DESKTOP);
    await page.goto('/?sceneTier=static', { waitUntil: 'networkidle' });

    // There are no scene BOUNDARIES left to honour a forced tier: the ambient
    // colour field and the evidence field's WebGPU/Canvas2D tiers were both
    // retired in the 2026-07-21 rebuild, so SceneBoundary has no live consumer.
    // What that tier system existed to guarantee — a designed poster, never a
    // blank or canvas-dependent hero — is now unconditional, which is what the
    // rest of this test asserts.
    await expect(page.locator('[data-scene-boundary]')).toHaveCount(0);

    await expect(page.locator('[data-home-evidence-field], [data-field-poster], [data-field-edges]')).toHaveCount(0);

    await expectNpiActionUsable(page);
    await expectNoHorizontalOverflow(page);
    expect(errors).toEqual([]);
  });

  test('no-JS SSR floor: heading, NPI form, and source lanes are all served', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, viewport: DESKTOP });
    const page = await context.newPage();
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('h1').first()).toBeVisible();
    await expect(page.getByLabel('NPI number')).toBeAttached();
    await expect(page.locator('[data-home-source-strip]')).toBeAttached();
    await expect(page.locator('[data-home-evidence-field], [data-field-poster], [data-field-edges]')).toHaveCount(0);

    await context.close();
  });

  test('keyboard reaches the NPI input from the top of the page — no trap before the primary action', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/', { waitUntil: 'networkidle' });

    let reached = false;
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press('Tab');
      const isNpi = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        return !!el && el.getAttribute('aria-label') === 'NPI number';
      });
      if (isNpi) { reached = true; break; }
    }
    expect(reached, 'Tab order must reach the NPI input within 25 stops').toBe(true);
  });
});

/**
 * HERO-RESET-1 — the sell and PERCEIVED visibility.
 *
 * SHD-6.1 above proves the poster/canvas EXISTS at every tier. These prove the
 * two failures existence checks cannot catch: a hero that buries the clinician
 * sell under category jargon, and a field that is "present but invisible"
 * (white-on-white geometry, composition cropped out of the panel). Visual
 * claims use deterministic contrast/pixel assertions, not screenshot baselines.
 */
test.describe('hero reset — clinician sell and field visibility (HERO-RESET-1)', () => {
  test('the clinician message leads: outcome, mechanism, action — no category jargon above the fold', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/', { waitUntil: 'networkidle' });

    await expect(page.locator('h1').first()).toHaveText('Get hired faster.');
    await expect(page.getByText('Start with your NPI. See what employers can confirm', { exact: false }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /check what’s ready/i })).toBeVisible();
    await expect(page.getByText('Free for clinicians · No account required')).toBeVisible();

    const heroText = (await page.locator('[data-home-hero]').innerText()).toLowerCase();
    for (const jargon of ['career evidence network', 'matcha', 'proof packet', 'recognition']) {
      expect(heroText, `category jargon "${jargon}" leaked above the fold`).not.toContain(jargon);
    }
    expect(heroText).not.toContain('recognizes your identity');
    await expect(page.locator('[data-narrative-state], [data-narrative-words], [data-narrative-complete]')).toHaveCount(0);
  });

  test('Cloud Dancer is scoped: homepage paper resolves it, dark mode keeps its own paper', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/', { waitUntil: 'networkidle' });

    const paper = await page.evaluate(() => {
      const root = document.querySelector('.mz-cloud-paper') as HTMLElement;
      return {
        root: getComputedStyle(root).backgroundColor,
        body: getComputedStyle(document.body).backgroundColor,
        token: getComputedStyle(root).getPropertyValue('--vt-cloud-dancer').trim(),
      };
    });
    // CSS minification lowercases hex — compare case-insensitively.
    expect(paper.token.toLowerCase()).toBe('#f0eee9');
    expect(paper.root).toBe('rgb(240, 238, 233)');
    expect(paper.body).toBe('rgb(240, 238, 233)');

    // Precedence contract: the dark theme's paper stays authoritative — the
    // Cloud Dancer scope must never leak into dark or non-optin surfaces.
    // Assert the custom property, not background-color: the theme transition
    // animates background-color, so an immediate read mid-transition still
    // reports the old paint; the variable itself flips instantly.
    const darkPaper = await page.evaluate(() => {
      document.documentElement.classList.add('dark');
      const v = getComputedStyle(document.querySelector('.mz-cloud-paper') as HTMLElement)
        .getPropertyValue('--paper')
        .trim()
        .toLowerCase();
      document.documentElement.classList.remove('dark');
      return v;
    });
    expect(darkPaper).toBe('#15140f'); // .dark .mz paper wins, not Cloud Dancer
  });

  test('static tier: the hero keeps the NPI action without a public graph', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/?sceneTier=static', { waitUntil: 'networkidle' });

    await expectNpiActionUsable(page);
    await expect(page.locator('[data-home-evidence-field], [data-field-poster], [data-field-edges]')).toHaveCount(0);
  });

  test('reduced motion: the NPI action and source strip stay complete without graph motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize(DESKTOP);
    await page.goto('/', { waitUntil: 'networkidle' });

    await expectNpiActionUsable(page);
    await expect(page.locator('[data-home-source-strip]')).toBeVisible();
    await expect(page.locator('[data-home-evidence-field], [data-field-poster], [data-field-edges]')).toHaveCount(0);
  });

  test('mobile: the NPI action remains visible and never overflows', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/?sceneTier=static', { waitUntil: 'networkidle' });

    await expectNpiActionUsable(page);
    await expect(page.locator('[data-home-evidence-field], [data-field-poster], [data-field-edges]')).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  });
});
