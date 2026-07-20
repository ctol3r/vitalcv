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
| Chapter progress driver | `scene/ChapterProgress` | THE single scroll model (one listener) | Static first-chapter state | Feeds dot rail + scene handoff today; feeds the horizontal rail after W2 |
| In-page navigation | `HomepageSectionRail` (right-edge dot rail) | Chapter driver (consumer) | Hidden < 1024px / reduced motion; header + DOM order remain complete | Jump-to-section on desktop |

## Sections, in DOM order

| # | Section | Owner component | Data source | Motion owner | Fallback | Conversion job | Disposition |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Hero — "Get hired faster." + NPI action | `HomePageClient` (hero block) + `CareerEvidenceField` / `LiveNpiResult` | Static copy; live NPI lookup (`checkNpi` → trust-state) | None on copy (W1.1 contract: no scroll-scrubbed copy); field animates via scene tiers | SSR static poster + full form pre-hydration | THE primary conversion: NPI → readiness | **Keep** |
| 2 | Career-loop pill strip | `HeroLoopPills` | Static | CSS only | Static | Preview the journey steps | **Retire at W2** — duplicates the rail's chapters (W2.3) |
| 3 | Source signal strip | `SourceCoverageRibbon` | Real lane states | Own marquee (pauseable, reduced-motion-safe) | Static list | Establish what VitalCV can actually read | **Keep** |
| 4 | Problem numbers | `ProblemStatBand` | Cited industry figures via `EvidenceMetric` | AnimatedMetricValue (once, IO) | SSR final text | Make the cost of delay tangible | **Keep** (W3.1 registry pending) |
| 5 | Form→system manifesto | `ScrollFocusManifesto` | Static copy | Own scroll-focus reader | Static prose (reduced motion) | Reframe résumé→system | **Retire at W2** — not in target composition; its message moves into chapter copy |
| 6 | Interview-to-start velocity | `TimeToStartComparison` | Industry benchmark + live coverage facts | IO-triggered bar + segments | SSR final state | Benchmark the queue honestly | **Keep** (NUM-1.4 shipped; W3.1 registry pending) |
| 7 | Product story (5 steps) | `StickyProductStory` | `STEPS` data | Own vertical sticky `useScroll` runway | Mobile snap stack; reduced-motion static stack | Explain how hiring moves | **Merge at W2** — becomes the Rolodex layer INSIDE `HorizontalStoryRail`; its private runway is deleted (one scroll model) |
| 8 | Evidence truth panel | `EvidenceTruthPanel` | Illustrative product UI (labeled) | Reveal on entry | Static | Show the evidence trace | **Merge at W4.2** — feeds the proof-packet moment (`ProofPacketInspector`) |
| 9 | Reusable-evidence word cycler | `RotatingProofLine` | Static words | Own CSS cycle | Static honest sentence | Decorative reinforcement | **Retire at W2** — fails the W9.1 category test (not outcome-critical, not comprehension-supporting once the rail lands) |
| 10 | Product carousel | `ProductCarousel` | Illustrative product UI | Own belt (pause control) | Reduced-motion grid | Product surface tour | **Merge at W2** — card faces become rail-chapter content; the standalone belt retires |
| 11 | Résumé→proof comparison | `ResumeToProof` | Static | Reveal on entry | Static | Contrast old vs new way | **Merge at W2** — content for the "Apply with proof" chapter |
| 12 | Metrics strip | `MetricStrip` | Live capability counts via `EvidenceMetric` | AnimatedMetricValue (once, IO) | SSR final text | Prove what is real today | **Keep** (W3.1 registry pending) |
| 13 | Dual-audience CTA | `DualAudienceCta` | Static routes | Reveal on entry | Static | Route clinician + employer to real product | **Keep** |
| 14 | Trust footer | `HomePageClient` footer nav | Static routes | None | Static | Trust surface deep links | **Keep** |

## The W2 target (four chapters, one rail)

`HorizontalStoryRail` (built, dev-harness `/dev/story-rail`) mounts with exactly
four chapters — **See what is ready · Find roles that fit · Apply with proof ·
Start faster** — replacing rows 2, 5, 7, 9 and absorbing 10–11. The dot rail
(row: page-level nav) retires or hides while the rail owns chapter state
(W2.3). The composition gate test forces that trade: mounting a second
page-level navigator without retiring the first fails CI.

## Change protocol

Adding, removing, or re-ordering a section requires updating THIS manifest and
the composition-gate test in the same PR. A PR that changes homepage
composition without touching this file is incomplete by definition.
