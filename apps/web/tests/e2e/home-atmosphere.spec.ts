import { test, expect, type Page, type Route } from '@playwright/test';

/**
 * Wave 4, D2 — what the hero phase SPENDS, at runtime.
 *
 * `home-phase.spec.ts` (D1) drives the phase itself. This drives the half no
 * unit test can see: the decorative layer is a PRECEDING SIBLING of the phase
 * carrier, so it is matched with `:has()` plus a sibling combinator. A DOM-order
 * change or a dropped `data-home-atmosphere` handle would silently stop the page
 * responding while every stylesheet assertion stayed green — proven by removing
 * the handle, which leaves the unit suite passing and turns these red.
 */

const VALID_NPI = '1234567893';

async function mockClean(page: Page) {
  await page.route('**/api/identity/bootstrap/**', (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        firstName: 'MACIE',
        lastName: 'MILLER',
        specialty: 'Family Medicine',
        state: 'CA',
        identitySource: 'NPPES_API',
      }),
    }),
  );
  await page.route('**/api/trust-state/**', (r) =>
    r.fulfill({
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

async function mockDown(page: Page) {
  const down = (route: Route) =>
    route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"down"}' });
  await page.route('**/api/identity/bootstrap/**', down);
  await page.route('**/api/trust-state/**', down);
}

const phaseOf = (page: Page) =>
  page.locator('[data-home-phase]').first().getAttribute('data-home-phase');

/** Computed opacity of the decorative layer — what the phase actually spends. */
const atmosphere = (page: Page) =>
  page.evaluate(() => {
    const el = document.querySelector('[data-home-atmosphere]');
    return el ? Number.parseFloat(getComputedStyle(el).opacity) : null;
  });

/**
 * Type into the field in a way React actually observes.
 *
 * On the server-rendered input, `fill()` sets the DOM value without React ever
 * seeing an `onChange`, so `onStatusChange` never fires and the phase stays
 * `idle` — legitimately. Clicking first both focuses the field and gives
 * hydration a turn, which is the same reason the repo's other helpers wait on
 * the CTA before clicking it.
 *
 * Caught against production: an identical fill-then-assert raced hydration and
 * read `idle` where the browser was, a moment later, correctly `active`. The
 * local run passed, which is exactly how this would have become an
 * only-fails-in-CI flake.
 */
async function typeNpi(page: Page, value: string) {
  const field = page.getByRole('textbox', { name: /npi/i });
  await field.click();
  await field.fill(value);
}

async function submit(page: Page, npi = VALID_NPI) {
  await typeNpi(page, npi);
  const cta = page.getByRole('button', { name: /check what.s ready/i });
  await expect(cta).toBeEnabled();
  await cta.click();
}

test.describe('home atmosphere', () => {
  test('recedes as the reader commits', async ({ page }) => {
    await mockClean(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const idle = await atmosphere(page);

    await typeNpi(page, '12345');
    await expect
      .poll(() => phaseOf(page), { timeout: 5_000 })
      .toBe('active');
    await page.waitForTimeout(500);
    const active = await atmosphere(page);

    await submit(page);
    await expect(page.locator('[data-evidence-group]').first()).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(600);
    const resolved = await atmosphere(page);

    // Strictly monotonic. This is the assertion that proves the `:has()` reach
    // works — if the selector stopped matching, all three would be equal.
    expect(idle).toBeGreaterThan(active as number);
    expect(active).toBeGreaterThan(resolved as number);
    // Still present, never removed: it is atmosphere, not a toggle.
    expect(resolved).toBeGreaterThan(0);
  });

  test('is exactly as quiet after a failure as after a success', async ({ page }) => {
    // The load-bearing honesty property. If a system error left the page
    // brighter or darker than a success, the decoration would be reporting an
    // outcome no source returned.
    await mockClean(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await submit(page);
    await expect(page.locator('[data-evidence-group]').first()).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(600);
    const onSuccess = await atmosphere(page);

    await mockDown(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await submit(page);
    await expect.poll(() => phaseOf(page), { timeout: 20_000 }).toBe('system-error');
    await page.waitForTimeout(600);
    const onError = await atmosphere(page);

    expect(onError).toBeCloseTo(onSuccess as number, 3);
  });

  test('reduced motion lands on the same end state, with nothing animating', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await mockClean(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await submit(page);
    await expect(page.locator('[data-evidence-group]').first()).toBeVisible({ timeout: 20_000 });
    await expect.poll(() => phaseOf(page), { timeout: 5_000 }).toBe('resolved');

    // The recession still happened — it simply did not animate.
    expect(await atmosphere(page)).toBeLessThan(0.62);
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  });
});

test.describe('decorative words are never rendered clipped', () => {
  // At 768px the artwork is 70rem wide, so every perimeter label was sliced by
  // the viewport edge and the caption crossed the employer link. The band
  // between the phone breakpoint and 900px was the only one not dropping them.
  for (const width of [360, 390, 768, 899, 1080, 1440]) {
    test(`no clipped decoration at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(600);

      const clipped = await page.evaluate(() =>
        [
          ...document.querySelectorAll(
            '.cinematic-evidence-field__label, .cinematic-evidence-field__caption',
          ),
        ]
          .filter((el) => getComputedStyle(el).display !== 'none')
          .map((el) => {
            const b = el.getBoundingClientRect();
            return {
              text: (el.textContent ?? '').trim(),
              clipped: b.width > 0 && (b.x < 0 || b.right > window.innerWidth),
            };
          })
          .filter((n) => n.clipped)
          .map((n) => n.text),
      );

      expect(clipped).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width + 1,
      );
    });
  }
});
