import { expect, test, type Page } from '@playwright/test';

/**
 * design-kernel.spec.ts — Wave 1081 (UX-02A, Design System Kernel).
 *
 * The kernel already exists: self-hosted Geist/Geist Mono/Fraunces through
 * next/font/local, a global `*:focus-visible` outline in globals.css, a global
 * prefers-reduced-motion kill switch, and the LINT-01 token ratchet. What did
 * not exist was any test that the kernel HOLDS in a rendered page. Nothing
 * asserted a computed font-family anywhere, so the regression this repo has
 * already lived through — layout.tsx quietly swapping font variables and the
 * whole site rendering system stacks — would ship silently again. Deleting the
 * global focus rule or the reduced-motion kill switch failed nothing either.
 *
 * These are browser-measured assertions on the running build: computed styles
 * and document.fonts, not source grep. The companion unit test
 * (design-kernel-source.test.ts) pins the source-level halves — no
 * next/font/google, the kill switch's exact shape — and proves each guard by
 * injection where a unit can.
 *
 * Fraunces note: EC-20 locks Geist for display and body. The UX-V1 homepage
 * complies. Legacy surfaces (e.g. /explore's Fraunces h1) are recorded
 * migration debt for the page waves (UX-04+) — W1081 is "no page redesign", so
 * this spec asserts the locked faces exactly where the verdict has been
 * implemented, and does not paper over the rest by asserting them everywhere.
 */

/** The loaded-family names next/font/local registers (see app/layout.tsx). */
const SANS = 'geistSans';
const MONO = 'geistMono';

const firstFamily = async (page: Page, selector: string) =>
  page
    .locator(selector)
    .first()
    .evaluate((el) => getComputedStyle(el).fontFamily.split(',')[0].replace(/["']/g, '').trim());

test.describe('design kernel — the intended font stack actually computes', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('the three self-hosted faces are loaded, not fallbacks', async ({ page }) => {
    // document.fonts is the browser's own ledger. If a woff2 404s or
    // next/font/local misconfigures, the face never reaches "loaded" and the
    // page silently renders the var() fallback — which is exactly the state
    // this repo shipped once. Checked on `/` where all three are declared.
    await page.waitForFunction(() => document.fonts.status === 'loaded');
    const loaded = await page.evaluate(() =>
      [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family),
    );
    expect(loaded).toContain(SANS);
    expect(loaded).toContain(MONO);
  });

  test('homepage display and body compute Geist — the EC-20 locked faces', async ({ page }) => {
    expect(await firstFamily(page, 'h1')).toBe(SANS);
    // `#main-content p`, not `main p`: the homepage gained a <main> landmark in the 2026-08-08 audit wave; #main-content still wraps it, so this selector holds. It previously had no <main> landmark —
    // a finding the #1165 census already records. This spec measures fonts;
    // the landmark belongs to the census's accessibility work, and asserting
    // `main p` here would just re-discover that bug as a locator timeout.
    expect(await firstFamily(page, '#main-content p')).toBe(SANS);
  });

  test('machine facts compute Geist Mono — mono is the retrieved-not-written signal', async ({ page }) => {
    // The homepage's micro-labels are the always-present mono surface. The
    // chrome no longer carries center content (the floating-chrome rebuild),
    // so the page's own kicker labels carry this contract.
    expect(await firstFamily(page, '.ezh-k')).toBe(MONO);
  });

  test('every legacy font variable resolves to a kernel face — no era escapes', async ({ page }) => {
    // layout.tsx aliases the era variables (--font-inter, --font-plus-jakarta,
    // --font-jetbrains) onto the kernel stacks so parked-era CSS cannot
    // resurrect a retired face. Assert the aliasing holds where it matters:
    // what each variable actually resolves to.
    const vars = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      const read = (name: string) => root.getPropertyValue(name).trim();
      return {
        inter: read('--font-inter'),
        jakarta: read('--font-plus-jakarta'),
        jetbrains: read('--font-jetbrains'),
      };
    });
    expect(vars.inter).toContain(SANS);
    expect(vars.jakarta).toContain(SANS);
    expect(vars.jetbrains).toContain(MONO);
  });
});

test.describe('design kernel — focus treatment', () => {
  for (const path of ['/', '/explore'] as const) {
    test(`keyboard focus is visible on ${path}`, async ({ page }) => {
      // The contract is the OUTCOME — a focused control is visibly marked —
      // not the mechanism. globals.css supplies `*:focus-visible` with
      // outline 2px var(--ring); an island stylesheet may override it, and
      // that is fine exactly as long as what it substitutes is still visible.
      await page.goto(path);
      const seen: string[] = [];
      for (let i = 0; i < 6; i += 1) {
        await page.keyboard.press('Tab');
        const state = await page.evaluate(() => {
          const el = document.activeElement as HTMLElement | null;
          if (!el || el === document.body) return null;
          const s = getComputedStyle(el);
          const outlineVisible = s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0;
          const shadowVisible = s.boxShadow !== 'none' && s.boxShadow !== '';
          return {
            tag: `${el.tagName.toLowerCase()}:${(el.textContent || '').trim().slice(0, 16)}`,
            visible: outlineVisible || shadowVisible,
          };
        });
        if (!state) continue;
        seen.push(`${state.tag}=${state.visible}`);
        expect(state.visible, `focused element has no visible indicator: ${state.tag} on ${path}`).toBe(true);
      }
      // Vacuity guard: a page where Tab never lands anywhere would pass every
      // per-element assertion while proving nothing.
      expect(seen.length, `Tab reached no interactive element on ${path}`).toBeGreaterThan(2);
    });
  }
});

test.describe('design kernel — the reduced-motion kill switch holds', () => {
  test('no animation or transition survives prefers-reduced-motion', async ({ page }) => {
    // test.use({ reducedMotion }) is NOT honored under this config
    // (@playwright/test 1.58.2) — emulateMedia is. Recorded in the UX-V1
    // cutover; repeated here because the failure mode is a spec that
    // silently tests the non-reduced page and always passes.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await page.waitForTimeout(400);

    const offenders = await page.evaluate(() => {
      const bad: string[] = [];
      for (const el of document.querySelectorAll('*')) {
        const s = getComputedStyle(el);
        // The kill switch clamps to 0.01ms; anything ≥ 50ms is a real
        // animation that escaped it (0.01ms parses to ~0).
        const durations = `${s.animationDuration},${s.transitionDuration}`
          .split(',')
          .map((d) => parseFloat(d) * (d.includes('ms') ? 1 : 1000))
          .filter((n) => Number.isFinite(n));
        if (durations.some((n) => n >= 50)) {
          bad.push(
            `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 30)} anim=${s.animationDuration} trans=${s.transitionDuration}`,
          );
        }
        if (bad.length >= 5) break; // enough to diagnose; don't flood
      }
      return bad;
    });

    expect(offenders, `elements animating under reduced motion:\n${offenders.join('\n')}`).toEqual([]);
  });
});
