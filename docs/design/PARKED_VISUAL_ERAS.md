# Parked Visual Eras

**Status:** Binding freeze record · Phase 0 of the Experience Overhaul Program
**Date:** 2026-08-08
**Authority:** `VITALCV_EXPERIENCE_OVERHAUL_PROGRAM_2026-08-08.md` (Phase 0) · `VITALCV_EXPERIENCE_CONSTITUTION.md`

## The freeze

A **UI PR freeze is in effect until UX-03 (eyebrow + navigation) ships.** No visual PRs land
outside the Experience Overhaul Program. Bug fixes that happen to touch UI files are permitted
only when they change no visual treatment.

Every visual treatment below is **parked, not deleted**. Parked means: it stays in the tree, it
keeps rendering wherever it currently renders, and it confers no authority. No new surface may
adopt a parked treatment, and no wave inherits one merely because it exists. Physical removal is
UX-02's de-islanding work (mechanical, many small PRs) — not something to do opportunistically.

## The eras and their residue (audited 2026-08-08 on `wave/career-evidence-network-alignment`)

| # | Era | Physical residue in `apps/web` | Parked status |
|---|---|---|---|
| 1 | **Stark black/white YC MVP** (early 2026) | Residual utility classes and layouts in older routes; `styles/utilities.css`, parts of `styles/typography.css` | Parked. No authority. |
| 2 | **Warm Minimalism / Liquid Glass blueprint** | `styles/blueprint-overrides.css`; glass/backdrop treatments on assorted chrome | Parked. Glass treatment is direction-locked (constitution EC-13) pending the UX-01 verdict; EC-3's certainty rule still bars certainty-implying treatment on evidence. |
| 3 | **Antigravity** (particles, glass, magnetic buttons) | `antigravity.css` loaded via layout; `--ag-*` tokens; particle/magnetic interaction code | Parked. Its devices are direction-locked/guidance material (EC-13/EC-14), not defaults for any surface. |
| 4 | **Calm Wave paper+ink** (waves 1500–1505) | `.mz` / `.w14` / `.w1505` scoped islands; `styles/vitalTokens.css`, `styles/tokens.css`; wave-1505 handoff under `design-handoff/claude-design-2026-07-12-wave1505/` | Parked as a *visual treatment*. Its **token/component architecture** (semantic `--vt-*` layer, StateChip contract, lint rules) carries forward as UX-02's skeleton, re-skinned to the UX-01 verdict. |
| 5 | **Creative Direction "record, not dashboard"** (July 2026) | `docs/design/VITALCV_CREATIVE_DIRECTION.md` (CD-1…CD-20); partial implementation across public routes | Doctrine largely carries forward into the Experience Constitution (see its Part II). CD's palette and type sections are **subject to the UX-01 verdict**. CD is amended per CD-19, never forked. |
| 6 | **Homepage reset directions A/B/C** (2026-08-07/08) | `design-lab/homepage-reset/` — three isolated prototypes, critiques, Playwright evidence | **Resolved.** UX-01 verdict = **Direction B GO, with amendments** (`design-lab/homepage-reset/DECISION.md`). A and C are parked; B's *thesis* — not its implementation — is implemented by UX-V1 below. |
| 7 | **One Real Loop homepage + journey-rail chrome** (Wave 1075 / FR-6 shared header) | See the UX-V1 table below | Parked by UX-V1. Both homepage predecessors stay env-switchable; the journey-rail chrome is unmounted but importable. |

## Parked by UX-V1 (production experience cutover, 2026-08-08)

The cutover (`docs/design/UXV1_PRODUCTION_CUTOVER_2026-08-08.md`) replaced `/` and the shared
public chrome. Nothing was deleted.

| Era | Code | How it is still reachable | Tests |
| --- | --- | --- | --- |
| Career-loop homepage ("One Real Loop", Wave 1075) | `components/home/career-loop/`, `styles/career-loop-home.css` | `PUBLIC_HOME_VARIANT=career-loop` (env rollback) | `tests/e2e/home-career-loop.spec.ts` (its own e2e pass), unit coverage via variant renders in `home-easy-cutover.test.tsx` |
| Evidence-film homepage (COMPETE-1) | `components/home/film/`, `styles/home.css` | `PUBLIC_HOME_VARIANT=film` (env rollback) | film e2e pass (`E2E_HOME_VARIANT=film`), `film-journey-unification.test.tsx`, `home-artifact-provenance.test.tsx` |
| Journey-rail header chrome (FR-6 shared-header era) | `components/layout/Navbar.tsx`, `HeaderMenu.tsx`, `LiquidMenu.tsx`, `JourneyRail.tsx`, `AnnouncementRail.tsx`, `styles/header.css` | Unmounted — `RootChrome` renders `Eyebrow` instead | `header-chrome.test.tsx`, `header-journey-system.test.tsx`, `header-scene.test.tsx` (component-level; the components remain importable) |

Notes:

- The rollback variants serve under the **UX-V1 eyebrow** — chrome does not switch with the
  content variant. Three chrome-pinning e2e specs were retired with the cutover
  (`header-journey.spec.ts`, `liquid-menu.spec.ts`, `film-journey-rail.spec.ts`); their surviving
  contracts moved to `eyebrow.spec.ts`, `eyebrow-chrome.test.tsx`, and the unit suites above.
- `journeyStages.ts`, `navDestinations.ts`, `headerRouteContext.ts`, and `useHeaderScene.ts` are
  NOT parked — the eyebrow consumes them; the film derives its chapter vocabulary from
  `journeyStages.ts`.
- Cleanup debt (dead-weight removal of parked chrome once rollback confidence expires) is recorded
  for the UX-F foundation lane in `docs/design/UXV1_PRODUCTION_CUTOVER_2026-08-08.md`.

## Shared entropy (belongs to no era, removed by UX-02)

- `apps/web/app/globals.css` imports **13 stylesheets** (14 `@import` lines incl. normalize +
  tailwind): `themes/index.css`, `vds.css`, `design-tokens.css`, `utilities.css`,
  `typography.css`, `tokens.css`, `vitalTokens.css`, `blueprint-overrides.css`, `matcha.css`,
  `matcha-zen.css`, `graph.css`, `intelligence.css` — plus `antigravity.css` via layout.
- Competing token prefixes: `--vt-`, `--ag-`, `--palette-`, `--vital-`, `--gf-`, `--trust-`,
  `--infra-`, `--glue-`, `--ops-`, `--mz-`, and more.
- A **global `*` transition rule** (~280ms on color properties) — forbidden by the wave-1505
  motion doctrine it coexists with.
- Two parallel component systems (`design-system/` vs `components/ui/`); a `Badge` import
  resolves differently by path; **≥30 status/badge components** express the same truth states.

Two entries from the 2026-08-08 audit have since been corrected on mainline and are **not**
outstanding: `apps/web/app/fonts/` does exist (Geist, Geist Mono and Fraunces are self-hosted via
`next/font/local`), and `scripts/check-design-lint.ts` is on mainline behind the required
`check-design-lint` status check.

## What "unparking" would take

A parked treatment returns only via a constitution amendment (dated rationale, founder-approved)
— the same bar as any other visual law change. There is no other path.
