import { expect, test } from '@playwright/test';

const EXTERNAL_ROLE = {
  id: 'a1111111-1111-4111-8111-111111111111',
  organizationId: 'b1111111-1111-4111-8111-111111111111',
  organizationName: 'Source-listed clinical organization',
  organizationSlug: 'source-listed-clinical-organization',
  title: 'Part-Time Family Medicine Physician',
  specialty: 'Family Medicine',
  profession: 'physician',
  schedule: 'part_time',
  hiringType: 'locums',
  state: 'CA',
  payRange: '$180–$220/hr',
  payRangeMin: 180,
  payRangeMax: 220,
  payUnit: 'hour',
  requirementLevel: 'L1',
  description: null,
  remote: false,
  status: 'ACTIVE',
  createdAt: '2026-08-14T08:00:00.000Z',
  updatedAt: '2026-08-14T08:05:00.000Z',
  source: {
    kind: 'public_feed',
    label: 'Listed on greenhouse',
    updatedAt: '2026-08-14T08:05:00.000Z',
    url: 'https://job-boards.greenhouse.io/example/jobs/123',
    fetchedAt: '2026-08-14T08:06:00.000Z',
  },
  isFeedListing: true,
  availability: {
    state: 'open',
    confidence: 'recent_observation',
    observedAt: '2026-08-14T08:06:00.000Z',
    limitation: 'The source was observed recently; the employer can still change or close the role.',
  },
  applicationMode: 'external',
  compensationProvenance: {
    state: 'supplied',
    method: 'structured_source',
    sourceLabel: 'Listed on greenhouse',
    observedAt: '2026-08-14T08:06:00.000Z',
  },
};

const INTEGRATED_ROLE = {
  ...EXTERNAL_ROLE,
  id: 'a2222222-2222-4222-8222-222222222222',
  organizationId: 'b2222222-2222-4222-8222-222222222222',
  organizationName: 'Integrated clinical organization',
  organizationSlug: 'integrated-clinical-organization',
  title: 'Family Medicine Physician',
  source: {
    kind: 'opportunity',
    label: 'Public opportunity record',
    updatedAt: '2026-08-14T08:05:00.000Z',
    url: '/opportunities/a2222222-2222-4222-8222-222222222222',
    fetchedAt: null,
  },
  isFeedListing: false,
  applicationMode: 'vitalcv',
};

const LONG_TITLE_ROLE = {
  ...EXTERNAL_ROLE,
  title: 'NY Center Advanced Practice Provider (Nurse Practitioner/Physician Assistant)',
};

async function mockFilteredField(
  page: import('@playwright/test').Page,
  opportunities = [EXTERNAL_ROLE, INTEGRATED_ROLE],
) {
  await page.route('**/api/opportunities?**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ opportunities, total: opportunities.length }),
  }));
}

async function waitForOpportunityField(page: import('@playwright/test').Page) {
  await page.locator('.opf-board[data-hydrated="true"]').waitFor();
}

async function loadDeterministicRows(page: import('@playwright/test').Page) {
  await mockFilteredField(page);
  await page.goto('/explore', { waitUntil: 'domcontentloaded' });
  await waitForOpportunityField(page);
  await page.getByRole('searchbox', { name: 'Search the field' }).fill('family medicine');
  await expect(page).toHaveURL(/q=family(?:\+|%20)medicine/);
  await expect(page.locator('.opf-role')).toHaveCount(2);
}

async function expectNoHorizontalOverflow(page: import('@playwright/test').Page) {
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

test.describe('WO-13 public opportunity field', () => {
  test('leads with an editorial promise, interactive lenses, and source-honest browse facets', async ({ page }) => {
    await page.goto('/explore', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', {
      level: 1,
      name: 'Find clinical work with the source in view.',
    })).toBeVisible();
    await expect(page.locator('.opf-hero-media')).toHaveCount(0);
    await expect(page.locator('.opf-hero img')).toHaveCount(0);

    const facetLabels = page.locator('.opf-filter-grid .opf-filter-label');
    await expect(facetLabels).toHaveText([
      'Specialty or service line',
      'Profession',
      'Location',
      'Schedule',
      'Employment type',
      'Source observation',
      'Application path',
      'Compensation detail',
      'Benefits detail',
      'Sort field',
    ]);
    for (const label of await facetLabels.all()) await expect(label).toBeVisible();

    const body = (await page.locator('body').innerText()).toLowerCase();
    expect(body).not.toContain('ready now');
    expect(body).not.toContain('automatic eligibility');

    const lenses = page.getByTestId('opportunity-lens-rail');
    await expect(lenses.getByRole('link', { name: /Fresh from source/ })).toHaveAttribute(
      'href',
      '/explore?observedWithin=7',
    );
    await expect(lenses.getByRole('link', { name: /Pay in view/ })).toHaveAttribute(
      'href',
      '/explore?compensation=supplied',
    );
  });

  test('shares discovery controls through the URL and preserves their API contract', async ({ page }) => {
    await mockFilteredField(page);
    await page.goto('/explore', { waitUntil: 'domcontentloaded' });
    await waitForOpportunityField(page);

    await page.getByLabel('Source observation').selectOption('7');
    await expect(page).toHaveURL(/observedWithin=7/);
    await page.getByLabel('Compensation detail').selectOption('supplied');
    await expect(page).toHaveURL(/compensation=supplied/);
    await page.getByLabel('Sort field').selectOption('title');
    await expect(page).toHaveURL(/sort=title/);

    await expect(page.getByRole('button', { name: 'Remove filter Source observed within 7 days' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Remove filter Compensation supplied' })).toBeVisible();
  });

  test('keeps source truth and the external versus integrated application boundary visible', async ({ page }) => {
    await loadDeterministicRows(page);

    const external = page.locator('[data-application-mode="external"]');
    await expect(external).toContainText('Listed on greenhouse');
    await expect(external).toContainText('Observed Aug 14, 2026');
    await expect(external).toContainText('Recent source observation');
    await expect(external).toContainText('Structured source data');
    await expect(external.getByRole('link', { name: /View original listing/ })).toHaveAttribute(
      'href',
      'https://job-boards.greenhouse.io/example/jobs/123',
    );
    await expect(external.getByText('Apply with VitalCV')).toHaveCount(0);

    const integrated = page.locator('[data-application-mode="vitalcv"]');
    await expect(integrated.getByRole('link', { name: 'Apply with VitalCV' })).toHaveAttribute(
      'href',
      '/opportunities/a2222222-2222-4222-8222-222222222222',
    );
    await expect(integrated.getByText('View original listing')).toHaveCount(0);
  });

  test('mobile filters use a native no-JavaScript disclosure and the field never overflows', async ({ browser }) => {
    const context = await browser.newContext({
      javaScriptEnabled: false,
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    await page.goto('/explore', { waitUntil: 'domcontentloaded' });

    const disclosure = page.locator('details.opf-filter-disclosure');
    await expect(disclosure).toBeVisible();
    await expect(page.getByLabel('Profession')).toBeVisible();
    await disclosure.locator('summary').click();
    await expect(page.getByLabel('Profession')).toBeHidden();
    await disclosure.locator('summary').click();
    await expect(page.getByLabel('Profession')).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await context.close();
  });

  test('a source-supplied long role title stays inside a 390px result card', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockFilteredField(page, [LONG_TITLE_ROLE]);
    await page.goto('/explore', { waitUntil: 'domcontentloaded' });
    await waitForOpportunityField(page);
    await page.getByRole('searchbox', { name: 'Search the field' }).fill('nurse practitioner');
    await expect(page).toHaveURL(/q=nurse(?:\+|%20)practitioner/);
    await expect(page.locator('.opf-role')).toHaveCount(1);

    const longTitle = page.getByRole('heading', {
      level: 3,
      name: LONG_TITLE_ROLE.title,
    });
    await expect(longTitle).toBeVisible();

    const titleRight = await longTitle.evaluate((element) => element.getBoundingClientRect().right);
    expect(titleRight).toBeLessThanOrEqual(390);
    await expectNoHorizontalOverflow(page);
  });

  test('required widths, reduced motion, keyboard, and 200% layout remain operable', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });

    for (const viewport of [
      { width: 390, height: 844 },
      { width: 768, height: 1024 },
      { width: 1440, height: 900 },
      { width: 1728, height: 1117 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto('/explore', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('.opf-hero-media')).toHaveCount(0);
      await expect(page.locator('.opf-hero img')).toHaveCount(0);
      await expectNoHorizontalOverflow(page);
    }

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/explore', { waitUntil: 'domcontentloaded' });
    await page.keyboard.press('Tab');
    let reachedSearch = false;
    for (let index = 0; index < 24; index += 1) {
      reachedSearch = await page.evaluate(() => document.activeElement?.id === 'opportunity-search');
      if (reachedSearch) break;
      await page.keyboard.press('Tab');
    }
    expect(reachedSearch, 'Tab order should reach the opportunity search within 24 stops').toBe(true);

    await page.evaluate(() => { document.documentElement.style.zoom = '2'; });
    await expectNoHorizontalOverflow(page);
  });
});
