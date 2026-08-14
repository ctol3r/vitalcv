import { expect, test } from '@playwright/test';

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 1000 },
  { width: 1728, height: 1117 },
] as const;

test.describe('WO-15 employer exact-packet story', () => {
  for (const viewport of VIEWPORTS) {
    test(`${viewport.width}px keeps both scenes and the review rail in bounds`, async ({ page }, testInfo) => {
      await page.setViewportSize(viewport);
      await page.goto('/employers', { waitUntil: 'networkidle' });

      await expect(page.getByRole('heading', { level: 1 })).toContainText('Review the exact packet');
      await expect(page.locator('[data-scene="employer_desk"]')).toBeVisible();
      await expect(page.locator('[data-scene-variant="employers_documentary"]')).toBeVisible();
      await expect(page.locator('[data-employer-workflow]')).toBeVisible();
      await expect(page.locator('[data-employer-stage]')).toHaveCount(6);

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, 'the document must not overflow horizontally').toBeLessThanOrEqual(1);

      await testInfo.attach(`employers-${viewport.width}`, {
        body: await page.screenshot({ animations: 'disabled', fullPage: true }),
        contentType: 'image/png',
      });
    });
  }

  test('arrow and keyboard controls move the native review rail', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/employers', { waitUntil: 'networkidle' });

    const rail = page.getByRole('list', { name: 'Employer review moments' });
    await rail.scrollIntoViewIfNeeded();
    const initial = await rail.evaluate((node) => node.scrollLeft);

    await page.getByRole('button', { name: 'Next review moment' }).click();
    await expect(page.getByText('Define what the role requires in view')).toBeVisible();
    await expect.poll(() => rail.evaluate((node) => node.scrollLeft)).toBeGreaterThan(initial + 100);

    await rail.focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByText('Receive the exact packet in view')).toBeVisible();
  });

  test('reduced motion keeps complete static scenes and immediate rail control', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/employers', { waitUntil: 'networkidle' });

    await expect(page.locator('[data-scene="employer_desk"] video')).toHaveCount(0);
    await expect(page.locator('[data-scene-variant="employers_documentary"] video')).toHaveCount(0);
    await page.getByRole('button', { name: 'Next review moment' }).click();
    await expect(page.getByText('Define what the role requires in view')).toBeVisible();
  });

  test('no JavaScript preserves the hero, transcripts, and all review moments', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await page.goto('/employers', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { level: 1 })).toContainText('Review the exact packet');
    await expect(page.locator('[data-scene="employer_desk"] img')).toBeVisible();
    await expect(page.locator('[data-scene-transcript]')).toHaveCount(2);
    await expect(page.locator('[data-employer-stage]')).toHaveCount(6);
    await expect(page.getByText('Receive the exact packet', { exact: true })).toBeAttached();
    await expect(page.getByText('Keep start events distinct', { exact: true })).toBeAttached();

    await context.close();
  });
});
