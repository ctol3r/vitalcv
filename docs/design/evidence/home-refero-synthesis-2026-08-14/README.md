# WO-17 homepage reference synthesis evidence

## Scope and creative ownership

- **Creative owner:** Codex.
- **Route:** `/`, canonical `easy` variant only.
- **Implementation baseline:** `origin/main` at `a8ec824f9`.
- **Production before baseline:** Railway web `/api/version` reported
  `cf64cdae4a40522defa88b3d81d4546c17787e41` on 2026-08-14.
- **Shared public chrome:** geometry, navigation, and controls unchanged. The
  homepage server/no-JavaScript fallback now starts in the existing light
  register so the wordmark and controls remain legible over the first paper
  section before client-side section observation.
- **Data, API, schema, authorization, packet, consent, and decision paths:** unchanged.

## Claim-check and duplicate-intent search

The search covered open and recently merged pull requests, remote branches, the
served home variant, and existing hero/work-surface/career-loop components.
Merged #1371 is the record-first Direction D foundation and merged #1373 is the
human+tactile Direction D.1 foundation. They are **LANDED dependencies**, not
duplicates. This is the existing homepage pull request #1387; no second open
pull request changes `/`. The work composes the existing
`HeroStage`, `WorkSurface`, and `CareerMobilitySequence`; it creates no new
homepage component family, scene registry, scroll owner, evidence
card, or career-loop engine.

Intent searches included `home`, `hero`, `watch`, `visual`, `design`, `film`,
`record`, `folio`, `mobility`, `career loop`, `evidence card`, and `scene stage`.

## Reference synthesis

Sources supplied by the founder:

- [Impilo design system](https://styles.refero.design/style/b44b0bb2-4ba3-4599-9706-3c3e0c8c2522)
- [Integrated Biosciences design system](https://styles.refero.design/style/80099f79-72b7-4367-b2e9-6a3d4a3e9e6a)
- `DESIGN.md`, `tokens.json`, `variables.css`, and `theme.css` — a Dimension
  style extraction supplied as material reference.
- `VitalCV Professional Trust Computing — Codex Mega-Wave Program V2.pdf` and
  `VitalCV Trust Compiler Canonical Technology Thesis.pdf` — technology and
  truth-boundary context, explicitly treated as target-state hypotheses rather
  than proof of deployed behavior.

The updated synthesis applies the Dimension reference's material behavior, not
its brand: translucent surfaces, backdrop blur, glass hairlines, compact pills,
and restrained depth. The CV Wallet is a warm frosted register over a
code-authored NPI -> distinct source states -> source-labelled roles horizon.
The motion display and the existing row assembly share one hydration owner and
run once. Every source state remains selectable text above the glass.

Deliberately not copied: the black Dimension canvas, violet wash, DM Sans/Geist
theme, gradient hero, proprietary assets, scientific wallpaper, or decorative
state color. The prior documentary hero poster is unmounted per the founder's
2026-08-14 direction to set images aside. VitalCV keeps warm paper, ink,
Fraunces, the locked 8px primary action, and deep green only where a
source-backed state or focus warrants it.

The trust theses influence hierarchy rather than public claims. Identity,
clinician-controlled history, access-gated licensure, and review-required
career evidence remain separate instead of collapsing into one glossy score.
The display stops at source-labelled opportunity; it does not imply a deployed
Trust Compiler, policy-satisfaction proof, eligibility, acceptance, or start.

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

`visual-measurements.json` records the painted values. At 1440px the H1 is
43px/500; the primary action is 52px high with the founder-locked 8px radius;
the hero stage is a contained 24px warm-sage field; and the record surface
paints at 58% white with `blur(26px) saturate(1.18)`. The server-visible
illustration contains four record rows, three horizon stops, and zero images.
Document horizontal overflow is 0px.

The app is founder-pinned to the light theme. Reduced motion keeps the complete
record and career horizon static and visible; no JavaScript keeps the founder
promise, code-authored display, all record rows, and the opportunity doorway
present. The videos show
ordinary wheel scrolling and keyboard focus without a scroll trap.

## Runtime verification

- Optimized build: `pnpm turbo run build --filter @vitalcv/web` — pass.
- Production server: `next start -p 3017` — route loaded successfully.
- Focused Vitest, including the glass-frost governance ratchet: 4 files / 44
  tests — pass.
- Production-build Chromium: 19/19 — pass across 390, 768, 1024, 1280, 1440,
  and 1728 widths, plus reduced motion, no JavaScript, keyboard access, source
  boundaries, and the new painted-register assertions.
- Design, copy, claims, route, and generated-design-document gates — pass. The
  glass ratchet carries one explicit founder-directed allowlist entry for this
  marketing illustration stylesheet; its reason requires a complete, readable
  fallback, and the Constitution continues to prohibit frost on operational,
  submitted-evidence, receipt, artifact, proof, and decision surfaces.
- Root typecheck, build, and lint — pass.
- Aggregate non-backend Turbo sweep: 468 files / 4,532 tests — pass, with 7
  files / 45 tests skipped by their existing suite contracts.
- Real-PostgreSQL backend sweep after the canonical locked Prisma generation:
  343 suites / 2,761 tests — pass in band. The first aggregate run exposed the
  repository's shared-client generation collision, then one parallel-only
  `pilot.routes` failure; the failed file passed 6/6 in isolation before the
  full serialized sweep passed.
- Browser log review found no application-origin runtime or chunk failure. The
  connected Chrome annotations extension emitted its own content-script and
  message-channel errors; those are outside the page bundle.
- The local optimized server, which intentionally had no Clerk runtime
  configuration, logged Clerk's middleware-detection error when the homepage
  polled `/api/opportunities`; the page kept its honest server-visible fallback
  and every browser assertion passed. This is a local auth-configuration
  limitation, not a claim that the opportunity request succeeded.

## Visual review scorecard

1. **First five seconds:** one clinician-owned record can carry source context
   into real opportunities and later review.
2. **Dominant object:** the frosted CV Wallet register over a luminous career horizon.
3. **Primary action:** `Start my CV Wallet`.
4. **Hierarchy change:** the evidence folio now has a contained luminous stage, and
   the career loop is a full inverse editorial chapter rather than another light
   ruled row.
5. **Memorable element:** seven white paper objects crossing one ink field.
6. **Removed competition:** no new card deck, scientific wallpaper, palette,
   font, or decorative status hue was added.
7. **Mobile recomposition:** the glass register and its career horizon stay one
   contained object; the seven-column rail becomes seven numbered two-column moments.
8. **Reduced motion / no JavaScript:** the record and light-register header are
   complete and visible; the warm-glass stage and numbered sequence are CSS/SSR
   composition, not JS content.
9. **External principles:** hard mode cuts, architectural type, flat hairlines,
   rationed signals, negative space, and compact technical numbering.
10. **Not copied:** brand palettes, proprietary type, scientific imagery,
    rounded primary-action grammar, lime/cyan decoration, and mono-heavy labels.
11. **Truth constraints:** the motion display and register remain illustrative; current
    listings keep source and observation boundaries; clinician choice precedes
    packet review; acceptance follows an employer-recorded decision; reuse needs
    fresh consent.
12. **Failure condition despite green tests:** the glass erases text contrast,
    the material reads as a separate brand, mobile clips the motion horizon,
    or state color starts functioning as atmosphere.

## Release state

Not deployed by this evidence capture. A review deployment, exact refreshed-head
CI, mergeability `CLEAN`, and exact-SHA Railway verification remain required.
