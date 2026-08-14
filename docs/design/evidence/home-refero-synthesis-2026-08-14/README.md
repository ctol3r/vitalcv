# WO-17 homepage reference synthesis evidence

## Scope and creative ownership

- **Creative owner:** Codex.
- **Route:** `/`, canonical `easy` variant only.
- **Implementation baseline:** `origin/main` at `a8ec824f9`.
- **Production before baseline:** Railway web `/api/version` reported
  `cf64cdae4a40522defa88b3d81d4546c17787e41` on 2026-08-14.
- **Shared public chrome:** unchanged.
- **Data, API, schema, authorization, packet, consent, and decision paths:** unchanged.

## Claim-check and duplicate-intent search

The search covered open and recently merged pull requests, remote branches, the
served home variant, and existing hero/work-surface/career-loop components.
Merged #1371 is the record-first Direction D foundation and merged #1373 is the
human+tactile Direction D.1 foundation. They are **LANDED dependencies**, not
duplicates. No open pull request changes `/`, and this work composes the existing
`HeroStage`, `WorkSurface`, and `CareerMobilitySequence`; it creates no new
homepage component family, motion owner, scene registry, scroll owner, evidence
card, or career-loop engine.

Intent searches included `home`, `hero`, `watch`, `visual`, `design`, `film`,
`record`, `folio`, `mobility`, `career loop`, `evidence card`, and `scene stage`.

## Reference synthesis

Sources supplied by the founder:

- [Impilo design system](https://styles.refero.design/style/b44b0bb2-4ba3-4599-9706-3c3e0c8c2522)
- [Integrated Biosciences design system](https://styles.refero.design/style/80099f79-72b7-4367-b2e9-6a3d4a3e9e6a)

The shared principles applied are a hard light/dark surface cut, an ink-ground
clinical-observatory frame, architectural display scale, flat hairline
structure, generous negative space, numbered technical wayfinding, and one
dominant product object. The hero's evidence folio remains solid and white
inside the ink stage, so atmosphere never blurs evidence.

Deliberately not copied: violet/cyan or bioluminescent-lime brand palettes,
proprietary fonts or assets, pill-soft action grammar, decorative state color,
scientific render wallpaper, single-weight typography, and a new mono register.
VitalCV keeps warm paper, ink, Fraunces, the locked 8px primary action, and deep
green only where a source-backed state or focus actually warrants it. The seven
new counters use Geist; the only page-level monospace that remains is the ten
pre-existing machine-fact chips in Attribution.

## Visual evidence

### Before — current production

- `before-1440x900.png`
- `before-390x844.png`

### After — optimized production build

- `after-1440x900.png`
- `after-390x844.png`
- `after-768x1024.png`
- `after-1728x1117.png`
- `after-1440-full.png`
- `after-mobility-1440x900.png`
- `after-mobility-390x844.png`
- `after-1440-reduced-motion.png`
- `after-1440-nojs.png`
- `after-768-zoom-200.png`
- `after-motion-desktop.webm`
- `after-motion-mobile.webm`

`visual-measurements.json` records the painted values. At 1440px: ground
`rgb(247, 246, 243)`; H1 43px/500 with -1.935px tracking; primary action
52px high, 8px radius, ink fill; hero stage ink fill with 24px radius; career
loop ink fill; career-loop H2 86.4px/500 with -4.752px tracking; seven numbered
steps; zero monospace elements inside the new career-loop band. Measured
contrast is 17.31:1 for H1 on paper, 18.71:1 for the primary action, and 17.31:1
for the inverse career-loop heading. Document horizontal overflow is 0px.

The app is founder-pinned to the light theme. Reduced motion keeps the complete
record static and visible; no JavaScript keeps the founder promise, documentary
poster, all record rows, and the opportunity doorway present. The videos show
ordinary wheel scrolling and keyboard focus without a scroll trap.

## Runtime verification

- Optimized build: `pnpm turbo run build --filter @vitalcv/web` — pass.
- Production server: `next start -p 3017` — route loaded successfully.
- Focused Vitest: 2 files / 35 tests — pass.
- Production-build Chromium: 18/18 — pass across 390, 768, 1024, 1280, 1440,
  and 1728 widths, plus reduced motion, no JavaScript, keyboard access, source
  boundaries, and the new painted-register assertions.
- Design, copy, claims, route, and generated-design-document gates — pass with
  no ratchet increase.
- Root typecheck, build, and lint — pass.
- Real-PostgreSQL backend sweep after the canonical locked Prisma generation:
  343 suites / 2,761 tests — pass in band. The first aggregate run exposed the
  repository's shared-client generation collision, then one parallel-only
  `pilot.routes` failure; the failed file passed 6/6 in isolation before the
  full serialized sweep passed.
- Browser log review found no application-origin runtime or chunk failure. The
  connected Chrome annotations extension emitted its own content-script and
  message-channel errors; those are outside the page bundle.

## Visual review scorecard

1. **First five seconds:** one clinician-owned record can carry source context
   into real opportunities and later review.
2. **Dominant object:** the solid CV Wallet folio inside the ink observatory.
3. **Primary action:** `Start my CV Wallet`.
4. **Hierarchy change:** the evidence folio now has a contained dark stage, and
   the career loop is a full inverse editorial chapter rather than another light
   ruled row.
5. **Memorable element:** seven white paper objects crossing one ink field.
6. **Removed competition:** no new card deck, scientific wallpaper, palette,
   font, or decorative status hue was added.
7. **Mobile recomposition:** the stage becomes a contained vertical photo/folio
   stack; the seven-column rail becomes seven numbered two-column moments.
8. **Reduced motion / no JavaScript:** the record is complete and visible; the
   dark stage and numbered sequence are CSS/SSR composition, not JS content.
9. **External principles:** hard mode cuts, architectural type, flat hairlines,
   rationed signals, negative space, and compact technical numbering.
10. **Not copied:** brand palettes, proprietary type, scientific imagery,
    rounded primary-action grammar, lime/cyan decoration, and mono-heavy labels.
11. **Truth constraints:** the image and folio remain illustrative; current
    listings keep source and observation boundaries; clinician choice precedes
    packet review; acceptance follows an employer-recorded decision; reuse needs
    fresh consent.
12. **Failure condition despite green tests:** the ink stage obscures the folio,
    the hard cut reads as a separate brand, mobile clips the physical objects,
    or state color starts functioning as atmosphere.

## Release state

Not deployed by this evidence capture. A review deployment, exact refreshed-head
CI, mergeability `CLEAN`, and exact-SHA Railway verification remain required.
