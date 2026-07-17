import { expect, test, type Page } from '@playwright/test';

/**
 * Motion M1 — scroll-scrubbed character heading, asserted against a production
 * build.
 *
 * The evidence-panel heading used to be a PINNED cinematic scene: a 124vh
 * runway of blank paper whose only job was to scrub three lines of type. That
 * runway was the homepage's "too much empty space", so it was removed — the
 * heading now inks in place (variant="ink") as it enters the viewport, reserving
 * no scroll of its own.
 *
 * The guarantees under test are the ones that break silently: the heading is
 * always semantic and complete, characters resolve as a function of SCROLL
 * (reversibly), words never shatter across lines, reduced motion gets the
 * finished heading, and — the regression guard — NO pinned runway ever returns.
 */

const HEADING = '[data-scrub-heading]';
const EVIDENCE_HEADING = '[data-home-evidence-truth] [data-scrub-heading]';
const EVIDENCE_TEXT = 'Every claim shows its source.';

async function scrollTo(page: Page, y: number) {
  await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), y);
  await page.waitForFunction((top) => Math.abs(window.scrollY - top) <= 1, y);
  await page.waitForTimeout(140); // let the spring settle
}

/** Mean opacity across a heading's characters = how inked it is. */
async function assembly(page: Page, selector: string): Promise<number> {
  return page.locator(selector).evaluate((node) => {
    const chars = Array.from(node.querySelectorAll('[data-motion-character]'));
    if (chars.length === 0) return -1;
    const total = chars.reduce((sum, c) => sum + Number(getComputedStyle(c).opacity), 0);
    return total / chars.length;
  });
}

async function headingTop(page: Page, selector: string): Promise<number> {
  return page.locator(selector).evaluate((n) => n.getBoundingClientRect().top + window.scrollY);
}

/**
 * The ink heading scrubs over its OWN viewport transit (offset
 * ['start 85%','start 35%']): progress 0 when its top sits at 85% of the
 * viewport (low on screen), progress 1 at 35% (high on screen). Deriving the
 * scroll range from those offsets keeps the assertions honest about where the
 * heading actually is.
 */
async function inkRange(page: Page) {
  const top = await headingTop(page, EVIDENCE_HEADING);
  const vh = await page.evaluate(() => window.innerHeight);
  const startY = Math.max(0, top - 0.85 * vh); // progress 0
  const endY = Math.max(0, top - 0.35 * vh); // progress 1
  return { top, startY, endY, distance: endY - startY };
}

test.describe('scroll-scrubbed character heading', () => {
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
    // Text is really there (selectable, greppable), not painted pseudo-content.
    expect((await evidence.innerText()).replace(/\s+/g, ' ')).toContain(EVIDENCE_TEXT);
  });

  test('characters resolve with scroll and REVERSE on scroll up', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/', { waitUntil: 'networkidle' });
    const { startY, endY, distance } = await inkRange(page);

    // Early: characters begin faint (ink opacity floor is 0.16).
    await scrollTo(page, startY);
    const early = await assembly(page, EVIDENCE_HEADING);
    expect(early).toBeGreaterThanOrEqual(0);
    expect(early).toBeLessThan(0.5);

    // Middle: clearly between faint and fully inked.
    await scrollTo(page, startY + distance * 0.5);
    const middle = await assembly(page, EVIDENCE_HEADING);
    expect(middle).toBeGreaterThan(early);

    // Completed: fully inked.
    await scrollTo(page, endY + 20);
    const done = await assembly(page, EVIDENCE_HEADING);
    expect(done).toBeGreaterThan(middle);
    expect(done).toBeGreaterThan(0.97);

    // Reverse: scrolling back up un-inks it — the state is a pure function of
    // scroll, not a one-way animation that latches.
    await scrollTo(page, startY);
    const reversed = await assembly(page, EVIDENCE_HEADING);
    expect(Math.abs(reversed - early)).toBeLessThan(0.05);
  });

  /**
   * THE REGRESSION GUARD. The heading must NOT be pinned: no data-scrub-pin, no
   * data-scrub-scene, and no runway element taller than the viewport. A pinned
   * runway is precisely the "too much empty space" this change removed.
   */
  test('the heading reserves no pinned runway of blank paper', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/', { waitUntil: 'networkidle' });

    const evidenceSection = page.locator('[data-home-evidence-truth]');
    expect(await evidenceSection.locator('[data-scrub-pin]').count()).toBe(0);
    expect(await evidenceSection.locator('[data-scrub-scene]').count()).toBe(0);
    // The lede sits directly under the heading, not stranded past a runway.
    const lede = page.locator('[data-home-evidence-truth] .evidence-truth-lede');
    await expect(lede).toBeVisible();
    // No element inside the panel is a >1-viewport tall scroll runway.
    const tallest = await evidenceSection.evaluate((node) => {
      let max = 0;
      node.querySelectorAll('*').forEach((el) => {
        max = Math.max(max, (el as HTMLElement).getBoundingClientRect().height);
      });
      return max / window.innerHeight;
    });
    expect(tallest, 'no runway taller than the viewport').toBeLessThan(1.1);
  });

  test('mobile keeps the heading in normal flow, complete and readable', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/', { waitUntil: 'networkidle' });

    const evidence = page.locator(EVIDENCE_HEADING);
    await expect(evidence).toBeVisible();
    await expect(evidence).toContainText(EVIDENCE_TEXT);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test('no animation gates the NPI form or its CTA', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/');
    // Immediately interactive — no waiting for networkidle or any reveal.
    // A checksum-VALID NPI: the CTA gates on checkNpi (#681's truth pass),
    // not merely on ten digits. Same constant the npi-truth-engine spec uses.
    const input = page.locator('#npi-input');
    await input.fill('1234567893');
    await expect(input).toHaveValue('123 456 7893'); // the field formats digits
    await expect(page.locator('[data-home-primary-cta]')).toBeEnabled();
  });

  // NOTE: one test per width. Re-navigating to the SAME url inside a single
  // page context never reaches networkidle (verified against /trust, which has
  // no scrub headings — it is app-wide router behavior, not this component), so
  // the width sweep must live at test level where each gets a fresh context.
  for (const width of [360, 768, 1440]) {
    test(`words never break into individual letters at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/', { waitUntil: 'networkidle' });
      await page.locator(EVIDENCE_HEADING).scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);

      // Every character of a word must share that word's LINE BOX. Measure
      // offsetTop, not getBoundingClientRect: the rect includes each
      // character's translateY, so mid-assembly it differs per character by
      // design — only the untransformed layout position reveals a real wrap.
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
    // No transforms to resolve, and the text is complete and fully inked.
    expect(await page.locator('[data-motion-character]').count()).toBe(0);
    await expect(page.locator(EVIDENCE_HEADING)).toContainText(EVIDENCE_TEXT);
  });

  test('heading assembly causes no layout shift', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/', { waitUntil: 'networkidle' });
    const { startY, endY } = await inkRange(page);

    // The heading's box must be identical unresolved vs. fully resolved: the
    // text is laid out from the start, only its ink changes.
    await scrollTo(page, startY);
    const before = await page.locator(EVIDENCE_HEADING).evaluate((n) => {
      const r = n.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height) };
    });
    await scrollTo(page, endY);
    const after = await page.locator(EVIDENCE_HEADING).evaluate((n) => {
      const r = n.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height) };
    });
    expect(after).toEqual(before);
  });
});

test.describe('scrub heading screenshot baselines', () => {
  for (const [name, width, height] of [
    ['desktop', 1440, 1000],
    ['mobile', 390, 844],
  ] as const) {
    test(`${name}: initial / mid / complete`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height });
      await page.goto('/', { waitUntil: 'networkidle' });
      const top = await headingTop(page, EVIDENCE_HEADING);
      const positions = [
        ['initial', Math.max(0, top - height * 0.85)],
        ['mid', Math.max(0, top - height * 0.6)],
        ['complete', Math.max(0, top - height * 0.3)],
      ] as const;

      for (const [label, y] of positions) {
        await scrollTo(page, y);
        await testInfo.attach(`scrub-heading-${name}-${label}`, {
          body: await page.screenshot(),
          contentType: 'image/png',
        });
      }
    });

    // Separate test: emulateMedia + a fresh context, never a re-navigation.
    test(`${name}: reduced-motion baseline`, async ({ page }, testInfo) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.setViewportSize({ width, height });
      await page.goto('/', { waitUntil: 'networkidle' });
      await page.locator(EVIDENCE_HEADING).scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
      await testInfo.attach(`scrub-heading-${name}-reduced-motion`, {
        body: await page.screenshot(),
        contentType: 'image/png',
      });
    });
  }
});
