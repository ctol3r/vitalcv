import { expect, test, type Page } from '@playwright/test';

/**
 * The Direction A homepage (amendment E) in a real browser.
 *
 * Pins what renderToStaticMarkup cannot: the drawn figures are flat paper
 * (no frost anywhere on the route), the one-shot row reveal never hides
 * content, the cycling word settles and never loops, effective figure text
 * clears the 11px floor at both evidence viewports, the real NPI entry
 * validates locally and is keyboard-reachable, and the composition holds
 * without horizontal overflow across six viewports.
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

async function routeOpportunities(page: Page) {
  await page.route('**/api/opportunities?*', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(PUBLIC_OPPORTUNITIES),
  }));
}

/**
 * Amendment E's figure floor, in CI shape: effective text size =
 * font-size × (rendered width ÷ viewBox width) must be ≥ 11px for every
 * visible <text> in every drawn figure. Measured, not eyeballed — the trap
 * this catches shipped once as 9.5px hero labels.
 */
async function minEffectiveFigureText(page: Page): Promise<{ min: number; where: string }> {
  return page.evaluate(() => {
    let min = Number.POSITIVE_INFINITY;
    let where = 'none';
    for (const svg of document.querySelectorAll('.ezh-fig-art svg, figure.ezh-fig svg')) {
      const rect = svg.getBoundingClientRect();
      if (rect.width === 0) continue; // the hidden half of a wide/narrow pair
      const viewBox = (svg as SVGSVGElement).viewBox.baseVal;
      if (!viewBox || viewBox.width === 0) continue;
      const scale = rect.width / viewBox.width;
      for (const t of svg.querySelectorAll('text')) {
        const fontSize = parseFloat(getComputedStyle(t).fontSize);
        const effective = fontSize * scale;
        if (effective < min) {
          min = effective;
          where = `${(t.textContent ?? '').slice(0, 32)} (${fontSize}px × ${scale.toFixed(3)})`;
        }
      }
    }
    return { min, where };
  });
}

test.describe('home — the Direction A hero', () => {
  test.beforeEach(async ({ page }) => {
    await routeOpportunities(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
  });

  test('one h1, and it is the amendment E thesis', async ({ page }) => {
    const h1 = page.locator('h1');
    await expect(h1).toHaveCount(1);
    await expect(h1).toHaveText('Enter your NPI. VitalCV does the rest.');
    await expect(page.getByText('For US clinicians', { exact: true })).toBeVisible();
  });

  test('the hero never blocks: NPI entry and the drawn figure paint together', async ({ page }) => {
    await expect(page.locator('[data-home-hero]')).toBeVisible();
    await expect(page.locator('#ezh-npi')).toBeVisible();
    await expect(page.locator('[data-home-primary-cta]')).toHaveText('Start with your NPI');
    await expect(surface(page)).toBeVisible();
    await expect(surface(page)).toHaveAttribute('data-visual-material', 'drawn-ink');
    await expect(page.locator('[data-home-stage] img')).toHaveCount(0);
  });

  test('the route carries no frost: flat paper, no backdrop-filter anywhere', async ({ page }) => {
    const material = await surface(page).evaluate((node) => {
      const style = getComputedStyle(node);
      return {
        backdropFilter: style.backdropFilter || style.getPropertyValue('-webkit-backdrop-filter'),
        background: style.backgroundColor,
      };
    });
    expect(material.backdropFilter === '' || material.backdropFilter === 'none').toBe(true);

    const frosted = await page.evaluate(() => {
      const bad: string[] = [];
      for (const el of document.querySelectorAll('.ezh, .ezh *')) {
        const s = getComputedStyle(el);
        const bf = s.backdropFilter || s.getPropertyValue('-webkit-backdrop-filter');
        if (bf && bf !== 'none') {
          bad.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)}`);
          if (bad.length >= 5) break;
        }
      }
      return bad;
    });
    expect(frosted, `frost on the E register:\n${frosted.join('\n')}`).toEqual([]);
  });

  test('the figure reveal is one-shot and strands nothing', async ({ page }) => {
    // The enhancement runs once, then the machinery is stripped; whatever the
    // transitions did, every row ends visible.
    await expect
      .poll(async () => surface(page).getAttribute('data-motion'), { timeout: 6000 })
      .toBe('done');
    const hidden = await page.evaluate(() =>
      [...document.querySelectorAll('.ezh-rowfx')].filter(
        (row) => getComputedStyle(row).opacity !== '1',
      ).length,
    );
    expect(hidden).toBe(0);
  });

  test('the cycling word runs a single pass and settles on the locked word', async ({ page }) => {
    await expect
      .poll(
        async () => page.locator('[data-home-cycling-word]').getAttribute('data-home-cycling-word'),
        { timeout: 6000 },
      )
      .toBe('settled');
    await expect(page.locator('[data-home-cycling-word]')).toHaveText('application');
    // Nothing loops: the settled word is still settled well after the pass.
    await page.waitForTimeout(1200);
    await expect(page.locator('[data-home-cycling-word]')).toHaveText('application');
  });

  test('effective figure text clears the 11px floor at 1440', async ({ page }) => {
    const { min, where } = await minEffectiveFigureText(page);
    expect(min, `smallest effective figure text: ${where}`).toBeGreaterThanOrEqual(11);
  });

  test('exactly one viewBox variant of each figure is visible', async ({ page }) => {
    // Both variants ship in the server frame; CSS must show ONE. An
    // equal-specificity slip rendered both halves of every pair at desktop —
    // caught by a screenshot, now pinned here at both breakpoints.
    for (const width of [1440, 390] as const) {
      await page.setViewportSize({ width, height: 900 });
      const counts = await page.evaluate(() => {
        const figures = [...document.querySelectorAll('[data-home-figure]')];
        return figures.map((fig) => ({
          id: fig.getAttribute('data-home-figure'),
          visible: [...fig.querySelectorAll('svg')].filter(
            (svg) => svg.getBoundingClientRect().width > 0,
          ).length,
        }));
      });
      for (const { id, visible } of counts) {
        expect(visible, `figure "${id}" shows ${visible} variants at ${width}px`).toBe(1);
      }
    }
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

  test('Roles renders only returned roles with source and application boundary', async ({ page }) => {
    const horizon = page.locator('[data-home-opportunity-horizon]');
    await expect(horizon.getByText('A job board that reads your credentials, not your keywords.')).toBeVisible();
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

  test('amendment E.1: three promises render, and the retired sections are gone', async ({ page }) => {
    // The 2026-08-16 founder directive replaced the seven-step band, standing
    // watch, attribution ledger, and accordion FAQ with three benefit cards
    // and three flat answers.
    await expect(page.locator('[data-home-mobility-sequence]')).toHaveCount(0);
    await expect(page.locator('[data-home-standing-watch]')).toHaveCount(0);
    const promises = page.locator('.ezh-promise');
    await expect(promises).toHaveCount(3);
    await expect(promises.first().locator('svg.ezh-promise-glyph')).toBeVisible();
    await expect(page.getByText('Build it once. Take it everywhere.')).toBeVisible();
    await expect(page.getByText('Most weeks, nothing does.')).toBeVisible();
    // Flat answers: a real <dl>, zero <details> anywhere on the page.
    await expect(page.locator('.ezh-qa-list')).toBeVisible();
    await expect(page.locator('main details')).toHaveCount(0);
  });

  test('the final action returns to the real entry', async ({ page }) => {
    await expect(page.locator('.ezh-start-cta')).toHaveAttribute('href', '#npi');
  });

  test('the first action keeps the approved 8px page-action radius', async ({ page }) => {
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
    // 390 was the narrowest declared width, which left the two commonest
    // small phones untested: 375 (iPhone SE / 12–13 mini / 6–8) and 360 (the
    // modal Android). The figure floor failed at 375 while passing at 390.
    [375, 812],
    [360, 800],
  ] as const) {
    test(`no horizontal overflow at ${width}×${height}`, async ({ page }) => {
      await routeOpportunities(page);
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

  /*
   * The floor is checked at every narrow width we claim to support, not just
   * the widest of them. It passed at 390 and failed at 375 by 0.51px — the
   * hero's frame charges its padding against the drawing's rendered width, so
   * the margin shrinks as the viewport does and the widest narrow viewport is
   * the least likely to catch it.
   */
  for (const [width, height] of [
    [390, 844],
    [375, 812],
    [360, 800],
  ] as const) {
    test(`effective figure text clears the 11px floor at ${width}`, async ({ page }) => {
      await routeOpportunities(page);
      await page.setViewportSize({ width, height });
      await page.goto('/');
      await expect(page.locator('[data-home-hero]')).toBeVisible();
      const { min, where } = await minEffectiveFigureText(page);
      expect(min, `smallest effective figure text at ${width}: ${where}`).toBeGreaterThanOrEqual(11);
    });
  }
});

test.describe('home — reduced motion', () => {
  // page.emulateMedia rather than test.use: with this config the context
  // option is not honored (@playwright/test 1.58.2), the CDP call is.
  test('the static frame is complete: figure static, word settled, nothing armed', async ({ page }) => {
    await routeOpportunities(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(surface(page)).toHaveAttribute('data-motion', 'static');
    await expect(page.locator('[data-home-cycling-word]')).toHaveText('application');
    const hidden = await page.evaluate(() =>
      [...document.querySelectorAll('.ezh-rowfx')].filter(
        (row) => getComputedStyle(row).opacity !== '1',
      ).length,
    );
    expect(hidden).toBe(0);
    await expect(surface(page).locator('.ezh-fig-cap')).toBeVisible();
  });

  test('the no-JavaScript frame keeps the thesis, figure, settled word, and doorway', async ({ browser }) => {
    const context = await browser.newContext({
      javaScriptEnabled: false,
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();
    await page.goto('/');
    await expect(page.locator('h1')).toHaveText('Enter your NPI. VitalCV does the rest.');
    await expect(page.locator('header.vcv-eb')).toHaveAttribute('data-eb-theme', 'light');
    await expect(page.locator('.vcv-eb__wordmark')).toHaveCSS('color', 'rgb(21, 20, 18)');
    await expect(surface(page)).toHaveAttribute('data-motion', 'static');
    await expect(page.locator('[data-home-stage] img')).toHaveCount(0);
    // The figure is complete in the server frame: both viewBox variants are
    // in DOM (5 rows each), and CSS shows exactly one.
    await expect(surface(page).locator('.ezh-rowfx')).toHaveCount(10);
    await expect(page.locator('[data-home-cycling-word]')).toHaveText('application');
    await expect(page.locator('[data-home-opportunity-cta]')).toHaveAttribute('href', '/explore');
    await expect(page.getByText('Reading the current opportunity feed…')).toBeVisible();
    await context.close();
  });
});
