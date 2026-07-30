import { expect, test, type Page } from '@playwright/test';

/**
 * W4.2 — the proof moment inside the live homepage spine.
 *
 * The interactive proof-packet inspector remains a real, keyboard-operable
 * product moment. The composition changed: it now lives inside Step 3, so a JS
 * reader deliberately opens "The packet you choose" before interacting with
 * it. With JavaScript disabled, all four spine panels render as one readable
 * stack and the inspector remains server-rendered in full.
 */

async function openPacketStep(page: Page) {
  const packetTab = page.getByRole('tab', { name: /step 3[\s\S]*packet/i });
  await expect(packetTab).toBeVisible();
  await packetTab.click();
  await expect(packetTab).toHaveAttribute('aria-selected', 'true');

  const moment = page.locator('[data-ask-artifact="once"]');
  await expect(moment).toBeVisible();
  return moment;
}

test.describe('homepage proof moment (W4.2)', () => {
  test('the inspector is on the homepage, illustrative, with the employer boundary and a real CTA', async ({
    page,
  }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    const moment = await openPacketStep(page);

    const inspector = moment.locator('[data-proof-packet-inspector]');
    await expect(inspector).toBeAttached();
    await expect(inspector.locator('[data-proof-illustrative]')).toContainText(/illustrative/i);
    await expect(moment).toContainText(/remain with the institution/i);

    const cta = moment.locator('a[href="/onboarding"]');
    await expect(cta).toBeVisible();
  });

  test('selecting a claim updates the inspected chain (click + keyboard)', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    const moment = await openPacketStep(page);
    const inspector = moment.locator('[data-proof-packet-inspector]');

    const panel = inspector.locator('#proof-detail');
    await expect(inspector.locator('[data-proof-claim="identity"]')).toHaveAttribute(
      'aria-selected',
      'true',
    );

    await inspector.locator('[data-proof-claim="licensure"]').click();
    await expect(inspector.locator('[data-proof-claim="licensure"]')).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(panel).toContainText(/access-gated/i);
    await expect(panel).not.toContainText(/\bVerified\b/);

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

    const moment = page.locator('[data-ask-artifact="once"]');
    await expect(moment.locator('[data-proof-packet-inspector]')).toBeAttached();
    await expect(moment).toContainText('NPPES NPI Registry');
    await expect(moment).toContainText(/remain with the institution/i);

    await context.close();
  });
});
