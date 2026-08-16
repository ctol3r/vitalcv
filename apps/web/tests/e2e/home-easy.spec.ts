import { expect, test, type Page } from '@playwright/test';

/**
 * The founder's Homepage v4 (amendment F) in a real browser.
 *
 * Pins what renderToStaticMarkup cannot: the drawn figures are flat paper (no
 * frost anywhere on the route), the hero folio's reveal is one-shot and
 * strands nothing, NOTHING on the page loops, effective figure text clears
 * the 11px floor at the narrow evidence viewports, the real NPI entry
 * validates locally and is keyboard-reachable, the resolution scene moves
 * idle → read log → real rows against route-mocked REAL-SHAPED payloads, and
 * the composition holds without horizontal overflow across eight viewports.
 *
 * The resolve path here runs against page.route mocks of the two real
 * endpoints (`/api/identity/bootstrap/*`, `/api/trust-state/*`) — the e2e
 * server is backend-deterministic, and live registry resolution stays covered
 * against production during deploy verification.
 */

const folio = (page: Page) => page.locator('[data-home-work-surface]');

const VALID_NPI = '1234567893'; // the repo's standard checksum-valid e2e NPI

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

/** REAL-SHAPED payloads for the resolve pipeline (EC-26: no fixture path in
 * the app — the fixtures live here, in the test, shaped like the real API). */
async function routeResolve(page: Page) {
  await page.route('**/api/identity/bootstrap/**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      firstName: 'TEST',
      lastName: 'CLINICIAN',
      specialty: 'Internal Medicine',
      state: 'CA',
      npiType: 'TYPE_1',
      identitySource: 'NPPES_API',
    }),
  }));
  await page.route('**/api/trust-state/**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      identityVerified: true,
      exclusionStatus: 'CLEAR',
      pecosStatus: 'ENROLLED',
      licensureStatus: 'unknown',
      blockers: [],
      nextActions: ['Add your preferred locations'],
    }),
  }));
  await page.route('**/api/matcha/opportunities/**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ matches: [] }),
  }));
}

/**
 * The figure floor, in CI shape: effective text size = font-size × (rendered
 * width ÷ viewBox width) must be ≥ 11px for every visible <text> in every
 * drawn figure on the route — the hero folio, the trust flow, and the arc
 * beat miniatures alike.
 */
async function minEffectiveFigureText(page: Page): Promise<{ min: number; where: string }> {
  return page.evaluate(() => {
    let min = Number.POSITIVE_INFINITY;
    let where = 'none';
    for (const svg of document.querySelectorAll('.ezh-fig-art svg, .ezh-beat-fig svg')) {
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

test.describe('home — the v4 hero and register', () => {
  test.beforeEach(async ({ page }) => {
    await routeOpportunities(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
  });

  test('one h1, and it is the amendment F thesis', async ({ page }) => {
    const h1 = page.locator('h1');
    await expect(h1).toHaveCount(1);
    await expect(h1).toHaveText('Get hired. Start working sooner.');
    await expect(page.getByText('For clinicians · no account required')).toBeVisible();
  });

  test('the hero never blocks: NPI entry and the folio paint together', async ({ page }) => {
    await expect(page.locator('[data-home-hero]')).toBeVisible();
    await expect(page.locator('#ezh-npi')).toBeVisible();
    await expect(page.locator('[data-home-primary-cta]')).toHaveText('Start with your NPI');
    await expect(folio(page)).toBeVisible();
    await expect(folio(page)).toHaveAttribute('data-visual-material', 'drawn-ink');
    await expect(page.locator('[data-home-stage] img')).toHaveCount(0);
  });

  test('the route carries no frost: flat paper, no backdrop-filter anywhere', async ({ page }) => {
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
    expect(frosted, `frost on the F register:\n${frosted.join('\n')}`).toEqual([]);
  });

  test('the folio reveal is one-shot and strands nothing', async ({ page }) => {
    await expect
      .poll(async () => folio(page).getAttribute('data-motion'), { timeout: 6000 })
      .toBe('done');
    const hidden = await page.evaluate(() =>
      [...document.querySelectorAll('.ezh-fig-hero .ezh-f-arr')].filter(
        (row) => getComputedStyle(row).opacity !== '1',
      ).length,
    );
    expect(hidden).toBe(0);
  });

  test('exactly ONE loop on the route — the sanctioned status pulse, nothing else', async ({ page }) => {
    // EC-29: no decorative loop. The founder's v4 kit shipped ambient
    // infinite animations; amendment F ports single-shot only. The single
    // lawful exception is E.2's system-status pulse on the live feed's
    // "Listed as open" availability dot (`ezh-status-pulse`) — a status the
    // row already states in words (EC-4). Anything else computing an
    // infinite iteration count is a regression.
    await expect
      .poll(async () => folio(page).getAttribute('data-motion'), { timeout: 6000 })
      .toBe('done');
    await expect(page.locator('.ezh-opportunity-source i.is-open').first()).toBeVisible();
    const looping = await page.evaluate(() => {
      const bad: string[] = [];
      for (const el of document.querySelectorAll('main.ezh, main.ezh *')) {
        const s = getComputedStyle(el);
        if (
          s.animationName !== 'none' &&
          s.animationIterationCount.includes('infinite') &&
          !(s.animationName === 'ezh-status-pulse' && el.classList.contains('is-open'))
        ) {
          bad.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 48)} → ${s.animationName}`);
          if (bad.length >= 5) break;
        }
      }
      return bad;
    });
    expect(looping, `unsanctioned infinite animations on /:\n${looping.join('\n')}`).toEqual([]);
  });

  test('the one-shot section entrances leave nothing hidden', async ({ page }) => {
    // E.2's reveal system, adopted by F: the hidden state exists only while
    // the root is armed, and the safety timer force-completes at 4s — so
    // whatever the observers did, every [data-ezh-reveal] section ends at
    // computed opacity 1.
    await expect
      .poll(
        async () => page.locator('main.ezh').getAttribute('data-ezh-motion'),
        { timeout: 8000 },
      )
      .toBe('done');
    const stranded = await page.evaluate(() =>
      [...document.querySelectorAll('[data-ezh-reveal]')].filter(
        (el) => Number(getComputedStyle(el).opacity) < 0.99,
      ).length,
    );
    expect(stranded).toBe(0);
  });

  test('effective figure text clears the 11px floor at 1440', async ({ page }) => {
    const { min, where } = await minEffectiveFigureText(page);
    expect(min, `smallest effective figure text: ${where}`).toBeGreaterThanOrEqual(11);
  });

  test('exactly one viewBox variant of each paired figure is visible', async ({ page }) => {
    for (const width of [1440, 390] as const) {
      await page.setViewportSize({ width, height: 900 });
      const counts = await page.evaluate(() => {
        const figures = [...document.querySelectorAll('.ezh-fig-art')];
        return figures.map((fig, i) => ({
          id: fig.closest('[data-home-figure]')?.getAttribute('data-home-figure') ?? `art-${i}`,
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

  test('Roles renders only returned roles with source and application boundary — and never says job board', async ({ page }) => {
    const horizon = page.locator('[data-home-opportunity-horizon]');
    await expect(horizon.getByText('Roles, read against your record — not your keywords.')).toBeVisible();
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
    await expect(horizon).not.toContainText(/ready now|automatically eligible|job board/i);
  });

  test('the v4 document sections render in order with their state grammar', async ({ page }) => {
    await expect(page.locator('[data-home-resolution]')).toBeVisible();
    await expect(page.locator('[data-home-figure="trust-flow"]')).toBeVisible();
    await expect(page.locator('[data-home-arc]')).toBeVisible();
    await expect(page.locator('[data-home-figure="packet-shape"]')).toBeVisible();
    await expect(page.locator('[data-home-state-legend]')).toBeVisible();
    await expect(page.getByText('Five states, no others')).toBeVisible();
    await expect(page.getByText('Counts are of lanes, not a score. VitalCV does not grade clinicians.')).toBeVisible();
    await expect(page.getByText('Durations are pilot targets, not returned data')).toBeVisible();
    await expect(page.locator('main')).not.toContainText(/Adverse|under dispute/);
  });

  test('the final action returns to the real entry', async ({ page }) => {
    await expect(page.locator('.ezh-start-cta')).toHaveAttribute('href', '#npi');
  });

  test('the first action keeps the approved 8px page-action radius', async ({ page }) => {
    await expect(page.locator('[data-home-primary-cta]')).toHaveCSS('border-top-left-radius', '8px');
  });
});

test.describe('home — the resolution scene, idle → resolved', () => {
  test('idle: the real registry with nothing read, and honest tally counts', async ({ page }) => {
    await routeOpportunities(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const scene = page.locator('[data-home-resolution]');
    await expect(scene.getByText('Awaiting an NPI — nothing has been read yet')).toBeVisible();
    await expect(scene.locator('[data-home-idle-ledger] .ezh-lrow')).toHaveCount(8);
    // The idle scene claims no read: no "no match", no timestamps, no clock.
    await expect(scene).not.toContainText(/no match/i);
    await expect(scene.getByText('Illustrative until a real lookup returns', { exact: false })).toBeVisible();
  });

  test('resolved: real-shaped rows replace the idle ledger, unknowns at full opacity', async ({ page }) => {
    await routeOpportunities(page);
    await routeResolve(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    const input = page.locator('#ezh-npi');
    await expect(async () => {
      await input.fill(VALID_NPI);
      await expect(page.getByText('10/10 digits')).toBeVisible({ timeout: 1500 });
    }).toPass({ timeout: 15000 });
    await page.locator('[data-home-primary-cta]').click();

    const reveal = page.locator('[data-npi-reveal]');
    await expect(reveal).toBeVisible({ timeout: 15000 });
    // The registry-named identity, presentation-cased.
    await expect(reveal.getByText('Test Clinician')).toBeVisible();
    await expect(reveal.getByText(`Named by NPPES for NPI ${VALID_NPI}`)).toBeVisible();
    // The idle ledger is gone — real rows replaced the illustration.
    await expect(page.locator('[data-home-idle-ledger]')).toHaveCount(0);

    // Equal typographic confidence: the access-required lane paints at full
    // opacity, same structure as a returned row.
    const accessRow = reveal.locator('.ezh-rv-row.is-unavailable').first();
    await expect(accessRow).toBeVisible();
    await expect(accessRow).toContainText('Access required');
    expect(await accessRow.evaluate((el) => getComputedStyle(el).opacity)).toBe('1');

    // Provenance stays behind a CLOSED disclosure.
    const disclosure = reveal.locator('details.ezh-rv-more').first();
    await expect(disclosure).toBeVisible();
    expect(await disclosure.evaluate((el) => (el as HTMLDetailsElement).open)).toBe(false);

    // The tally now counts the real rows, not the idle fixture. ("Returned
    // by source" is also the reveal's group heading, so scope to the tally.)
    const scene = page.locator('[data-home-resolution]');
    await expect(scene.locator('.ezh-tally').getByText('Returned by source')).toBeVisible();
    await expect(scene.getByText('Shown to you only. Nothing here has been sent anywhere.')).toBeVisible();

    // The correction path is first-class and resets to the idle composition.
    await reveal.getByRole('button', { name: 'Not you? Check another NPI' }).click();
    await expect(page.locator('[data-home-idle-ledger]')).toBeVisible();
    await expect(scene.getByText('Awaiting an NPI — nothing has been read yet')).toBeVisible();
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
      // scrollWidth is blind when an ancestor hides overflow-x — assert the
      // interactive elements actually END inside the viewport.
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

test.describe('home — reduced motion and no-JS', () => {
  test('reduced motion: the static frame is complete and runs ZERO animations ≥50ms', async ({ page }) => {
    await routeOpportunities(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(folio(page)).toHaveAttribute('data-motion', 'static');
    const hidden = await page.evaluate(() =>
      [...document.querySelectorAll('.ezh-fig-hero .ezh-f-arr')].filter(
        (row) => getComputedStyle(row).opacity !== '1',
      ).length,
    );
    expect(hidden).toBe(0);
    // Zero animations of consequence anywhere in the island.
    const running = await page.evaluate(() =>
      document
        .getAnimations()
        .filter((a) => {
          const target = (a.effect as KeyframeEffect | null)?.target as Element | null;
          if (!target || !target.closest('main.ezh')) return false;
          const duration = (a.effect?.getTiming().duration as number) || 0;
          return duration >= 50;
        })
        .map((a) => (a as CSSAnimation).animationName ?? a.id),
    );
    expect(running, `animations under reduced motion: ${running.join(', ')}`).toEqual([]);
    await expect(folio(page).locator('.ezh-fig-cap')).toBeVisible();
  });

  test('the no-JavaScript frame is the complete composition', async ({ browser }) => {
    const context = await browser.newContext({
      javaScriptEnabled: false,
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();
    await page.goto('/');
    await expect(page.locator('h1')).toHaveText('Get hired. Start working sooner.');
    await expect(page.locator('header.vcv-eb')).toHaveAttribute('data-eb-theme', 'light');
    await expect(folio(page)).toHaveAttribute('data-motion', 'static');
    await expect(page.locator('[data-home-stage] img')).toHaveCount(0);
    // The folio is complete in the server frame: both viewBox variants are in
    // DOM (4 arrival groups each) and CSS shows exactly one.
    await expect(folio(page).locator('.ezh-f-arr')).toHaveCount(8);
    // The idle resolution ledger, the arc, the packet shape, and the legend
    // all read without JavaScript.
    await expect(page.locator('[data-home-idle-ledger] .ezh-lrow')).toHaveCount(8);
    await expect(page.getByText('Five states, no others')).toBeVisible();
    await expect(page.getByText('Counts are of lanes, not a score. VitalCV does not grade clinicians.')).toBeVisible();
    await expect(page.locator('[data-home-opportunity-cta]')).toHaveAttribute('href', '/explore');
    await expect(page.getByText('Reading the current opportunity feed…')).toBeVisible();
    await context.close();
  });
});
