# Design Baseline — UX-02 Phase 0

> Measured against `origin/main` @ `efda1a5d8` on 2026-08-07, production build
> (`next start`, hermetic local env — no database, no external fetches).
> Regenerate: build `@vitalcv/web`, serve on a port, then
> `BASE_URL=http://localhost:<port> node design-lab/ux02-phase0/capture.mjs`.
> Screenshots land in `design-lab/ux02-phase0/evidence/` (untracked by design,
> same policy as `design-lab/homepage-reset/evidence/`); structural metrics are
> committed as `design-lab/ux02-phase0/evidence/metrics.json`.

## Structural metrics

`heightRatio` = page height ÷ viewport height. `chars/vp` = visible text characters
per viewport of scroll. The teardown's density rule: a route above **2.5×** viewport
height should carry **>800 chars per viewport**.

| Route | Width | Status | Page height | heightRatio | Text chars | chars/vp |
|---|---|---|---|---|---|---|
| `/` | 390 | 200 | 3199 | 3.55 | 1266 | 357 |
| `/` | 768 | 200 | 2983 | 3.31 | 1431 | 432 |
| `/` | 1280 | 200 | 3689 | 4.10 | 1431 | **349** |
| `/` | 1728 | 200 | 3826 | 4.25 | 1431 | **337** |
| `/employers` | 390 | 200 | 3776 | 4.20 | 5336 | 1270 |
| `/employers` | 768 | 200 | 2940 | 3.27 | 5492 | 1680 |
| `/employers` | 1280 | 200 | 2923 | 3.25 | 5492 | 1690 |
| `/employers` | 1728 | 200 | 2923 | 3.25 | 5492 | 1690 |
| `/pricing` | 390 | 200 | 2893 | 3.21 | 2551 | 795 |
| `/pricing` | 768 | 200 | 1956 | 2.17 | 2725 | 1256 |
| `/pricing` | 1280 | 200 | 1656 | 1.84 | 2725 | 1481 |
| `/pricing` | 1728 | 200 | 1656 | 1.84 | 2725 | 1481 |
| `/profile/1407202518` | all | **404** | — | — | — | — |
| `/matcha` | all | **404** | — | — | — | — |

**The homepage fails the density rule at every width** — worst at desktop:
4.1–4.25 viewports of scroll carrying ~340–350 chars per viewport. This is the
quantified form of the "content-free 900px sections" finding. `/employers` and
`/pricing` pass.

### Route-list corrections vs the teardown

- `/profile/[npi]` **exists** on `origin/main`, but `notFound()`s in a hermetic
  env with no backing data for the safe test NPI (1407202518). A production or
  seeded-env capture is needed to baseline this route — do not read the 404 as
  a missing route.
- `/matcha` does **not** exist as a public route. Matcha lives at
  `/holder/matcha` (authenticated); the public Matcha experience is embedded in
  the homepage (`PublicMatchaExperience` in `HomePageClient`). The teardown's
  route list was wrong here.

## Accessibility (axe-core 4.x, 1280px, production build)

| Route | Violations |
|---|---|
| `/` | `color-contrast` (serious, **14 nodes**), `landmark-one-main` (moderate) |
| `/pricing` | `color-contrast` (serious, **7 nodes**) |
| `/employers` | none |
| 404 page | `region` (moderate, 2 nodes) — page content outside landmarks |

The 21 serious contrast nodes corroborate the teardown's border/microcopy
contrast findings and set the "zero violations" target for UX-02 verification.

## Not measured (recorded, not silently skipped)

- **Lighthouse** — not installed in the hermetic worktree; a full Lighthouse
  pass (perf + CLS) should run against a production URL before UX-02 ships so
  the comparison is apples-to-apples. The scroll-reveal CLS risk in the
  teardown remains unverified until then.
- **`/profile/[npi]` render** — needs seeded data or a production capture (see
  above).
- **Cross-browser** — Chromium only.
