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
