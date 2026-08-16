# Parked Visual Eras

**Status:** Binding freeze record · Phase 0 of the Experience Overhaul Program
**Date:** 2026-08-08
**Authority:** `VITALCV_EXPERIENCE_OVERHAUL_PROGRAM_2026-08-08.md` (Phase 0) · `VITALCV_EXPERIENCE_CONSTITUTION.md`

## The freeze

**The UI PR freeze was LIFTED on 2026-08-09** (founder ruling): UX-03 shipped as UX-V1 (#1190,
the public eyebrow and homepage) plus #1232 (the signed-in navigation contract). This register
outlives the freeze — parking is how superseded treatments are retired, freeze or no freeze. Bug fixes that happen to touch UI files are permitted
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
| 3 | **Antigravity** (particles, glass, magnetic buttons) | `antigravity.css` (no longer loaded — W1083 removed the global import; the file stays as the era record); `--ag-*` tokens; particle/magnetic interaction code | Parked, and since W1083 **unloaded**: it served zero live consumers while shipping 570 lines to every page. Its devices are direction-locked/guidance material (EC-13/EC-14), not defaults for any surface. LINT-12 now pins the shell's stylesheet set, so re-loading it is a CI failure, not a drive-by import. |
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
| Journey-rail header chrome (FR-6 shared-header era) | **REMOVED 2026-08-09.** Was five components under components/layout (Navbar, HeaderMenu, LiquidMenu, JourneyRail, AnnouncementRail) plus the header stylesheet. Deliberately written without path syntax: these files no longer exist, and the citability guard is right to reject a dead path | Git history only — deleted on the founder's rollback-confidence call after the eyebrow held a day in production | Their two suites retired with them; `header-journey-system.test.tsx` was KEPT, because its stage / nav-destination / route-context subjects are LIVE — the eyebrow consumes them |

**Removal note (2026-08-09).** The chrome row above is deleted, not parked. It
was a closed island — Navbar and AnnouncementRail had zero importers, the other
three were reachable only through Navbar, the header stylesheet had a single
`@import`, and the film variant never touched any of it — so removal was a
clean cut rather than an untangling. What did NOT go, because the eyebrow
consumes all four: `apps/web/components/layout/journeyStages.ts`,
`apps/web/components/layout/navDestinations.ts`,
`apps/web/components/layout/headerRouteContext.ts` and
`apps/web/components/layout/useHeaderScene.ts`.

Notes:

- The rollback variants serve under the **UX-V1 eyebrow** — chrome does not switch with the
  content variant. Three chrome-pinning e2e specs were retired with the cutover — they lived at
  `apps/web/tests/e2e/{header-journey,liquid-menu,film-journey-rail}.spec.ts` and were **deleted**
  in `c6a693641` (#1190), so unlike every other row in this document they are not parked on disk.
  Git history is their park: `git show c6a693641^:apps/web/tests/e2e/header-journey.spec.ts`
  recovers one. Naming the retiring commit is what makes that recoverable — a filename alone
  points at nothing once the file is gone (recorded 2026-08-08, W1080). Their surviving contracts
  moved to `eyebrow.spec.ts`, `eyebrow-chrome.test.tsx`, and the unit suites above.
- `journeyStages.ts`, `navDestinations.ts`, `headerRouteContext.ts`, and `useHeaderScene.ts` are
  NOT parked — the eyebrow consumes them; the film derives its chapter vocabulary from
  `journeyStages.ts`.
- Cleanup debt (dead-weight removal of parked chrome once rollback confidence expires) is recorded
  for the UX-F foundation lane in `docs/design/UXV1_PRODUCTION_CUTOVER_2026-08-08.md`.

## Shared entropy (belongs to no era, removed by UX-02)

- `apps/web/app/globals.css` imports **13 stylesheets** (14 `@import` lines incl. normalize +
  tailwind): `themes/index.css`, `vds.css`, `design-tokens.css`, `utilities.css`,
  `typography.css`, `tokens.css`, `vitalTokens.css`, `blueprint-overrides.css`, `matcha.css`,
  `matcha-zen.css`, `graph.css`, `intelligence.css`. (`antigravity.css` was unloaded from layout
  by W1083 and stays on disk as the era record; the glass-cursor stylesheet was DELETED outright
  in the same wave together with its no-op component — the W1083 merge commit is its park, per
  this document's own deleted-files convention. LINT-12 pins the shell's remaining set.)
- Competing token prefixes: `--vt-`, `--ag-`, `--palette-`, `--vital-`, `--gf-`, `--trust-`,
  `--infra-`, `--glue-`, `--ops-`, `--mz-`, and more.
- ~~A **global `*` transition rule** (~280ms on color properties)~~ — **removed by W1083**; its
  opt-out attribute had zero consumers by removal day. Motion is declared by the surface that
  owns it (EC-4).
- Two parallel component systems (`design-system/` vs `components/ui/`); a `Badge` import
  resolves differently by path; **≥30 status/badge components** express the same truth states.

**Removal note (2026-08-15).** The #1411 squash commit — the commit that
carries this note, findable with `git log --grep "#1411"` — deleted three
era-less dead motion components — RevealOnScroll and BackgroundField under components/motion,
plus ScrollReveal under components/ui (deliberately written without path
syntax: the files no longer exist, and the citability guard is right to reject
a dead path; the unrelated BackgroundField under components/ui stays). All
three had zero importers and belonged to no recorded era — generic
framer-motion wrappers born inside feature waves, the entropy class DG-5.6 /
DG-6.13 had already marked for consolidation or deletion. The removing commit
is their park. The same commit dropped two dead apps/web dependencies
(tailwindcss-animate — no Tailwind config or `@plugin` reference existed, so
it was never loaded — and react-countup, zero imports) and retired the deleted
files' stale glass-ratchet rows.

Two neighbours from the same zero-importer inventory were evaluated and
**kept** as Era 3 (Antigravity) residue under this register:
`apps/web/components/motion/ParticleLayer.tsx` (cursor-attraction ambient
particle system — the era row's "particle/magnetic interaction code") and
`apps/web/components/motion/FloatingCredentials.tsx` (self-declared Wave 230 /
Antigravity UI signature). Zero importers does not un-park an era artifact.

Two entries from the 2026-08-08 audit have since been corrected on mainline and are **not**
outstanding: `apps/web/app/fonts/` does exist (Geist, Geist Mono and Fraunces are self-hosted via
`next/font/local`), and `scripts/check-design-lint.ts` is on mainline behind the required
`check-design-lint` status check.

## Parked by amendment F (the founder's Homepage v4, 2026-08-16)

The **amendment E / E.1 Direction A homepage composition** — the drawn
six-figure paper page (`#FBFAF7` ground, hot `#D92800` action, Geist display,
no mono, the ThreePromises band, quick answers, cycling payoff word) — is
parked. It was rewritten in place inside the `easy` island (the same
precedent as E replacing D.7), so its recovery path is the git revert of the
amendment F squash commit rather than an env-switchable variant; the
`--vt-home-e-*` token family stays declared in `styles/themes/index.css` as
the historical record until nothing references it (scene-token-contract still
pins its values). Deleted with the recomposition, recoverable from history:
the WorkSurface, ThreePromises and CyclingWord components and the whole
figures directory beside them (MatchExplanationFigure, FigureMarkers) — all
formerly under the easy home island, and named here **without path syntax on
purpose**: the files no longer exist, and the citability guard is right to
reject a dead path (the same convention the 2026-08-15 removal note above
uses). Recover them from the amendment F squash commit. The E rows in the
constitution carry dated
`SUPERSEDED by F` markers; nothing here was silently forked.

## What "unparking" would take

A parked treatment returns only via a constitution amendment (dated rationale, founder-approved)
— the same bar as any other visual law change. There is no other path.
