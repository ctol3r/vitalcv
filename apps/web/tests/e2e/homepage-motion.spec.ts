import { expect, test, type Page, type TestInfo } from '@playwright/test';

test.describe('Homepage motion convergence', () => {
  // behavior: 'instant' — the page sets CSS smooth scrolling, so 'auto' defers
  // to it and one-shot reads would race the animation.
  async function scrollTo(page: Page, y: number) {
    await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), y);
    await page.waitForFunction((top) => Math.abs(window.scrollY - top) <= 1, y);
    await page.waitForTimeout(110);
  }

  test('hero reset: outcome-first static copy, compact, with the scrub narrative gone', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/', { waitUntil: 'networkidle' });

    const hero = page.locator('#wallet');
    await expect(page.locator('[data-home-hero-stage]')).toHaveCSS('position', 'relative');
    const heroHeight = await hero.evaluate((node) => node.getBoundingClientRect().height);
    expect(heroHeight, 'hero must fit within the opening viewport').toBeLessThanOrEqual(1000);
    await expect(page.locator('[data-home-primary-cta]')).toBeInViewport();

    // The sell is readable at a glance (HERO-RESET-1): outcome, then mechanism.
    await expect(page.locator('h1').first()).toHaveText('Get hired faster.');
    const subhead = page.locator('[data-home-hero-subhead]');
    await expect(subhead).toBeVisible();
    await expect(subhead).toContainText('Start with your NPI.');

    // The scroll-scrub effect is deleted — no listener hooks, no progress
    // dots, no character spans, at any scroll depth.
    for (const y of [0, 150, 300]) {
      await scrollTo(page, y);
      await expect(page.locator('[data-narrative-state], [data-narrative-words], [data-narrative-complete]')).toHaveCount(0);
      await expect(subhead).toContainText('reuse your career profile for every job.');
    }
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toContain('recognizes your identity');
  });

  for (const width of [360, 768, 1440]) {
    test(`has no horizontal page overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/', { waitUntil: 'networkidle' });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
      if (width === 1440) {
        // Cloud Dancer public paper (HERO-RESET-1): #F0EEE9, route-scoped.
        await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(240, 238, 233)');
        // EvidenceTruthPanel retired; the limitation it owned now ships as the
        // shared boundary under the surviving proof section.
        await expect(page.locator('[data-home-truth-boundary]')).toHaveCount(1);
      }
    });
  }

  for (const width of [1024, 1366]) {
    test(`keeps the NPI action in the opening laptop viewport at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 768 });
      await page.goto('/', { waitUntil: 'networkidle' });
      await expect(page.locator('[data-home-primary-cta]')).toBeInViewport();
      const heroHeight = await page.locator('[data-home-hero]').evaluate((node) => node.getBoundingClientRect().height);
      expect(heroHeight).toBeLessThanOrEqual(768);
    });
  }

  test('mobile: journey chapters stack vertically', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/', { waitUntil: 'networkidle' });
    // W2 fallback: no pin, no navigator, all four chapters in document flow.
    await expect(page.locator('[data-story-rail]')).toHaveAttribute('data-rail-pinned', 'false');
    await expect(page.locator('[data-journey-card]')).toHaveCount(4);
    await expect(page.locator('[data-story-rail-nav]')).toHaveCount(0);
  });

  test('reduced motion exposes a static stacked story', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/', { waitUntil: 'networkidle' });
    // W2: reduced motion renders the four journey chapters as a static
    // vertical document — no pin, no navigator, no leaf transforms.
    await expect(page.locator('[data-journey-card]')).toHaveCount(4);
    await expect(page.locator('[data-story-rail]')).toHaveAttribute('data-rail-pinned', 'false');
    await expect(page.getByText(/Start with your NPI\. See what employers can confirm/).first()).toBeVisible();
    // The limitation is plain server-rendered text under reduced motion too.
    await expect(page.getByText('What this does not mean')).toBeVisible();
  });

  // ── Career Evidence Field (hero, VHS-1) ─────────────────────────────────
  // The force-directed graph was replaced by an abstract generative field. The
  // canvas itself is unverifiable from the DOM, so the tests pin the resilience
  // contract: a static SSR poster is always present (no blank/black hero), the
  // honest legend carries the meaning, and no graph appears in the hero.

  test('the hero renders the evidence field with an SSR poster and legend, no graph', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/', { waitUntil: 'networkidle' });

    const field = page.locator('[data-home-evidence-field]');
    await expect(field).toBeVisible();
    // Static poster is server-rendered → present even before/without canvas.
    await expect(field.locator('[data-field-poster]')).toBeAttached();
    // The honest, non-claiming legend expresses the meaning semantically.
    const legend = field.locator('[data-field-legend]');
    await expect(legend).toContainText('Source-backed');
    await expect(legend).toContainText('Employer decision');
    // No force-directed graph remains in the hero.
    await expect(page.locator('[data-home-hero-graph]')).toHaveCount(0);
    await expect(page.locator('[data-graph-caption]')).toHaveCount(0);
    // The deep graph is still reachable from the trust footer.
    await expect(page.locator('[data-home-trust-footer]').getByRole('link', { name: /evidence network/i })).toHaveAttribute('href', '/evidence-network');
  });

  test('reduced motion keeps the whole graph, with no continuous motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/', { waitUntil: 'networkidle' });
    const field = page.locator('[data-home-evidence-field]');
    await expect(field).toBeVisible();
    await expect(field.locator('[data-field-poster]')).toBeVisible();
    await page.waitForTimeout(600);

    // The field no longer has render TIERS. It used to be WebGPU → Canvas2D →
    // poster behind a SceneBoundary, where reduced motion's job was to resolve
    // the 'static' tier so no canvas mounted. It is now plain SVG, so the
    // guarantee is unconditional and stronger: there is no canvas and no rAF
    // loop to disable on any tier, for any visitor.
    await expect(field.locator('canvas')).toHaveCount(0);

    // Reduced motion must not COST anything: the full composition is still
    // present and still interactive — seven named nodes and the bounded ring.
    await expect(field.locator('[data-field-label]')).toHaveCount(7);
    await expect(field.locator('[data-poster-ring]')).toHaveCount(1);

    // The only continuous motion (the travelling edge pulse) is removed
    // outright rather than merely slowed.
    await expect(field.locator('.ceg-pulse').first()).toHaveCSS('display', 'none');
  });

  // AUD-1.1 guard: the left-floating "Page outline" was removed because at
  // desktop width it overlaid the first lines of major headings. This is the
  // regression guard — no fixed/sticky overlay may cover the primary heading,
  // the NPI field, or the primary CTA at 1366px desktop.
  test('no fixed/sticky overlay covers the primary heading or NPI action (AUD-1.1)', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto('/', { waitUntil: 'networkidle' });

    // The removed left-floating outline must not return.
    await expect(page.locator('[data-home-outline-panel]')).toHaveCount(0);

    // At each key content anchor, the topmost painted element must be the
    // content itself (or an ancestor/descendant of it) — never a fixed/sticky
    // overlay sitting on top.
    for (const sel of ['h1', '#npi-input', '[data-home-primary-cta]']) {
      const overlay = await page.locator(sel).first().evaluate((el) => {
        const r = el.getBoundingClientRect();
        const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        if (!top || el.contains(top) || top.contains(el)) return null;
        for (let n: Element | null = top; n; n = n.parentElement) {
          const pos = getComputedStyle(n).position;
          if (pos === 'fixed' || pos === 'sticky') {
            return n.getAttribute('data-home-outline-panel') !== null
              ? 'outline-panel'
              : n.className || n.tagName;
          }
        }
        return null;
      });
      expect(overlay, `fixed/sticky overlay covering ${sel}`).toBeNull();
    }
  });

  test('the ambient scene layer rides under content and never blocks input', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/', { waitUntil: 'networkidle' });

    const scene = page.locator('[data-home-scene]');
    await expect(scene).toHaveCSS('pointer-events', 'none');
    await expect(scene).toHaveCSS('position', 'fixed');
    await expect(scene).toHaveAttribute('aria-hidden', 'true');

    // The ambient COLOUR field is gone. It painted emerald 12% / indigo 10%
    // radial gradients on this fixed layer, so the tint stayed welded to the
    // viewport while content scrolled past — the single reason a deliberately
    // uniform Cloud Dancer page read as having an inconsistent background.
    // Grain (a baked texture, not a colour) is all that may live here now.
    await expect(page.locator('[data-scene-ambient]')).toHaveCount(0);

    // The NPI input receives real clicks straight through the fixed layer.
    await page.locator('#npi-input').click();
    await expect(page.locator('#npi-input')).toBeFocused();
  });
});
