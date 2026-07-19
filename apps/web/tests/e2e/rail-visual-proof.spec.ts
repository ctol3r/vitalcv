import { expect, test } from '@playwright/test';

/**
 * Visual evidence for the applied horizontal rail (SHD-3.1) — captures each
 * chapter's rest state forward, one reverse return, and the mobile vertical
 * fallback. Screenshots are attached to the report; assertions keep it honest
 * (every chapter must present real content, never a blank stage).
 */

const CHAPTERS = ['wallet', 'readiness', 'matcha', 'apply', 'employers', 'start'];

test('the six-chapter journey renders content at every rest, forward and back', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page.locator('[data-story-rail]')).toHaveAttribute('data-rail-pinned', 'true');

  const geo = await page.evaluate(() => {
    const runway = document.querySelector<HTMLElement>('.story-rail-runway')!;
    return {
      top: runway.getBoundingClientRect().top + window.scrollY,
      travel: Math.max(1, runway.offsetHeight - window.innerHeight),
    };
  });
  const restY = (k: number) => Math.round(geo.top + (k / (CHAPTERS.length - 1)) * geo.travel);

  for (let k = 0; k < CHAPTERS.length; k++) {
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), restY(k));
    await page.waitForTimeout(650);
    const chapter = page.locator(`[data-rail-chapter-id="${CHAPTERS[k]}"]`);
    // The active chapter is on-stage and carries real text — never blank.
    await expect(chapter).toBeInViewport();
    const textLength = await chapter.evaluate((n) => (n.textContent ?? '').trim().length);
    expect(textLength, `chapter ${CHAPTERS[k]} has content`).toBeGreaterThan(40);
    await testInfo.attach(`rail-forward-${k}-${CHAPTERS[k]}`, {
      body: await page.screenshot({ animations: 'disabled' }),
      contentType: 'image/png',
    });
  }

  // Reverse: return to the Opportunity chapter — same rest state, no blank.
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), restY(2));
  await page.waitForTimeout(650);
  await expect(page.locator('[data-rail-chapter-id="matcha"]')).toBeInViewport();
  await testInfo.attach('rail-reverse-2-matcha', {
    body: await page.screenshot({ animations: 'disabled' }),
    contentType: 'image/png',
  });
});

test('mobile renders the same chapters vertically', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page.locator('[data-story-rail]')).toHaveAttribute('data-rail-pinned', 'false');
  for (const id of CHAPTERS) {
    await expect(page.locator(`[data-rail-chapter-id="${id}"]`)).toHaveCount(1);
  }
  await testInfo.attach('rail-mobile-vertical', {
    body: await page.screenshot({ animations: 'disabled' }),
    contentType: 'image/png',
  });
});
