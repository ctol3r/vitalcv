import { expect, test } from '@playwright/test';

/**
 * Wave 1072 — the one real loop at /design/reset. PREVIEW COVERAGE, additive:
 * production '/' keeps its own suite untouched.
 *
 * Network is mocked at the proxy boundary so CI needs no live backend — the
 * mocks reproduce the REAL contracts recon verified (bootstrap's 4-field
 * projection with npiType, the UNAVAILABLE collapse, the anonymous MATCHA
 * feed shape). What is asserted is the loop's truth behaviour, not backend
 * availability.
 */

const ROUTE = '/design/reset';
// Checksum-valid NPIs (80840+Luhn). 1234567893 is the canonical test number.
const NPI_INDIVIDUAL = '1234567893';

const BOOT_INDIVIDUAL = {
  npi: NPI_INDIVIDUAL, npiType: 'TYPE_1', inferredPersona: 'CLINICIAN',
  identitySource: 'NPPES_API', firstName: 'JEAN', lastName: 'ABBOTT',
  specialty: 'Emergency Medicine', state: 'CO', alreadyRegistered: false,
};
const TRUST = {
  identityVerified: true, exclusionStatus: 'CLEAR', pecosStatus: 'UNKNOWN',
  licensureStatus: 'unknown', blockers: [], nextActions: [],
};
const MATCHES = {
  npi: NPI_INDIVIDUAL,
  matches: [
    {
      opportunity: { id: 'opp-1', title: 'Emergency Medicine Physician', organizationName: 'East Bay Access Clinics', state: 'CA', hiringType: 'Full-time' },
      explanation: {
        matchBand: 'PARTIAL',
        fitReasons: [{ label: 'Specialty matches: emergency medicine', dimension: 'specialty' }],
        blockers: [{ label: 'State licensure not source-checked' }],
      },
    },
    {
      opportunity: { id: 'opp-2', title: 'Urgent Care Physician', organizationName: 'North Pier Health', state: 'CO' },
      explanation: { matchBand: 'PARTIAL', fitReasons: [], blockers: [] },
    },
  ],
};

async function mockLoop(page: import('@playwright/test').Page, opts: {
  boot?: unknown; matches?: unknown; matchStatus?: number;
} = {}) {
  await page.route('**/api/identity/bootstrap/**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(opts.boot ?? BOOT_INDIVIDUAL) }));
  await page.route('**/api/trust-state/**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(TRUST) }));
  await page.route('**/api/matcha/opportunities/**', (r) =>
    r.fulfill({ status: opts.matchStatus ?? 200, contentType: 'application/json', body: JSON.stringify(opts.matches ?? MATCHES) }));
}

async function resolve(page: import('@playwright/test').Page, npi = NPI_INDIVIDUAL) {
  await page.goto(ROUTE);
  await page.fill('#rst-npi', npi);
  await page.click('button[data-home-primary-cta]');
}

test.describe('one real loop — truth behaviour', () => {
  test('a real individual resolution renders the registry identity, never a fixture', async ({ page }) => {
    await mockLoop(page);
    await resolve(page);
    await expect(page.locator('.rst-name-xl')).toHaveText(/JEAN ABBOTT/);
    await expect(page.locator('.rst-role')).toContainText('Emergency Medicine · CO');
    // the fictional clinician must NOT appear on the live path
    await expect(page.locator('body')).not.toContainText('K. Osei');
  });

  test('the same profile object reaches every scene', async ({ page }) => {
    await mockLoop(page);
    await resolve(page);
    await expect(page.locator('.rst-name-xl')).toContainText('JEAN ABBOTT');
    // rail plate, apply side, and continuity all carry the same identity
    await expect(page.locator('.rst-plate-name').first()).toHaveText('JEAN ABBOTT');
    await expect(page.locator('.rst-apply .rst-carry-name').first()).toHaveText('JEAN ABBOTT');
    await expect(page.locator('.rst-keep-line')).toContainText("JEAN ABBOTT's record stays yours");
  });

  test('MATCHA renders the real feed: dominant + secondary with computed reasons', async ({ page }) => {
    await mockLoop(page);
    await resolve(page);
    await expect(page.locator('.rst-opp-role')).toHaveText('Emergency Medicine Physician');
    await expect(page.locator('.rst-why li').first()).toContainText('Specialty matches');
    await expect(page.locator('.rst-blockers')).toContainText('not source-checked');
    // secondary switches the dominant selection
    await page.click('.rst-alt');
    await expect(page.locator('.rst-opp-role')).toHaveText('Urgent Care Physician');
  });

  test('an empty feed is an honest state with real destinations — never substituted', async ({ page }) => {
    await mockLoop(page, { matches: { npi: NPI_INDIVIDUAL, matches: [] } });
    await resolve(page);
    await expect(page.locator('.rst-discover')).toContainText('No current opportunities match');
    await expect(page.locator('a[href="/holder/matcha"]')).toBeVisible();
    await expect(page.locator('a[href="/explore"]')).toBeVisible();
    await expect(page.locator('body')).not.toContainText('Cascade Regional');
  });

  test('an organization NPI gets the honest Type-2 state, not a profile', async ({ page }) => {
    await mockLoop(page, { boot: { ...BOOT_INDIVIDUAL, npiType: 'TYPE_2', firstName: undefined, lastName: undefined } });
    await resolve(page);
    await expect(page.locator('.rst-msg')).toContainText('names an organization');
    await expect(page.locator('.rst-name-xl')).not.toContainText('JEAN');
  });

  test('the UNAVAILABLE collapse is carried honestly — no guessing which failure', async ({ page }) => {
    await mockLoop(page, { boot: { npi: NPI_INDIVIDUAL, npiType: 'TYPE_1', identitySource: 'UNAVAILABLE', alreadyRegistered: false } });
    await resolve(page);
    await expect(page.locator('.rst-msg')).toContainText('could not answer');
    await expect(page.locator('.rst-msg')).not.toContainText(/not found|rate.?limit|outage/i);
  });

  test('no fake completion wording exists before a real share', async ({ page }) => {
    await mockLoop(page);
    await resolve(page);
    const body = await page.locator('.rst').innerText();
    for (const banned of ['Start confirmed', 'Delivered', 'Employer received', 'Application submitted']) {
      expect(body, `"${banned}" must not appear without a real backend event`).not.toContain(banned);
    }
    await expect(page.locator('.rst-side--to')).toContainText('Preview only — nothing has been sent');
  });

  test('the demo fixture is explicit, labelled, and cleared by real input', async ({ page }) => {
    await mockLoop(page);
    await page.goto(ROUTE);
    await page.click('.rst-demo-link');
    await expect(page.locator('.rst-name-xl')).toContainText('K. Osei');
    await expect(page.locator('.rst-open .rst-fine')).toContainText('Illustrative example');
    // the live Apply flow must be disabled under demo
    await expect(page.locator('.rst-apply-embed')).toHaveCount(0);
    // typing a real number clears the fixture entirely
    await page.fill('#rst-npi', '12');
    await expect(page.locator('body')).not.toContainText('K. Osei');
  });

  test('preview route is noindex and carries the hero contract markers', async ({ page }) => {
    await page.goto(ROUTE);
    expect(await page.locator('meta[name="robots"][content*="noindex"]').count()).toBeGreaterThan(0);
    await expect(page.locator('[data-home-hero]')).toBeVisible();
    await expect(page.locator('h1')).toHaveCount(1);
  });
});
