/**
 * The real accessibility gate — axe WCAG 2.2 AA against RENDERED routes.
 *
 * Why this exists. `__tests__/a11y/hero-routes.test.tsx` is wired to the
 * required `axe WCAG 2.2 AA` status check, and it runs axe against **five
 * hand-written HTML fixtures** — its own header says so: "These are NOT full
 * page renders". The fixtures have since drifted off the product entirely; the
 * homepage fixture asserts an `<h1>` reading "Credentialing visibility for the
 * people who move healthcare", which appears **zero times** on the live
 * homepage.
 *
 * So the gate was green while the 2026-08-09 page audit measured, on the real
 * product: 716 sub-44px touch targets, two public pages with no `<h1>` at all,
 * and three with two. Every one of those is an EC-5 violation that a fixture
 * cannot see, because a fixture is not the page.
 *
 * This spec runs the same rules against the same routes a visitor actually
 * gets, inside the already-required `Web E2E (Playwright)` job — so it gates
 * without needing a branch-protection change.
 *
 * ── The ratchet ──────────────────────────────────────────────────────────
 * A gate that is red the day it lands teaches everyone to ignore it (the
 * argument `scripts/check-design-lint.ts` makes for its own baselines). The
 * product has real debt here, and this wave is not the wave that pays it down.
 * So `a11y-baseline.json` records what each route measures TODAY, per rule, and
 * the assertion is **never worse**:
 *
 *   - a rule's violation count going UP on a route  → fail
 *   - a rule appearing on a route that had none     → fail
 *   - a route's sub-44px target count going UP      → fail
 *   - anything going DOWN                            → pass (lower the baseline)
 *
 * Regenerate after a deliberate improvement — note `--workers=1`:
 *
 *   A11Y_WRITE_BASELINE=1 pnpm --filter @vitalcv/web exec \
 *     playwright test a11y-public-routes --workers=1
 *
 * and commit the diff — a shrinking baseline is the point. The serial flag is
 * load-bearing: `fullyParallel` runs afterAll once per worker, and each worker
 * knows only its own routes, so parallel writers read-modify-write the same
 * file and silently drop the routes they did not measure (observed: 16 of 20
 * survived the first run). A short baseline cannot pass unnoticed — the
 * assertion path below fails any route with no entry — but it would waste a CI
 * cycle to discover.
 */

import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';

// Playwright transpiles specs to CJS, so `import.meta.url` is unavailable here.
// Paths anchor on the config directory (apps/web), which Playwright makes the
// cwd for every run — local and CI alike.
const WEB_ROOT = process.cwd();
const BASELINE_PATH = path.join(WEB_ROOT, 'tests', 'e2e', 'a11y-baseline.json');
const WRITE = process.env.A11Y_WRITE_BASELINE === '1';

/**
 * Anonymous-reachable routes. Auth-gated trees are absent because they 307 to
 * /sign-in and would measure the sign-in page N times over — covering them
 * needs a session and is tracked as the open gap in
 * docs/design/authed-navigation-audit-2026-08-09.md.
 */
const ROUTES = [
  '/',
  '/pricing',
  '/employers',
  '/trust',
  '/status',
  '/verify',
  '/verify/guide',
  '/evidence-network',
  '/for/cvo',
  '/for/payer',
  '/for/staffing-exchange',
  '/sign-in',
  '/sign-up',
  '/onboarding',
  '/privacy',
  '/terms',
  '/contact',
  '/review',
  '/docs',
  '/pilot',
  // The public board. It was absent while it was actively being restyled,
  // so the gate passed without ever measuring the surface under change.
  '/explore',
] as const;

interface RouteBaseline {
  /** violation rule id → node count */
  violations: Record<string, number>;
  /** interactive elements smaller than the EC-5 44px floor */
  smallTargets: number;
}

type Baseline = Record<string, RouteBaseline>;

function readBaseline(): Baseline {
  try {
    return JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8')) as Baseline;
  } catch {
    return {};
  }
}

const AXE_SOURCE = (() => {
  // Resolved from the installed package rather than vendored, so the gate
  // tracks the axe-core version the repo actually depends on.
  const repoRoot = path.join(WEB_ROOT, '..', '..');
  const candidates = [
    path.join(WEB_ROOT, 'node_modules', 'axe-core', 'axe.min.js'),
    path.join(repoRoot, 'node_modules', 'axe-core', 'axe.min.js'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8');
  }
  // pnpm's virtual store, when axe-core is not hoisted to a node_modules root.
  const store = path.join(repoRoot, 'node_modules', '.pnpm');
  if (fs.existsSync(store)) {
    for (const dir of fs.readdirSync(store)) {
      if (!dir.startsWith('axe-core@')) continue;
      const p = path.join(store, dir, 'node_modules', 'axe-core', 'axe.min.js');
      if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8');
    }
  }
  throw new Error('axe-core bundle not found — is axe-core installed?');
})();

/**
 * Viewports.
 *
 * EC-6 says mobile is designed independently, and the touch floor is a mobile
 * concern first — a 44px target is trivially met by a desktop nav row and
 * routinely missed by a 390px stack. The 2026-08-09 audit measured its 716
 * sub-44px targets at 390×844; a desktop-only gate would ratchet the easy half
 * and leave the hard half unmeasured, which is how a gate ends up technically
 * green and practically useless.
 *
 * Baseline keys are `route@viewport`, so the two ratchet independently — fixing
 * a desktop target cannot mask a mobile regression.
 */
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
] as const;

const measured: Baseline = {};

test.describe('a11y — real routes, WCAG 2.2 AA', () => {
  for (const viewport of VIEWPORTS)
  for (const route of ROUTES) {
    test(`${route} @${viewport.name} is never less accessible than its baseline`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      // NOT `networkidle`: /sign-in and /sign-up mount Clerk, which keeps
      // connections open (telemetry retries, and a CSP-blocked endpoint that
      // never resolves), so the idle event never fires and the route times out
      // at 30s. Wait for the document instead, then give hydration a settle
      // window — the measurement has to happen on the hydrated DOM, since that
      // is what a person actually gets.
      const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => document.readyState === 'complete').catch(() => {});
      await page.waitForTimeout(1200);

      // A route that stops resolving is a different failure; say which.
      expect(
        response?.status(),
        `${route} did not return a page (status ${response?.status()})`,
      ).toBeLessThan(400);

      await page.addScriptTag({ content: AXE_SOURCE });

      const violations = await page.evaluate(async () => {
        // @ts-expect-error injected by addScriptTag
        const result = await window.axe.run(document, {
          runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
        });
        const out: Record<string, number> = {};
        for (const v of result.violations) out[v.id] = v.nodes.length;
        return out;
      });

      /**
       * EC-5's 44px floor. WCAG 2.2's own Target Size (Minimum) is 24px at AA,
       * so axe does not enforce 44 — the constitution sets a higher bar than
       * the standard and it has to be measured directly.
       *
       * Only visible, genuinely interactive elements count. An element inside a
       * larger hit area (a bare icon in a padded button) is not a finding, so
       * elements whose interactive ancestor already clears the floor are
       * excluded.
       */
      const smallTargets = await page.evaluate(() => {
        const SEL = 'a[href], button, input:not([type=hidden]), select, textarea, [role=button], [role=link], [tabindex]:not([tabindex="-1"])';
        const nodes = Array.from(document.querySelectorAll<HTMLElement>(SEL));
        let count = 0;
        for (const el of nodes) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          const cs = getComputedStyle(el);
          if (cs.visibility === 'hidden' || cs.display === 'none') continue;
          // Screen-reader-only controls — the skip link is the canonical case —
          // are clipped to ~1px until focused, then render full size. They are
          // not touch targets, and counting them would make ADDING a skip link
          // raise the number and fail this ratchet: an accessibility
          // improvement punished as a regression.
          if (r.width <= 2 && r.height <= 2) continue;
          if (r.width >= 44 && r.height >= 44) continue;
          const parent = el.parentElement?.closest<HTMLElement>(SEL);
          if (parent) {
            const pr = parent.getBoundingClientRect();
            if (pr.width >= 44 && pr.height >= 44) continue;
          }
          count += 1;
        }
        return count;
      });

      const key = `${route}@${viewport.name}`;
      measured[key] = { violations, smallTargets };
      if (WRITE) return;

      const base = readBaseline()[key];
      expect(
        base,
        `${key} has no baseline entry. Run with A11Y_WRITE_BASELINE=1 --workers=1 and commit the diff.`,
      ).toBeDefined();
      if (!base) return;

      // New rule firing on a route that was clean for it.
      const appeared = Object.keys(violations).filter((id) => !(id in base.violations));
      expect(appeared, `${key}: new axe violation type(s) — ${appeared.join(', ')}`).toEqual([]);

      // Existing rule getting worse.
      const worse = Object.entries(violations)
        .filter(([id, n]) => id in base.violations && n > base.violations[id])
        .map(([id, n]) => `${id}: ${base.violations[id]} → ${n}`);
      expect(worse, `${key}: axe violations increased — ${worse.join('; ')}`).toEqual([]);

      expect(
        smallTargets,
        `${key}: sub-44px touch targets increased ${base.smallTargets} → ${smallTargets} (EC-5)`,
      ).toBeLessThanOrEqual(base.smallTargets);
    });
  }
});

test.afterAll(() => {
  if (!WRITE) return;
  const merged: Baseline = { ...readBaseline(), ...measured };
  const ordered = Object.fromEntries(Object.entries(merged).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(BASELINE_PATH, `${JSON.stringify(ordered, null, 2)}\n`);
  // eslint-disable-next-line no-console
  console.log(`a11y baseline written: ${BASELINE_PATH}`);
});
