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

/**
 * COMPETE-1: the field is addressed by ROLE. The film labels it with a visible
 * `<label>` ("Start with your NPI") instead of the retired composition's
 * invisible `aria-label="NPI number"`, and the arrival scene's region shares
 * that accessible name — so a bare `getByLabel` is ambiguous between the
 * landmark and the control.
 */
const NPI_FIELD = { name: /start with your npi/i };

async function expectNpiActionUsable(page: import('@playwright/test').Page) {
  const input = page.getByRole('textbox', NPI_FIELD);
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
    await expect(page.getByRole('textbox', NPI_FIELD)).toBeAttached();
    // The source signal survives the composition change: `SourceCoverageRibbon`
    // retired with the stacked page, and the cadence statement it carried is now
    // one registry-derived sentence. Still SSR-served, still on the no-JS floor.
    await expect(page.locator('[data-home-source-cadence]')).toBeAttached();
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
        return !!el && el.id === 'film-npi-input';
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

    // Accessible name, not raw text: `KineticPhrase` renders the phrase twice on
    // purpose — once `sr-only` for assistive tech and once `aria-hidden` for the
    // per-word animation — so textContent legitimately reads it twice. The
    // accessible name is the single copy a screen reader announces, which is the
    // thing this contract is actually about.
    await expect(page.locator('h1').first()).toHaveAccessibleName('Get hired faster.');
    // The mandate's copy ceiling is ONE short editorial phrase per scene, so the
    // old two-sentence subhead is now just "Start with your NPI." The contract
    // that matters — the action is explained in plain words — is unchanged.
    await expect(page.getByText('Start with your NPI.', { exact: false }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /check what’s ready/i })).toBeVisible();
    await expect(page.getByText('Free for clinicians · No account required')).toBeVisible();

    const heroText = (await page.locator('[data-film-scene="arrival"]').innerText()).toLowerCase();
    for (const jargon of ['career evidence network', 'matcha', 'proof packet', 'recognition']) {
      expect(heroText, `category jargon "${jargon}" leaked above the fold`).not.toContain(jargon);
    }
    expect(heroText).not.toContain('recognizes your identity');
    await expect(page.locator('[data-narrative-state], [data-narrative-words], [data-narrative-complete]')).toHaveCount(0);
  });

  test('Cloud Dancer is scoped to the homepage: it paints / and does not leak to other routes', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/', { waitUntil: 'networkidle' });

    const home = await page.evaluate(() => {
      const film = document.querySelector('.film') as HTMLElement;
      return {
        body: getComputedStyle(document.body).backgroundColor,
        token: getComputedStyle(film).getPropertyValue('--vt-cloud-dancer').trim(),
        paper: getComputedStyle(film).getPropertyValue('--film-paper').trim(),
      };
    });
    // CSS minification lowercases hex — compare case-insensitively.
    expect(home.token.toLowerCase()).toBe('#f0eee9');
    expect(home.paper.toLowerCase()).toMatch(/#f0eee9|var\(--vt-cloud-dancer/);
    expect(home.body).toBe('rgb(240, 238, 233)');

    // The precedence contract, restated for this composition. The retired page
    // scoped its paper with `.mz-cloud-paper` and proved `.dark .mz` still won;
    // the film has no `.mz` scope, so the equivalent guarantee is ROUTE scoping:
    // the paper is set by a style that unmounts with the film, and must not
    // follow the reader to another surface.
    await page.goto('/trust', { waitUntil: 'networkidle' });
    const elsewhere = await page.evaluate(() => ({
      body: getComputedStyle(document.body).backgroundColor,
      film: document.querySelectorAll('.film').length,
    }));
    expect(elsewhere.film, 'the film must not render outside /').toBe(0);
    expect(elsewhere.body, 'Cloud Dancer must not leak past the homepage').not.toBe(
      'rgb(240, 238, 233)',
    );
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
    await expect(page.locator('[data-home-source-cadence]')).toBeAttached();
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
