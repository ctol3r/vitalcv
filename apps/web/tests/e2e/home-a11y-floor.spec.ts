import { test, expect, type Page, type Route } from '@playwright/test';

/**
 * The two accessibility floors the homepage program's own acceptance checklist
 * names, and that nothing was measuring.
 *
 * Both were open on `main` when the release wave audited them. Neither is
 * exotic — they survived because the existing guards checked an adjacent
 * property: the reset guard asserted the field was VISIBLE and CLEARED (it
 * always was) rather than focused, and nothing measured a control's height at
 * all.
 */

const VALID_NPI = '1234567893';

async function mockClean(page: Page) {
  await page.route('**/api/identity/bootstrap/**', (r: Route) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ firstName: 'MACIE', lastName: 'MILLER', identitySource: 'NPPES_API' }),
    }),
  );
  await page.route('**/api/trust-state/**', (r: Route) =>
    r.fulfill({
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

test('reset returns FOCUS to the field, not just the field to the screen', async ({ page }) => {
  // `onReset` cannot focus the input directly: at that instant `LiveNpiResult`
  // is still mounted and the field is not, so the ref is null and `.focus()`
  // is a silent no-op. Measured before the fix: `<body>` held focus at 0, 100,
  // 500 and 1500ms, dropping a keyboard user to the top of the document.
  await mockClean(page);
  await page.goto('/', { waitUntil: 'networkidle' });

  await page.getByRole('textbox', { name: /npi/i }).fill(VALID_NPI);
  await page.getByRole('button', { name: /check what.s ready/i }).click();
  await expect(page.locator('[data-evidence-group]').first()).toBeVisible({ timeout: 20_000 });

  await page.getByRole('button', { name: /check another npi/i }).click();

  await expect
    .poll(() => page.evaluate(() => (document.activeElement as HTMLElement | null)?.id ?? null), {
      timeout: 5_000,
    })
    .toBe('npi-input');
});

test('the primary action meets the 44px touch floor', async ({ page }) => {
  // CD-15: "44px minimum touch target". The button resolved to 40px from
  // padding alone — inside WCAG 2.2 AA's 24px minimum, but under the floor
  // this product commits to, on the control the homepage exists to get
  // pressed. Checked at the narrowest supported width, where it matters most.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/', { waitUntil: 'networkidle' });

  const cta = page.locator('.ask-go').first();
  const box = await cta.boundingBox();
  expect(box).not.toBeNull();
  expect(Math.round(box!.height)).toBeGreaterThanOrEqual(44);

  // The field is the other thing a thumb has to hit, and iOS zooms any input
  // under 16px on focus.
  const fontPx = await page
    .locator('#npi-input')
    .evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize));
  expect(fontPx).toBeGreaterThanOrEqual(16);
});
