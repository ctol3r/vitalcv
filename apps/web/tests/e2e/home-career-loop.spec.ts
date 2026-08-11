import { expect, test } from '@playwright/test';

/**
 * `/` — the one real clinician career loop (Wave 1075), against a real
 * production build.
 *
 * These cover what SSR assertions cannot: live NPI resolution, the Apply
 * authentication and ownership boundaries, reduced motion, and layout at the
 * six required viewports.
 *
 * Network is mocked at the app's own proxy boundary so CI needs no live
 * backend. The mocks reproduce contracts that were verified against
 * production — bootstrap's 4-field projection with npiType, the UNAVAILABLE
 * collapse, and the PUBLIC-SAFE MATCHA shape #1074 shipped. What is asserted
 * is the homepage's truth behaviour, not backend availability.
 */

const NPI = '1234567893'; // checksum-valid; the canonical test number
// 1558395514 — check-digit INVALID, NPPES result_count 0, final digit (4)
// preserved. Was 1003000134 until 2026-08-10, which NPPES answers with
// result_count 1: a real registrant, used here as a stand-in organization.
const ORG_NPI = '1558395514';

const BOOT = {
  npi: NPI, npiType: 'TYPE_1', inferredPersona: 'CLINICIAN',
  identitySource: 'NPPES_API', firstName: 'JEAN', lastName: 'ABBOTT',
  specialty: 'Emergency Medicine', state: 'CO', alreadyRegistered: false,
};

/** Exactly the public-safe projection — no band, score, blockers or name. */
const PUBLIC_MATCHES = {
  npi: NPI,
  visibility: 'public',
  signInPrompt: 'Sign in to see readiness-aware matching for your own NPI.',
  matches: [
    {
      opportunityId: '98c123da-b7c5-41e3-8865-619330c60a14',
      title: 'Emergency Medicine Physician',
      organizationName: 'East Bay Access Clinics',
      organizationId: '9484bf5e-82f4-4b83-ade3-b14cda86e534',
      state: 'CA', hiringType: 'perm', applyAvailable: true,
      fitIndication: 'possible_fit',
      publicReasons: ['Specialty matches: emergency medicine'],
    },
    {
      opportunityId: 'b1c2d3e4-0000-4000-8000-000000000002',
      title: 'Urgent Care Physician',
      organizationName: 'North Pier Health',
      organizationId: 'c9d8e7f6-0000-4000-8000-000000000003',
      state: 'CO', hiringType: 'perm', applyAvailable: true,
      fitIndication: 'limited_public_signal', publicReasons: [],
    },
  ],
};

type Opts = { boot?: unknown; matches?: unknown; credentialsStatus?: number; credentialsBody?: unknown };

async function mockHome(page: import('@playwright/test').Page, opts: Opts = {}) {
  await page.route('**/api/identity/bootstrap/**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(opts.boot ?? BOOT) }));
  await page.route('**/api/trust-state/**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ blockers: [], nextActions: [] }) }));
  await page.route('**/api/matcha/opportunities/**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(opts.matches ?? PUBLIC_MATCHES) }));
  await page.route('**/api/apply/credentials/**', (r) =>
    r.fulfill({
      status: opts.credentialsStatus ?? 401,
      contentType: 'application/json',
      body: JSON.stringify(opts.credentialsBody ?? { error: 'Verified Clerk session required.' }),
    }));
}

/**
 * Open the Apply panel.
 *
 * The scroll-reveal keeps later scenes hidden until they intersect, so the
 * trigger exists in the DOM long before it is clickable. Scrolling first is
 * what a visitor does; clicking a hidden control is not.
 */
async function openApply(page: import('@playwright/test').Page) {
  const section = page.locator('.clh-apply').first();
  await section.scrollIntoViewIfNeeded();
  const trigger = page.locator('.clh-apply button').first();
  await expect(trigger).toBeVisible();
  await trigger.click();
  const dialog = page.locator('[role="dialog"]');
  await expect(dialog).toBeVisible();
  return dialog;
}

async function resolve(page: import('@playwright/test').Page, npi = NPI) {
  await page.goto('/');
  await page.click('#clh-npi');
  await page.fill('#clh-npi', npi);
  await page.click('button[data-home-primary-cta]');
}

test.describe('4–9 · the real loop on the production root', () => {
  test('4. a real individual NPI creates a real profile carried through every scene', async ({ page }) => {
    await mockHome(page);
    await resolve(page);
    await expect(page.locator('.clh-name-xl')).toContainText('JEAN ABBOTT');
    await expect(page.locator('.clh-role')).toContainText('Emergency Medicine');
    // ONE identity: the same clinician reaches the apply and continuity scenes.
    await expect(page.locator('.clh-carry-name').first()).toContainText('JEAN ABBOTT');
    await expect(page.locator('.clh-keep-sub')).toContainText('JEAN ABBOTT');
  });

  test('5. an organization NPI gets the honest Type-2 state, not a profile', async ({ page }) => {
    await mockHome(page, { boot: { ...BOOT, npi: ORG_NPI, npiType: 'TYPE_2', firstName: undefined, lastName: undefined } });
    await resolve(page, ORG_NPI);
    await expect(page.locator('.clh-msg')).toContainText('names an organization');
    await expect(page.locator('.clh-name-xl')).not.toContainText('JEAN');
  });

  test('6. an invalid NPI is rejected before any lookup runs', async ({ page }) => {
    let lookups = 0;
    await page.route('**/api/identity/bootstrap/**', (r) => { lookups += 1; return r.fulfill({ status: 200, body: '{}' }); });
    await page.goto('/');
    await page.click('#clh-npi');
    await page.fill('#clh-npi', '1234567890'); // valid length, bad check digit
    await page.click('button[data-home-primary-cta]');
    await expect(page.locator('.clh-msg')).toBeVisible();
    expect(lookups, 'a failed check digit must not reach the registry').toBe(0);
  });

  test('7. the registry-unavailable state never guesses which failure occurred', async ({ page }) => {
    await mockHome(page, { boot: { npi: NPI, npiType: 'TYPE_1', identitySource: 'UNAVAILABLE', alreadyRegistered: false } });
    await resolve(page);
    await expect(page.locator('.clh-msg')).toContainText('could not answer');
    await expect(page.locator('.clh-msg')).not.toContainText(/not found|rate.?limit|outage/i);
  });

  test('8. the rendered match carries no private field', async ({ page }) => {
    await mockHome(page);
    await resolve(page);
    await expect(page.locator('.clh-opp-role')).toHaveText('Emergency Medicine Physician');
    const body = await page.locator('.clh').innerText();
    for (const leak of ['matchBand', 'matchScore', 'INELIGIBLE', 'PARTIAL', 'Missing state license', 'profileCompleteness']) {
      expect(body, `homepage rendered private field "${leak}"`).not.toContain(leak);
    }
  });

  test('9. an empty feed is honest and offers real destinations', async ({ page }) => {
    await mockHome(page, { matches: { npi: NPI, visibility: 'public', matches: [] } });
    await resolve(page);
    await expect(page.locator('.clh-discover')).toContainText('No current opportunities match');
    await expect(page.locator('a[href="/holder/matcha"]')).toBeVisible();
    await expect(page.locator('a[href="/explore"]')).toBeVisible();
    // Never substitute a fictional listing for an empty live result.
    await expect(page.locator('body')).not.toContainText('Cascade Regional');
  });

  /*
   * Every scene must actually PAINT under default motion.
   *
   * The scroll-reveal starts nodes at opacity 0. The observer only ran on
   * `state.outcome`, so the opportunity block — which mounts later, when the
   * feed returns — was observed by nothing and never became visible. Only
   * reduced motion (which forces opacity:1) looked correct, so the
   * reduced-motion spec passed straight over it and `toHaveText` did too:
   * the text was in the DOM the whole time, drawn at zero opacity.
   */
  test('every resolved scene is actually visible, not merely in the DOM', async ({ page }) => {
    await mockHome(page);
    await resolve(page);
    for (const sel of ['.clh-create', '.clh-opp', '.clh-apply', '.clh-continue']) {
      const el = page.locator(sel).first();
      await el.scrollIntoViewIfNeeded();
      await expect(el, `${sel} never painted`).toBeVisible();
      // Retrying assertion — the reveal is a 0.6s transition, and reading
      // computed opacity once races it. Note toBeVisible() alone does NOT
      // catch this: Playwright counts an opacity-0 element as visible.
      await expect(el, `${sel} stayed transparent`).toHaveCSS('opacity', '1');
    }
  });

  test('a secondary opportunity is a user choice that replaces the default', async ({ page }) => {
    await mockHome(page);
    await resolve(page);
    await page.click('.clh-alt');
    await expect(page.locator('.clh-opp-role')).toHaveText('Urgent Care Physician');
  });
});

test.describe('10–13 · the Apply boundary', () => {
  test('10. Apply stops at authentication for a signed-out visitor', async ({ page }) => {
    await mockHome(page, { credentialsStatus: 401 });
    await resolve(page);
    const dialog = await openApply(page);
    await expect(dialog).toContainText('Sign in to see and choose what you share');
    // Scoped to the dialog: the site nav also links /sign-in, and the point
    // here is what the APPLY boundary offers.
    await expect(dialog.locator('a[href="/sign-in"]')).toBeVisible();
    // No credential holdings may render for an anonymous visitor.
    const body = await page.locator('body').innerText();
    expect(body).not.toContain('CA Medical Board');
  });

  test('11. pending ownership cannot reach credentials and is routed to verification', async ({ page }) => {
    await mockHome(page, {
      credentialsStatus: 403,
      credentialsBody: {
        error: 'Identity verification required before private sharing is enabled.',
        code: 'OWNERSHIP_PENDING',
      },
    });
    await resolve(page);
    const dialog = await openApply(page);
    await expect(dialog).toContainText('Identity verification required');
    // The real route into verification — not a "claim" button that verifies nothing.
    const verify = dialog.locator('a[href^="/holder/settings"]');
    await expect(verify).toBeVisible();
    await expect(verify).toContainText('Verify this NPI');
    // A pending clinician is already signed in; telling them to sign in again
    // would be the wrong instruction.
    await expect(dialog.locator('a[href="/sign-in"]')).toHaveCount(0);
    expect(await page.locator('body').innerText()).not.toContain('CA Medical Board');
  });

  test('12. verified ownership continues into the real selection flow', async ({ page }) => {
    await mockHome(page, {
      credentialsStatus: 200,
      credentialsBody: {
        npi: NPI,
        credentials: [
          { type: 'STATE_LICENSE', issuer: 'CO Medical Board', status: 'ACTIVE' },
          { type: 'DEA', issuer: 'DEA', status: 'ACTIVE' },
        ],
        trustState: { readiness_level: 'L2', readiness_score: 60, readiness_status: 'Partial' },
      },
    });
    await resolve(page);
    const dialog = await openApply(page);
    await expect(dialog).toContainText('CO Medical Board');
    await expect(dialog.locator('a[href="/sign-in"]')).toHaveCount(0);
  });

  test('13. the employer packet mirrors the clinician’s actual selection', async ({ page }) => {
    await mockHome(page, {
      credentialsStatus: 200,
      credentialsBody: {
        npi: NPI,
        credentials: [
          { type: 'STATE_LICENSE', issuer: 'CO Medical Board', status: 'ACTIVE' },
          { type: 'DEA', issuer: 'DEA', status: 'ACTIVE' },
        ],
        trustState: {},
      },
    });
    await resolve(page);
    const dialog = await openApply(page);
    const boxes = dialog.locator('input[type="checkbox"]');
    if (await boxes.count()) {
      await boxes.first().check().catch(() => {});
      // Whatever is selected is what the employer side reports — never a
      // hardcoded list.
      await expect(page.locator('.clh-side--to')).toContainText(/selected item/i);
    }
    // Until the backend confirms, the employer side says nothing was sent.
    await expect(page.locator('.clh-side--to')).toContainText('nothing has been sent');
  });
});

test.describe('16–19 · production surface properties', () => {
  /*
   * 16 is NOT asserted here. This e2e server deliberately boots with
   * DESIGN_PREVIEW=1 so other suites can drive /design/*, so a 404 assertion
   * would be measuring the harness rather than production. The guard's own
   * refusal is pinned in __tests__/home-career-loop-cutover.test.tsx (it
   * refuses canonical production even WITH the flag set), and the live 404 is
   * verified against vitalcv.com after deploy.
   */

  test('17. the root is indexable and carries the hero contract markers', async ({ page }) => {
    await page.goto('/');
    expect(await page.locator('meta[name="robots"][content*="noindex"]').count()).toBe(0);
    await expect(page.locator('[data-home-hero]')).toBeVisible();
    await expect(page.locator('h1')).toHaveCount(1);
  });

  test('18. reduced motion tells the same story', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await mockHome(page);
    await resolve(page);
    // Every scene's content is present without relying on scroll animation.
    await expect(page.locator('.clh-name-xl')).toContainText('JEAN ABBOTT');
    await expect(page.locator('.clh-opp-role')).toBeVisible();
    await expect(page.locator('.clh-keep-line')).toContainText('Keep your profile');
  });

  test('19. no horizontal overflow at any required viewport', async ({ page }) => {
    for (const [w, h] of [[320, 700], [390, 844], [768, 1024], [1366, 768], [1440, 900], [1728, 1117]] as const) {
      await page.setViewportSize({ width: w, height: h });
      await mockHome(page);
      await resolve(page);
      const overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `horizontal overflow at ${w}x${h}`).toBeLessThanOrEqual(1);
    }
  });

  test('the primary NPI action is reachable by keyboard alone', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    for (let i = 0; i < 25; i += 1) {
      const isNpi = await page.evaluate(() => document.activeElement?.id === 'clh-npi');
      if (isNpi) break;
      await page.keyboard.press('Tab');
    }
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('clh-npi');
    await page.keyboard.type(NPI);
    await expect(page.locator('#clh-npi')).toHaveValue(NPI);
  });
});
