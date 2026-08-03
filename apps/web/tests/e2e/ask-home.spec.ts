import { expect, test } from '@playwright/test';

/**
 * Homepage evidence-film contracts.
 *
 * The NPI action remains the first useful action. On an eligible desktop the
 * explanation advances through native vertical scroll that translates the
 * five evidence panes; every other capability tier keeps the same document as
 * a readable vertical composition.
 */

const HOME = '/';
const NPI_FIELD = { name: 'Your 10-digit NPI', exact: true };

async function hydrated(page: import('@playwright/test').Page) {
  const input = page.locator('#film-npi-input');
  await expect
    .poll(
      async () => {
        await input.fill('');
        await input.fill('1');
        return (await page.locator('#film-npi-hint').innerText()).includes('1/10 digits');
      },
      { timeout: 15_000, message: 'NPI field never became interactive' },
    )
    .toBe(true);
  await input.fill('');
}

test.describe('homepage evidence film', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HOME, { waitUntil: 'networkidle' });
  });

  test('keeps the NPI action early, keyboard reachable, and visibly focused', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await hydrated(page);
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.locator('body').click({ position: { x: 2, y: 2 } });
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());

    let reached = false;
    for (let stop = 0; stop < 25; stop += 1) {
      await page.keyboard.press('Tab');
      if (await page.evaluate(() => document.activeElement?.id === 'film-npi-input')) {
        reached = true;
        break;
      }
    }
    expect(reached, 'the clinician action must not be buried behind chrome').toBe(true);
    await expect(page.locator('#film-npi-input')).toBeFocused();
  });

  test('opens with a truthful empty source record, not a fabricated clinician', async ({ page }) => {
    const hero = page.locator('[data-home-hero]');
    await expect(hero.getByRole('heading', { level: 1 })).toHaveAccessibleName('Get hired on evidence.');
    // The #1060 recovery replaced `.film-record` / `.film-panel-lane` with the
    // `.film-summon` record and its six `.film-strip` lane cards. Same six
    // lanes, same pre-lookup truth — only the markup moved.
    await expect(hero.locator('.film-summon')).toBeVisible();
    await expect(hero.locator('.film-strip')).toHaveCount(6);

    const text = (await hero.innerText()).toLowerCase();
    expect(text).toContain('not checked');
    expect(text).toContain('access required');
    expect(text).not.toMatch(/\bdr\.\s|\bmd\b|\brn\b|\d+\s*%/);
    expect(text).not.toContain('constellation');
  });

  test('validates the NPI locally without claiming a source lookup', async ({ page }) => {
    await hydrated(page);
    const input = page.getByRole('textbox', NPI_FIELD);
    const cta = page.getByRole('button', { name: /check what.s ready/i });

    await input.fill('123');
    await expect(page.locator('#film-npi-hint')).toContainText('3/10 digits');

    await input.fill('1234567893');
    await expect(cta).toBeEnabled();

    await input.fill('1234567890');
    await expect(cta).toBeDisabled();
  });

  test('translates panes from ordinary vertical scroll without intercepting it', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    // Page-wide horizontal travel is RETIRED (founder directive, 2026-08-03):
    // the document scrolls vertically and horizontal movement happens inside a
    // sticky chapter stage instead. `vertical` is therefore the correct and
    // only mode. Asserting 'film' here would be a guard enforcing doctrine that
    // was deliberately withdrawn.
    await expect(page.locator('.film')).toHaveAttribute('data-film-mode', 'vertical');

    const track = page.locator('.film-track');
    const before = await track.evaluate((element) => getComputedStyle(element).transform);
    await page.evaluate(() => window.scrollTo({ top: window.innerHeight * 2 }));
    await expect
      .poll(() => track.evaluate((element) => getComputedStyle(element).transform))
      .not.toBe(before);
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  });

  test('keeps every pane in its no-JS vertical reading order', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(HOME, { waitUntil: 'domcontentloaded' });

    await expect(page.locator('[data-film-scene]')).toHaveCount(5);
    await expect(page.getByRole('textbox', NPI_FIELD)).toBeAttached();
    await expect(page.locator('[data-home-source-cadence]')).toBeAttached();
    await expect(page.locator('[data-proof-packet-inspector]')).toBeAttached();
    await context.close();
  });

  test('reduced motion falls back to a complete, still vertical composition', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto(HOME, { waitUntil: 'networkidle' });

    await expect(page.locator('.film')).toHaveAttribute('data-film-mode', 'vertical');
    await expect(page.getByRole('textbox', NPI_FIELD)).toBeVisible();
    expect(await page.evaluate(() => document.getAnimations().filter((animation) => animation.playState === 'running').length)).toBe(0);
    await context.close();
  });

  test('never creates horizontal document overflow', async ({ page }) => {
    for (const [width, height] of [
      [360, 740],
      [390, 844],
      [768, 1024],
      [1440, 900],
      [1920, 1080],
    ]) {
      await page.setViewportSize({ width, height });
      await page.waitForTimeout(150);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
        `horizontal overflow at ${width}×${height}`,
      ).toBe(true);
    }
  });

  test('keeps the heading and input clear of fixed chrome', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const covered = await page.evaluate(() => {
      const hits: string[] = [];
      for (const selector of ['[data-home-hero] h1', '#film-npi-input', '[data-home-primary-cta]']) {
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
