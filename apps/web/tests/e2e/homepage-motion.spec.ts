import { expect, test, type Page, type TestInfo } from '@playwright/test';

async function captureStoryFrame(page: Page, testInfo: TestInfo, name: string, progress: number) {
  const story = page.locator('[data-home-sticky-product-story]');
  const metrics = await story.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return { top: rect.top + window.scrollY, height: rect.height };
  });
  const scrollDistance = Math.max(1, metrics.height - page.viewportSize()!.height);
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'auto' }), metrics.top + scrollDistance * progress);
  await page.waitForTimeout(150);
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

  test('every narrative phrase plays while the line is on screen', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/', { waitUntil: 'networkidle' });

    // The hero pins on desktop, holding the line at a fixed viewport position
    // for the whole reveal. Without the pin the line exits at scrollY ~584
    // while a 0.72vh reveal runs to ~927 — phrases 3-5 played below the fold.
    await expect(page.locator('#wallet')).toHaveCSS('min-height', '2200px');
    await expect(page.locator('[data-home-hero-stage]')).toHaveCSS('position', 'sticky');

    const subhead = page.locator('[data-home-hero-subhead]');
    const seen = new Set<string>();
    const height = page.viewportSize()!.height;
    // The last phrase fully typed = sequence complete. After that the pin is
    // SUPPOSED to release and the hero scrolls away like any other section, so
    // the guarantee is only that nothing plays off-screen while the sequence is
    // still running. Sweeping past the release and demanding on-screen was the
    // original form of this assertion, and it failed on the release frame.
    const done = '4:4';
    let completedAt = -1;

    for (let y = 0; y <= 2200 && completedAt < 0; y += 100) {
      await scrollTo(page, y);
      const state = String(await subhead.getAttribute('data-narrative-state'));
      const box = await subhead.boundingBox();
      expect(box, `narrative missing at scrollY=${y}`).not.toBeNull();
      expect(box!.y, `phrase ${state} played above the viewport at scrollY=${y}`).toBeGreaterThan(0);
      expect(box!.y + box!.height, `phrase ${state} played below the viewport at scrollY=${y}`).toBeLessThan(height);
      seen.add(state.split(':')[0]);
      if (state === done) completedAt = y;
    }

    // The sequence finished on screen, inside the pin, before any release.
    expect(completedAt, 'sequence never completed within the pin').toBeGreaterThan(0);
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
    for (const y of [0, 400, 800, 1200]) forward.push(String(await stateAt(y)));

    // Advancing scroll advances the sequence (never regresses).
    const phraseIdx = forward.map((s) => Number(s.split(':')[0]));
    expect(phraseIdx).toEqual([...phraseIdx].sort((a, b) => a - b));
    expect(phraseIdx.at(-1)).toBeGreaterThan(phraseIdx[0]);

    // Reverse scroll reproduces each state exactly (pure function of scroll).
    for (const y of [800, 400, 0]) {
      expect(await stateAt(y), `reverse mismatch at scrollY=${y}`).toBe(forward[[0, 400, 800, 1200].indexOf(y)]);
    }
  });

  test('captures the start, middle, and end of the reversible pinned sequence', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/', { waitUntil: 'networkidle' });

    const story = page.locator('[data-home-sticky-product-story]');
    await expect(story).toBeVisible();
    await expect(story).toHaveCSS('min-height', '4600px');

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
  });

  test('carousel has keyboard controls and no autoplay', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    const carousel = page.getByRole('region', { name: 'VitalCV product surfaces' });
    const before = await carousel.evaluate((node) => node.scrollLeft);
    await carousel.focus();
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => carousel.evaluate((node) => node.scrollLeft)).toBeGreaterThan(before);
    await page.waitForTimeout(1200);
    const afterKeyboard = await carousel.evaluate((node) => node.scrollLeft);
    await page.waitForTimeout(700);
    const afterWait = await carousel.evaluate((node) => node.scrollLeft);
    expect(Math.abs(afterWait - afterKeyboard)).toBeLessThan(2);
  });
});
