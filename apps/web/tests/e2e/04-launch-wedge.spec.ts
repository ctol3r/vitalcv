import { expect, test, type Page } from '@playwright/test';

const REVIEW_BLOCKED_COPY = 'No decision card is rendered until VitalCV can hydrate a passport record for this entity. Shared review context must also still be valid when one is supplied.';

async function stubHomepageFallback(page: Page) {
  await page.route('**/api/identity/1234567890/ingest', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 250));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        npi: '1234567890',
        fallback: true,
        results: [],
      }),
    });
  });
}

async function runLaunchWedgeFlow(page: Page) {
  await stubHomepageFallback(page);

  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: /see your readiness snapshot/i })).toBeVisible();

  await page.getByLabel('NPI number').fill('1234567890');
  await page.getByRole('button', { name: /start with npi lookup/i }).click();

  await expect(
    page.locator('[data-slot="card-title"]').filter({
      hasText: /checking primary sources|preparing demo preview|building your snapshot|resolving readiness/i,
    }).first(),
  ).toBeVisible();
  await expect(
    page.locator('p').filter({ hasText: /^Readiness snapshot$/ }).first(),
  ).toBeVisible({ timeout: 10_000 });
  await expect(
    page.getByText(/^Preview only$/).first(),
  ).toBeVisible();
  await expect(
    page.getByText(/readiness check temporarily unavailable|could not reach the readiness service/i).first(),
  ).toBeVisible();
  await expect(
    page.getByText(/degraded preview|preview only/i).first(),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: /continue to passport/i }),
  ).toBeVisible();
  await expect(
    page.getByText(/source-backed preview|preview only/i).first(),
  ).toBeVisible();

  await page.getByRole('button', { name: /continue to passport/i }).click();
  await page.waitForURL(/\/passport\?npi=1234567890/);

  await page.goto('/review/00000000-0000-0000-0000-000000000000?contextId=demo-review', { waitUntil: 'networkidle' });
  await expect(page.getByText('Employer review unavailable')).toBeVisible();
  await expect(page.getByText(REVIEW_BLOCKED_COPY)).toBeVisible();
}

test.describe('Launch wedge', () => {
  test('homepage preview reaches explicit passport and review states on desktop', async ({ page }) => {
    await runLaunchWedgeFlow(page);
  });

  test('homepage preview reaches explicit passport and review states on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await runLaunchWedgeFlow(page);
  });
});
