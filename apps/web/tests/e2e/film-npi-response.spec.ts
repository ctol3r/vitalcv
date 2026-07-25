import { expect, test, type Page } from '@playwright/test';

/**
 * COMPETE-1 — the primary action must visibly answer.
 *
 * The homepage has exactly one primary action: enter an NPI. The film renders
 * the answer in the RECOGNITION scene, which in film mode sits one full
 * viewport to the right of where the reader typed. The first cut of the switch
 * shipped the result into the DOM at `left = 1440` with `scrollY = 0` — the
 * page appeared to do nothing at all when a clinician submitted their own NPI.
 *
 * This pins the fix in BOTH compositions, because they carry the reader
 * differently: film mode moves window scroll along the runway, vertical mode
 * scrolls the scene into view as an ordinary block.
 *
 * Do not relax `resultOnScreen` to "rendered". Rendered-but-off-screen is
 * exactly the regression this exists to catch.
 */

const NPI_FIELD = { name: /start with your npi/i };
const CTA = { name: /check what.s ready/i };
const VALID_NPI = '1234567893';

async function mockLookup(page: Page) {
  await page.route('**/api/identity/bootstrap/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        firstName: 'MACIE',
        lastName: 'MILLER',
        specialty: 'Family Medicine',
        state: 'CA',
      }),
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

async function submit(page: Page) {
  await page.getByRole('textbox', NPI_FIELD).fill(VALID_NPI);
  const cta = page.getByRole('button', CTA);
  await expect(cta).toBeEnabled();
  await cta.click();
}

/** The clinician's own name, from the mocked lookup, actually within the viewport. */
async function resultIsOnScreen(page: Page) {
  return page.evaluate(() => {
    const el = [...document.querySelectorAll('*')].find(
      (e) => e.children.length === 0 && /Macie Miller/i.test(e.textContent ?? ''),
    );
    if (!el) return { rendered: false, onScreen: false };
    const r = el.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    return {
      rendered: true,
      onScreen: r.width > 0 && r.height > 0 && r.left < vw && r.right > 0 && r.top < vh && r.bottom > 0,
    };
  });
}

test.describe('COMPETE-1 — submitting an NPI answers visibly', () => {
  test('film mode (desktop) carries the reader to the recognition scene', async ({ page }) => {
    await mockLookup(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    await expect(page.locator('.film')).toHaveAttribute('data-film-mode', 'film');

    await submit(page);
    await expect
      .poll(async () => (await resultIsOnScreen(page)).onScreen, { timeout: 10_000 })
      .toBe(true);

    // The scene the reader was carried to is the one holding their answer.
    const left = await page
      .locator('[data-film-scene="recognition"]')
      .evaluate((el) => Math.round(el.getBoundingClientRect().left));
    expect(Math.abs(left), 'recognition scene should settle in frame').toBeLessThan(80);
  });

  test('vertical mode (mobile) scrolls the result into view', async ({ page }) => {
    await mockLookup(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    await expect(page.locator('.film')).toHaveAttribute('data-film-mode', 'vertical');

    await submit(page);
    await expect
      .poll(async () => (await resultIsOnScreen(page)).onScreen, { timeout: 10_000 })
      .toBe(true);
  });

  test('reduced motion still lands on the answer', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await mockLookup(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);

    await submit(page);
    await expect
      .poll(async () => (await resultIsOnScreen(page)).onScreen, { timeout: 10_000 })
      .toBe(true);
  });
});

test('reset carries the reader back to the field it cleared', async ({ page }) => {
  await mockLookup(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);

  await submit(page);
  await expect.poll(async () => (await resultIsOnScreen(page)).onScreen, { timeout: 10_000 }).toBe(true);

  await page.getByRole('button', { name: /check another npi/i }).click();

  // The cleared field must be back in front of the reader, not a scene away.
  await expect
    .poll(
      async () =>
        page
          .getByRole('textbox', NPI_FIELD)
          .evaluate((el) => {
            const r = el.getBoundingClientRect();
            const vw = document.documentElement.clientWidth;
            return r.width > 0 && r.left < vw && r.right > 0;
          }),
      { timeout: 10_000 },
    )
    .toBe(true);
  await expect(page.getByRole('textbox', NPI_FIELD)).toHaveValue('');
});
