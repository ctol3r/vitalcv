import { test, expect, type Page, type Route } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * Layout stability across the hero's six state changes.
 *
 * The homepage program's own contract asks that the label float not move the
 * page, that the correction reserve its space rather than push the CTA down,
 * that the button not resize as it enables, and that the result not move the
 * control the visitor is still holding. Every one of those is a claim about
 * PIXELS, and nothing was measuring pixels — the release receipt records "no
 * screenshot baseline exists for the homepage. Layout was measured numerically
 * instead", which is true of clipping and overflow but was never true of these
 * transitions.
 *
 * CLS cannot see most of this. The band that holds the correction is inside a
 * fixed-height container, so a shift there scores 0.00 while still being the
 * thing a person notices. This measures the elements directly.
 *
 * It writes what it measured to `artifacts/home-v2/layout-stability.json`, so
 * the performance report quotes numbers this produced rather than numbers
 * somebody typed.
 */

const VALID_NPI = '1234567893';
const BAD_CHECKSUM = '1234567890';
const OUT = 'artifacts/home-v2/layout-stability.json';

/** Anchors whose movement a visitor would actually feel. */
const ANCHORS = {
  h1: '#ask-title',
  cta: '[data-home-primary-cta]',
  band: '#ask-hint',
  field: '.evidence-field',
} as const;

type Rect = { x: number; y: number; w: number; h: number };
type Frame = Partial<Record<keyof typeof ANCHORS, Rect | null>>;

const measured: Record<string, Frame> = {};

async function frame(page: Page, label: string): Promise<Frame> {
  const f = await page.evaluate((sel) => {
    const out: Record<string, { x: number; y: number; w: number; h: number } | null> = {};
    for (const [k, s] of Object.entries(sel)) {
      const el = document.querySelector(s as string);
      if (!el) {
        out[k] = null;
        continue;
      }
      const r = el.getBoundingClientRect();
      // DOCUMENT coordinates, not viewport. `getBoundingClientRect` is
      // viewport-relative, so any scroll between two frames reads as movement
      // — and this flow scrolls twice (the result mounts, then reset focuses
      // the field back). Measured that way the headline appeared to move 232px
      // on reset while the layout had not changed at all. Adding scroll offset
      // measures the thing being asserted: did the box move in the PAGE.
      // Rounded: sub-pixel noise from font metrics is not a layout shift.
      out[k] = {
        x: Math.round(r.x + window.scrollX),
        y: Math.round(r.y + window.scrollY),
        w: Math.round(r.width),
        h: Math.round(r.height),
      };
    }
    out.__scroll = { x: Math.round(window.scrollX), y: Math.round(window.scrollY), w: 0, h: 0 };
    return out;
  }, ANCHORS);
  measured[label] = f as Frame;
  return f as Frame;
}

/** Movement of one anchor between two frames, in CSS px. */
function moved(a: Frame, b: Frame, key: keyof typeof ANCHORS) {
  const p = a[key];
  const q = b[key];
  if (!p || !q) return null;
  return { dx: q.x - p.x, dy: q.y - p.y, dw: q.w - p.w, dh: q.h - p.h };
}

async function mockClean(page: Page) {
  await page.route('**/api/identity/bootstrap/**', (r: Route) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ firstName: 'MACIE', lastName: 'MILLER', identitySource: 'NPPES_API' }),
    }),
  );
  await page.route('**/api/trust-state/**', (r: Route) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        identityVerified: true,
        exclusionStatus: 'CLEAR',
        pecosStatus: 'ENROLLED',
        blockers: [],
        nextActions: [],
      }),
    }),
  );
}

test.describe('the hero does not move under the visitor', () => {
  test('label float, CTA enablement, submit, result and reset', async ({ page }) => {
    await mockClean(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/', { waitUntil: 'networkidle' });

    const input = page.getByRole('textbox', { name: 'Your 10-digit NPI', exact: true });
    const cta = page.locator(ANCHORS.cta);
    await expect(input).toBeVisible();

    const idle = await frame(page, '1-idle');

    // 1. LABEL FLOAT. Focusing compresses the label. Nothing else may move.
    await input.click();
    await expect(page.locator('[data-label-floating]')).toHaveCount(1);
    const focused = await frame(page, '2-focused');

    expect(moved(idle, focused, 'h1'), 'the headline moved when the label floated').toMatchObject({ dy: 0 });
    expect(moved(idle, focused, 'cta'), 'the CTA moved when the label floated').toMatchObject({ dy: 0 });
    expect(moved(idle, focused, 'field')?.dh, 'the field changed height when the label floated').toBe(0);

    // 2. CTA ENABLEMENT. Enabling must not resize the button — its label is
    //    the same string; only `disabled` changes.
    await input.fill(VALID_NPI);
    await expect(cta).toBeEnabled();
    const valid = await frame(page, '3-valid');

    expect(moved(focused, valid, 'cta'), 'the CTA resized as it enabled').toMatchObject({ dw: 0, dh: 0 });
    expect(moved(focused, valid, 'h1')?.dy, 'the headline moved as the CTA enabled').toBe(0);

    // 3. SUBMITTING. The label swaps to "Checking…" — a SHORTER string. If the
    //    button is content-sized this is where it snaps narrower.
    await cta.click();
    const submitting = await frame(page, '4-submitting');
    const ctaDelta = moved(valid, submitting, 'cta');
    if (ctaDelta) {
      expect(Math.abs(ctaDelta.dw), 'the CTA changed width while submitting').toBeLessThanOrEqual(1);
    }

    // 4. RESULT. The capsule replaces the field. The h1 above it is the anchor
    //    a reader keeps their eye on; it must hold.
    await expect(page.locator('[data-evidence-group]').first()).toBeVisible({ timeout: 20_000 });
    const resolved = await frame(page, '5-resolved');
    expect(moved(idle, resolved, 'h1')?.dy, 'the headline moved when the result landed').toBe(0);

    // 5. RESET. Returning to the field must restore the idle geometry exactly,
    //    or the page has drifted over one round trip.
    await page.getByRole('button', { name: /check another npi/i }).click();
    await expect(input).toBeVisible();
    const reset = await frame(page, '6-reset');

    expect(moved(idle, reset, 'h1')?.dy, 'the headline did not return to its idle position').toBe(0);
    expect(moved(idle, reset, 'field')?.dh, 'the field did not return to its idle height').toBe(0);

    mkdirSync(dirname(join(process.cwd(), OUT)), { recursive: true });
    writeFileSync(join(process.cwd(), OUT), JSON.stringify(measured, null, 2));
  });

  test('the correction reserves its space instead of pushing the CTA down', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/', { waitUntil: 'networkidle' });

    const input = page.getByRole('textbox', { name: 'Your 10-digit NPI', exact: true });
    await input.click();
    await input.fill(BAD_CHECKSUM);

    const before = await frame(page, 'err-1-before');
    // A complete-but-wrong number errors without needing a submit.
    await expect(page.locator('[data-evidence-input-state="invalid"]')).toHaveCount(1);
    const after = await frame(page, 'err-2-after');

    // The counter and the correction share one band, so the band's height is
    // the whole contract: if it holds, nothing below it can be pushed.
    expect(moved(before, after, 'band')?.dh, 'the message band grew when the correction appeared').toBe(0);
    expect(moved(before, after, 'cta')?.dy, 'the correction pushed the CTA down').toBe(0);
  });
});
