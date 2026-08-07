# /employers restructure — founder-gate evidence

Wave source: founder vitalcv.com experience audit, 2026-08-06 (measured prod
build `2e7d7fb`). Findings addressed: 5,744px page with one conversion moment
at 96% depth; primary CTA a 5,100px in-page smooth-scroll; three mono
disclaimer paragraphs between H1 and action; three CTA labels for one
intention; lane-register reference density on a landing page.

Explicitly **not** in this wave (open founder decisions): the H1 line, any
pricing statement.

## Measured result (branch prod build, `next start`)

| Route | 1440 height | 390 height | overflow | console errors |
|---|---|---|---|---|
| /employers (before, prod) | 5,743px | 7,402px | none | 0 |
| /employers (after) | **3,262px (−43%)** | **4,571px (−38%)** | none | 0 |
| /employers/request-access (new) | 1,054px | 1,030px | none | 0 |
| /employers/how-it-works (new) | 3,390px | 3,578px | none | 0 |

The audit's ≤2,800px target is not fully reached; the remaining mass is the
audience section's two 3-card grids (~1,100px). Tightening those is a content
decision left to the gate (REVISE lever), not made silently.

## Capture methodology

`tools/capture-evidence.mjs` (Playwright/Chromium against a production
`next start`). Full-page shots settle the single-shot `Reveal` observers
first — CDP's captureBeyondViewport never scrolls, so below-fold
IntersectionObservers don't fire and `mz-reveal` content screenshots blank
(capture artifact only: a real reader keeps elements in view, so the observer
always fires for them; prod's own capture shows identical blanks). After a
scroll pass, remaining reveals are forced to their settled state — the same
neutralization `matcha-zen.css` ships for reduced motion.

The aborted `/?_rsc=`/`/sign-in?_rsc=` prefetches in metrics occur identically
on prod today — platform-wide Next prefetch behavior, not introduced here.

## Evidence files

- `evidence/before-employers-*` — prod (build `a872c2c` era) at 1440×900 and 390×844, viewport + full.
- `evidence/after-employers-*` — this branch, same viewports, plus 768×1024, reduced-motion, 200%-zoom proxy (720×450 reflow), keyboard-focus (2×Tab).
- `evidence/after-employers_request-access-*`, `after-employers_how-it-works-*` — the new routes.
- `evidence/metrics-before.json`, `evidence/metrics-after.json` — heights, overflow, console errors, failed requests per route.
