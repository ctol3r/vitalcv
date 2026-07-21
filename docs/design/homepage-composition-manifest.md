# Homepage composition manifest

**Established:** 2026-07-20 (deep-audit W0.2) · **Baseline commit:** `bb67cb013`
**Rule:** every live homepage section has exactly one owner component, one motion
owner, a declared fallback, and a conversion job. A section that cannot name its
conversion job does not ship. No more than **one page-level in-page navigation
rail** may render at a time — enforced by
`apps/web/__tests__/homepage-composition-gate.test.tsx`.

The target composition (deep audit, "The target homepage composition") is a
normal vertical page with ONE desktop-only horizontal product-chapter rail.
Dispositions below encode the path from today's page to that target.

## Page-level systems (not sections)

| System | Owner | Motion owner | Fallback | Job |
| --- | --- | --- | --- | --- |
| Ambient scene (atmosphere + grain + cursor) | `scene/AmbientField` + `GrainOverlay` + `SceneCursor` via `SceneProvider`/`SceneBoundary` | Scene tier system (SHD-1.1) | `.scene-ambient-poster` static gradient; nothing mounts on `static` tier | Premium, calm presence — never carries meaning |
| Chapter progress driver | `scene/ChapterProgress` (+ rail `publishExternal` bridge) | THE single scroll model; the rail publishes while pinned | Static first-chapter state | Feeds the ambient scene in both modes (one driver, W2 executed) |
| In-page navigation | `HorizontalStoryRail` chapter navigator (`data-story-rail-nav`) | The rail driver (pinned mode only) | Never renders in vertical fallback — DOM order navigates | THE one page-level navigator (W2.3 executed; dot rail retired) |

## Sections, in DOM order

| # | Section | Owner component | Data source | Motion owner | Fallback | Conversion job | Disposition |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Hero — "Get hired faster." + NPI action | `HomePageClient` (hero block) + `CareerEvidenceField` / `LiveNpiResult` | Static copy; live NPI lookup (`checkNpi` → trust-state) | None on copy (W1.1 contract: no scroll-scrubbed copy); field animates via scene tiers | SSR static poster + full form pre-hydration | THE primary conversion: NPI → readiness | **Keep — single-purpose (2026-07-21)**: the NPI control is the ONLY interactive element in the first screen. The wallet pill and employer link moved to row 13; the stage is sized to its content so row 3 crests the fold. |
| 2 | ~~Career-loop pill strip~~ | ~~`HeroLoopPills`~~ | — | — | — | — | **RETIRED (W2.3 executed)** — the rail's chapters carry the journey |
| 3 | Source signal strip | `SourceCoverageRibbon` | Real lane states | Own marquee (pauseable, reduced-motion-safe) | Static list | Establish what VitalCV can actually read | **Keep** |
| 4 | Problem numbers | `ProblemStatBand` | Cited industry figures via `EvidenceMetric` | AnimatedMetricValue (once, IO) | SSR final text | Make the cost of delay tangible | **Keep** (W3.1 registry pending) |
| 5 | ~~Form→system manifesto~~ | ~~`ScrollFocusManifesto`~~ | — | — | — | — | **RETIRED (W2 executed)** — reframe carried by ResumeToProof + chapter copy |
| 6 | Interview-to-start velocity | `TimeToStartComparison` | Industry benchmark + live coverage facts | IO-triggered bar + segments | SSR final state | Benchmark the queue honestly | **Keep** (NUM-1.4 shipped; W3.1 registry pending) |
| 7 | Career journey (4 chapters) | `RailJourney` → `HorizontalStoryRail` + `JourneyCard` (`components/home/journey.ts` data) | Shared journey model | The rail driver (native scroll → translate + rolodex leaf poses) | Identical chapters in vertical DOM order (SSR/mobile/coarse/reduced-motion/no-JS) | Explain how a clinician gets hired faster | **MERGED (W2.1/W2.2 executed)** — `StickyProductStory` deleted, one scroll model |
| 8 | Proof moment | `HomeProofMoment` → `ProofPacketInspector` | Illustrative proof grammar (labeled) | Reveal on entry | SSR-complete (default claim) | THE tangible proof moment: claim → source → receipt → state → limitation | **MOUNTED (W4.2 executed)** — interactive, keyboard, links `/onboarding` |
| 8b | Evidence truth panel | `EvidenceTruthPanel` | Illustrative product UI (labeled) | Reveal (fade) | Static | The evidence-trace narrative + truth boundary | **Keep** — distinct from the inspector; also a `ResumeToProof` dependency and its own scrub-heading e2e |
| 9 | ~~Reusable-evidence word cycler~~ | ~~`RotatingProofLine`~~ | — | — | — | — | **RETIRED (W2 executed)** — failed the W9.1 category test |
| 10 | Product carousel | `ProductCarousel` | Illustrative product UI | Own belt (pause control) | Reduced-motion grid | Product surface tour | **Keep; merge at W4/W5** — candidates for the proof-moment recomposition |
| 11 | ~~Résumé→proof comparison~~ | ~~`ResumeToProof`~~ | — | — | — | — | **RETIRED (2026-07-21)** — 25 words and 200px restating the old-way/new-way contrast the rail's four chapters already carry. No test, spec, or copy-source depended on it. Component retained on disk; this is a composition change, not a deletion of the idea. |
| 12 | Metrics strip | `MetricStrip` | Live capability counts via `EvidenceMetric` | AnimatedMetricValue (once, IO) | SSR final text | Prove what is real today | **Keep** (W3.1 registry pending) |
| 13 | Dual-audience CTA | `DualAudienceCta` | Static routes | Reveal on entry | Static | Route clinician + employer to real product | **Keep — now the only employer entrance in the page body (2026-07-21)**: SHD-2.2's hero employer link moved here with its `data-home-employer-cta` hook and funnel event; the site header still carries "For Employers". |
| 14 | Trust footer | `HomePageClient` footer nav | Static routes | None | Static | Trust surface deep links | **Keep** |

## The W2 composition (EXECUTED 2026-07-20)

`RailJourney` mounts `HorizontalStoryRail` on the live homepage with exactly
four chapters — **See what is ready · Find roles that fit · Apply with proof ·
Start faster** — replacing rows 2, 5, 7, 9 and absorbing 10–11. The dot rail
(row: page-level nav) retires or hides while the rail owns chapter state
(W2.3). The composition gate test forces that trade: mounting a second
page-level navigator without retiring the first fails CI.

## Change protocol

Adding, removing, or re-ordering a section requires updating THIS manifest and
the composition-gate test in the same PR. A PR that changes homepage
composition without touching this file is incomplete by definition.
