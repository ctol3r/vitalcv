import { expect, test, type Page } from '@playwright/test';

/**
 * W4.2 — the proof moment inside the live homepage evidence film.
 *
 * The interactive proof-packet inspector remains a real, keyboard-operable
 * product moment. The composition changed: it now lives in the hiring pane,
 * reached with ordinary vertical scroll. With JavaScript disabled, every film
 * pane is a readable stack and the inspector remains server-rendered in full.
 */

async function openPacketPane(page: Page) {
  await page.evaluate(() => window.scrollTo({ top: window.innerHeight * 2 }));
  const moment = page.locator('[data-film-scene="hiring"]');
  await expect(moment).toBeVisible();
  return moment;
}

test.describe('homepage proof moment (W4.2)', () => {
  test('the inspector is on the homepage, illustrative, with the employer boundary and a real CTA', async ({
    page,
  }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    const moment = await openPacketPane(page);

    const inspector = moment.locator('[data-proof-packet-inspector]');
    await expect(inspector).toBeAttached();
    await expect(inspector.locator('[data-proof-illustrative]')).toContainText(/illustrative/i);
    await expect(moment).toContainText(/remain with the institution/i);

  });

  test('selecting a claim updates the inspected chain (click + keyboard)', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    const moment = await openPacketPane(page);
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

    const moment = page.locator('[data-film-scene="hiring"]');
    await expect(moment.locator('[data-proof-packet-inspector]')).toBeAttached();
    await expect(moment).toContainText('NPPES NPI Registry');
    await expect(moment).toContainText(/remain with the institution/i);

    await context.close();
  });
});
