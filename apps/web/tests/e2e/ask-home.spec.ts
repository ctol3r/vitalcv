import { expect, test } from '@playwright/test';

/**
 * Homepage contracts after the composition compression.
 *
 * The NPI-first Ask remains the only first-screen act. The explanation beneath
 * it is one progressive-enhancement spine: four operable steps with a stacked
 * no-JS reading order. The old ledger/chapter/beat stack is intentionally gone.
 */

const HOME = '/';

async function hydrated(page: import('@playwright/test').Page) {
  const input = page.locator('#npi-input');
  await expect
    .poll(
      async () => {
        await input.fill('');
        await input.fill('1');
        return (await page.locator('#ask-hint').innerText()).includes('1/10');
      },
      { timeout: 15_000, message: 'NPI field never became interactive' },
    )
    .toBe(true);
  await input.fill('');
}

test.describe('homepage Ask + four-step spine', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HOME, { waitUntil: 'domcontentloaded' });
  });

  test('the NPI action remains early, keyboard reachable, and visibly focused', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await hydrated(page);
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.locator('body').click({ position: { x: 2, y: 2 } });
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());

    const MAX_STOPS = 12;
    let stops = 0;
    for (; stops < MAX_STOPS; stops += 1) {
      await page.keyboard.press('Tab');
      if (await page.evaluate(() => document.activeElement?.id === 'npi-input')) break;
    }
    expect(stops, 'the only first-screen action must not be buried behind chrome').toBeLessThan(
      MAX_STOPS,
    );
    await expect(page.locator('#npi-input')).toBeFocused();

    const focusRule = await page.evaluate(() =>
      [...document.styleSheets]
        .flatMap((sheet) => {
          try {
            return [...sheet.cssRules];
          } catch {
            return [];
          }
        })
        .map((rule) => rule.cssText)
        .filter((text) => text.includes(':focus-within') && text.includes('ask-field')),
    );
    expect(focusRule.length).toBeGreaterThan(0);
    expect(focusRule.join(' ')).toMatch(/border-bottom-color|outline|box-shadow/);
  });

  test('the first screen is an act, not a wall of state', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(300);

    const firstScreen = (await page.locator('[data-home-hero]').innerText()).toUpperCase();
    for (const label of ['NOT CHECKED', 'ACCESS REQUIRED', 'SOURCE-BACKED', 'SELF-ATTESTED']) {
      expect(firstScreen).not.toContain(label);
    }

    const sizes = await page.evaluate(() => ({
      input: parseFloat(getComputedStyle(document.querySelector('#npi-input')!).fontSize),
      title: parseFloat(getComputedStyle(document.querySelector('#ask-title')!).fontSize),
    }));
    expect(sizes.input, 'the field remains the hero').toBeGreaterThan(sizes.title);
  });

  test('renders no fabricated clinician, readiness percentage, or graph', async ({ page }) => {
    await page.waitForTimeout(300);
    const text = await page.locator('.ask').innerText();
    expect(text).not.toMatch(/\d+\s*%/);
    expect(text).not.toMatch(/\bDr\.\s|\bMD\b|\bRN\b/);
    expect(text).not.toContain('Find the opportunity');
    expect(text).not.toContain('VitalCV recognizes');
    expect(await page.locator('.ask [draggable="true"]').count()).toBe(0);
    expect(text.toLowerCase()).not.toContain('constellation');
  });

  test('validates the NPI locally without claiming a source lookup', async ({ page }) => {
    await hydrated(page);

    await page.locator('#npi-input').fill('123');
    await expect(page.locator('#ask-hint')).toContainText('3/10 digits');

    await page.locator('#npi-input').fill('1234567893');
    await expect(page.locator('[data-home-primary-cta]')).toBeEnabled();

    await page.locator('#npi-input').fill('1234567890');
    await expect(page.locator('[data-home-primary-cta]')).toBeDisabled();
  });

  test('keeps clinician action primary and employer access secondary', async ({ page }) => {
    await hydrated(page);

    const employer = page.locator('[data-home-employer-cta]');
    await expect(employer).toHaveAttribute('href', '/employers');

    const sizes = await page.evaluate(() => {
      const employerLink = document.querySelector('[data-home-employer-cta]')!;
      const primary = document.querySelector('[data-home-primary-cta]')!;
      return {
        employer: parseFloat(getComputedStyle(employerLink).fontSize),
        primary: parseFloat(getComputedStyle(primary).fontSize),
      };
    });
    expect(sizes.employer).toBeLessThanOrEqual(sizes.primary);

    const offsets = await page.evaluate(() => {
      const midpoint = document.documentElement.clientWidth / 2;
      const center = (selector: string) => {
        const rect = document.querySelector(selector)!.getBoundingClientRect();
        return rect.left + rect.width / 2 - midpoint;
      };
      return { title: center('#ask-title'), action: center('.ask-go') };
    });
    expect(Math.abs(offsets.title)).toBeLessThanOrEqual(2);
    expect(Math.abs(offsets.action)).toBeLessThanOrEqual(2);
  });

  test('promotes one operable four-step spine', async ({ page }) => {
    await hydrated(page);

    const spine = page.locator('[data-home-spine] .spine');
    await expect(spine).toHaveAttribute('data-enhanced', '');
    const tabs = spine.getByRole('tab');
    await expect(tabs).toHaveCount(4);
    await expect(spine.locator('.spine-panel:not([hidden])')).toHaveCount(1);
    await expect(tabs.nth(0)).toHaveAttribute('aria-selected', 'true');

    await tabs.nth(1).click();
    await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
    await expect(spine.locator('.spine-panel:not([hidden])')).toHaveCount(1);
    await expect(spine.locator('[data-home-lane-ledger]')).toBeVisible();

    await tabs.nth(2).focus();
    await page.keyboard.press('ArrowRight');
    await expect(tabs.nth(3)).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('[data-home-employer-door]')).toBeVisible();
    await expect(page.locator('[data-home-employer-door]')).toHaveAttribute('href', '/employers');
  });

  test('the source-evidence step renders the canonical lane registry honestly', async ({ page }) => {
    await hydrated(page);
    await page.getByRole('tab', { name: /source evidence/i }).click();

    const ledger = page.locator('[data-home-lane-ledger]');
    const rows = ledger.locator('.ask-ledger-row');
    await expect(rows).toHaveCount(6);

    const text = (await ledger.innerText()).toLowerCase();
    for (const source of ['nppes', 'oig', 'pecos', 'state licensure']) {
      expect(text).toContain(source);
    }
    expect(text).toContain('access required');
    expect(text).toContain('not yet connected');
    expect(text.match(/available/g)?.length ?? 0).toBe(3);
    expect(text).not.toMatch(/\bDr\.\s|\bMD\b|\bRN\b|\d+\s*%/);
  });

  test('removes the redundant below-fold ledger, chapters, and beats', async ({ page }) => {
    await page.waitForTimeout(300);
    await expect(page.locator('[data-home-spine]')).toHaveCount(1);
    await expect(page.locator('.ask > .ask-ledger')).toHaveCount(0);
    await expect(page.locator('.ask > .ask-chapter')).toHaveCount(0);
    await expect(page.locator('.ask > .ask-beat')).toHaveCount(0);
    await expect(page.locator('.ask h1')).toHaveCount(1);
  });

  test('no JavaScript becomes a readable four-panel stack, not dead tabs', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(HOME, { waitUntil: 'domcontentloaded' });

    const spine = page.locator('[data-home-spine] .spine');
    await expect(spine).not.toHaveAttribute('data-enhanced', '');
    await expect(spine.locator('.spine-tabs')).toHaveCSS('display', 'none');
    await expect(spine.locator('.spine-panel')).toHaveCount(4);
    await expect(spine.locator('.spine-panel[hidden]')).toHaveCount(0);
    await expect(spine.locator('.spine-panel-heading')).toHaveCount(4);

    await context.close();
  });

  test('reduced motion keeps the page still and meaningful', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto(HOME, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(400);

    const before = await page.evaluate(() => {
      const elements = document.querySelectorAll('.ask h1, .ask-field, .spine');
      return [...elements]
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return `${Math.round(rect.top)},${Math.round(rect.left)},${Math.round(rect.width)}`;
        })
        .join('|');
    });
    await page.waitForTimeout(600);
    const after = await page.evaluate(() => {
      const elements = document.querySelectorAll('.ask h1, .ask-field, .spine');
      return [...elements]
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return `${Math.round(rect.top)},${Math.round(rect.left)},${Math.round(rect.width)}`;
        })
        .join('|');
    });
    expect(after).toBe(before);
    expect(await page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').length)).toBe(0);

    await context.close();
  });

  test('never scrolls horizontally at supported viewport widths', async ({ page }) => {
    for (const [width, height] of [
      [360, 740],
      [390, 844],
      [768, 1024],
      [1440, 900],
      [1920, 1080],
    ]) {
      await page.setViewportSize({ width, height });
      await page.waitForTimeout(250);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      );
      expect(overflow, `horizontal overflow at ${width}×${height}`).toBe(false);
    }
  });

  test('fixed chrome does not cover the heading or NPI action', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(300);

    const covered = await page.evaluate(() => {
      const hits: string[] = [];
      for (const selector of ['#ask-title', '#npi-input', '[data-home-primary-cta]']) {
        const element = document.querySelector(selector);
        if (!element) continue;
        const rect = element.getBoundingClientRect();
        const top = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        if (top && !element.contains(top) && !top.contains(element)) {
          hits.push(`${selector} covered by ${top.tagName}.${top.className}`);
        }
      }
      return hits;
    });
    expect(covered).toEqual([]);
  });
});
