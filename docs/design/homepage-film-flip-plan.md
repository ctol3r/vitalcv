# Flipping `/` to the horizontal film — what it actually costs

**Date:** 2026-07-25
**Status:** Measured, not shipped. The one-line change was made, run against the full suite, and
reverted. This records the real cost so the flip can be executed deliberately.

## The headline number

Swapping `<HomePageClient />` for `<HorizontalCareerFilm />` in `apps/web/app/page.tsx`:

| Gate | Result |
| --- | --- |
| `tsc --noEmit` | **exit 0** |
| `vitest` (full, 331 files) | **2,983 passed / 0 failed** |
| Playwright, 7 homepage specs | **44 failed / 12 passed** |

**The vitest result is a false negative and must not be quoted as a green light.** Every homepage
vitest file imports `HomePageClient` *directly* (`renderToStaticMarkup(<HomePageClient />)`), so it
tests the component, not the route. Flipping `page.tsx` cannot break them — and after the flip they
would be asserting a composition that is no longer on the homepage. Those files need re-pointing at
the route, or they become the same kind of orphan as `homepage-public-truth.test.tsx`.

## Why the 44 failures are not all stale

They split into three kinds, and the split is the whole job:

**1. Selector drift — the film is arguably more correct.**
The old hero labels its input with `aria-label="NPI number"` and `id="npi-input"`. The film uses a
**visible `<label htmlFor="film-npi-input">Start with your NPI</label>`**. A visible label is better
practice than an aria-label, and it is what WCAG 2.5.3 (Label in Name) wants. So `Tab order must
reach the NPI input within 25 stops` fails on the *name*, not on reachability — the failure is the
test being stale, and "fixing" it by bolting `aria-label="NPI number"` onto the film would override
the visible label and make accessibility *worse*.

**2. Composition assertions that are genuinely obsolete.**
`homepage-journey-rail.spec.ts` in full, plus the rail/grid/proof-moment/scrub-heading markers.
These assert sections the mandate retires. They should be deleted with their sections, not re-pointed.

**3. Guarantees that must survive and need re-proving against the film.**
The no-JS SSR floor, the NPI truth-engine flow (`npi-truth-engine.spec.ts` — whose header says in
terms *"Do not weaken these assertions to make a copy change pass"*), the institution-review
boundary, bounded `s-maxage ≤ 300`, and the `data-home-hero` marker that `scripts/deploy-smoke.mjs`
greps out of the raw production response.

Category 3 is why this is not a rubber stamp. Rewriting 44 assertions at speed is exactly how a
truth guard or an a11y guarantee gets quietly dropped to make a build pass.

## Recommended sequence

1. **Re-point the homepage vitest files at the route** (render `HomePage`, not `HomePageClient`).
   Do this *first* — it makes the vitest suite honest, and it will start failing, which is correct.
2. **Adjudicate the 44 one at a time**, labelling each stale-selector / obsolete / must-survive.
   Delete the obsolete with their sections; re-point the stale; satisfy the must-survive **in the
   film**, never by weakening the assertion.
3. **Port `compete-film.spec.ts` and `film-visual.spec.ts` from `/dev/compete-film` to `/`,** so the
   film keeps its own visual-regression baselines on the real route.
4. Only then flip `page.tsx`.

## What is already verified about the film itself

Measured at `/dev/compete-film` on `c3593747` (real browser, not the Browser pane):

- runway 5400px, track 8640px, transform `0 → -7200px` across ordinary vertical scroll
- **paint-order test passes** — the headline is the topmost element at its own centre
  (`elementFromPoint`), so the documented atmosphere-canvas-over-copy regression is fixed
- zero console errors, zero page errors
- copy honors the mandate's ceiling: one phrase per scene, and the 90–120 day figure is worded as an
  **industry** benchmark, never a VitalCV result

The film is ready. The *contract around it* is the work.
