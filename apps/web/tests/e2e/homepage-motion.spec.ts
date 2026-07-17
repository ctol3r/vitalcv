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
  // lockup rather than an arbitrary frame in the overlap.
  await page.waitForTimeout(1250);
  const screenshot = await page.screenshot({ animations: 'disabled' });
  await testInfo.attach(`homepage-story-${name}`, { body: screenshot, contentType: 'image/png' });
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

      // Palantir/Anyscale register: the fill ACCUMULATES. Once the scrub has
      // moved past the first clause, the sentence's first word must still be
      // fully inked — phrase-replace (words vanishing) is a regression.
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

  // Heading behavior (character scrub, anchors, reverse, reduced motion) is
  // owned end-to-end by scrub-headings.spec.ts since Motion M1 replaced
  // ScrollTypeHeading with ScrollScrubHeading.

  test('captures the start, middle, and end of the reversible pinned sequence', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/', { waitUntil: 'networkidle' });

    const story = page.locator('[data-home-sticky-product-story]');
    await expect(story).toBeVisible();
    await expect(story).toHaveCSS('min-height', '2000px');
    await expect(story).toHaveAttribute('data-story-motion', 'motion-values');
    await expect(story).toHaveAttribute('data-story-transition-ms', '1050');
    const storyHeight = await story.evaluate((node) => node.getBoundingClientRect().height);
    const transitionRunway = (storyHeight - page.viewportSize()!.height) / 4;
    expect(transitionRunway, 'each card transition must begin within 35vh').toBeLessThanOrEqual(350);

    await captureStoryFrame(page, testInfo, 'start', 0);
    await expect(story).toHaveAttribute('data-active-step', 'recognize');
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

  test('uses a readable scroll-snap story and carousel on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/', { waitUntil: 'networkidle' });
    await expect(page.locator('.story-stage')).toHaveCSS('position', 'relative');
    await expect(page.locator('.story-cards')).toHaveCSS('scroll-snap-type', 'x mandatory');
    await expect(page.locator('.product-carousel-track')).toHaveCSS('scroll-snap-type', 'x mandatory');
  });

  test('reduced motion exposes a static stacked story and carousel', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/', { waitUntil: 'networkidle' });
    await expect(page.locator('[data-story-card]')).toHaveCount(5);
    await expect(page.locator('.story-stage')).toHaveCSS('position', 'relative');
    await expect(page.locator('.product-carousel-track')).toHaveCSS('display', 'grid');
    await expect(page.getByText(/VitalCV recognizes your identity, checks the primary sources/).first()).toBeVisible();
    // Headings render plain and complete under reduced motion (M1 contract).
    await expect(page.locator('#product-story-title')).toHaveAttribute('data-scrub-heading', 'reduced');
    await expect(page.locator('#product-carousel-title')).toHaveAttribute('data-scrub-heading', 'reduced');
  });

  // Auto-advance was DELIBERATELY added on Chris's 2026-07-16 direction,
  // reversing the wave's original "no autoplay" rule. The contract now is
  // accessible autoplay: it advances only while idle, on-screen, and unhovered;
  // any manual navigation stops it; a visible pause control exists; and
  // reduced-motion users never see it move on its own.
  // A goTo() smooth-scroll can be mid-flight when we sample (an autoplay tick
  // or manual nav we just triggered). Wait until scrollLeft is stable before
  // opening a no-drift assertion window, or the animation tail reads as drift.
  async function settledScrollLeft(carousel: import('@playwright/test').Locator): Promise<number> {
    let prev = -1;
    await expect
      .poll(
        async () => {
          const current = await carousel.evaluate((node) => node.scrollLeft);
          const stable = Math.abs(current - prev) < 1;
          prev = current;
          return stable;
        },
        { intervals: [400], timeout: 8000 },
      )
      .toBe(true);
    return prev;
  }

  test('carousel uses a controlled one-second slide with active-card depth', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/', { waitUntil: 'networkidle' });
    const section = page.locator('[data-home-product-carousel]');
    const carousel = page.getByRole('region', { name: 'VitalCV product surfaces' });
    await section.scrollIntoViewIfNeeded();
    await expect(section).toHaveAttribute('data-carousel-hold-ms', '11000');
    await expect(section).toHaveAttribute('data-carousel-transition-ms', '1050');

    const target = await carousel.evaluate((track) => {
      const card = track.querySelector<HTMLElement>('[data-carousel-index="1"]')!;
      const scrollPadding = Number.parseFloat(getComputedStyle(track).scrollPaddingLeft) || 0;
      return Math.max(0, card.offsetLeft - (track as HTMLElement).offsetLeft - scrollPadding);
    });
    const start = await carousel.evaluate((node) => node.scrollLeft);
    await page.getByRole('button', { name: 'Next product' }).click();
    await expect(section).toHaveAttribute('data-carousel-autoplay', 'off');
    await expect(carousel).toHaveAttribute('data-transitioning', 'true');
    await page.waitForTimeout(260);
    const middle = await carousel.evaluate((node) => node.scrollLeft);
    expect(middle).toBeGreaterThan(start + 1);
    expect(middle).toBeLessThan(target - 1);

    await expect.poll(() => carousel.evaluate((node) => node.scrollLeft), { timeout: 3000 }).toBeCloseTo(target, 0);
    await expect(carousel).not.toHaveAttribute('data-transitioning', 'true');
    await expect(carousel.locator('[data-carousel-index="1"]')).toHaveAttribute('data-active', 'true');
    await expect(carousel.locator('[data-carousel-index="1"]'))
      .toHaveCSS('opacity', '1');
  });

  test('carousel auto-advances while idle and stops on manual navigation', async ({ page }) => {
    test.setTimeout(70_000);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/', { waitUntil: 'networkidle' });
    const section = page.locator('[data-home-product-carousel]');
    const carousel = page.getByRole('region', { name: 'VitalCV product surfaces' });
    await section.scrollIntoViewIfNeeded();
    await expect(section).toHaveAttribute('data-carousel-autoplay', 'on');
    await expect(section).toHaveAttribute('data-carousel-hold-ms', '11000');

    // Idle + visible + unhovered (mouse never entered the section) → advances.
    const before = await carousel.evaluate((node) => node.scrollLeft);
    await expect
      .poll(() => carousel.evaluate((node) => node.scrollLeft), { timeout: 15_000 })
      .toBeGreaterThan(before);

    // Keyboard navigation still works — and it takes the wheel: autoplay stops.
    await carousel.focus();
    await page.keyboard.press('ArrowRight');
    await expect(section).toHaveAttribute('data-carousel-autoplay', 'off');
    await page.mouse.move(10, 10);
    await page.keyboard.press('Escape');
    await carousel.evaluate((node) => (node as HTMLElement).blur());
    const stopped = await settledScrollLeft(carousel);
    await page.waitForTimeout(12_000);
    expect(Math.abs((await carousel.evaluate((node) => node.scrollLeft)) - stopped)).toBeLessThan(2);
  });

  test('carousel autoplay pauses on hover and honors the pause control', async ({ page }) => {
    test.setTimeout(70_000);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/', { waitUntil: 'networkidle' });
    const section = page.locator('[data-home-product-carousel]');
    const carousel = page.getByRole('region', { name: 'VitalCV product surfaces' });
    await section.scrollIntoViewIfNeeded();

    // Hovering anywhere in the section suspends the timer (WCAG 2.2.2).
    await section.hover();
    const hovered = await settledScrollLeft(carousel);
    await page.waitForTimeout(12_000);
    expect(Math.abs((await carousel.evaluate((node) => node.scrollLeft)) - hovered)).toBeLessThan(2);

    // The visible pause control flips the state and survives un-hovering.
    await page.getByRole('button', { name: 'Pause auto-advance' }).click();
    await expect(section).toHaveAttribute('data-carousel-autoplay', 'off');
    await expect(page.getByRole('button', { name: 'Resume auto-advance' })).toBeVisible();
    await page.mouse.move(10, 10);
    const paused = await settledScrollLeft(carousel);
    await page.waitForTimeout(2000);
    expect(Math.abs((await carousel.evaluate((node) => node.scrollLeft)) - paused)).toBeLessThan(2);
  });

  test('reduced motion never auto-advances', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/', { waitUntil: 'networkidle' });
    await expect(page.locator('[data-home-product-carousel]')).toHaveAttribute(
      'data-carousel-autoplay',
      'off',
    );
  });
});
