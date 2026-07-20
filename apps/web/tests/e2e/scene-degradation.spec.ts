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

    await expect(page.locator('h1').first()).toBeVisible();
    await expect(page.getByLabel('NPI number')).toBeAttached();
    await expect(page.locator('[data-field-poster]')).toBeAttached();
    await expect(page.locator('[data-home-source-strip]')).toBeAttached();
    // The scene never blocks the semantic page: boundaries render their poster
    // server-side (static) with no client JS at all.
    await expect(page.locator('[data-scene-boundary]').first()).toBeAttached();
    // HERO-RESET-1: the designed composition — named stations, ring, legend —
    // is complete without JavaScript, not a low-contrast emergency state.
    for (const id of ['nppes', 'oig-leie', 'pecos', 'record', 'opportunity']) {
      await expect(page.locator(`[data-field-label="${id}"]`)).toBeAttached();
    }
    await expect(page.locator('[data-poster-ring]')).toBeAttached();
    await expect(page.locator('[data-field-legend]')).toBeAttached();

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
    expect(paper.token).toBe('#F0EEE9');
    expect(paper.root).toBe('rgb(240, 238, 233)');
    expect(paper.body).toBe('rgb(240, 238, 233)');

    // Precedence contract: the dark theme's paper stays authoritative — the
    // Cloud Dancer scope must never leak into dark or non-optin surfaces.
    const darkPaper = await page.evaluate(() => {
      document.documentElement.classList.add('dark');
      const v = getComputedStyle(document.querySelector('.mz-cloud-paper') as HTMLElement).backgroundColor;
      document.documentElement.classList.remove('dark');
      return v;
    });
    expect(darkPaper).toBe('rgb(21, 20, 15)'); // .dark .mz --paper #15140f
  });

  test('static tier: the designed composition is inside the panel and materially distinct from it', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/?sceneTier=static', { waitUntil: 'networkidle' });

    const field = page.locator('[data-home-evidence-field]');
    const box = await field.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(300);
    expect(box!.height).toBeGreaterThan(300);

    // Every named station renders INSIDE the visible panel — the old sliced
    // viewBox cropped the sources and opportunity out of the tall desktop
    // panel, which is exactly the "reads as empty" failure.
    for (const id of ['nppes', 'oig-leie', 'pecos', 'record', 'opportunity']) {
      const label = page.locator(`[data-field-label="${id}"]`);
      await expect(label).toBeVisible();
      const lb = await label.boundingBox();
      expect(lb, `${id} label has a box`).not.toBeNull();
      const inside =
        lb!.x >= box!.x - 1 &&
        lb!.x + lb!.width <= box!.x + box!.width + 1 &&
        lb!.y >= box!.y - 1 &&
        lb!.y + lb!.height <= box!.y + box!.height + 1;
      expect(inside, `${id} label inside the panel`).toBe(true);
    }
    await expect(page.locator('[data-poster-ring]')).toBeVisible();

    // Deterministic contrast: a named source station vs the panel surface.
    const contrast = await page.evaluate(() => {
      const lum = (c: string) => {
        const m = (c.match(/\d+(\.\d+)?/g) || []).map(Number);
        const f = (v: number) => {
          const s = v / 255;
          return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
        };
        return 0.2126 * f(m[0] || 0) + 0.7152 * f(m[1] || 0) + 0.0722 * f(m[2] || 0);
      };
      const panel = document.querySelector('[data-home-evidence-field]') as HTMLElement;
      const station = document.querySelector('[data-field-poster] g circle[opacity="0.9"]') as SVGCircleElement | null;
      if (!panel || !station) return -1;
      const bg = lum(getComputedStyle(panel).backgroundColor);
      const fg = lum(getComputedStyle(station).fill);
      return (Math.max(bg, fg) + 0.05) / (Math.min(bg, fg) + 0.05);
    });
    expect(contrast, 'station color must stand off the panel, not camouflage').toBeGreaterThan(3);

    // Structural density: the poster is a designed drawing, not three faint lines.
    const shapes = await page
      .locator('[data-field-poster] line, [data-field-poster] circle, [data-field-poster] ellipse, [data-field-poster] rect')
      .count();
    expect(shapes).toBeGreaterThan(20);
  });

  test('canvas tier: real pixels are painted over the same named composition', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/?sceneTier=canvas2d', { waitUntil: 'networkidle' });
    await expect(page.locator('[data-home-evidence-field] canvas')).not.toHaveCount(0);
    await page.waitForTimeout(900); // let a few frames draw

    const painted = await page.evaluate(() => {
      const canvas = document.querySelector('[data-home-evidence-field] canvas') as HTMLCanvasElement | null;
      if (!canvas || canvas.width === 0) return -1;
      const ctx = canvas.getContext('2d');
      if (!ctx) return -2;
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let hits = 0;
      for (let i = 3; i < data.length; i += 40) if (data[i] > 8) hits += 1;
      return hits;
    });
    expect(painted, 'the 2D scene must paint real, non-transparent pixels').toBeGreaterThan(50);

    // The shared label overlay is identical on the animated tier.
    await expect(page.locator('[data-field-label="nppes"]')).toBeVisible();
    await expect(page.locator('[data-field-label="record"]')).toBeVisible();
  });

  test('reduced motion: the poster composition is complete and obvious without any render loop', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize(DESKTOP);
    await page.goto('/', { waitUntil: 'networkidle' });

    await expect(page.locator('[data-home-evidence-field] canvas')).toHaveCount(0);
    await expect(page.locator('[data-poster-ring]')).toBeAttached();
    for (const id of ['nppes', 'oig-leie', 'pecos', 'record', 'opportunity']) {
      await expect(page.locator(`[data-field-label="${id}"]`)).toBeVisible();
    }
  });

  test('mobile: the field follows the form, stays visible, and never crowds the NPI action', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/?sceneTier=static', { waitUntil: 'networkidle' });

    const form = await page.locator('#npi').boundingBox();
    const field = await page.locator('[data-home-evidence-field]').boundingBox();
    expect(form).not.toBeNull();
    expect(field).not.toBeNull();
    expect(field!.y, 'field follows the form on mobile').toBeGreaterThan(form!.y);
    expect(field!.height).toBeGreaterThan(180);
    await expect(page.locator('[data-field-label="record"]')).toBeVisible();
    await expectNpiActionUsable(page);
    await expectNoHorizontalOverflow(page);
  });
});
