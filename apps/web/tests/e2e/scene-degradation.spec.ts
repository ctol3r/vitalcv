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
  await expect(page.getByRole('button', { name: /check what.s ready/i })).toBeEnabled();
}

test.describe('scene degradation matrix (SHD-6.1)', () => {
  test('static tier: posters only, no live canvas, NPI fully usable', async ({ page }) => {
    const errors = collectPageErrors(page);
    await page.setViewportSize(DESKTOP);
    await page.goto('/?sceneTier=static', { waitUntil: 'networkidle' });

    // Every scene boundary honors the forced tier.
    const boundaries = page.locator('[data-scene-boundary]');
    const count = await boundaries.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      await expect(boundaries.nth(i)).toHaveAttribute('data-scene-tier', 'static');
    }

    // The designed poster is the visual — no live scene canvas mounts.
    await expect(page.locator('[data-field-poster]')).toBeAttached();
    await expect(page.locator('[data-home-evidence-field] canvas')).toHaveCount(0);

    await expectNpiActionUsable(page);
    await expectNoHorizontalOverflow(page);
    expect(errors).toEqual([]);
  });

  test('canvas2d tier: the live 2D scene mounts over the poster, which stays', async ({ page }) => {
    const errors = collectPageErrors(page);
    await page.setViewportSize(DESKTOP);
    await page.goto('/?sceneTier=canvas2d', { waitUntil: 'networkidle' });

    const field = page.locator('[data-home-evidence-field] [data-scene-boundary]');
    await expect(field).toHaveAttribute('data-scene-tier', 'canvas2d');
    // Live scene present…
    await expect(page.locator('[data-home-evidence-field] canvas')).not.toHaveCount(0);
    // …and the poster is layered beneath it, never removed.
    await expect(page.locator('[data-field-poster]')).toBeAttached();

    await expectNpiActionUsable(page);
    expect(errors).toEqual([]);
  });

  test('webgpu tier in a GPU-less browser: degrades cleanly, never a blank or error region', async ({ page }) => {
    const errors = collectPageErrors(page);
    await page.setViewportSize(DESKTOP);
    await page.goto('/?sceneTier=webgpu', { waitUntil: 'networkidle' });

    const field = page.locator('[data-home-evidence-field] [data-scene-boundary]');
    // The boundary grants the forced tier; the field's WebGPU renderer must
    // fall back internally (onFallback → Canvas-2D) when init fails.
    await expect(field).toHaveAttribute('data-scene-tier', 'webgpu');
    // Never a crash-fallback marker, never a missing poster.
    await expect(field).not.toHaveAttribute('data-scene-error', '');
    await expect(page.locator('[data-field-poster]')).toBeAttached();
    // A live surface eventually paints (WebGPU where supported, else the 2D
    // fallback) — either way a canvas exists and the page stays whole.
    await expect(page.locator('[data-home-evidence-field] canvas')).not.toHaveCount(0, { timeout: 10_000 });

    await expectNpiActionUsable(page);
    expect(errors).toEqual([]);
  });

  test('an invalid sceneTier value is ignored — real detection decides, page stays whole', async ({ page }) => {
    const errors = collectPageErrors(page);
    await page.setViewportSize(DESKTOP);
    await page.goto('/?sceneTier=bogus', { waitUntil: 'networkidle' });

    const field = page.locator('[data-home-evidence-field] [data-scene-boundary]');
    const tier = await field.getAttribute('data-scene-tier');
    expect(['static', 'canvas2d', 'webgpu']).toContain(tier);
    await expect(page.locator('[data-field-poster]')).toBeAttached();
    await expectNpiActionUsable(page);
    expect(errors).toEqual([]);
  });

  test('reduced motion resolves every boundary to static — no live scene anywhere', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize(DESKTOP);
    await page.goto('/', { waitUntil: 'networkidle' });

    const boundaries = page.locator('[data-scene-boundary]');
    const count = await boundaries.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      await expect(boundaries.nth(i)).toHaveAttribute('data-scene-tier', 'static');
    }
    await expect(page.locator('[data-home-evidence-field] canvas')).toHaveCount(0);
  });

  test('no-JS SSR floor: heading, NPI form, posters, and source lanes are all served', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, viewport: DESKTOP });
    const page = await context.newPage();
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('h1')).toBeVisible();
    await expect(page.getByLabel('NPI number')).toBeAttached();
    await expect(page.locator('[data-field-poster]')).toBeAttached();
    await expect(page.locator('[data-home-source-strip]')).toBeAttached();
    // The scene never blocks the semantic page: boundaries render their poster
    // server-side (static) with no client JS at all.
    await expect(page.locator('[data-scene-boundary]').first()).toBeAttached();

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

test.describe('perceived visibility + Cloud Dancer scope (HERO-RESET-1)', () => {
  test('static tier: the evidence field is visibly COMPOSED, not merely attached', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/?sceneTier=static', { waitUntil: 'networkidle' });

    const field = page.locator('[data-home-evidence-field]');
    const box = await field.boundingBox();
    expect(box, 'field panel must occupy real space').not.toBeNull();
    expect(box!.width).toBeGreaterThan(300);
    expect(box!.height).toBeGreaterThan(300);

    // The shared caption layer names the composition on EVERY tier — a human
    // can identify sources → record without canvas or GPU.
    for (const label of ['NPPES', 'OIG / LEIE', 'PECOS', 'Your career record']) {
      await expect(field.locator('[data-field-labels]').getByText(label)).toBeVisible();
    }

    // The poster carries real geometry: colored connectors, glowing atoms, a
    // record capsule, and exactly one bounded decision-ring cluster — with
    // fills/strokes that are NOT the paper color (the "present but invisible"
    // failure this bundle exists to prevent).
    const density = await field.locator('[data-field-poster]').evaluate((svg) => {
      const paper = getComputedStyle(document.querySelector('.home-cloud-dancer')!).backgroundColor;
      const els = [...svg.querySelectorAll('circle, line, rect, ellipse')];
      const colored = els.filter((el) => {
        const s = getComputedStyle(el as SVGElement);
        const fill = s.fill;
        const stroke = s.stroke;
        return (fill !== 'none' && fill !== paper) || (stroke !== 'none' && stroke !== paper);
      });
      return { total: els.length, colored: colored.length };
    });
    expect(density.total).toBeGreaterThan(30);
    expect(density.colored).toBeGreaterThan(25);
  });

  test('canvas2d tier: the live canvas actually PAINTS over the same composition', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/?sceneTier=canvas2d', { waitUntil: 'networkidle' });

    const canvas = page.locator('[data-home-evidence-field] canvas');
    await expect(canvas).toBeVisible();
    // Same-origin canvas is readable: require a material number of painted
    // (non-transparent) pixels — a mounted-but-blank canvas fails.
    await expect
      .poll(
        () =>
          canvas.evaluate((c) => {
            const ctx = (c as HTMLCanvasElement).getContext('2d');
            if (!ctx) return -1;
            const { width, height } = c as HTMLCanvasElement;
            if (width === 0 || height === 0) return 0;
            const data = ctx.getImageData(0, 0, width, height).data;
            let painted = 0;
            for (let i = 3; i < data.length; i += 40) if (data[i] > 8) painted++;
            return painted;
          }),
        { timeout: 5000 },
      )
      .toBeGreaterThan(500);
    // The caption layer still names the composition above the canvas.
    await expect(page.locator('[data-field-labels]').getByText('NPPES')).toBeVisible();
  });

  test('Cloud Dancer papers the homepage — and ONLY the homepage', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/', { waitUntil: 'networkidle' });
    const homePaper = await page
      .locator('.home-cloud-dancer')
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(homePaper).toBe('rgb(240, 238, 233)');

    // A non-homepage public surface must NOT drift to the new paper.
    await page.goto('/trust', { waitUntil: 'domcontentloaded' });
    const trustPaper = await page.evaluate(
      () => getComputedStyle(document.body).backgroundColor,
    );
    expect(trustPaper).not.toBe('rgb(240, 238, 233)');
  });
});
