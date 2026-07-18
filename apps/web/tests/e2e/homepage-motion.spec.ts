import { expect, test, type Page, type TestInfo } from '@playwright/test';

async function captureStoryFrame(page: Page, testInfo: TestInfo, name: string, progress: number) {
  const story = page.locator('[data-home-sticky-product-story]');
  const metrics = await story.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return { top: rect.top + window.scrollY, height: rect.height };
  });
  const scrollDistance = Math.max(1, metrics.height - page.viewportSize()!.height);
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'auto' }), metrics.top + scrollDistance * progress);
  // The story intentionally settles over ~1s; screenshots capture the stable
  // lockup rather than an arbitrary frame in the flip.
  await page.waitForTimeout(1250);
  const screenshot = await page.screenshot({ animations: 'disabled' });
  await testInfo.attach(`homepage-story-${name}`, { body: screenshot, contentType: 'image/png' });
}

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

  test('hero stays compact while every narrative phrase completes on screen', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/', { waitUntil: 'networkidle' });

    const hero = page.locator('#wallet');
    await expect(page.locator('[data-home-hero-stage]')).toHaveCSS('position', 'relative');
    const heroHeight = await hero.evaluate((node) => node.getBoundingClientRect().height);
    expect(heroHeight, 'hero must fit within the opening viewport').toBeLessThanOrEqual(1000);
    await expect(page.locator('[data-home-primary-cta]')).toBeInViewport();

    const subhead = page.locator('[data-home-hero-subhead]');
    const seen = new Set<string>();
    const height = page.viewportSize()!.height;
    let completedAt = -1;

    for (let y = 0; y <= 360 && completedAt < 0; y += 30) {
      await scrollTo(page, y);
      const state = String(await subhead.getAttribute('data-narrative-state'));
      const box = await subhead.boundingBox();
      expect(box, `narrative missing at scrollY=${y}`).not.toBeNull();
      expect(box!.y, `phrase ${state} filled above the viewport at scrollY=${y}`).toBeGreaterThan(0);
      expect(box!.y + box!.height, `phrase ${state} filled below the viewport at scrollY=${y}`).toBeLessThan(height);
      seen.add(state.split(':')[0]);

      // The fill ACCUMULATES. Once the scrub has moved past the first clause,
      // the sentence's first word must still be fully inked — phrase-replace
      // (words vanishing) is a regression.
      if (Number(state.split(':')[0]) >= 1) {
        const firstWordOpacity = await subhead
          .locator('[data-narrative-words] span[data-ch]')
          .first()
          .evaluate((node) => Number(getComputedStyle(node).opacity));
        expect(firstWordOpacity, `first letter un-inked at scrollY=${y} (state ${state})`).toBeGreaterThan(0.9);
      }

      if ((await subhead.getAttribute('data-narrative-complete')) !== null) completedAt = y;
    }

    // The fill finishes quickly while the hero remains visible; no extra
    // viewport is reserved merely to complete decorative motion.
    expect(completedAt, 'sequence never completed inside the compact hero').toBeGreaterThan(0);
    expect(completedAt).toBeLessThanOrEqual(360);
    // All five phrases were reached — none skipped past the fold.
    expect([...seen].sort()).toEqual(['0', '1', '2', '3', '4']);
  });

  test('narrative reveal is scroll-linked and reverses deterministically', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/', { waitUntil: 'networkidle' });
    const subhead = page.locator('[data-home-hero-subhead]');
    const stateAt = async (y: number) => {
      await scrollTo(page, y);
      return subhead.getAttribute('data-narrative-state');
    };

    const forward: string[] = [];
    for (const y of [0, 100, 200, 300]) forward.push(String(await stateAt(y)));

    // Advancing scroll advances the sequence (never regresses).
    const phraseIdx = forward.map((s) => Number(s.split(':')[0]));
    expect(phraseIdx).toEqual([...phraseIdx].sort((a, b) => a - b));
    expect(phraseIdx.at(-1)).toBeGreaterThan(phraseIdx[0]);

    // Reverse scroll reproduces each state exactly (pure function of scroll).
    for (const y of [200, 100, 0]) {
      expect(await stateAt(y), `reverse mismatch at scrollY=${y}`).toBe(forward[[0, 100, 200, 300].indexOf(y)]);
    }
  });

  test('captures the start, middle, and end of the reversible rolodex sequence', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/', { waitUntil: 'networkidle' });

    const story = page.locator('[data-home-sticky-product-story]');
    await expect(story).toBeVisible();
    await expect(story).toHaveCSS('min-height', '2000px');
    await expect(story).toHaveAttribute('data-story-motion', 'motion-values');
    await expect(story).toHaveAttribute('data-story-effect', 'rolodex');
    await expect(story).toHaveAttribute('data-story-transition-ms', '1050');
    const storyHeight = await story.evaluate((node) => node.getBoundingClientRect().height);
    const transitionRunway = (storyHeight - page.viewportSize()!.height) / 4;
    expect(transitionRunway, 'each card transition must begin within 35vh').toBeLessThanOrEqual(350);

    // The rolodex mechanics: the stack has real perspective and cards hinge on
    // a spindle BELOW their box, so the step change is a flip, not a fade.
    await expect(page.locator('.story-cards')).toHaveCSS('perspective', '1500px');
    const origin = await page
      .locator('[data-story-card="recognize"]')
      .evaluate((n) => getComputedStyle(n).transformOrigin);
    const originYFraction = await page.locator('[data-story-card="recognize"]').evaluate((n) => {
      const parts = getComputedStyle(n).transformOrigin.split(' ');
      return Number.parseFloat(parts[1]) / n.getBoundingClientRect().height;
    });
    expect(originYFraction, `spindle below the card (origin ${origin})`).toBeGreaterThan(1.05);

    await captureStoryFrame(page, testInfo, 'start', 0);
    await expect(story).toHaveAttribute('data-active-step', 'recognize');

    // Mid-flip, a non-active card is ROTATED in X (matrix3d), not just faded.
    await page.evaluate(() => {
      const node = document.querySelector('[data-home-sticky-product-story]')!;
      const rect = node.getBoundingClientRect();
      const distance = rect.height - window.innerHeight;
      window.scrollTo({ top: rect.top + window.scrollY + distance * 0.32, behavior: 'auto' });
    });
    await page.waitForTimeout(400);
    const midTransform = await page
      .locator('[data-story-card="prepare"]')
      .evaluate((n) => getComputedStyle(n).transform);
    expect(midTransform, 'transitioning card must carry a 3d flip').toContain('matrix3d');

    await captureStoryFrame(page, testInfo, 'middle', 0.5);
    await expect(story).toHaveAttribute('data-active-step', 'match');
    await captureStoryFrame(page, testInfo, 'end', 1);
    await expect(story).toHaveAttribute('data-active-step', 'accept');

    // Reverse scroll must deterministically reverse the active state.
    await captureStoryFrame(page, testInfo, 'reverse-middle', 0.5);
    await expect(story).toHaveAttribute('data-active-step', 'match');
  });

  for (const width of [360, 768, 1440]) {
    test(`has no horizontal page overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/', { waitUntil: 'networkidle' });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
      if (width === 1440) {
        await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(250, 250, 248)');
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

  test('mobile swipe updates the active story step (card observer)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/', { waitUntil: 'networkidle' });
    const story = page.locator('[data-home-sticky-product-story]');
    await story.scrollIntoViewIfNeeded();
    await expect(story).toHaveAttribute('data-active-step', 'recognize');
    // Swipe (programmatic horizontal scroll of the snap track) to the 3rd card.
    await page.evaluate(() => {
      const track = document.querySelector('.story-cards')!;
      const card = track.querySelectorAll<HTMLElement>('[data-story-card-index]')[2]!;
      track.scrollTo({ left: card.offsetLeft - (track as HTMLElement).offsetLeft, behavior: 'auto' });
    });
    await expect(story).toHaveAttribute('data-active-step', 'match');
    // Tap-to-jump also works (the dead cardRefs no-op is fixed).
    await page.getByRole('button', { name: /05.*Accept/i }).click();
    await expect(story).toHaveAttribute('data-active-step', 'accept');
  });

  test('mobile: story keeps scroll-snap; the carousel belt flows inside a clip', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/', { waitUntil: 'networkidle' });
    await expect(page.locator('.story-stage')).toHaveCSS('position', 'relative');
    await expect(page.locator('.story-cards')).toHaveCSS('scroll-snap-type', 'x mandatory');
    await expect(page.locator('.product-carousel-track')).toHaveCSS('overflow', 'hidden');
    await expect(page.locator('[data-carousel-belt]')).toHaveCSS('display', 'flex');
  });

  test('reduced motion exposes a static stacked story and carousel grid', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/', { waitUntil: 'networkidle' });
    await expect(page.locator('[data-story-card]')).toHaveCount(5);
    await expect(page.locator('.story-stage')).toHaveCSS('position', 'relative');
    await expect(page.locator('[data-carousel-belt]')).toHaveCSS('display', 'grid');
    // One copy of each card only — the seam duplicate never renders.
    await expect(page.locator('[data-carousel-belt] article')).toHaveCount(6);
    await expect(page.getByText(/VitalCV recognizes your identity, checks the primary sources/).first()).toBeVisible();
    // Headings render plain and complete under reduced motion (M1 contract).
    await expect(page.locator('#product-story-title')).toHaveAttribute('data-scrub-heading', 'reduced');
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

  // ── Reader features (Chris, 2026-07-18): scroll-focus manifesto ──

  test('the manifesto lines come into focus by distance from viewport centre', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/', { waitUntil: 'networkidle' });

    const band = page.locator('[data-home-manifesto]');
    const lines = page.locator('[data-manifesto-line]');
    await expect(lines).toHaveCount(4);
    // Every line's full text is present regardless of the visual focus.
    await expect(band).toContainText('A résumé says you are qualified.');
    await expect(band).toContainText('VitalCV is the system beneath it:');

    // Park the band so its top sits high in the viewport: the first line is far
    // from centre (dim) while a lower line sits near centre (sharp).
    const top = await band.evaluate((n) => n.getBoundingClientRect().top + window.scrollY);
    await scrollTo(page, Math.max(0, top - 60));
    await page.waitForTimeout(160);
    const opacities = await lines.evaluateAll((els) =>
      els.map((e) => Number(getComputedStyle(e).opacity)),
    );
    const spread = Math.max(...opacities) - Math.min(...opacities);
    expect(spread, `focus gradient across lines (${opacities.join(', ')})`).toBeGreaterThan(0.25);
  });

  test('reduced motion renders every manifesto line fully legible', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/', { waitUntil: 'networkidle' });
    const opacities = await page
      .locator('[data-manifesto-line]')
      .evaluateAll((els) => els.map((e) => Number(getComputedStyle(e).opacity)));
    expect(Math.min(...opacities)).toBeGreaterThan(0.99);
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

  test('the reusable-evidence cycler carries an honest static meaning', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/', { waitUntil: 'networkidle' });
    const cycle = page.locator('[data-home-proof-cycle]');
    // The animated words are decorative; the complete meaning is real text.
    await expect(cycle).toHaveAccessibleName('Carry your source-backed evidence forward');
    await expect(cycle.locator('.proofcycle-word')).toHaveCount(5);
    // The rotation is running (an animation is applied to the words).
    const anim = await cycle.locator('.proofcycle-word').first().evaluate(
      (n) => getComputedStyle(n).animationName,
    );
    expect(anim).toBe('proofcycle-spin');
  });

  test('reduced motion parks the evidence cycler', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/', { waitUntil: 'networkidle' });
    const anim = await page.locator('[data-home-proof-cycle] .proofcycle-word').first().evaluate(
      (n) => getComputedStyle(n).animationName,
    );
    expect(anim).toBe('none');
  });
});
