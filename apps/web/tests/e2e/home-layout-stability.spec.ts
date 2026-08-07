import { expect, test, type Page, type Route } from '@playwright/test';

const VALID_NPI = '1234567893';
const BAD_CHECKSUM = '1234567890';

async function mockClean(page: Page) {
  await page.route('**/api/identity/bootstrap/**', (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ firstName: 'MACIE', lastName: 'MILLER', identitySource: 'NPPES_API' }),
    }),
  );
  await page.route('**/api/trust-state/**', (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        identityVerified: true,
        exclusionStatus: 'CLEAR',
        pecosStatus: 'ENROLLED',
        blockers: [],
        nextActions: [],
      }),
    }),
  );
}

const rect = (page: Page, selector: string) =>
  page.locator(selector).evaluate((element) => {
    const box = element.getBoundingClientRect();
    return { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width), height: Math.round(box.height) };
  });

test.describe('evidence-film layout stability', () => {
  test('invalid and valid NPI states do not move the primary control', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/', { waitUntil: 'networkidle' });

    const input = page.locator('#film-npi-input');
    const cta = page.locator('.film-npi-submit');
    const before = await rect(page, '.film-npi-submit');

    await input.fill(BAD_CHECKSUM);
    await expect(cta).toBeDisabled();
    const invalid = await rect(page, '.film-npi-submit');
    expect(invalid).toMatchObject({ y: before.y, width: before.width, height: before.height });

    await input.fill(VALID_NPI);
    await expect(cta).toBeEnabled();
    const valid = await rect(page, '.film-npi-submit');
    expect(valid).toMatchObject({ y: before.y, width: before.width, height: before.height });
  });

  test('a lookup replaces the question in the same frame and reset restores it', async ({ page }) => {
    await mockClean(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/', { waitUntil: 'networkidle' });

    await page.locator('#film-npi-input').fill(VALID_NPI);
    await page.locator('.film-npi-submit').click();
    await expect(page.getByText('Macie Miller')).toBeVisible({ timeout: 20_000 });
    expect(await page.evaluate(() => window.scrollY)).toBeLessThan(120);
    await expect(page.locator('[data-home-hero]')).toContainText('Macie Miller');

    await page.getByRole('button', { name: /check another npi/i }).click();
    await expect(page.locator('#film-npi-input')).toHaveValue('');
    await expect(page.locator('#film-npi-input')).toBeFocused();
  });
});
