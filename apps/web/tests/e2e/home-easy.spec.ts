import { expect, test, type Page } from '@playwright/test';

/**
 * The UX-V1 homepage in a real browser.
 *
 * Pins what renderToStaticMarkup cannot: the record assembly never hides its
 * content, the reduced-motion static frame is annotated and complete, the
 * real NPI entry validates locally and is
 * keyboard-reachable, and the composition holds without horizontal overflow
 * across six viewports.
 *
 * Live registry resolution deliberately has NO spec here — the e2e server is
 * backend-deterministic, and the resolution path is exercised against
 * production during deploy verification instead.
 */

const surface = (page: Page) => page.locator('[data-home-work-surface]');

const PUBLIC_OPPORTUNITIES = {
  total: 2,
  opportunities: [
    {
      id: 'feed-role',
      organizationId: 'feed-org',
      organizationName: 'Source Health',
      organizationSlug: 'source-health',
      title: 'Family Medicine Physician',
      specialty: 'Family Medicine',
      hiringType: 'locums',
      state: 'CA',
      payRange: null,
      requirementLevel: 'not_stated',
      description: null,
      remote: false,
      status: 'ACTIVE',
      createdAt: '2026-08-13T12:00:00.000Z',
      isFeedListing: true,
      source: {
        kind: 'public_feed',
        label: 'Listed on greenhouse',
        url: 'https://jobs.example.test/family-medicine',
        updatedAt: '2026-08-13T12:00:00.000Z',
        fetchedAt: '2026-08-13T12:00:00.000Z',
      },
      freshness: {
        listingStatus: 'fresh',
        employerDataStatus: 'limited',
        completenessScore: 0,
        isStale: false,
        isUncertain: true,
        lastUpdatedAt: '2026-08-13T12:00:00.000Z',
      },
    },
    {
      id: 'integrated-role',
      organizationId: 'integrated-org',
      organizationName: 'Connected Clinical Group',
      organizationSlug: 'connected-clinical-group',
      title: 'Emergency Medicine Physician',
      specialty: 'Emergency Medicine',
      hiringType: 'perm',
      state: 'TX',
      payRange: null,
      requirementLevel: 'stated',
      description: null,
      remote: false,
      status: 'open',
      createdAt: '2026-08-13T13:00:00.000Z',
      isFeedListing: false,
      source: {
        kind: 'opportunity',
        label: 'Published through VitalCV',
        updatedAt: '2026-08-13T13:00:00.000Z',
      },
      freshness: {
        listingStatus: 'fresh',
        employerDataStatus: 'complete',
        completenessScore: 100,
        isStale: false,
        isUncertain: false,
        lastUpdatedAt: '2026-08-13T13:00:00.000Z',
      },
    },
  ],
};

test.describe('home — the Easy Button hero', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/opportunities?*', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(PUBLIC_OPPORTUNITIES),
    }));
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
  });

  test('one h1, and it is the founder-locked career-mobility thesis', async ({ page }) => {
    const h1 = page.locator('h1');
    await expect(h1).toHaveCount(1);
    await expect(h1).toHaveText('One career record. More ways forward.');
    await expect(page.getByText('Your VitalCV profile. Ready for every move.', { exact: true })).toBeVisible();
  });

  test('the hero never blocks: NPI entry, motion display, and frosted record paint together', async ({ page }) => {
    await expect(page.locator('[data-home-hero]')).toBeVisible();
    await expect(page.locator('#ezh-npi')).toBeVisible();
    await expect(page.locator('[data-home-primary-cta]')).toHaveText('Build my free profile');
    await expect(page.locator('[data-home-motion-display]')).toBeVisible();
    await expect(surface(page)).toBeVisible();
    await expect(surface(page)).toHaveAttribute('data-visual-material', 'frosted-glass');
    await expect(page.locator('[data-home-stage] img')).toHaveCount(0);
  });

  test('the register uses real frosted material and keeps every truth state legible', async ({ page }) => {
    const material = await surface(page).locator('.ezh-folio-paper').evaluate((node) => {
      const style = getComputedStyle(node);
      return {
        backdropFilter: style.backdropFilter || style.getPropertyValue('-webkit-backdrop-filter'),
        background: style.backgroundColor,
        overflow: style.overflow,
      };
    });

    expect(material.backdropFilter).toContain('blur(');
    expect(material.background).toMatch(/rgba?\(/);
    expect(material.overflow).toBe('hidden');
    await expect(surface(page).locator('.ezh-watch-row')).toHaveCount(4);
  });

  test('the record is complete and visible before its optional assembly settles', async ({ page }) => {
    await expect(surface(page).locator('.ezh-watch-row')).toHaveCount(4);
    await expect(surface(page).getByText('Source-backed', { exact: true })).toBeVisible();
    await expect(surface(page).getByText('Access required', { exact: true })).toBeVisible();
    await expect
      .poll(async () => surface(page).getAttribute('data-motion'), { timeout: 5000 })
      .toBe('assembling');
  });

  test('the NPI entry validates locally and states progress honestly', async ({ page }) => {
    const input = page.locator('#ezh-npi');
    await expect(page.getByText('0/10 digits')).toBeVisible();
    // Type-and-poll: a pre-hydration fill is silently lost.
    await expect(async () => {
      await input.fill('123');
      await expect(page.getByText('3/10 digits')).toBeVisible({ timeout: 1500 });
    }).toPass({ timeout: 15000 });
    await page.locator('[data-home-primary-cta]').click();
    await expect(page.getByText(/An NPI is 10 digits/)).toBeVisible();
  });

  test('the NPI action is keyboard-reachable from the top of the document', async ({ page }) => {
    await page.keyboard.press('Tab'); // skip link
    let reached = false;
    for (let i = 0; i < 25; i += 1) {
      await page.keyboard.press('Tab');
      const id = await page.evaluate(() => document.activeElement?.id ?? '');
      if (id === 'ezh-npi') {
        reached = true;
        break;
      }
    }
    expect(reached).toBe(true);
  });

  test('the opportunity doorway is the signed-out secondary action', async ({ page }) => {
    const opportunity = page.locator('[data-home-opportunity-cta]');
    await expect(opportunity).toHaveAttribute('href', '/explore');
    await expect(opportunity).toHaveText(/Explore clinician opportunities/);
    const order = await page.evaluate(() => {
      const primary = document.querySelector('[data-home-primary-cta]');
      const secondary = document.querySelector('[data-home-opportunity-cta]');
      if (!primary || !secondary) return false;
      return Boolean(primary.compareDocumentPosition(secondary) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    expect(order).toBe(true);
  });

  test('the opportunity horizon renders only returned roles with source and application boundary', async ({ page }) => {
    const horizon = page.locator('[data-home-opportunity-horizon]');
    await expect(horizon.locator('.ezh-opportunity-row')).toHaveCount(2);
    await expect(horizon.getByText('Listed on greenhouse', { exact: true })).toBeVisible();
    await expect(horizon.getByText('Observed Aug 13, 2026', { exact: true }).first()).toBeVisible();
    await expect(horizon.getByText(/Listed as open/).first()).toBeVisible();
    await expect(horizon.getByRole('link', { name: 'View original listing' })).toHaveAttribute(
      'href',
      'https://jobs.example.test/family-medicine',
    );
    await expect(horizon.getByRole('link', { name: 'Apply with VitalCV' })).toHaveAttribute(
      'href',
      '/opportunities/integrated-role',
    );
    await expect(horizon).not.toContainText(/ready now|automatically eligible/i);
  });

  test('the reference synthesis uses a contained warm-glass stage and numbered inverse career band', async ({ page }) => {
    const stage = page.locator('.ezh-human-tactile-stage');
    const mobility = page.locator('[data-home-mobility-sequence]');

    await expect(stage).toHaveCSS('overflow', 'hidden');
    await expect(stage).toHaveCSS('border-radius', '24px');
    await expect(stage.locator('[data-home-motion-display]')).toBeVisible();
    await expect(stage.locator('img')).toHaveCount(0);
    await expect(mobility).toHaveCSS('background-color', 'rgb(19, 18, 17)');
    await expect(mobility.locator('.ezh-mobility-index')).toHaveCount(7);
    await expect(mobility.getByText('01 / 07', { exact: true })).toBeVisible();
    await expect(mobility.getByText('07 / 07', { exact: true })).toBeVisible();
    await expect(mobility.locator('h2')).toHaveCSS('color', 'rgb(247, 246, 243)');
  });

  test('the final action returns to the real entry', async ({ page }) => {
    await expect(page.locator('.ezh-start-cta')).toHaveAttribute('href', '#npi');
  });

  test('the first action uses the approved 8px control radius', async ({ page }) => {
    await expect(page.locator('[data-home-primary-cta]')).toHaveCSS('border-top-left-radius', '8px');
  });
});

test.describe('home — layout integrity across viewports', () => {
  for (const [width, height] of [
    [1728, 1117],
    [1440, 900],
    [1280, 832],
    [1024, 768],
    [768, 1024],
    [390, 844],
  ] as const) {
    test(`no horizontal overflow at ${width}×${height}`, async ({ page }) => {
      await page.route('**/api/opportunities?*', (route) => route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(PUBLIC_OPPORTUNITIES),
      }));
      await page.setViewportSize({ width, height });
      await page.goto('/');
      await expect(page.locator('[data-home-hero]')).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
      // scrollWidth is blind when an ancestor hides overflow-x — a clipped
      // page measures "no overflow" while the CTA hangs off screen. Assert
      // the interactive elements actually END inside the viewport.
      for (const selector of ['#ezh-npi', '[data-home-primary-cta]', '[data-home-work-surface]']) {
        const box = await page.locator(selector).boundingBox();
        expect(box, `${selector} missing at ${width}`).not.toBeNull();
        expect(
          box!.x + box!.width,
          `${selector} clipped past the ${width}px viewport`,
        ).toBeLessThanOrEqual(width + 1);
      }
    });
  }
});

test.describe('home — reduced motion', () => {
  // page.emulateMedia rather than test.use: with this config the context
  // option is not honored (@playwright/test 1.58.2), the CDP call is.
  test('the static frame is complete, annotated, and loses no meaning', async ({ page }) => {
    await page.route('**/api/opportunities?*', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(PUBLIC_OPPORTUNITIES),
    }));
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(surface(page)).toHaveAttribute('data-motion', 'static');
    await expect(surface(page).getByText('Identity', { exact: true })).toBeVisible();
    await expect(surface(page).getByText('Needs your review', { exact: true })).toBeVisible();
    await expect(surface(page).locator('.ezh-rm-legend')).toBeVisible();
  });

  test('the no-JavaScript frame keeps the promise, motion illustration, record rows, and opportunity doorway', async ({ browser }) => {
    const context = await browser.newContext({
      javaScriptEnabled: false,
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();
    await page.goto('/');
    await expect(page.locator('h1')).toHaveText('One career record. More ways forward.');
    await expect(page.locator('header.vcv-eb')).toHaveAttribute('data-eb-theme', 'light');
    await expect(page.locator('.vcv-eb__wordmark')).toHaveCSS('color', 'rgb(21, 20, 18)');
    await expect(page.locator('[data-home-motion-display]')).toBeVisible();
    await expect(page.locator('[data-home-stage] img')).toHaveCount(0);
    await expect(surface(page).locator('.ezh-watch-row')).toHaveCount(4);
    await expect(page.locator('[data-home-opportunity-cta]')).toHaveAttribute('href', '/explore');
    await expect(page.getByText('Reading the current opportunity feed…')).toBeVisible();
    await context.close();
  });
});
