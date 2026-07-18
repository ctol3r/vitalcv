import { test, expect, type Page } from '@playwright/test';

/**
 * NPI Truth Engine — homepage hero contract.
 *
 * Rewritten from the pre-#510 spec that drove a `/api/ingest/**` SSE flow the
 * hero no longer invokes. The current flow (app/HomePageClient.tsx +
 * components/home/LiveNpiResult.tsx): submit resolves in place by fetching
 * `/api/identity/bootstrap/:npi` and `/api/trust-state/:npi` — both thin
 * proxies to the backend, so this suite intercepts them in the browser and
 * asserts how each truth state RENDERS.
 *
 * The contract under guard, in current copy:
 *   - a source the registry confirmed today  → "Confirmed today"
 *   - a source needing review                → "Needs your attention" (never "Blocked")
 *   - a source we cannot read yet            → "Unavailable without additional access"
 *   - a system failure                       → an explicit system state, not a finding
 *   - no bare "Verified", no fabricated readiness score
 * Do not weaken these assertions to make a copy change pass; change the copy
 * back or bring the new copy here deliberately (see tests/e2e/README.md).
 */

// Passes the CMS 80840 + Luhn check digit (lib/vital/npi.ts) — the hero's
// submit stays disabled for any 10-digit value that does not.
const VALID_NPI = '1234567893';
const BAD_CHECKSUM_NPI = '1234567890';

interface MockBootstrap {
  firstName?: string;
  lastName?: string;
  specialty?: string;
  state?: string;
}
interface MockTrustState {
  identityVerified?: boolean;
  exclusionStatus?: 'CLEAR' | 'EXCLUDED' | 'UNCHECKED';
  pecosStatus?: 'ENROLLED' | 'NOT_FOUND' | 'UNKNOWN';
  licensureStatus?: string;
  blockers?: string[];
  nextActions?: string[];
}

const CLEAN_BOOTSTRAP: MockBootstrap = {
  firstName: 'MACIE',
  lastName: 'MILLER',
  specialty: 'Family Medicine',
  state: 'CA',
};

const CLEAN_TRUST: MockTrustState = {
  identityVerified: true,
  exclusionStatus: 'CLEAR',
  pecosStatus: 'ENROLLED',
  licensureStatus: 'unknown',
  blockers: [],
  nextActions: ['Connect your state license'],
};

async function mockNpiApis(
  page: Page,
  opts: {
    bootstrap?: MockBootstrap;
    bootstrapStatus?: number;
    trust?: MockTrustState;
    trustStatus?: number;
  },
) {
  await page.route('**/api/identity/bootstrap/**', (route) =>
    route.fulfill({
      status: opts.bootstrapStatus ?? 200,
      contentType: 'application/json',
      body: JSON.stringify(
        opts.bootstrapStatus && opts.bootstrapStatus >= 400
          ? { error: 'Backend unavailable' }
          : (opts.bootstrap ?? CLEAN_BOOTSTRAP),
      ),
    }),
  );
  await page.route('**/api/trust-state/**', (route) =>
    route.fulfill({
      status: opts.trustStatus ?? 200,
      contentType: 'application/json',
      body: JSON.stringify(
        opts.trustStatus && opts.trustStatus >= 400
          ? { error: 'Backend unavailable' }
          : (opts.trust ?? CLEAN_TRUST),
      ),
    }),
  );
}

const hero = (page: Page) => page.locator('[data-home-hero]');

async function submitNpi(page: Page, npi: string) {
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.getByLabel('NPI number').fill(npi);
  const cta = page.getByRole('button', { name: /check readiness/i });
  // Enablement requires hydration + a checksum-valid NPI; waiting here keeps
  // the click from racing a pre-hydration (native, no-op) form submit.
  await expect(cta).toBeEnabled();
  await cta.click();
}

/** Rows inside one truth group, addressed by its rendered heading. */
function groupRows(page: Page, title: string) {
  return hero(page).locator(`p:has-text("${title}") + ul`);
}

async function expectResolved(page: Page) {
  await expect(hero(page).getByText(/located in NPPES/)).toBeVisible({ timeout: 15_000 });
}

test.describe('NPI truth engine — homepage hero', () => {
  test('a checksum-invalid NPI cannot start a lookup and says why', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    await page.getByLabel('NPI number').fill(BAD_CHECKSUM_NPI);
    await expect(
      page.getByText('That is 10 digits but not a valid NPI — check for a typo.'),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /check readiness/i })).toBeDisabled();

    // The same field with a checksum-valid NPI unlocks the lookup.
    await page.getByLabel('NPI number').fill(VALID_NPI);
    await expect(page.getByText('Press Enter to continue')).toBeVisible();
    await expect(page.getByRole('button', { name: /check readiness/i })).toBeEnabled();
  });

  test('clean clinician: confirmed sources are named, gated licensure stays unavailable', async ({ page }) => {
    await mockNpiApis(page, { bootstrap: CLEAN_BOOTSTRAP, trust: CLEAN_TRUST });
    await submitNpi(page, VALID_NPI);

    // The progressive check sequence renders before any claim does.
    await expect(hero(page).getByText('Reading primary sources')).toBeVisible();

    await expectResolved(page);
    await expect(hero(page).getByText('Macie Miller')).toBeVisible();
    await expect(hero(page).getByText(`NPI ${VALID_NPI} · located in NPPES`)).toBeVisible();

    // Confirmed lanes name their source and what the source actually returned.
    const confirmed = groupRows(page, 'Confirmed today');
    await expect(confirmed.getByText('Confirmed through the NPPES registry')).toBeVisible();
    await expect(confirmed.getByText('No exclusion match returned')).toBeVisible();

    // Licensure was not read — it must sit in the gated group, not the confirmed one.
    const unavailable = groupRows(page, 'Unavailable without additional access');
    await expect(unavailable.getByText('State licensure')).toBeVisible();
    await expect(unavailable.getByText('State-board source access required')).toBeVisible();
    await expect(confirmed.getByText('State licensure')).not.toBeVisible();

    // One next step, and the snapshot names its own limits. /onboarding is the
    // canonical destination (#686 route canon); /get-ready is only a 307 now.
    await expect(hero(page).getByRole('link', { name: /claim your wallet/i })).toHaveAttribute(
      'href',
      '/onboarding',
    );
    await expect(
      hero(page).getByText(/not a completed credentialing decision/),
    ).toBeVisible();

    // Truth contract: no bare "Verified", no fabricated score, no proof artifact.
    const heroText = (await hero(page).innerText()).toLowerCase();
    expect(heroText).not.toMatch(/\bverified\b/);
    expect(heroText).not.toMatch(/\/100|readiness score/);
    expect(heroText).not.toMatch(/download proof/);
  });

  test('identity the source did not confirm is never claimed as confirmed', async ({ page }) => {
    await mockNpiApis(page, {
      bootstrap: { firstName: 'JOHN', lastName: 'DOE' },
      trust: { ...CLEAN_TRUST, identityVerified: false },
    });
    await submitNpi(page, VALID_NPI);
    await expectResolved(page);

    // The located identity may render as fact…
    await expect(hero(page).getByText('John Doe')).toBeVisible();
    // …but the confirmed group must not carry the NPPES-confirmed claim.
    await expect(hero(page).getByText('Confirmed through the NPPES registry')).not.toBeVisible();
    // Other genuinely-returned results still show, so absence above is not a render failure.
    await expect(hero(page).getByText('No exclusion match returned')).toBeVisible();
  });

  test('PECOS NOT_FOUND is attention — not blocked, not confirmed', async ({ page }) => {
    await mockNpiApis(page, {
      trust: { ...CLEAN_TRUST, pecosStatus: 'NOT_FOUND' },
    });
    await submitNpi(page, VALID_NPI);
    await expectResolved(page);

    const attention = groupRows(page, 'Needs your attention');
    await expect(attention.getByText('Medicare enrollment (PECOS)')).toBeVisible();
    await expect(attention.getByText('No active enrollment found')).toBeVisible();

    const heroText = await hero(page).innerText();
    expect(heroText).not.toMatch(/blocked/i);
    await expect(
      groupRows(page, 'Confirmed today').getByText('Medicare enrollment (PECOS)'),
    ).not.toBeVisible();
  });

  test('an OIG exclusion lands in attention and never reads as clear', async ({ page }) => {
    await mockNpiApis(page, {
      bootstrap: { firstName: 'BAD', lastName: 'ACTOR' },
      trust: {
        identityVerified: true,
        exclusionStatus: 'EXCLUDED',
        pecosStatus: 'ENROLLED',
        licensureStatus: 'unknown',
        blockers: ['OIG / LEIE exclusion recorded — review required before staffing'],
        nextActions: [],
      },
    });
    await submitNpi(page, VALID_NPI);
    await expectResolved(page);

    await expect(
      groupRows(page, 'Needs your attention').getByText(
        'OIG / LEIE exclusion recorded — review required before staffing',
      ),
    ).toBeVisible();
    // An EXCLUDED status must never render the clear-result line.
    await expect(hero(page).getByText('No exclusion match returned')).not.toBeVisible();
  });

  test('unchecked sources stay unknown — never presented as clear', async ({ page }) => {
    await mockNpiApis(page, {
      trust: {
        identityVerified: true,
        exclusionStatus: 'UNCHECKED',
        pecosStatus: 'UNKNOWN',
        licensureStatus: 'unknown',
        blockers: [],
        nextActions: [],
      },
    });
    await submitNpi(page, VALID_NPI);
    await expectResolved(page);

    const unavailable = groupRows(page, 'Unavailable without additional access');
    await expect(unavailable.getByText('Check not yet run')).toBeVisible();
    await expect(unavailable.getByText('State-board source access required')).toBeVisible();
    await expect(hero(page).getByText('No exclusion match returned')).not.toBeVisible();
  });

  test('trust-state outage degrades honestly: identity located, nothing claimed confirmed', async ({ page }) => {
    await mockNpiApis(page, { bootstrap: CLEAN_BOOTSTRAP, trustStatus: 503 });
    await submitNpi(page, VALID_NPI);
    await expectResolved(page);

    await expect(hero(page).getByText('Macie Miller')).toBeVisible();
    await expect(hero(page).getByText('Confirmed today')).not.toBeVisible();
    await expect(hero(page).getByText('Needs your attention')).not.toBeVisible();
    await expect(
      groupRows(page, 'Unavailable without additional access').getByText(
        'State-board source access required',
      ),
    ).toBeVisible();
  });

  test('registry outage is a system state, not a finding about the NPI', async ({ page }) => {
    await mockNpiApis(page, { bootstrapStatus: 502, trust: CLEAN_TRUST });
    await submitNpi(page, VALID_NPI);

    await expect(hero(page).getByText(/couldn.t reach the registry/i)).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      hero(page).getByText(`This is a system state, not a finding about NPI ${VALID_NPI}.`),
    ).toBeVisible();
    await expect(hero(page).getByText('Confirmed today')).not.toBeVisible();
    await expect(hero(page).getByRole('link', { name: /claim your wallet/i })).not.toBeVisible();
    await expect(hero(page).getByRole('button', { name: /try another npi/i })).toBeVisible();
  });

  test('reset returns to the illustrative preview with a cleared field', async ({ page }) => {
    await mockNpiApis(page, {});
    await submitNpi(page, VALID_NPI);
    await expectResolved(page);

    await page.getByRole('button', { name: /check another npi/i }).click();
    // The pre-lookup panel is the abstract Career Evidence Field (VHS-1). It is
    // a system metaphor, not per-clinician data — its legend names source states
    // rather than asserting an outcome. Reset returns to it with a cleared field.
    await expect(hero(page).locator('[data-home-evidence-field]')).toBeVisible();
    await expect(hero(page).locator('[data-field-legend]')).toContainText('Source-backed');
    await expect(page.getByLabel('NPI number')).toHaveValue('');
  });
});

test.describe('Review without a hydratable passport', () => {
  // Carried forward from the retired 04-launch-wedge spec: until VitalCV can
  // hydrate a passport record for an entity, /review renders an explicit
  // unavailable state — it never fabricates a decision card. In the e2e
  // environment the backend is down, so the passport fetch fails closed.
  test('renders the explicit unavailable state instead of a decision card', async ({ page }) => {
    await page.goto('/review/00000000-0000-0000-0000-000000000000?contextId=demo-review', {
      waitUntil: 'networkidle',
    });

    await expect(page.getByText('Employer review unavailable')).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByText(
        'This clinician passport is not available for review yet. The clinician may need to run a readiness check first.',
      ),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Try again' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Back to review' })).toBeVisible();
  });
});
