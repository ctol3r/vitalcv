import { expect, test } from '@playwright/test';

/**
 * W4.2 — the proof moment on the LIVE homepage.
 *
 * The interactive proof-packet inspector (claim → source → retrieval/receipt →
 * state → limitation) must be a real, keyboard-operable moment on the
 * homepage: explicitly illustrative, stating the employer-final boundary, and
 * linking the real clinician flow — never a dead-end demo. Deterministic
 * behavior only (no screenshots).
 */

test.describe('homepage proof moment (W4.2)', () => {
  test('the inspector is on the homepage, illustrative, with the employer boundary and a real CTA', async ({
    page,
  }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    // COMPETE-1: the artifact lives in the film's `start` scene. The
    // `HomeProofMoment` WRAPPER is deliberately not used — it is a vertical page
    // section carrying a numbered eyebrow ("04 Why this is credible") and a
    // second display heading, both retired mechanisms (R4, R6). The inspector
    // itself, its illustrative label, and the employer boundary are unchanged.
    const moment = page.locator('[data-film-scene="hiring"]');
    await moment.scrollIntoViewIfNeeded();

    const inspector = moment.locator('[data-proof-packet-inspector]');
    await expect(inspector).toBeAttached();
    await expect(inspector.locator('[data-proof-illustrative]')).toContainText(/illustrative/i);
    await expect(moment).toContainText(/remain with the institution/i);

    // The anti-dead-end contract, restated for this composition: the proof beat
    // no longer carries its own CTA, so what must hold is that the film still
    // reaches the real clinician flow rather than ending on a demo.
    const cta = page.locator('a[href="/onboarding"]').first();
    await expect(cta).toBeAttached();
  });

  test('selecting a claim updates the inspected chain (click + keyboard)', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    const inspector = page.locator('[data-proof-packet-inspector]');
    await inspector.scrollIntoViewIfNeeded();

    const panel = inspector.locator('#proof-detail');
    // First claim selected by default.
    await expect(inspector.locator('[data-proof-claim="identity"]')).toHaveAttribute(
      'aria-selected',
      'true',
    );

    // Click the gated licensure claim → the panel shows its access-gated chain.
    await inspector.locator('[data-proof-claim="licensure"]').click();
    await expect(inspector.locator('[data-proof-claim="licensure"]')).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(panel).toContainText(/access-gated/i);
    // Gated licensure is never presented as present or clear.
    await expect(panel).not.toContainText(/\bVerified\b/);

    // Keyboard: arrow within the tablist moves selection.
    await inspector.locator('[data-proof-claim="licensure"]').focus();
    await page.keyboard.press('Home');
    await expect(inspector.locator('[data-proof-claim="identity"]')).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  test('the proof moment renders complete without JavaScript', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const moment = page.locator('[data-film-scene="hiring"]');
    await expect(moment.locator('[data-proof-packet-inspector]')).toBeAttached();
    // The default claim's chain is server-rendered (no selection JS needed).
    await expect(moment).toContainText('NPPES NPI Registry');
    await expect(moment).toContainText(/remain with the institution/i);
    await context.close();
  });
});
