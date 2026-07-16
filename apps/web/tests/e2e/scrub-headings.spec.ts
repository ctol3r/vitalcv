import { expect, test, type Page } from '@playwright/test';

/**
 * Motion M1 — scroll-scrubbed character headings, asserted against a
 * production build.
 *
 * The guarantees under test are the ones that break silently: the heading is
 * always semantic and complete, characters resolve as a function of SCROLL
 * (reversibly), words never shatter across lines, and reduced motion gets the
 * finished heading with no runway.
 */

const HEADING = '[data-scrub-heading]';
const EVIDENCE_HEADING = '[data-home-evidence-truth] [data-scrub-heading]';
const EVIDENCE_SCENE = '[data-home-evidence-truth] [data-scrub-scene]';

async function scrollTo(page: Page, y: number) {
  await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), y);
  await page.waitForFunction((top) => Math.abs(window.scrollY - top) <= 1, y);
  await page.waitForTimeout(140); // let the spring settle
}

/** Mean opacity across a heading's characters = how assembled it is. */
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

async function sceneMetrics(page: Page) {
  return page.locator(EVIDENCE_SCENE).evaluate((node) => {
    const top = node.getBoundingClientRect().top + window.scrollY;
    return { top, distance: node.clientHeight - window.innerHeight };
  });
}

test.describe('scroll-scrubbed character headings', () => {
  test('heading is fully present and semantic, with one accessible name', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/', { waitUntil: 'networkidle' });

    const evidence = page.locator(EVIDENCE_HEADING);
    // Correct native heading element — not a div dressed as one.
    expect(await evidence.evaluate((n) => n.tagName)).toBe('H2');
    // The accessible name is the COMPLETE sentence, never a stream of letters.
    await expect(evidence).toHaveAccessibleName('Every claim carries its source, its state, and its limits.');
    // Every character span is hidden from assistive tech.
    const exposed = await evidence.evaluate((node) =>
      Array.from(node.querySelectorAll('[data-motion-character]')).filter(
        (c) => c.closest('[aria-hidden="true"]') === null,
      ).length,
    );
    expect(exposed, 'character spans must be aria-hidden').toBe(0);
    // Text is really there (selectable, greppable), not painted pseudo-content.
    expect((await evidence.innerText()).replace(/\s+/g, ' ')).toContain('Every claim carries its source');
  });

  test('characters resolve with scroll and REVERSE on scroll up', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/', { waitUntil: 'networkidle' });
    const { top, distance } = await sceneMetrics(page);

    // Early: fragments begin outside their line masks in genuine depth.
    await scrollTo(page, top);
    const early = await assembly(page, EVIDENCE_HEADING);
    expect(early).toBeGreaterThanOrEqual(0);
    expect(early).toBeLessThan(0.2);

    // Middle: the composition is clearly between fragments and lockup.
    await scrollTo(page, top + distance * 0.5);
    const middle = await assembly(page, EVIDENCE_HEADING);
    expect(middle).toBeGreaterThan(early);
    expect(middle).toBeLessThan(0.95);

    // Completed: fully inked, followed by a deliberate final hold.
    await scrollTo(page, top + distance * 0.92);
    const done = await assembly(page, EVIDENCE_HEADING);
    expect(done).toBeGreaterThan(middle);
    expect(done).toBeGreaterThan(0.97);

    // Reverse: scrolling back up un-resolves it — the state is a pure function
    // of scroll, not a one-way animation that latches.
    await scrollTo(page, top);
    const reversed = await assembly(page, EVIDENCE_HEADING);
    expect(reversed).toBeLessThan(0.2);
    expect(Math.abs(reversed - early)).toBeLessThan(0.05);
  });

  test('the one cinematic statement owns a masked full-width sticky stage', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/', { waitUntil: 'networkidle' });

    const scene = page.locator(EVIDENCE_SCENE);
    await expect(scene).toHaveAttribute('data-scrub-pin', '');
    await expect(scene).toHaveCSS('min-height', '1600px');
    await expect(scene.locator('.scrub-heading-stage')).toHaveCSS('position', 'sticky');
    await expect(scene.locator('[data-scrub-heading]')).toHaveAttribute('data-scrub-heading', 'scene');
    expect(await scene.locator('[data-motion-line-mask]').count()).toBe(3);

    const { top } = await sceneMetrics(page);
    await scrollTo(page, top);
    const first = scene.locator('[data-motion-character]').first();
    const initial = await first.evaluate((node) => ({
      opacity: Number(getComputedStyle(node).opacity),
      transform: getComputedStyle(node).transform,
    }));
    expect(initial.opacity).toBeLessThan(0.2);
    expect(initial.transform).toContain('matrix3d');
  });

  test('the completed statement holds stable before the stage releases', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/', { waitUntil: 'networkidle' });
    const { top, distance } = await sceneMetrics(page);

    await scrollTo(page, top + distance * 0.88);
    const held = await assembly(page, EVIDENCE_HEADING);
    await scrollTo(page, top + distance);
    const released = await assembly(page, EVIDENCE_HEADING);

    expect(held).toBeGreaterThan(0.99);
    expect(released).toBeGreaterThan(0.99);
    expect(Math.abs(released - held)).toBeLessThan(0.005);
  });

  test('mobile keeps the scene in normal flow with complete readable lines', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/', { waitUntil: 'networkidle' });

    const scene = page.locator(EVIDENCE_SCENE);
    await expect(scene).not.toHaveAttribute('data-scrub-pin', '');
    await expect(scene.locator('[data-scrub-heading]')).toBeVisible();
    expect(await scene.locator('[data-motion-line-mask]').count()).toBe(3);
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
    await expect(page.locator(EVIDENCE_HEADING)).toContainText(
      'Every claim carries its source, its state, and its limits.',
    );
  });

  test('heading assembly causes no layout shift', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/', { waitUntil: 'networkidle' });
    const { top, distance } = await sceneMetrics(page);

    // The heading's box must be identical unresolved vs. fully resolved: the
    // text is laid out from the start, only its ink changes.
    await scrollTo(page, top);
    const before = await page.locator(EVIDENCE_HEADING).evaluate((n) => {
      const r = n.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height) };
    });
    await scrollTo(page, top + distance * 0.92);
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
      const scene = await sceneMetrics(page);
      const mobileTop = width < 768 ? await headingTop(page, EVIDENCE_HEADING) : 0;
      const positions = width < 768
        ? [
            ['initial', Math.max(0, mobileTop - height)],
            ['mid', Math.max(0, mobileTop - height * 0.62)],
            ['complete', Math.max(0, mobileTop - height * 0.3)],
          ] as const
        : [
            ['initial', Math.max(0, scene.top)],
            ['mid', scene.top + scene.distance * 0.5],
            ['complete', scene.top + scene.distance * 0.92],
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
