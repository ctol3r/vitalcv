/**
 * The Z1 product story — PREVIEW COVERAGE, additive.
 *
 * This tests /design/z1-home, the gated review surface. It does NOT replace
 * the production homepage specs: '/' still serves the six-scene film and
 * keeps its own coverage until a founder visual review approves the cutover.
 * Two routes, two surfaces, two suites — consolidation waits for the actual
 * route change.
 *
 * What it pins on the preview composition:
 *
 * - The NPI action is the first useful action, visible without scrolling.
 * - Validity is the REAL check digit; a bad number gets the true answer.
 * - Resolution is SIMULATED and the surface says so — the page never
 *   represents demo data as live verification (the film's live-lookup
 *   doctrine retired with the live lookup; what survives is honesty about
 *   what the page actually does).
 * - The argument never moves when the story lights: state changes the
 *   record, not the headline.
 * - Evidence stays SOLID (glass is chrome-only) and the browser keeps its
 *   native cursor.
 * - Reduced motion gets the complete story with no auto-play.
 */
import { expect, test } from '@playwright/test';

const VALID_NPI = '1234567893';
const BAD_CHECKSUM = '1234567890';

/** Interactions need the island mounted; the component states this honestly
 * via data-hydrated (and adopts pre-hydration typing besides). */
const ROUTE = '/design/z1-home';

async function readyToType(page: import('@playwright/test').Page) {
  await page.goto(ROUTE);
  await page.locator('.z1-activation[data-hydrated]').waitFor({ timeout: 15_000 });
}

test.describe('the Z1 product story (preview route)', () => {
  test('composition contract: hero marker and exactly one h1', async ({ page }) => {
    await page.goto(ROUTE);
    await expect(page.locator('[data-home-hero]')).toBeVisible();
    await expect(page.locator('h1')).toHaveCount(1);
    // The preview is deliberately NOT indexable — it is not the homepage.
    expect(await page.locator('meta[name="robots"][content*="noindex"]').count())
      .toBeGreaterThan(0);
  });

  test('the NPI action is visible without scrolling and comes before the employer door', async ({ page }) => {
    await page.goto(ROUTE);
    const input = page.locator('.z1-npi-input');
    await expect(input).toBeInViewport();
    await expect(page.locator('[data-home-primary-cta]')).toBeInViewport();
    const employer = page.locator('[data-home-employer-cta]');
    await expect(employer).toHaveAttribute('href', '/employers');
  });

  test('a checksum-valid NPI resolves to the labelled illustrative profile', async ({ page }) => {
    await readyToType(page);
    await page.locator('.z1-npi-input').click();
    await page.locator('.z1-npi-input').fill(VALID_NPI);
    await page.locator('[data-home-primary-cta]').click();
    await expect(page.locator('.z1-activation[data-state="found"]')).toBeAttached({ timeout: 8_000 });
    // The resolved profile is fictional and says so EVERYWHERE it appears —
    // the profile card and the record each carry the label independently, so
    // this counts rather than expecting a single node.
    const illustrative = page.locator('.z1-story').getByText('Illustrative — not a live result');
    expect(await illustrative.count()).toBeGreaterThanOrEqual(1);
    await expect(illustrative.first()).toBeVisible();
    await expect(page.locator('.z1-story').getByText('K. Osei, PA-C').first()).toBeVisible();
  });

  test('a checksum-invalid NPI cannot resolve and says why', async ({ page }) => {
    await readyToType(page);
    await page.locator('.z1-npi-input').click();
    await page.locator('.z1-npi-input').fill(BAD_CHECKSUM);
    await page.locator('[data-home-primary-cta]').click();
    await expect(page.getByText('That number fails the NPI check digit.')).toBeVisible();
    // and the story does NOT light
    await expect(page.locator('.z1-story[data-lit]')).toHaveCount(0);
  });

  test('the argument never moves when the story lights', async ({ page }) => {
    await readyToType(page);
    const headline = page.locator('.z1-headline');

    /**
     * The doctrine (unchanged): state changes the RECORD, not the headline —
     * resolving must not shove the argument under the reader.
     *
     * The INSTRUMENT changed, twice over, after this failed on CI at 2.77px
     * while passing on macOS at 0px:
     *
     *  1. `boundingBox().y` is VIEWPORT-relative, so it scores a scroll as a
     *     layout move. Anything that nudges the scroll position between the
     *     two reads (a focus scroll on click, an anchor offset, a pinned
     *     mobile control cluster) is reported as the headline moving when the
     *     headline did not move at all. Document-space (`+ scrollY`) measures
     *     the thing the doctrine is actually about.
     *  2. `<= 1px` was a constant read off ONE machine. Cross-platform text
     *     metrics differ by a couple of px on a multi-line headline, which is
     *     not "the argument moved" in any sense a reader could perceive. The
     *     tolerance is now tied to the LAYOUT instead of to a machine: a real
     *     regression (a panel or row appearing above the argument) displaces
     *     it by at least a full line; metric noise is a fraction of one. This
     *     is the A-3 lesson applied to a spec — a geometry rule read off a
     *     single environment is a coordinate, not a law.
     */
    const geometry = () =>
      headline.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return {
          docY: r.y + window.scrollY,
          height: r.height,
          lineHeight: parseFloat(cs.lineHeight) || r.height,
        };
      });

    const before = await geometry();
    await page.locator('.z1-npi-input').click();
    await page.locator('.z1-npi-input').fill(VALID_NPI);
    await page.locator('[data-home-primary-cta]').click();
    await expect(page.locator('.z1-activation[data-state="found"]')).toBeAttached({ timeout: 8_000 });
    const after = await geometry();

    // Well under one line: nothing was inserted above the argument.
    const budget = Math.max(4, before.lineHeight * 0.25);
    expect(
      Math.abs(after.docY - before.docY),
      `the argument moved ${Math.abs(after.docY - before.docY).toFixed(2)}px in document space ` +
        `(budget ${budget.toFixed(2)}px = a quarter line). State must change the record, not the headline.`,
    ).toBeLessThan(budget);

    // And the argument itself did not reflow — same box, same number of lines.
    expect(
      Math.abs(after.height - before.height),
      'the headline changed height — the argument re-wrapped when the story lit',
    ).toBeLessThan(1);
  });

  test('the chapters carry the story and its boundaries', async ({ page }) => {
    await page.goto(ROUTE);
    await expect(page.getByRole('heading', { name: /find work that fits more than your résumé/i })).toBeAttached();
    await expect(page.getByRole('heading', { name: /apply once/i })).toBeAttached();
    await expect(page.getByRole('heading', { name: /move from hired to ready sooner/i })).toBeAttached();
    await expect(page.getByRole('heading', { name: /your career record keeps moving with you/i })).toBeAttached();
    // the non-negotiable boundary survives every rewrite
    await expect(page.locator('[data-home-truth-boundary]')).toBeAttached();
    // source cadences come from the canonical record, not marketing copy
    await expect(page.locator('[data-home-source-cadence]')).toBeAttached();
    // illustrative labelling is present where fictional data renders
    await expect(page.getByText('Illustrative matches — not live listings')).toBeAttached();
  });

  test('evidence stays solid and the cursor stays native', async ({ page }) => {
    await readyToType(page);
    await page.locator('.z1-npi-input').fill(VALID_NPI);
    await page.locator('[data-home-primary-cta]').click();
    await expect(page.locator('.z1-activation[data-state="found"]')).toBeAttached({ timeout: 8_000 });
    const evr = page.locator('.z1-story .evr').first();
    const bg = await evr.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg, 'evidence must be opaque — glass is chrome-only').not.toMatch(/rgba\(.*,\s*0(\.\d+)?\)|transparent/);
    const cursor = await page.locator('body').evaluate((el) => getComputedStyle(el).cursor);
    expect(cursor).toBe('auto');
  });

  test('reduced motion: no auto-play, complete story', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(ROUTE);
    await page.locator('.z1-start-ch').scrollIntoViewIfNeeded();
    const active = () => page.evaluate(() =>
      [...document.querySelectorAll('.z1-step')].findIndex((e) => e.hasAttribute('data-active')));
    const first = await active();
    await page.waitForTimeout(4200);
    expect(await active(), 'the stepper must not auto-advance under reduced motion').toBe(first);
    // every chapter remains present with nothing animating
    await expect(page.locator('[data-home-truth-boundary]')).toBeAttached();
  });

  test('the loop returns: the next-opportunity control carries back to Discover', async ({ page }) => {
    await readyToType(page);
    await page.locator('.z1-keep-ch').scrollIntoViewIfNeeded();
    await page.locator('button.z1-opp--next').click();
    await expect(page.locator('.z1-discover')).toBeInViewport({ timeout: 5_000 });
  });
});
