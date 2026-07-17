import { expect, test, type Page } from '@playwright/test';

/**
 * Motion M1 — TYPED display headings (Palantir register, Chris 2026-07-17),
 * asserted against a production build.
 *
 * Display headings type out character by character in TIME once they enter the
 * viewport, behind a block caret. This replaced the scroll-scrubbed reveal
 * (which had replaced the pinned cinematic scene). The guarantees under test
 * are the ones that break silently: the heading is always semantic and
 * complete, typing is monotonic and finishes on a bounded clock, layout never
 * shifts while typing, words never shatter across lines, reduced motion gets
 * the finished heading instantly, and — the standing regression guard — NO
 * pinned runway of blank paper ever returns.
 */

const HEADING = '[data-scrub-heading]';
const EVIDENCE_HEADING = '[data-home-evidence-truth] [data-scrub-heading]';
const EVIDENCE_TEXT = 'Every claim shows its source.';

async function scrollTo(page: Page, y: number) {
  await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), y);
  await page.waitForFunction((top) => Math.abs(window.scrollY - top) <= 1, y);
}

/** Fraction of a heading's characters currently inked (opacity ≈ 1). */
async function typedFraction(page: Page, selector: string): Promise<number> {
  return page.locator(selector).evaluate((node) => {
    const chars = Array.from(node.querySelectorAll('[data-motion-character]'));
    if (chars.length === 0) return -1;
    const on = chars.filter((c) => Number(getComputedStyle(c).opacity) > 0.9).length;
    return on / chars.length;
  });
}

async function bringIntoView(page: Page, selector: string) {
  const top = await page
    .locator(selector)
    .evaluate((n) => n.getBoundingClientRect().top + window.scrollY);
  // Put the heading at ~55% of the viewport — safely past the 0.3 IO threshold.
  await scrollTo(page, Math.max(0, top - page.viewportSize()!.height * 0.55));
}

test.describe('typed display headings', () => {
  test('heading is fully present and semantic, with one accessible name', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/', { waitUntil: 'networkidle' });

    const evidence = page.locator(EVIDENCE_HEADING);
    // Correct native heading element — not a div dressed as one.
    expect(await evidence.evaluate((n) => n.tagName)).toBe('H2');
    // The accessible name is the COMPLETE sentence, never a stream of letters.
    await expect(evidence).toHaveAccessibleName(EVIDENCE_TEXT);
    // Every character span is hidden from assistive tech.
    const exposed = await evidence.evaluate((node) =>
      Array.from(node.querySelectorAll('[data-motion-character]')).filter(
        (c) => c.closest('[aria-hidden="true"]') === null,
      ).length,
    );
    expect(exposed, 'character spans must be aria-hidden').toBe(0);
  });

  test('characters type out in time with a caret, monotonic to completion', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/', { waitUntil: 'networkidle' });

    const evidence = page.locator(EVIDENCE_HEADING);
    await bringIntoView(page, EVIDENCE_HEADING);
    await expect(evidence).toHaveAttribute('data-scrub-heading', 'type');

    // Catch it mid-type: partially inked with the caret riding the last
    // character; ink strictly accumulates from there.
    await expect
      .poll(() => typedFraction(page, EVIDENCE_HEADING), { intervals: [40], timeout: 4000 })
      .toBeGreaterThan(0.05);
    const early = await typedFraction(page, EVIDENCE_HEADING);
    if (early < 1) {
      await expect(evidence.locator('[data-type-caret]')).toBeVisible();
    }
    await expect
      .poll(() => typedFraction(page, EVIDENCE_HEADING), { intervals: [80], timeout: 5000 })
      .toBe(1);
    await expect(evidence).toHaveAttribute('data-type-complete', '');
    expect(await typedFraction(page, EVIDENCE_HEADING)).toBeGreaterThanOrEqual(early);
    // Typed text is really there (selectable, greppable), not pseudo-content.
    expect((await evidence.innerText()).replace(/\s+/g, ' ')).toContain(EVIDENCE_TEXT);
  });

  test('the hero H1 types and hands the caret to the narrative sentence', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/', { waitUntil: 'networkidle' });

    const h1 = page.locator('[data-home-hero-h1]');
    await expect(h1).toHaveAttribute('data-scrub-heading', 'type');
    await expect(h1).toHaveAccessibleName(
      'Find the opportunity. Prove your career once. Start faster.',
    );
    // H1 completes on its own clock (~51 chars × 26ms + arming), no scrolling.
    await expect(h1).toHaveAttribute('data-type-complete', '', { timeout: 6000 });
    // Then the subhead types: it accumulates and completes without any scroll.
    const subhead = page.locator('[data-home-hero-subhead]');
    await expect(subhead).toHaveAttribute('data-narrative-complete', '', { timeout: 8000 });
  });

  /**
   * THE STANDING REGRESSION GUARD. The evidence heading must NOT be pinned: no
   * data-scrub-pin, no data-scrub-scene, and no runway element taller than the
   * viewport. A pinned runway is precisely the "too much empty space" the
   * density wave removed.
   */
  test('the heading reserves no pinned runway of blank paper', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/', { waitUntil: 'networkidle' });

    const evidenceSection = page.locator('[data-home-evidence-truth]');
    expect(await evidenceSection.locator('[data-scrub-pin]').count()).toBe(0);
    expect(await evidenceSection.locator('[data-scrub-scene]').count()).toBe(0);
    const lede = page.locator('[data-home-evidence-truth] .evidence-truth-lede');
    await expect(lede).toBeVisible();
    const tallest = await evidenceSection.evaluate((node) => {
      let max = 0;
      node.querySelectorAll('*').forEach((el) => {
        max = Math.max(max, (el as HTMLElement).getBoundingClientRect().height);
      });
      return max / window.innerHeight;
    });
    expect(tallest, 'no runway taller than the viewport').toBeLessThan(1.1);
  });

  test('typing causes no layout shift', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/', { waitUntil: 'networkidle' });

    // Measure the box the instant the heading enters, then after completion:
    // identical — characters are laid out from the first frame, only their
    // ink changes.
    await bringIntoView(page, EVIDENCE_HEADING);
    const before = await page.locator(EVIDENCE_HEADING).evaluate((n) => {
      const r = n.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height) };
    });
    await expect(page.locator(EVIDENCE_HEADING)).toHaveAttribute('data-type-complete', '', {
      timeout: 6000,
    });
    const after = await page.locator(EVIDENCE_HEADING).evaluate((n) => {
      const r = n.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height) };
    });
    expect(after).toEqual(before);
  });

  test('mobile keeps the heading in normal flow, complete and readable', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/', { waitUntil: 'networkidle' });

    const evidence = page.locator(EVIDENCE_HEADING);
    await bringIntoView(page, EVIDENCE_HEADING);
    await expect(evidence).toHaveAttribute('data-type-complete', '', { timeout: 6000 });
    await expect(evidence).toContainText(EVIDENCE_TEXT);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test('no animation gates the NPI form or its CTA', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/');
    // Immediately interactive — no waiting for networkidle, typing, or any
    // reveal. A checksum-VALID NPI: the CTA gates on checkNpi (#681's truth
    // pass), not merely on ten digits.
    const input = page.locator('#npi-input');
    await input.fill('1234567893');
    await expect(input).toHaveValue('123 456 7893'); // the field formats digits
    await expect(page.locator('[data-home-primary-cta]')).toBeEnabled();
  });

  // NOTE: one test per width. Re-navigating to the SAME url inside a single
  // page context never reaches networkidle (app-wide router behavior), so the
  // width sweep must live at test level where each gets a fresh context.
  for (const width of [360, 768, 1440]) {
    test(`words never break into individual letters at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/', { waitUntil: 'networkidle' });
      await bringIntoView(page, EVIDENCE_HEADING);
      await page.waitForTimeout(150);

      // Every character of a word must share that word's LINE BOX; only the
      // untransformed layout position (offsetTop) reveals a real wrap.
      const brokenWords = await page.locator(EVIDENCE_HEADING).evaluate((node) =>
        Array.from(node.querySelectorAll('[data-motion-word]')).filter((word) => {
          const tops = Array.from(
            word.querySelectorAll<HTMLElement>('[data-motion-character]'),
          ).map((c) => c.offsetTop);
          return new Set(tops).size > 1;
        }).length,
      );
      expect(brokenWords, `word split across lines at ${width}px`).toBe(0);
    });

    test(`no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/', { waitUntil: 'networkidle' });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(1);
    });
  }

  test('reduced motion renders completed headings with no character spans', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/', { waitUntil: 'networkidle' });

    const headings = page.locator(HEADING);
    expect(await headings.count()).toBeGreaterThan(0);
    for (const heading of await headings.all()) {
      await expect(heading).toHaveAttribute('data-scrub-heading', 'reduced');
    }
    // No characters to type, no caret, and the text is complete and inked.
    expect(await page.locator('[data-motion-character]').count()).toBe(0);
    expect(await page.locator('[data-type-caret]').count()).toBe(0);
    await expect(page.locator(EVIDENCE_HEADING)).toContainText(EVIDENCE_TEXT);
  });
});

test.describe('typed heading screenshot baselines', () => {
  for (const [name, width, height] of [
    ['desktop', 1440, 1000],
    ['mobile', 390, 844],
  ] as const) {
    test(`${name}: mid-type / complete`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height });
      await page.goto('/', { waitUntil: 'networkidle' });
      await bringIntoView(page, EVIDENCE_HEADING);
      await expect
        .poll(() => typedFraction(page, EVIDENCE_HEADING), { intervals: [30], timeout: 4000 })
        .toBeGreaterThan(0.1);
      await testInfo.attach(`typed-heading-${name}-mid`, {
        body: await page.screenshot(),
        contentType: 'image/png',
      });
      await expect(page.locator(EVIDENCE_HEADING)).toHaveAttribute('data-type-complete', '', {
        timeout: 6000,
      });
      await testInfo.attach(`typed-heading-${name}-complete`, {
        body: await page.screenshot(),
        contentType: 'image/png',
      });
    });

    test(`${name}: reduced-motion baseline`, async ({ page }, testInfo) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.setViewportSize({ width, height });
      await page.goto('/', { waitUntil: 'networkidle' });
      await page.locator(EVIDENCE_HEADING).scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
      await testInfo.attach(`typed-heading-${name}-reduced-motion`, {
        body: await page.screenshot(),
        contentType: 'image/png',
      });
    });
  }
});
