import { expect, test, type Page } from '@playwright/test';

/**
 * Film ↔ journey unification (founder follow-up, 2026-08-07).
 *
 * Runs ONLY in the film pass (FILM_SPECS + PUBLIC_HOME_VARIANT=film): the
 * behaviors here describe the rollback composition. The career-loop pass
 * keeps its own coverage in header-journey.spec.ts.
 *
 * What must hold under rollback after the unification:
 *   – the film's chapter rail speaks the header's journey vocabulary,
 *     plus its one epilogue chapter;
 *   – the shared header's rail anchors LAND on film sections (they no-op'd
 *     before, because the film used `source-responses`-family ids);
 *   – the film's scene declarations drive the header stage, so the chrome
 *     narrates the same story the page is telling.
 */

const header = (page: Page) => page.locator('header.vcv-header');

/** Hydration probe — same rationale as header-journey.spec.ts. */
async function waitForHeaderHydration(page: Page) {
  const el = header(page);
  await page.evaluate(() => window.scrollTo({ top: 2, behavior: 'instant' as ScrollBehavior }));
  await expect(el).toHaveAttribute('data-nav-lifted', '', { timeout: 20000 });
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }));
  await expect(el).not.toHaveAttribute('data-nav-lifted', '', { timeout: 20000 });
}

async function scrollToSection(page: Page, id: string) {
  await page.evaluate((sectionId) => {
    const el = document.getElementById(sectionId);
    if (!el) throw new Error(`missing #${sectionId}`);
    window.scrollTo({
      top: el.getBoundingClientRect().top + window.scrollY + 160,
      behavior: 'instant' as ScrollBehavior,
    });
  }, id);
}

test.describe('film rollback — unified journey vocabulary', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/', { waitUntil: 'networkidle' });
  });

  test('the chapter rail lists the journey stages plus the epilogue', async ({ page }) => {
    const rail = page.locator('nav[aria-label="Chapters"] .film-rail-link');
    await expect(rail).toHaveCount(5);
    // Visible labels only — the sr-only position suffix is announced, not printed.
    const labels = await rail.evaluateAll((links) =>
      links.map((link) => link.childNodes[0]?.textContent?.trim()),
    );
    expect(labels).toEqual(['Your Number', 'Sources', 'Permission', 'Review', 'What happens next']);
  });

  test('header rail anchors land on film chapters instead of no-opping', async ({ page }) => {
    await waitForHeaderHydration(page);
    const sources = page.locator('section#sources');
    await expect(sources).toHaveCount(1);

    await page.locator('a.vcv-rail__stage', { hasText: 'Sources' }).first().click();
    await expect(page).toHaveURL(/#sources$/);
    // The anchor actually moved the page: the chapter owns the viewport now.
    await expect
      .poll(async () => sources.evaluate((el) => Math.abs(el.getBoundingClientRect().top) < window.innerHeight))
      .toBe(true);
  });

  test('film scenes drive the header stage, staying on paper end to end', async ({ page }) => {
    await waitForHeaderHydration(page);

    await scrollToSection(page, 'sources');
    await expect(header(page)).toHaveAttribute('data-header-stage', 'sources');
    await expect(header(page)).toHaveAttribute('data-header-theme', 'light');

    await scrollToSection(page, 'review');
    await expect(header(page)).toHaveAttribute('data-header-stage', 'review');

    // The epilogue declares `review` rather than dropping out of the band —
    // the header must NOT snap back to the route default at the end.
    await scrollToSection(page, 'closing');
    await expect(header(page)).toHaveAttribute('data-header-stage', 'review');
    await expect(header(page)).toHaveAttribute('data-header-theme', 'light');
  });
});
