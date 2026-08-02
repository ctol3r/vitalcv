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
 *   - a named source answered  → "Returned by source"
 *   - a source needing review  → "Needs your attention" (never "Blocked")
 *   - a source we cannot read  → "Unavailable without additional access"
 *   - a system failure         → an explicit system state, not a finding
 *   - no bare "Verified", no fabricated readiness score
 *
 * The first label read "Confirmed today" until Home Evidence v2 Wave 3E. It had
 * to go: the OIG lane answers from a MONTHLY LEIE file, so a same-day exclusion
 * cannot be in it, and a heading claiming same-day confirmation over a monthly
 * snapshot out-claims its own rows. "Returned by source" says what happened and
 * nothing more. Every row now also carries SOURCE · CADENCE · LIMITATION.
 *
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
  alreadyRegistered?: boolean;
  /** Provenance label on the identity fields — 'NPPES_API' when registry-derived. */
  identitySource?: string;
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

/**
 * Where the clinician's own returned state renders.
 *
 * This moved twice. COMPETE-1 took it out of `[data-home-hero]` and into a
 * scene of its own; COMPETE-3 folded it back into ARRIVAL, because a scene that
 * exists only to hold a result is blank for every visitor who has not asked for
 * one — it was the emptiest frame on the site. The answer now replaces the
 * empty record in the frame where the NPI was typed. Every truth assertion
 * below is unchanged and still applies — only the container moved.
 */
// The homepage's first screen, addressed by the composition-agnostic marker
// rather than by whichever scene/section currently serves it. This spec's ten
// truth assertions have now outlived two compositions; the marker is why.
const hero = (page: Page) => page.locator('[data-home-hero]');

/**
 * The hero's primary action (HERO-RESET-1: was "Check readiness"). The dot
 * tolerates either apostrophe form, so a straight/curly swap in the copy
 * cannot silently break every lookup test in this file.
 */
const HERO_CTA = /check what.s ready/i;

/**
 * The NPI field's accessible name.
 *
 * COMPETE-1: the homepage labels this field with a VISIBLE `<label>`, where the
 * retired stacked composition used an invisible `aria-label="NPI number"`. The
 * visible label is the better markup — and it is why this could not simply be
 * aliased back: adding `aria-label` over visible text that says something else
 * breaks WCAG 2.5.3 (Label in Name) for voice-control users, who speak what
 * they see.
 *
 * That visible label now FLOATS (Home Evidence v2, Wave 2C): it reads "Enter
 * your 10-digit NPI" at rest and compresses to "NPI number" once the field is
 * focused or holding digits. Since `fill()` focuses the field, a locator tied
 * to either wording alone would break mid-interaction. Match the part stable
 * across both states, so this keeps testing the field rather than the copy.
 * Supersedes `/start with your npi/i`.
 *
 * Declared once so the next composition change edits one line, not four.
 */
const NPI_FIELD = { name: /npi/i };

async function submitNpi(page: Page, npi: string) {
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.getByRole('textbox', NPI_FIELD).fill(npi);
  const cta = page.getByRole('button', { name: HERO_CTA });
  // Enablement requires hydration + a checksum-valid NPI; waiting here keeps
  // the click from racing a pre-hydration (native, no-op) form submit.
  await expect(cta).toBeEnabled();
  await cta.click();
}

/**
 * Rows inside one truth group.
 *
 * Addressed by the group's own data attribute rather than by its heading text.
 * Wave 3E moved the headings into `<h3>` and renamed the first one, and a
 * locator keyed to heading COPY has now broken twice for reasons that had
 * nothing to do with truth. The attribute is the stable contract; the heading
 * wording is asserted separately, where it is the thing under test.
 */
function groupRows(page: Page, kind: 'returned' | 'attention' | 'unavailable') {
  return hero(page).locator(`[data-evidence-group="${kind}"] ul`);
}

async function expectResolved(page: Page) {
  await expect(hero(page).getByText(/located in NPPES/)).toBeVisible({ timeout: 15_000 });
}

/**
 * The clear-exclusion line. Matched by pattern, not literal: the copy now
 * carries the lane's cadence from the registry (`sourceLanes.ts`), because a
 * monthly LEIE snapshot rendered under "Confirmed today" with no age was a
 * freshness overclaim on the one fact where staleness is a liability.
 * Pinning the literal would re-break every time the cadence label changes.
 */
const CLEAR_EXCLUSION = /No match in the current LEIE file/;

test.describe('NPI truth engine — homepage hero', () => {
  test('a checksum-invalid NPI cannot start a lookup and says why', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    await page.getByRole('textbox', NPI_FIELD).fill(BAD_CHECKSUM_NPI);
    await expect(
      page.getByText('That is 10 digits but not a valid NPI — check for a typo.'),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: HERO_CTA })).toBeDisabled();

    // The same field with a checksum-valid NPI unlocks the lookup.
    await page.getByRole('textbox', NPI_FIELD).fill(VALID_NPI);
    // This used to assert the literal hint "Press Enter to continue" — the
    // retired composition's way of saying the field was ready. The durable
    // guarantee is that correcting the number CLEARS the complaint and opens
    // the action, which the next line already proves; asserting the retraction
    // is stronger than asserting one wording of the invitation.
    await expect(
      page.getByText('That is 10 digits but not a valid NPI — check for a typo.'),
    ).toBeHidden();
    await expect(page.getByRole('button', { name: HERO_CTA })).toBeEnabled();
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
    const confirmed = groupRows(page, 'returned');
    await expect(confirmed.getByText('Located in the NPPES registry')).toBeVisible();
    await expect(confirmed.getByText(CLEAR_EXCLUSION)).toBeVisible();

    // Licensure was not read — it must sit in the gated group, not the confirmed one.
    const unavailable = groupRows(page, 'unavailable');
    await expect(unavailable.getByText('State licensure')).toBeVisible();
    await expect(unavailable.getByText('Not read — state-board access required')).toBeVisible();
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
    await expect(hero(page).getByText('Located in the NPPES registry')).not.toBeVisible();
    // Other genuinely-returned results still show, so absence above is not a render failure.
    await expect(hero(page).getByText(CLEAR_EXCLUSION)).toBeVisible();
  });

  test('a registered account name never renders under registry framing', async ({ page }) => {
    // The exact legacy payload shape production served for the Sarah Chen
    // misattribution: a registered NPI's bootstrap echoing the account's
    // self-entered profile fields, with no provenance label. Rendering that
    // name under "located in NPPES" presented an account display name as the
    // registry record of a real provider's NPI — the header must fall back to
    // the neutral NPI identity instead.
    await mockNpiApis(page, {
      bootstrap: {
        firstName: 'Sarah',
        lastName: 'Chen',
        specialty: 'Internal Medicine',
        state: 'CA',
        alreadyRegistered: true,
      },
      trust: CLEAN_TRUST,
    });
    await submitNpi(page, VALID_NPI);

    // Cannot key resolution on "located in NPPES" here — that caption is
    // exactly what an unlabeled registered payload must NOT receive.
    await expect(hero(page).getByText(`NPI ${VALID_NPI}`, { exact: true }).first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(hero(page).getByText('Sarah Chen')).not.toBeVisible();
    await expect(hero(page).getByText(/located in NPPES/)).not.toBeVisible();
    await expect(hero(page).getByText('Registry identity unavailable right now')).toBeVisible();
  });

  test('registry-labeled identity renders for a registered NPI — the registry record, not the account name', async ({ page }) => {
    await mockNpiApis(page, {
      bootstrap: {
        firstName: 'ARDALAN',
        lastName: 'ENKESHAFI',
        specialty: 'Hospitalist',
        state: 'MD',
        alreadyRegistered: true,
        identitySource: 'NPPES_API',
      },
      trust: CLEAN_TRUST,
    });
    await submitNpi(page, VALID_NPI);
    await expectResolved(page);

    await expect(hero(page).getByText('Ardalan Enkeshafi')).toBeVisible();
    await expect(hero(page).getByText(`NPI ${VALID_NPI} · located in NPPES`)).toBeVisible();
  });

  test('PECOS NOT_FOUND is attention — not blocked, not confirmed', async ({ page }) => {
    await mockNpiApis(page, {
      trust: { ...CLEAN_TRUST, pecosStatus: 'NOT_FOUND' },
    });
    await submitNpi(page, VALID_NPI);
    await expectResolved(page);

    const attention = groupRows(page, 'attention');
    await expect(attention.getByText('Medicare enrollment (PECOS)')).toBeVisible();
    await expect(attention.getByText('No active enrollment found')).toBeVisible();

    const heroText = await hero(page).innerText();
    expect(heroText).not.toMatch(/blocked/i);
    await expect(
      groupRows(page, 'returned').getByText('Medicare enrollment (PECOS)'),
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
      groupRows(page, 'attention').getByText(
        'OIG / LEIE exclusion recorded — review required before staffing',
      ),
    ).toBeVisible();
    // An EXCLUDED status must never render the clear-result line.
    await expect(hero(page).getByText(CLEAR_EXCLUSION)).not.toBeVisible();
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

    const unavailable = groupRows(page, 'unavailable');
    await expect(unavailable.getByText('Check not yet run')).toBeVisible();
    await expect(unavailable.getByText('Not read — state-board access required')).toBeVisible();
    await expect(hero(page).getByText(CLEAR_EXCLUSION)).not.toBeVisible();
  });

  test('trust-state outage degrades honestly: identity located, nothing claimed confirmed', async ({ page }) => {
    await mockNpiApis(page, { bootstrap: CLEAN_BOOTSTRAP, trustStatus: 503 });
    await submitNpi(page, VALID_NPI);
    await expectResolved(page);

    await expect(hero(page).getByText('Macie Miller')).toBeVisible();
    await expect(hero(page).getByText('Returned by source')).not.toBeVisible();
    await expect(hero(page).getByText('Needs your attention')).not.toBeVisible();
    await expect(
      groupRows(page, 'unavailable').getByText('Not read — state-board access required'),
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
    await expect(hero(page).getByText('Returned by source')).not.toBeVisible();
    await expect(hero(page).getByRole('link', { name: /claim your wallet/i })).not.toBeVisible();
    await expect(hero(page).getByRole('button', { name: /try another npi/i })).toBeVisible();
  });

  test('reset returns to the NPI action with a cleared field', async ({ page }) => {
    await mockNpiApis(page, {});
    await submitNpi(page, VALID_NPI);
    await expectResolved(page);

    await page.getByRole('button', { name: /check another npi/i }).click();
    await expect(hero(page).locator('[data-home-evidence-field]')).toHaveCount(0);
    // COMPETE-1: the reset control and the NPI action now live in DIFFERENT
    // scenes, so the CTA is addressed at page level rather than within the
    // result container. The contract is unchanged — cleared field, disabled
    // action — and `ask-npi-response.spec.ts` pins that reset also carries the
    // reader back to the field it just cleared.
    await expect(page.getByRole('button', { name: HERO_CTA })).toBeDisabled();
    await expect(page.getByRole('textbox', NPI_FIELD)).toHaveValue('');
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
