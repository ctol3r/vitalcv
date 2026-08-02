import { test, expect, type Page } from '@playwright/test';

/**
 * Wave 4 — the hero phase reaches the DOM and moves (contract §7).
 *
 * `__tests__/home-phase.test.tsx` pins the state machine as a pure function.
 * That is not evidence the marker is wired: the derivation can be perfect while
 * nothing renders it, or while the two reporters (`onStatusChange` from the
 * field, `onPhaseChange` from the result) are never connected. This drives the
 * real page and watches the attribute change.
 */
const VALID_NPI = '1234567893';
const NPI_FIELD = { name: /npi/i };
const HERO_CTA = /check what.s ready/i;

const root = (page: Page) => page.locator('[data-home-phase]');

async function mockLookup(page: Page, opts: { bootstrapStatus?: number } = {}) {
  await page.route('**/api/identity/bootstrap/**', (route) =>
    route.fulfill({
      status: opts.bootstrapStatus ?? 200,
      contentType: 'application/json',
      body: JSON.stringify(
        opts.bootstrapStatus && opts.bootstrapStatus >= 400
          ? { error: 'Backend unavailable' }
          : { firstName: 'MACIE', lastName: 'MILLER', specialty: 'Family Medicine', state: 'CA' },
      ),
    }),
  );
  await page.route('**/api/trust-state/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        identityVerified: true,
        exclusionStatus: 'CLEAR',
        pecosStatus: 'ENROLLED',
        licensureStatus: 'unknown',
        blockers: [],
        nextActions: [],
      }),
    }),
  );
}

test.describe('hero phase choreography', () => {
  test('starts idle and becomes active only when the visitor engages', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    // The server render — and therefore the no-JS floor — is idle.
    await expect(root(page)).toHaveAttribute('data-home-phase', 'idle');

    await page.getByRole('textbox', NPI_FIELD).fill('123');
    await expect(root(page)).toHaveAttribute('data-home-phase', 'active');
  });

  test('advances to resolving, then resolved, and releases on reset', async ({ page }) => {
    await mockLookup(page);
    await page.goto('/', { waitUntil: 'networkidle' });

    await page.getByRole('textbox', NPI_FIELD).fill(VALID_NPI);
    const cta = page.getByRole('button', { name: HERO_CTA });
    await expect(cta).toBeEnabled();
    await cta.click();

    // The sequence holds a minimum on-screen duration, so resolving is
    // observable rather than a frame that races past.
    await expect(root(page)).toHaveAttribute('data-home-phase', 'resolving');
    await expect(root(page)).toHaveAttribute('data-home-phase', 'resolved', { timeout: 15_000 });

    // Reset must release the phase with the result that produced it — a hero
    // still claiming `resolved` over an empty field is the bug this catches.
    await page.getByRole('button', { name: /check another|reset|start over/i }).first().click();
    await expect(root(page)).toHaveAttribute('data-home-phase', 'idle');
  });

  /**
   * The truth-carrying case: a failed lookup is a state of the SYSTEM. The
   * markup must not offer a phase that a stylesheet could dress as an adverse
   * finding about this clinician.
   */
  test('a registry outage reads as system-error, not as a finding', async ({ page }) => {
    await mockLookup(page, { bootstrapStatus: 500 });
    await page.goto('/', { waitUntil: 'networkidle' });

    await page.getByRole('textbox', NPI_FIELD).fill(VALID_NPI);
    const cta = page.getByRole('button', { name: HERO_CTA });
    await expect(cta).toBeEnabled();
    await cta.click();

    await expect(root(page)).toHaveAttribute('data-home-phase', 'system-error', {
      timeout: 15_000,
    });
  });

  /**
   * RISK 1 — the decorative atmosphere reads the phase. It must never be able
   * to describe a real person, so the phase itself may not carry the lookup.
   */
  test('the phase marker never carries the submitted NPI or identity', async ({ page }) => {
    await mockLookup(page);
    await page.goto('/', { waitUntil: 'networkidle' });

    await page.getByRole('textbox', NPI_FIELD).fill(VALID_NPI);
    await page.getByRole('button', { name: HERO_CTA }).click();
    await expect(root(page)).toHaveAttribute('data-home-phase', 'resolved', { timeout: 15_000 });

    const attrs = await root(page).evaluate((el) =>
      Object.fromEntries(
        Array.from(el.attributes)
          .filter((a) => a.name.startsWith('data-home'))
          .map((a) => [a.name, a.value]),
      ),
    );
    const serialised = JSON.stringify(attrs);
    expect(serialised).not.toContain(VALID_NPI);
    expect(serialised.toLowerCase()).not.toContain('macie');
    expect(serialised.toLowerCase()).not.toContain('miller');
    expect(attrs['data-home-phase']).toBe('resolved');
  });
});
