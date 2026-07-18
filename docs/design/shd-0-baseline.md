# SHD-0.1 — Homepage baseline: production vs. current `origin/main`

**Date:** 2026-07-18
**Base SHA:** `d1005e3c42c709b8af6f776762d32d0edf62b73a` (fresh worktree from `origin/main`)
**Package manager / commands:** pnpm + turbo. Canonical web build/type gate: `pnpm turbo run build --filter @vitalcv/web`. Unit: `pnpm --filter @vitalcv/web exec vitest run __tests__/<file>`. E2E: `pnpm --filter @vitalcv/web exec playwright test tests/e2e/<spec>`.

## Entry points

| Surface | File |
|---|---|
| Homepage server entry | `apps/web/app/page.tsx` |
| Homepage client composition | `apps/web/app/HomePageClient.tsx` |
| Global header | `apps/web/components/layout/Navbar.tsx` |
| Section navigator (dot rail) | `apps/web/components/home/HomepageSectionRail.tsx` |
| Hero visual | `apps/web/components/home/CareerEvidenceField.tsx` |
| Motion CSS | `apps/web/styles/homepage-motion.css`; visual system `apps/web/styles/matcha-zen.css` |
| Analytics init | `apps/web/app/providers.tsx` (PostHog; empty-token init fixed in #767) |

## Production vs. current main: NO drift

Screenshots in `shd-0-baseline/` (`prod-*` vs `local-main-*`, captured 2026-07-18 at 1440/1280/1024/768/390 + full-page 1280): production and `origin/main` render identically. Today's merges (#765 outline-panel removal, #767 PostHog guard, #768 AA contrast) are already deployed.

## Current homepage effect inventory → disposition for the Shader build

Dispositions: `replace` (superseded by scene system), `absorb` (content survives inside a scene chapter), `keep isolated` (unrelated to scene system), `remove`.

| # | Current effect / component | What it does today | Disposition |
|---|---|---|---|
| 1 | `CareerEvidenceField` (hero canvas) | 2D-canvas evidence field: atoms → wallet capsule, arcs, acceptance ring; parallax + bloom (#759) | **replace** — becomes the Graphene/WebGPU Career Evidence Field (SHD-2.1) with this canvas demoted to its non-GPU fallback tier |
| 2 | `ScrollTypeNarrative` (hero subhead scroll-scrub) | Scroll-scrubbed phrase highlight in hero subhead | **absorb** — chapter-progress model drives the same emphasis; no independent scroll listener survives |
| 3 | `HeroLoopPills` | Career-loop pill strip under hero | **absorb** — becomes chapter navigation/preview inside the rail (chapters ARE the loop) |
| 4 | `SourceCoverageRibbon` (#756) | Living source-coverage marquee, honest lane states | **absorb** — Evidence chapter surface; keep exact lane-state copy contract |
| 5 | `ProblemStatBand` | Industry-context stats with citations | **absorb** — Evidence/Opportunity chapter interstitial; citations preserved verbatim |
| 6 | `ScrollFocusManifesto` + `FormSystemsDiagram` | Scroll-focus prose + form/system diagram (#741) | **absorb** — Apply chapter ("form vs system" is the Apply story); scroll-focus effect replaced by chapter progress |
| 7 | `TimeToStartComparison` | Illustrative queue vs head-start framing | **absorb** — Start chapter; keep non-SLA/illustrative labels |
| 8 | `StickyProductStory` (rolodex) | rotateX card stack, adjacent cards faded | **replace** — becomes the real 3D `CareerRolodex` (SHD-3.2); do not keep both |
| 9 | `EvidenceTruthPanel` | Dark trace card: claim → source → receipt → limitation | **absorb** — this IS the interactive proof moment (SHD-4.2 seed) |
| 10 | `RotatingProofLine` (word cycler) | UIverse word-cycle marquee | **remove** — independent marquee; tasklist §SHD-1.3.7 explicitly bans surviving stray marquees |
| 11 | `ProductCarousel` | Product screen carousel | **absorb/replace** — content redistributes into Optimus-style chapter cards (SHD-4.1); carousel mechanic does not survive |
| 12 | `ResumeToProof` | Résumé → proof transformation narrative | **absorb** — Apply chapter |
| 13 | `MetricStrip` + `DualAudienceCta` | Closing metrics + two-sided CTA | **absorb** — Start/Reuse chapter conversion surface (SHD-4.1 contact-section analogue) |
| 14 | `HomepageSectionRail` (right-edge dot rail) | Sole page-level navigator (#765; focus ring, hidden on coarse/reduced-motion) | **keep isolated → becomes chapter navigator** — same component upgraded to drive/reflect rail chapter state (SHD-3.1.2) |
| 15 | `WhatWeCheckSection`, `PublicTruthSections`, trust footer | Truth/source honesty surfaces | **keep isolated** — trust/legal stays in normal vertical flow after the rail |
| 16 | Navbar (glass) | Global site nav | **keep isolated** — desktop stays conventional (SHD-5.1 adds Liquid mobile menu only) |
| 17 | `Reveal` / IO-based section reveals (various) | Per-section fade/slide reveals | **absorb** — replaced by the single chapter-progress model; no ad-hoc IO listeners for visuals |
| 18 | Homepage e2e motion contracts (`homepage-motion.spec.ts`, 22 tests incl. overlay guard) | Pin current behaviors | **keep** — update alongside each wave; overlay guard and copy guards must stay green |

No duplicate motion system may survive: items 2, 6, 8, 10, 11, 17 are the ones that would otherwise stack — each has an explicit replace/absorb owner above.

## Screenshot manifest

`docs/design/shd-0-baseline/{prod,local-main}-{1440,1280,1024,768,390}-hero.png`, plus `-1280-full.png` full-page pairs. Captured with Playwright Chromium, `networkidle` + 2.5s settle.
