import { expect, test, type Page, type TestInfo } from '@playwright/test';

/** The belt's current leftward travel in px (0 when untransformed). */
async function beltOffset(page: Page): Promise<number> {
  return page.locator('[data-carousel-belt]').evaluate((node) => {
    const t = getComputedStyle(node).transform;
    if (t === 'none') return 0;
    const m = new DOMMatrixReadOnly(t);
    return -m.m41;
  });
}

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
        await expect(page.locator('[data-home-evidence-trace]')).toHaveCount(1);
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

  test('mobile: journey chapters stack vertically; the carousel belt flows inside a clip', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/', { waitUntil: 'networkidle' });
    // W2 fallback: no pin, no navigator, all four chapters in document flow.
    await expect(page.locator('[data-story-rail]')).toHaveAttribute('data-rail-pinned', 'false');
    await expect(page.locator('[data-journey-card]')).toHaveCount(4);
    await expect(page.locator('[data-story-rail-nav]')).toHaveCount(0);
    await expect(page.locator('.product-carousel-track')).toHaveCSS('overflow', 'hidden');
    await expect(page.locator('[data-carousel-belt]')).toHaveCSS('display', 'flex');
  });

  test('reduced motion exposes a static stacked story and carousel grid', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/', { waitUntil: 'networkidle' });
    // W2: reduced motion renders the four journey chapters as a static
    // vertical document — no pin, no navigator, no leaf transforms.
    await expect(page.locator('[data-journey-card]')).toHaveCount(4);
    await expect(page.locator('[data-story-rail]')).toHaveAttribute('data-rail-pinned', 'false');
    await expect(page.locator('[data-carousel-belt]')).toHaveCSS('display', 'grid');
    // One copy of each card only — the seam duplicate never renders.
    await expect(page.locator('[data-carousel-belt] article')).toHaveCount(6);
    await expect(page.getByText(/Start with your NPI\. See what employers can confirm/).first()).toBeVisible();
    // Headings render plain and complete under reduced motion (M1 contract).
    await expect(page.locator('#product-carousel-title')).toHaveAttribute('data-scrub-heading', 'reduced');
  });

  // ── Continuous-flow carousel (Chris, 2026-07-17: "100% continuous flow") ──
  // The contract is a seamless marquee with accessible controls: it streams at
  // a constant pace while idle, suspends on hover/focus (WCAG 2.2.2 via the
  // visible pause control), duplicates its sequence once (aria-hidden) to hide
  // the wrap seam, and never moves for reduced-motion visitors.

  test('carousel streams continuously while idle and unhovered', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/', { waitUntil: 'networkidle' });
    const section = page.locator('[data-home-product-carousel]');
    await section.scrollIntoViewIfNeeded();
    await page.mouse.move(10, 10); // ensure the pointer is OUTSIDE the section
    await expect(section).toHaveAttribute('data-carousel-flow', 'continuous');
    await expect(section).toHaveAttribute('data-carousel-autoplay', 'on');

    // Two copies of the six cards, clones hidden from assistive tech.
    await expect(page.locator('[data-carousel-belt] article')).toHaveCount(12);
    await expect(page.locator('[data-carousel-belt] article[aria-hidden="true"]')).toHaveCount(6);

    const a = await beltOffset(page);
    await page.waitForTimeout(1200);
    const b = await beltOffset(page);
    await page.waitForTimeout(1200);
    const c = await beltOffset(page);
    expect(b, 'belt must advance').toBeGreaterThan(a);
    expect(c, 'belt must KEEP advancing — continuous, not stepped').toBeGreaterThan(b);
    // Constant pace: two equal windows travel roughly equal distances.
    expect(Math.abs(c - b - (b - a))).toBeLessThan(25);
  });

  test('carousel suspends on hover and honors the visible pause control', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/', { waitUntil: 'networkidle' });
    const section = page.locator('[data-home-product-carousel]');
    await section.scrollIntoViewIfNeeded();

    // Hovering anywhere in the section suspends the stream (WCAG 2.2.2).
    await section.hover();
    await page.waitForTimeout(300);
    const hovered = await beltOffset(page);
    await page.waitForTimeout(1500);
    expect(Math.abs((await beltOffset(page)) - hovered)).toBeLessThan(2);

    // The pause control flips the state and survives un-hovering.
    await page.getByRole('button', { name: 'Pause the product flow' }).click();
    await expect(section).toHaveAttribute('data-carousel-autoplay', 'off');
    await expect(page.getByRole('button', { name: 'Resume the product flow' })).toBeVisible();
    await page.mouse.move(10, 10);
    await page.waitForTimeout(300);
    const paused = await beltOffset(page);
    await page.waitForTimeout(1500);
    expect(Math.abs((await beltOffset(page)) - paused)).toBeLessThan(2);

    // Resume restores the stream.
    await page.getByRole('button', { name: 'Resume the product flow' }).click();
    await page.mouse.move(10, 10);
    const resumed = await beltOffset(page);
    await expect
      .poll(() => beltOffset(page), { intervals: [400], timeout: 5000 })
      .toBeGreaterThan(resumed + 5);
  });

  test('keyboard nudges the belt one card while focus holds the stream', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/', { waitUntil: 'networkidle' });
    const track = page.getByRole('region', { name: 'VitalCV product surfaces' });
    await track.scrollIntoViewIfNeeded();
    await track.focus();
    await page.waitForTimeout(200);
    const before = await beltOffset(page);
    await page.keyboard.press('ArrowRight');
    const after = await beltOffset(page);
    expect(after - before, 'ArrowRight advances about one card').toBeGreaterThan(300);
    // Focus inside the region keeps the stream suspended (no drift on top of
    // the manual position).
    await page.waitForTimeout(1200);
    expect(Math.abs((await beltOffset(page)) - after)).toBeLessThan(2);
  });

  test('reduced motion never streams', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/', { waitUntil: 'networkidle' });
    await expect(page.locator('[data-home-product-carousel]')).toHaveAttribute(
      'data-carousel-autoplay',
      'off',
    );
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

  test('reduced motion keeps the field poster with no animation loop', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/', { waitUntil: 'networkidle' });
    const field = page.locator('[data-home-evidence-field]');
    await expect(field).toBeVisible();
    // SHD-1.1 strengthened this contract: under reduced motion the
    // SceneBoundary resolves the 'static' tier, so the live canvas scene is
    // never MOUNTED (previously an idle canvas held opacity 0). The designed
    // poster is the whole visual.
    await expect(field.locator('[data-field-poster]')).toBeVisible();
    await page.waitForTimeout(600);
    await expect(field.locator('[data-scene-boundary]')).toHaveAttribute('data-scene-tier', 'static');
    await expect(field.locator('canvas')).toHaveCount(0);
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

    // The ambient canvas is mounted on animated tiers and aria-hidden.
    await expect(page.locator('[data-scene-ambient]')).toHaveCount(1);
    await expect(scene).toHaveAttribute('aria-hidden', 'true');

    // The NPI input receives real clicks straight through the fixed layer.
    await page.locator('#npi-input').click();
    await expect(page.locator('#npi-input')).toBeFocused();
  });
});
