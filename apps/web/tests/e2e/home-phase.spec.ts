import { expect, test, type Page } from '@playwright/test';

const VALID_NPI = '1234567893';

async function mockLookup(page: Page) {
  await page.route('**/api/identity/bootstrap/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ firstName: 'MACIE', lastName: 'MILLER', specialty: 'Family Medicine', state: 'CA' }),
    }),
  );
  await page.route('**/api/trust-state/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        identityVerified: true,
        exclusionStatus: 'CLEAR',
        pecosStatus: 'ENROLLED',
        licensureStatus: 'unknown',
        blockers: [],
        nextActions: [],
      }),
    }),
  );
}

test.describe('evidence-film progression', () => {
  test('uses a single scroll-driven film on eligible desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/', { waitUntil: 'networkidle' });

    const film = page.locator('.film');
    const track = page.locator('.film-stage-rail');
    await expect(film).toHaveAttribute('data-film-mode', 'vertical'); // page-wide travel retired 2026-08-03
    const before = await track.evaluate((element) => getComputedStyle(element).transform);
    // Scroll INTO the sticky stage — that is where the rail travels now.
    await page.evaluate(() => {
      const spacer = document.querySelector('.film-stage-spacer');
      const top = (spacer?.getBoundingClientRect().top ?? 0) + window.scrollY;
      window.scrollTo(0, top + window.innerHeight);
    });
    await expect.poll(() => track.evaluate((element) => getComputedStyle(element).transform)).not.toBe(before);
  });

  test('uses the same complete vertical document for reduced motion and mobile', async ({ browser }) => {
    const reduced = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } });
    const reducedPage = await reduced.newPage();
    await reducedPage.goto('/', { waitUntil: 'networkidle' });
    await expect(reducedPage.locator('.film')).toHaveAttribute('data-film-mode', 'vertical');
    await expect(reducedPage.locator('[data-film-scene]')).toHaveCount(5);
    await reduced.close();

    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const mobilePage = await mobile.newPage();
    await mobilePage.goto('/', { waitUntil: 'networkidle' });
    await expect(mobilePage.locator('.film')).toHaveAttribute('data-film-mode', 'vertical');
    await expect(mobilePage.locator('[data-film-scene]')).toHaveCount(5);
    await mobile.close();
  });

  test('releases the film for a real answer and restores it after reset', async ({ page }) => {
    await mockLookup(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/', { waitUntil: 'networkidle' });

    // Page-wide horizontal travel is RETIRED (founder directive, 2026-08-03):
    // the document scrolls vertically and horizontal movement happens inside a
    // sticky chapter stage instead. `vertical` is therefore the correct and
    // only mode. Asserting 'film' here would be a guard enforcing doctrine that
    // was deliberately withdrawn.
    await expect(page.locator('.film')).toHaveAttribute('data-film-mode', 'vertical');
    await page.locator('#film-npi-input').fill(VALID_NPI);
    await page.locator('.film-npi-submit').click();
    await expect(page.getByText('Macie Miller')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('.film')).toHaveAttribute('data-film-mode', 'vertical');

    await page.getByRole('button', { name: /check another npi/i }).click();
    await expect(page.locator('#film-npi-input')).toBeFocused();
    // Page-wide horizontal travel is RETIRED (founder directive, 2026-08-03):
    // the document scrolls vertically and horizontal movement happens inside a
    // sticky chapter stage instead. `vertical` is therefore the correct and
    // only mode. Asserting 'film' here would be a guard enforcing doctrine that
    // was deliberately withdrawn.
    await expect(page.locator('.film')).toHaveAttribute('data-film-mode', 'vertical');
  });
});
