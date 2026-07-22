# Homepage composition ownership record

**Established:** 2026-07-21 (COMPETE-0) · **Baseline commit:** `47d94070a`
**Authority:** [`docs/strategy/competitive-mandate.md`](../strategy/competitive-mandate.md)
**Status:** the single record of *who owns homepage motion*. Supersedes the
"target composition" of [`homepage-composition-manifest.md`](./homepage-composition-manifest.md),
which described a vertical page with one desktop horizontal rail. That target is
retired; the manifest remains valid as the **history** of how each section got
to its current disposition.

Required by COMPETE-0: *"Before new homepage work, create one written
'composition ownership' record that states the chosen engine, the only scroll
driver, the fallback order, and the components being retired."*

---

## 1. The chosen engine

**Decision: one in-repo scroll-progress engine (single passive scroll listener →
single `requestAnimationFrame` → one composited transform). No GSAP,
no ScrollTrigger, no Lenis, no new motion dependency.**

Framer Motion (`^12.34.3`, already present) stays for **discrete, local**
animation only — `Reveal`, enter transitions, layout springs. It is explicitly
**not** a scroll owner on this page.

### Why not GSAP / ScrollTrigger

GSAP is the conventional answer for a pinned horizontal film and was a live
option under the mandate ("only if it becomes the one owner"). It was not chosen:

| Factor | In-repo engine | GSAP + ScrollTrigger |
| --- | --- | --- |
| New dependency | None | ~70 kB on the most performance-sensitive public page |
| Prior art in this repo | `HorizontalStoryRail` already does native-scroll → rAF → translate, with a tested pin/unpin bridge (`scene/ChapterProgress`, `scene/progress.ts`) | None; a second paradigm beside Framer Motion |
| Fallback ladder | Hand-owned, so static / Canvas 2D / reduced-motion / no-JS are explicit branches we control | ScrollTrigger's pinning mutates the DOM (wrapper insertion, spacer sizing), which fights SSR-complete fallbacks |
| Conflict with the 2026-07-21 deep-audit doc | None | That doc explicitly forbids "GSAP ScrollTrigger added beside the existing rail driver" |
| Risk | Hand-rolled scrubbing can jank | Mature, but owns pin geometry we then cannot cheaply override |

The mandate asks COMPETE-1 to **recompose** existing capability rather than "add
another layer on top". The repo has already solved scroll-driven horizontal
translation once; the work is to replace what it *renders*, not the mechanism
that drives it.

**Jank mitigation (binding on COMPETE-1):** one `passive: true` scroll listener;
one rAF tick; progress written to a single `transform: translate3d()` on one
composited stage element; every other consumer *reads* progress from context and
must not attach its own listener.

---

## 2. The only scroll driver

```
window scroll (passive, 1 listener)
        │
        ▼
  filmProgress()            ← single rAF tick, clamps + eases
        │
        ├─► stage transform  (translate3d on ONE composited element)
        ├─► scene registry   (accent, grain, scrim, wake per scene)
        ├─► kinetic type     (reads progress; never listens)
        ├─► product artifact (reads progress; never listens)
        └─► a11y state       (aria-current scene, focus targets)
```

**Rules, enforced by the composition gate test:**

1. Exactly **one** page-level scroll listener may exist on `/`.
2. Exactly **one** rAF loop may drive page-level progress.
3. No component below the stage may attach `scroll`, `wheel`, or a page-level
   `IntersectionObserver` for *progression*. (Local `IntersectionObserver` for a
   one-shot `Reveal` is permitted — it is not a progression driver.)
4. Vertical axis is never hijacked. Wheel and trackpad behave normally; the
   film advances because ordinary vertical scroll is *translated*, not captured.
5. No nested scroller may trap the user.

---

## 3. Fallback order

Each tier must be **independently complete**. A scene may enrich meaning; it may
never carry required meaning. Falling back must read as deliberately composed —
never as an empty hole.

| Tier | Condition | Behavior |
| --- | --- | --- |
| 1 — Film | Desktop, fine pointer, ≥ pin threshold, JS + motion allowed | Pinned horizontal film; WebGPU atmosphere if available |
| 2 — Film, Canvas 2D | As tier 1, WebGPU unavailable or context lost | Identical composition; Canvas 2D atmosphere |
| 3 — Film, static atmosphere | As tier 1, no canvas at all | Identical composition; static poster atmosphere |
| 4 — Vertical | Mobile, coarse pointer, narrow viewport, or below pin threshold | Ordinary vertical document; same scenes in DOM order |
| 5 — Reduced motion | `prefers-reduced-motion: reduce` | Tier 4 composition, no scrub, no parallax, no cursor effect |
| 6 — No JS | Hydration never runs | Tier 4 markup, SSR-complete, fully readable and navigable |

**Invariant:** tiers 4–6 render the *same semantic DOM in the same order* as
tier 1. The film is a transform applied to a linear document, not a different
document.

---

## 4. Component inventory

Current `/` stack at `47d94070a` (`apps/web/app/HomePageClient.tsx`),
classified against the six-scene film.

**Legend** — **Preserve**: moves into the film essentially as-is. **Recompose**:
capability is right, presentation must be rebuilt as a scene event.
**Move**: belongs on another route. **Retire**: leaves the homepage; component
may stay on disk if tests depend on it.

### Page-level systems

| Component | Disposition | Target scene | Note |
| --- | --- | --- | --- |
| `SceneProvider` | **Preserve** | all | Already the scene-state root |
| `scene/registry.ts` | **Recompose** | all | Rekey from 6 chapter ids to the 6 **film scenes**. It is data, not behavior — the right shape already |
| `scene/ChapterProgress` | **Recompose** | all | Becomes `filmProgress` — the one driver (§2). Its pin/unpin bridge is the pattern to keep |
| `scene/progress.ts` | **Preserve** | all | Progress math is reusable |
| `scene/GrainOverlay` | **Preserve** | all | Baked SVG texture; what keeps flat Cloud Dancer reading as paper |
| `scene/SceneCursor` | **Recompose** | all | Must become the mandate's "meaningful cursor/overlay", not a decorative dot |
| `scene/AmbientField` | **Retire** | — | Already retired from the composition 2026-07-21 (fixed coloured veil welded to viewport) |
| `scene/MagneticButton`, `scene/SceneBoundary`, `scene/capabilities.ts` | **Preserve** | — | Capability detection feeds the fallback ladder (§3) |

### Sections

| Component | Disposition | Target scene | Reason |
| --- | --- | --- | --- |
| Hero block (in `HomePageClient`) | **Recompose** | Arrival | Copy and NPI action are correct. The boxed form must become a designed object *inside* the scene, not a form beside a visual |
| `CareerEvidenceField` | **Recompose** | Arrival → Recognition | **The most valuable asset on the page.** Already abstract (no nodes/people), already tiered static/Canvas 2D/WebGPU. Must become the scene atmosphere spanning two scenes rather than a panel |
| `LiveNpiResult` | **Preserve** | Recognition | Real returned state. This is the whole first-proof promise (COMPETE-3) |
| `SourceCoverageRibbon` | **Recompose** | Recognition | Real lane state is right; a marquee strip is a widget. Becomes source light / receipt fragments in the atmosphere |
| `TimeToStartComparison` | **Recompose** | Momentum | Keep only if its numbers are real and scoped. Its bar-chart presentation is close to R4 metric theatre |
| `RailJourney` | **RETIRE** | — | R2 horizontal Rolodex. Its **chapter sequencing** is the input to the six scenes; the wide-card interaction is retired |
| `rail/HorizontalStoryRail` | **RETIRE** (harvest) | — | R2. Its *driver* is the prior art for §2. Harvest the mechanism, delete the card presentation |
| `rail/JourneyCard`, `rail/geometry.ts` | **RETIRE** | — | R2 Rolodex leaf poses |
| `home/journey.ts` | **Preserve** | all | The journey data model — becomes scene copy |
| `HomeProofMoment` (`ProofPacketInspector`) | **Preserve** | Start | Exactly the mandate's "proof is a close-up": claim → source → receipt → state → limitation |
| `TruthBoundary` | **Preserve** | Start | The page's only enumerated "this is not a credentialing decision" statement. **Non-negotiable — it does not leave** |
| `MetricStrip` | **Recompose** | Choice | Must be audited against R4. Real capability counts may stay; anything reading as a counter goes |
| `DualAudienceCta` | **Preserve** | Choice | Clinician primary / employer secondary, context-preserving |
| Trust footer nav | **Preserve** | Choice | Static deep links |
| `EvidenceTruthPanel` | Already retired | — | On disk; renders `TruthBoundary` so the two cannot drift |
| `ProductCarousel` | Already retired | — | R2/R3. **Stays on disk with its tests** — `homepage-truth-pass.test.tsx` renders it directly to guard the evidence-state glyph grammar |
| `ProblemStatBand`, `ResumeToProof`, `FormSystemsDiagram`, `OutcomeTriad`, `SocialProofSection`, `WhatWeCheckSection`, `WorkflowStoryTabs`, `PublicTruthSections`, `ForEmployersSection`, `StoryIcon` | Already retired / not mounted | — | On disk, not in the `/` composition |

### Retired in this wave

`RailJourney`, `HorizontalStoryRail`, `JourneyCard`, `rail/geometry.ts` —
retired from the `/` composition under R2. **They remain on disk until COMPETE-1
lands the film**, because deleting the only working scroll-driver prior art
before its replacement exists would be a regression, not a cleanup.

---

## 5. Open conflicts requiring founder sign-off

Logged per COMPETE-0. Each is a place where the competitive mandate reverses a
previously-signed direction, or where the controlling document is missing.

| # | Conflict | Prior position | Mandate position | Status |
| --- | --- | --- | --- | --- |
| C1 | **The controlling design authority is missing.** `VitalCV_Whole_Horizontal_Rebuild_Directive_2026-07-21.md` is named as controlling the homepage design but is not present in the repo, Dropbox, or Drive | — | Mandate is being treated as controlling; its restated guardrails and six scenes are the working contract | **Founder decision 2026-07-21: proceed on the competitive mandate.** Re-verify if the directive surfaces |
| C2 | **Horizontal Rolodex** | `VitalCV_Deep_Audit_Design_Direction_and_Master_Waves_2026-07-21.md` (15:39): *"Do not replace `HorizontalStoryRail`; audit and tune the shipped implementation"* | R2 — retired from the homepage | **Resolved to the mandate.** The rail is retired from `/` |
| C3 | **Full-page horizontal scrolling** | Same doc lists it under "Do not add or restore" | Required — the whole desktop homepage is one horizontal film | **Resolved to the mandate.** Direct reversal |
| C4 | **GSAP** | Same doc: *"GSAP ScrollTrigger added beside the existing rail driver"* is forbidden | Permitted only as the sole owner | **Moot** — §1 chose the in-repo engine, satisfying both documents |
| C5 | **`TimeToStartComparison` and `MetricStrip`** | Kept as honest, live-data sections | R4 bans metric theatre | **Needs founder review.** Both use real data; the question is whether their *presentation* reads as a counter |

---

## 6. Review checklist

A homepage PR is rejected if any answer is "no":

- [ ] Exactly one page-level scroll listener and one rAF progression loop?
- [ ] Semantic DOM order identical across all six fallback tiers?
- [ ] No nodes, links, people, constellation, or physics controls (R1)?
- [ ] No wide card queue, carousel, or chapter cards (R2, R3)?
- [ ] No counter, `01`–`06` step numbers, percentage ring, or unaudited velocity claim (R4)?
- [ ] Exactly zero or one page-level in-page navigator (R5)?
- [ ] One short editorial phrase per scene; no section taxonomy headers (R6)?
- [ ] Nothing personal, fabricated, or clinician-specific rendered before a real NPI lookup returns?
- [ ] `TruthBoundary` still mounted?
- [ ] `scripts/check-public-claims.ts` green?
