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
| Ambient scene (grain + cursor) | `GrainOverlay` + `SceneCursor` via `SceneProvider` | — (no render loop) | Grain is a baked SVG texture; always present | Keep flat paper reading as paper — never carries meaning. **Colour field RETIRED (2026-07-21)**: `AmbientField` + `.scene-ambient-poster` painted emerald 12% / indigo 10% radial gradients on a `position: fixed` layer, so the tint stayed welded to the viewport while content scrolled past it. The page paper is a deliberate, uniform Cloud Dancer (`#F0EEE9`, measured identical at every scroll offset); a fixed coloured veil was the one thing able to make it look inconsistent. Atmosphere is earned by content motion now, not by tinting the page. |
| Chapter progress driver | `scene/ChapterProgress` (+ rail `publishExternal` bridge) | THE single scroll model; the rail publishes while pinned | Static first-chapter state | Feeds the ambient scene in both modes (one driver, W2 executed) |
| In-page navigation | `HorizontalStoryRail` chapter navigator (`data-story-rail-nav`) | The rail driver (pinned mode only) | Never renders in vertical fallback — DOM order navigates | THE one page-level navigator (W2.3 executed; dot rail retired) |

## Sections, in DOM order

| # | Section | Owner component | Data source | Motion owner | Fallback | Conversion job | Disposition |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Hero — "Get hired faster." + NPI action | `HomePageClient` (hero block) + `CareerEvidenceField` / `LiveNpiResult` | Static copy; live NPI lookup (`checkNpi` → trust-state) | None on copy (W1.1 contract: no scroll-scrubbed copy); field animates via scene tiers | SSR static poster + full form pre-hydration | THE primary conversion: NPI → readiness | **Keep — single-purpose (2026-07-21)**: the NPI control is the ONLY interactive element in the first screen. The wallet pill and employer link moved to row 13; the stage is sized to its content so row 3 crests the fold. |
| 2 | ~~Career-loop pill strip~~ | ~~`HeroLoopPills`~~ | — | — | — | — | **RETIRED (W2.3 executed)** — the rail's chapters carry the journey |
| 3 | Source signal strip | `SourceCoverageRibbon` | Real lane states | Own marquee (pauseable, reduced-motion-safe) | Static list | Establish what VitalCV can actually read | **Keep** |
| 4 | ~~Problem numbers~~ | ~~`ProblemStatBand`~~ | — | — | — | — | **RETIRED (2026-07-21 rebuild)** — "Healthcare hiring has a trust-liquidity problem" ran ~610px immediately above row 6, which made the same argument with a sharper line and an actual comparison visual. Two H2s and ~1,000px for one argument. Component retained on disk. |
| 5 | ~~Form→system manifesto~~ | ~~`ScrollFocusManifesto`~~ | — | — | — | — | **RETIRED (W2 executed)** — reframe carried by ResumeToProof + chapter copy |
| 6 | Interview-to-start velocity | `TimeToStartComparison` | Industry benchmark + live coverage facts | IO-triggered bar + segments | SSR final state | Benchmark the queue honestly | **Keep** (NUM-1.4 shipped; W3.1 registry pending) |
| 7 | Career journey (4 chapters) | `RailJourney` → `HorizontalStoryRail` + `JourneyCard` (`components/home/journey.ts` data) | Shared journey model | The rail driver (native scroll → translate + rolodex leaf poses) | Identical chapters in vertical DOM order (SSR/mobile/coarse/reduced-motion/no-JS) | Explain how a clinician gets hired faster | **MERGED (W2.1/W2.2 executed)** — `StickyProductStory` deleted, one scroll model |
| 8 | Proof moment | `HomeProofMoment` → `ProofPacketInspector` | Illustrative proof grammar (labeled) | Reveal on entry | SSR-complete (default claim) | THE tangible proof moment: claim → source → receipt → state → limitation | **MOUNTED (W4.2 executed)** — interactive, keyboard, links `/onboarding` |
| 8b | ~~Evidence truth panel~~ | ~~`EvidenceTruthPanel`~~ | — | — | — | — | **RETIRED (2026-07-21 rebuild)** — "Every claim shows its source" (~811px) sat directly below row 8 making the same argument again; row 8 wins the slot because it is the interactive one. **The limitation it owned did NOT retire with it**: the enumerated "not a completed credentialing, privileging, or employer clearance decision" was extracted to `TruthBoundary` (row 8c) before removal, because a redundant argument does not make its disclaimers redundant guarantees. |
| 8c | Truth boundary | `TruthBoundary` | Static, enumerated | Reveal (delay 90) | SSR-complete text | What VitalCV knows — and the explicit limits | **MOUNTED (2026-07-21 rebuild)** — extracted from row 8b; `EvidenceTruthPanel` renders the same component so the two cannot drift. Guarded by `home-npi-role-doors` ("keeps the explicit limits even though the panel that owned them is gone"). |
| 9 | ~~Reusable-evidence word cycler~~ | ~~`RotatingProofLine`~~ | — | — | — | — | **RETIRED (W2 executed)** — failed the W9.1 category test |
| 10 | ~~Product carousel~~ | ~~`ProductCarousel`~~ | — | — | — | — | **RETIRED (2026-07-21 rebuild)** — "One career record. Six reusable surfaces." was the third pass at "look what the record can do" after row 7 had walked the same ground in four chapters, and a six-panel feature carousel is a product-tour device on a page that should make one argument. Component retained on disk **with its tests**: the evidence-state glyph grammar (a check glyph only on source-backed/checked rows, never on gated/review rows) is a real truth contract, and `homepage-truth-pass.test.tsx` renders `ProductCarousel` directly to guard it — unaffected by the section leaving the page. |
| 11 | ~~Résumé→proof comparison~~ | ~~`ResumeToProof`~~ | — | — | — | — | **RETIRED (2026-07-21)** — 25 words and 200px restating the old-way/new-way contrast the rail's four chapters already carry. No test, spec, or copy-source depended on it. Component retained on disk; this is a composition change, not a deletion of the idea. |
| 12 | Metrics strip | `MetricStrip` | Live capability counts via `EvidenceMetric` | AnimatedMetricValue (once, IO) | SSR final text | Prove what is real today | **Keep** (W3.1 registry pending) |
| 13 | Dual-audience CTA | `DualAudienceCta` | Static routes | Reveal on entry | Static | Route clinician + employer to real product | **Keep — now the only employer entrance in the page body (2026-07-21)**: SHD-2.2's hero employer link moved here with its `data-home-employer-cta` hook and funnel event; the site header still carries "For Employers". |
| 14 | Trust footer | `HomePageClient` footer nav | Static routes | None | Static | Trust surface deep links | **Keep** |

## The 2026-07-21 rebuild

Founder direction: the page was too long, too repetitive, and its centrepiece
did nothing. Three decisions, then the cuts above.

1. **One Cloud Dancer surface.** The tokens were never wrong — `.mz-cloud-paper`
   already resolved `--vt-bg: #F0EEE9` / `--vt-surface: #FBFAF6`, and the
   painted page measured `rgb(240,238,233)` at all 11 sampled scroll offsets.
   The fixed ambient colour layer was the whole problem (page-level systems
   table, row 1).
2. **The hero graph builds from the NPI.** `CareerEvidenceField` went from a
   616-line canvas stack drawing a seeded particle scatter to a structured SVG
   graph — four named public lanes → one record you own → what it unlocks —
   where every node is a focusable button that explains itself, and entering an
   NPI resolves the lanes for real instead of swapping the graph out for a card.
   Canvas was also unverifiable; SVG nodes are assertable in vitest.
3. **Each argument exactly once.** Rows 4, 8b and 10 retired. Page height
   8,872px → 5,451px (9.9 → 6.1 viewports) with no information removed — only
   restatements. `home-npi-role-doors` now pins the shape ("one H2 per section",
   no duplicate headings) so the redundancy cannot regrow.

Rail gearing: `dwellVh` 1 → 0.5. The rail was never broken — progress ran 0 → 1
and the track translated 0 → -300vw — but four chapters at a full viewport of
dwell each demanded 3,600px of pinned scrolling (44% of the page) to produce
barely-perceptible movement, which reads as "stuck", not as motion. Runway
3,600px → 2,250px, same choreography.

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
