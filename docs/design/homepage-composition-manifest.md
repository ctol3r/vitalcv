# Homepage composition manifest

**Established:** 2026-07-20 (deep-audit W0.2) · **Baseline commit:** `bb67cb013`
**Rule:** every live homepage section has exactly one owner component, one motion
owner, a declared fallback, and a conversion job. A section that cannot name its
conversion job does not ship. No more than **one page-level in-page navigation
rail** may render at a time — enforced by
`apps/web/__tests__/homepage-composition-gate.test.tsx`.

The target composition is a normal vertical page. Product explanation must not
pin scrolling, rotate through panels, or require a carousel control.

## Page-level systems (not sections)

| System | Owner | Motion owner | Fallback | Job |
| --- | --- | --- | --- | --- |
| Ambient scene (grain + cursor) | `GrainOverlay` + `SceneCursor` via `SceneProvider` | — (no render loop) | Grain is a baked SVG texture; always present | Keep flat paper reading as paper — never carries meaning. **Colour field RETIRED (2026-07-21)**: `AmbientField` + `.scene-ambient-poster` painted emerald 12% / indigo 10% radial gradients on a `position: fixed` layer, so the tint stayed welded to the viewport while content scrolled past it. The page paper is a deliberate, uniform Cloud Dancer (`#F0EEE9`, measured identical at every scroll offset); a fixed coloured veil was the one thing able to make it look inconsistent. Atmosphere is earned by content motion now, not by tinting the page. |
| Chapter progress driver | `scene/ChapterProgress` | Section observation only | Static first-chapter state | Feeds the ambient scene without taking over document scrolling |
| In-page navigation | None | — | DOM order and chapter anchors | No page-level carousel or chapter navigator |

## Sections, in DOM order

| # | Section | Owner component | Data source | Motion owner | Fallback | Conversion job | Disposition |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Hero — "Get hired faster." + NPI action | `HomePageClient` (hero block) + `LiveNpiResult` | Static copy; live NPI lookup (`checkNpi` → trust-state) | None on copy (W1.1 contract: no scroll-scrubbed copy) | SSR-complete form pre-hydration; result renders only after lookup | THE primary conversion: NPI → readiness | **Keep — single-purpose (2026-07-23)**: the NPI control is the ONLY interactive element in the first screen. The wallet pill and employer link moved to row 13; public source state is named in row 3, and the hero never presents a node/edge graph before a real lookup. |
| 2 | ~~Career-loop pill strip~~ | ~~`HeroLoopPills`~~ | — | — | — | — | **RETIRED (W2.3 executed)** — the journey chapters carry the story |
| 3 | Source signal strip | `SourceCoverageRibbon` | Real lane states | Own marquee (pauseable, reduced-motion-safe) | Static list | Establish what VitalCV can actually read | **Keep** |
| 4 | ~~Problem numbers~~ | ~~`ProblemStatBand`~~ | — | — | — | — | **RETIRED (2026-07-21 rebuild)** — "Healthcare hiring has a trust-liquidity problem" ran ~610px immediately above row 6, which made the same argument with a sharper line and an actual comparison visual. Two H2s and ~1,000px for one argument. Component retained on disk. |
| 5 | ~~Form→system manifesto~~ | ~~`ScrollFocusManifesto`~~ | — | — | — | — | **RETIRED (W2 executed)** — reframe carried by ResumeToProof + chapter copy |
| 6 | Interview-to-start velocity | `TimeToStartComparison` | Industry benchmark + live coverage facts | IO-triggered bar + segments | SSR final state | Benchmark the queue honestly | **Keep** (NUM-1.4 shipped; W3.1 registry pending) |
| 7 | Career journey (4 chapters) | `RailJourney` + `JourneyCard` (`components/home/journey.ts` data) | Shared journey model | None | Same static two-column/one-column grid at every viewport | Explain how a clinician gets hired faster | **KEEP — carousel removed (2026-07-23)**. The four steps remain visible and linkable in ordinary document flow. |
| 8 | Proof moment | `HomeProofMoment` → `ProofPacketInspector` | Illustrative proof grammar (labeled) | Reveal on entry | SSR-complete (default claim) | THE tangible proof moment: claim → source → receipt → state → limitation | **MOUNTED (W4.2 executed)** — interactive, keyboard, links `/onboarding` |
| 8b | ~~Evidence truth panel~~ | ~~`EvidenceTruthPanel`~~ | — | — | — | — | **RETIRED (2026-07-21 rebuild)** — "Every claim shows its source" (~811px) sat directly below row 8 making the same argument again; row 8 wins the slot because it is the interactive one. **The limitation it owned did NOT retire with it**: the enumerated "not a completed credentialing, privileging, or employer clearance decision" was extracted to `TruthBoundary` (row 8c) before removal, because a redundant argument does not make its disclaimers redundant guarantees. |
| 8c | Truth boundary | `TruthBoundary` | Static, enumerated | Reveal (delay 90) | SSR-complete text | What VitalCV knows — and the explicit limits | **MOUNTED (2026-07-21 rebuild)** — extracted from row 8b; `EvidenceTruthPanel` renders the same component so the two cannot drift. Guarded by `homepage-truth-contract` ("names the institution as the final step"), which renders the ROUTE — so the guard follows `/` through a composition change instead of orphaning on the retired one. |
| 8d | ~~Career constellation~~ | ~~`w1501/Sky` (`SkySection`)~~ | — | — | — | — | **RETIRED FROM `/` (2026-07-23)** — this fixed, non-NPI-bound arc is not a clinician record and violates the public-homepage composition rule against nodes, links, and constellations. It remains available only in the isolated Wave 1501 design reference; the acquisition page retains the real, post-lookup `CareerEvidenceField`. |
| 9 | ~~Reusable-evidence word cycler~~ | ~~`RotatingProofLine`~~ | — | — | — | — | **RETIRED (W2 executed)** — failed the W9.1 category test |
| 10 | ~~Product carousel~~ | ~~`ProductCarousel`~~ | — | — | — | — | **RETIRED (2026-07-21 rebuild)** — "One career record. Six reusable surfaces." was the third pass at "look what the record can do" after row 7 had walked the same ground in four chapters, and a six-panel feature carousel is a product-tour device on a page that should make one argument. Component retained on disk **with its tests**: the evidence-state glyph grammar (a check glyph only on source-backed/checked rows, never on gated/review rows) is a real truth contract, and `homepage-truth-pass.test.tsx` renders `ProductCarousel` directly to guard it — unaffected by the section leaving the page. |
| 11 | ~~Résumé→proof comparison~~ | ~~`ResumeToProof`~~ | — | — | — | — | **RETIRED (2026-07-21)** — 25 words and 200px restating the old-way/new-way contrast the journey's four chapters already carry. No test, spec, or copy-source depended on it. Component retained on disk; this is a composition change, not a deletion of the idea. |
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
2. **The hero starts with the NPI.** The hero names no public career graph,
   nodes, or links before a lookup. `LiveNpiResult` renders source-specific
   state only after a clinician enters a valid NPI, while the source signal
   strip names the available lanes in the regular document flow.
3. **Each argument exactly once.** Rows 4, 8b and 10 retired. Page height
   8,872px → 5,451px (9.9 → 6.1 viewports) with no information removed — only
   restatements. This applied to the retired vertical composition; the H2-cap
   guard that pinned it retired with it, and the film's shape is now pinned
   end-to-end by `tests/e2e/film-composition.spec.ts`. The surviving vitest
   guard, `homepage-truth-contract`, keeps only the claim/disclosure rules —
   deliberately, because those are properties of `/` rather than of any one
   composition, and pointing them at the route is what stops them orphaning.

The prior rail gearing is historical only. It was removed from the live
composition because the interaction still read as a carousel and interrupted
ordinary scrolling, even after its runway was shortened.

## The W2 composition (EXECUTED 2026-07-20)

The prior W2 rail is historical. The live `RailJourney` retains exactly four
chapters — **See what is ready · Find roles that fit · Apply with proof · Start
faster** — but renders them in a visible grid. The composition gate prohibits
page-level in-page navigation rails and the journey tests prohibit mounting the
retired carousel markers.

## The eyebrow wave (2026-08-07): "How VitalCV works" added to the career loop

Founder directive, same wave as the header's full-width eyebrow restyle. The
live career-loop composition gains one section between the opening scene and
`01 · CREATE`:

| Section | Owner component | Data source | Motion owner | Fallback | Conversion job |
| --- | --- | --- | --- | --- | --- |
| How VitalCV works | `components/home/career-loop/HowItWorks` | `JOURNEY_STAGES` (labels + descriptions) and `SOURCE_LANE_OPS` (lane cadence) — derived, never restated | Single-shot activation walk (IntersectionObserver, CSS transitions only); stage heads lightly interactive after it | SSR-complete: all four vignettes render resolved; reduced motion and no-JS skip the walk and see everything | Let a visitor understand NPI → Sources → Permission → Review **without** entering an NPI or loading the illustrative example — removing the "what happens if I type here?" hesitation ahead of THE primary conversion |

Composition rules honored: all four stages are visible at once — activation
moves emphasis, it never rotates panels or hides a column (no carousel, no
page-level in-page navigation rail; the stage heads are emphasis controls
inside the section, not page navigation). The section declares
`data-header-stage="your-number"` / `data-header-theme="light"`, and its
`id="how-it-works"` deliberately does NOT reuse a journey anchor id — the
header rail's four anchors still land exactly once each
(`home-how-it-works.test.tsx` pins this, along with the derived vocabulary,
the complete server render, and the no-ten-digit-number rule).

## Change protocol

Adding, removing, or re-ordering a section requires updating THIS manifest and
the composition-gate test in the same PR. A PR that changes homepage
composition without touching this file is incomplete by definition.
