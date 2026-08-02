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
    const track = page.locator('.film-track');
    await expect(film).toHaveAttribute('data-film-mode', 'film');
    const before = await track.evaluate((element) => getComputedStyle(element).transform);
    await page.evaluate(() => window.scrollTo({ top: window.innerHeight * 3 }));
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

    await expect(page.locator('.film')).toHaveAttribute('data-film-mode', 'film');
    await page.locator('#film-npi-input').fill(VALID_NPI);
    await page.locator('.film-npi-submit').click();
    await expect(page.getByText('Macie Miller')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('.film')).toHaveAttribute('data-film-mode', 'vertical');

    await page.getByRole('button', { name: /check another npi/i }).click();
    await expect(page.locator('#film-npi-input')).toBeFocused();
    await expect(page.locator('.film')).toHaveAttribute('data-film-mode', 'film');
  });
});
