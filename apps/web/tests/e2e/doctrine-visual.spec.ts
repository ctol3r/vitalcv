import { expect, test } from '@playwright/test';

/**
 * Rendered-doctrine contract — CD-3 (one accent) and CD-4 (one paper, warm ink).
 *
 * This replaces `film-visual.spec.ts`, which was deleted and left ten orphaned
 * PNG baselines behind. That spec is not worth restoring in kind: Playwright
 * names baselines per platform, so the suite needed a whole manual workflow to
 * regenerate them on ubuntu, and a pixel diff still could not say WHY a frame
 * changed — a deliberate re-colour and a regression produce the same red.
 *
 * So this asserts the doctrine directly, from computed style:
 *
 *   paper   `<main>` never paints a different off-white over `<body>`
 *   ink     no near-neutral text sits in the cool arc
 *   accent  one accent across routes, and never the source-confirmed green
 *
 * Why it exists: all three rulings were settled on 2026-07-25 and none of them
 * had actually reached the screen. `/trust` painted #FAFAF8 over a #F0EEE9
 * body; headings computed a cool slate; `.mz-accent` was green on /employers
 * and indigo on /trust because the brand accent was an ALIAS of the verified
 * state colour. Every one of those shipped green, because nothing rendered the
 * page and looked. The unit suite cannot catch them — they only exist after
 * the cascade resolves.
 *
 * Assertions are about the ruling, not this fix. Paper is pinned to the literal
 * because CD-4 names it. Ink and accent are asserted as HUE ARCS, so the palette
 * can still be tuned without a red build; only leaving the arc fails.
 */

/** Cloud Dancer — the one paper (CD-4). */
const CLOUD_DANCER = 'rgb(240, 238, 233)';

/** Routes that must obey the doctrine. Public, no auth, no seeded data. */
const ROUTES = ['/', '/employers', '/trust', '/pilot', '/verify', '/solutions'] as const;

type Rgb = { r: number; g: number; b: number };

function parseRgb(value: string): Rgb | null {
  const parts = value.match(/\d+(\.\d+)?/g);
  if (!parts || parts.length < 3) return null;
  const [r, g, b] = parts.map(Number);
  return { r, g, b };
}

/** Hue in degrees (0-360). Achromatic colours return null. */
function hue({ r, g, b }: Rgb): number | null {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  if (delta < 1) return null;
  let h: number;
  if (max === r) h = ((g - b) / delta) % 6;
  else if (max === g) h = (b - r) / delta + 2;
  else h = (r - g) / delta + 4;
  h *= 60;
  return h < 0 ? h + 360 : h;
}

const isTransparent = (value: string) => /rgba\(0, 0, 0, 0\)/.test(value);

test.describe('rendered doctrine', () => {
  for (const route of ROUTES) {
    test(`${route} — one paper, warm ink`, async ({ page }) => {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      // The cascade is resolved at first paint; this only lets fonts settle so
      // colour reads are stable. Deliberately not networkidle — the homepage
      // holds connections open and never reaches it.
      await page.waitForTimeout(400);

      const surface = await page.evaluate(() => {
        const main = document.querySelector('main') ?? document.body;
        return {
          body: getComputedStyle(document.body).backgroundColor,
          main: getComputedStyle(main).backgroundColor,
        };
      });

      expect(surface.body, `${route} body must be Cloud Dancer`).toBe(CLOUD_DANCER);

      // A transparent main is correct — the body paper shows through. What is
      // NOT allowed is main painting a DIFFERENT opaque off-white on top, which
      // is exactly the two-paper bug this contract exists to stop.
      if (!isTransparent(surface.main)) {
        expect(surface.main, `${route} main must not paint a second paper`).toBe(surface.body);
      }

      // Warm ink: every near-neutral dark text colour must sit in the warm arc.
      // Cool slate (blue-leaning) is the regression — it was the shipped state.
      const coolInk = await page.evaluate(() => {
        const offenders: string[] = [];
        const nodes = document.querySelectorAll('h1, h2, h3, h4, p, li, span, a, strong');
        for (const el of Array.from(nodes).slice(0, 600)) {
          const colour = getComputedStyle(el).color;
          const parts = colour.match(/\d+(\.\d+)?/g);
          if (!parts || parts.length < 3) continue;
          const [r, g, b] = parts.map(Number);
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          // Near-neutral (low chroma) AND dark — i.e. ink, not decoration.
          if (max >= 140 || max - min < 4) continue;
          if (b > r) offenders.push(`${el.tagName.toLowerCase()} ${colour}`);
        }
        return offenders.slice(0, 5);
      });

      expect(coolInk, `${route} has blue-leaning ink — CD-4 requires a warm ramp`).toEqual([]);
    });
  }

  test('one accent across routes, and it is not the source-confirmed green', async ({ page }) => {
    const seen = new Map<string, string>();

    for (const route of ROUTES) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(300);

      const accent = await page.evaluate(() => {
        const el = document.querySelector('.mz-accent, .type-accent');
        return el ? getComputedStyle(el).color : null;
      });

      if (accent) seen.set(route, accent);
    }

    // Guard the guard: if no route exposes an accent the assertions below are
    // vacuous, so fail loudly rather than passing on an empty set.
    expect(seen.size, 'no route rendered an accent — this contract would be vacuous').toBeGreaterThan(0);

    const distinct = [...new Set(seen.values())];
    expect(
      distinct,
      `CD-3 allows ONE accent; found ${distinct.length}: ${JSON.stringify(Object.fromEntries(seen))}`,
    ).toHaveLength(1);

    const rgb = parseRgb(distinct[0]);
    expect(rgb, `accent ${distinct[0]} is unparseable`).not.toBeNull();

    const h = hue(rgb!);
    expect(h, `accent ${distinct[0]} is achromatic — CD-3 expects a chromatic accent`).not.toBeNull();

    // The specific regression: the brand accent was an alias of the
    // source-confirmed state green. Any green accent means the alias is back.
    // Asserting the ARC (not the literal indigo) keeps the accent tunable.
    expect(
      h! > 70 && h! < 200,
      `accent ${distinct[0]} (hue ${Math.round(h!)}°) is in the green arc — ` +
        'the brand accent must never alias the source-confirmed state colour (CD-3)',
    ).toBe(false);
  });
});
