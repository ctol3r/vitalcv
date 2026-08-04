# VitalCV — Visual Regression Spec (DG-18.3) · Wave 1505

Ready for Playwright implementation. No design interpretation required.

## 1. Route × viewport matrix

10 key routes × 3 viewports = 30 baseline screenshots (60 with reduced-motion variants off/on if desired; default: reduced-motion ON only, see §3).

| # | Route | Source wave | Notes |
|---|---|---|---|
| 1 | `/` | 1501 | homepage |
| 2 | `/pricing` | 1505 | |
| 3 | `/contact` | 1505 | pristine form state |
| 4 | `/legal/privacy` | 1505 | template proxy for all four legal docs |
| 5 | `/get-ready` | 1503 | |
| 6 | `/passport` | 1503 | seeded fixture persona `psp_okafor_7f3a` |
| 7 | `/p/a-okafor-7f3a` | 1503 | share page, same fixture |
| 8 | `/review/request` | 1502 | |
| 9 | `/trust` | 1504 | trust register |
| 10 | `/status` | 1504 | operational status |

Viewports (device scale factor 2):

| Name | Size |
|---|---|
| `mobile` | 360 × 740 |
| `tablet` | 768 × 1024 |
| `desktop` | 1440 × 900 |

Capture: `fullPage: true` for all routes.

## 2. Masking rules — by attribute, never by coordinates

Dynamic content carries `data-vr-mask` in the DOM. The spec masks by selector:

```ts
const MASKS = [
  '[data-vr-mask="freshness"]',   // FreshnessStamp relative times
  '[data-vr-mask="timestamp"]',   // ISO timestamps, compiled-at, checked_at
  '[data-vr-mask="runid"]',       // run ids, receipt ids, packet ids
  '[data-vr-mask="fingerprint"]', // key fingerprints on /trust
  '[data-vr-mask="pulse"]',       // /status live pulse cell — masked, not frozen
];
```

Repo task: components render these attributes themselves — `FreshnessStamp` → `freshness`; `TokenRow`/receipt chips → `runid`; `/status` pulse cell → `pulse`. Ring **values** are fixture-stable and are NOT masked (a changed ring is a real diff).

Per-route required masks: routes 5–7 (`freshness`, `runid`, `timestamp`); route 9 (`timestamp`, `runid`, `fingerprint`); route 10 (`timestamp`, `pulse`). Routes 1–4, 8: none (fail if masks appear — that means dynamic data leaked into static pages).

## 3. Capture conditions

```ts
use: {
  colorScheme: 'light',
  reducedMotion: 'reduce',        // entrances render final-state; no race
  deviceScaleFactor: 2,
  timezoneId: 'UTC',
  locale: 'en-US',
},
expect: {
  toHaveScreenshot: {
    maxDiffPixelRatio: 0.001,
    animations: 'disabled',
    caret: 'hide',
  },
},
```

Per page before capture:

```ts
await page.goto(route);
await page.evaluate(() => document.fonts.ready);
await page.waitForLoadState('networkidle');
```

Fixtures: seed the demo persona (`npi:1234567893`, snapshot `psp_okafor_7f3a`) via the test database seed script; never point regression at production data.

## 4. Assertions beyond screenshots (cheap, high-signal)

Run on all 10 routes:

- `body` computed background = `rgb(244, 242, 236)` (paper — catches ops-theme leaks, LINT-04).
- No horizontal scroll: `document.documentElement.scrollWidth <= viewport.width` at 360.
- Exactly 0 elements match `[style*="#6c47ff"], .cl-internal-*:not([data-themed])` on auth routes (Clerk default leak).
- `document.querySelector('.skip-link')` exists and is first focusable.

## 5. Baseline change control

A failing diff has exactly two exits:
1. Fix the regression.
2. Update the baseline **with** a CHANGES.md entry naming the intentional change; CI comment links the diff image to the entry. Baseline updates without a CHANGES entry fail review by policy.

## 6. File layout

```
tests/visual/
  routes.ts          // matrix above as data
  visual.spec.ts     // one parameterized test
  __screenshots__/   // baselines, committed
```

One parameterized spec, not ten files — the matrix is data, the test is three lines of logic.
