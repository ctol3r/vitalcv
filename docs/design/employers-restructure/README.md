# /employers restructure — founder-gate evidence

Wave source: founder vitalcv.com experience audit, 2026-08-06 (measured prod
build `2e7d7fb`). Findings addressed: 5,744px page with one conversion moment
at 96% depth; primary CTA a 5,100px in-page smooth-scroll; three mono
disclaimer paragraphs between H1 and action; three CTA labels for one
intention; lane-register reference density on a landing page.

Explicitly **not** in this wave (open founder decisions): the H1 line, any
pricing statement.

## REVISION 2 (founder visual gate, 2026-08-07)

The gate approved the restructure and revised the hierarchy: the evidence-led
H1 sold the trust machinery as the product. Changes, all on the existing
structure (`evidence-revision2/`):

- **Hero** now leads with the hiring experience — "Move a clinician hire from
  interest to start." — with the lede carrying arrival/known/remaining/decision
  and attribution entering immediately beneath as proof. No pace language.
- **Organization access** is framed as the doorway (hero caption + closing
  card), not the proposition. Same label, same route, still the only action.
- **Audience section** recomposed from six bordered cards in two grids to two
  hairline row lists under one heading; size-band rows run full-width with the
  action on the band line. All W10 titles, W11 bands, routing, and boundary
  strings preserved.
- The branch also inherits the shared journey header (#1083, #1085) via rebase.

Measured (branch prod build, `next start`): /employers **3,145px** desktop
(was 3,262 at revision 1; 5,743 before), **4,118px** mobile (was 4,571;
7,402 before). Zero console errors, no overflow at any capture size. The
audit's ≤2,800px is still not fully reached: the remaining mass is the
six-card workflow section (~590px) and the hero artifact stage (~290px) —
both part of the approved visual architecture, so tightening either is a
founder decision, not one this revision takes silently.

## Measured result (branch prod build, `next start`)

| Route | 1440 height | 390 height | overflow | console errors |
|---|---|---|---|---|
| /employers (before, prod) | 5,743px | 7,402px | none | 0 |
| /employers (after, revision 2) | **3,145px (−45%)** | **4,118px (−44%)** | none | 0 |
| /employers/request-access (new) | 1,054px | 1,030px | none | 0 |
| /employers/how-it-works (new) | 3,390px | 3,578px | none | 0 |

The audit's ≤2,800px target is not fully reached; the remaining mass is the
six-card workflow section (~590px) and the hero artifact stage (~290px) — both
approved visual architecture, so tightening either is a founder decision, not
made silently.

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
