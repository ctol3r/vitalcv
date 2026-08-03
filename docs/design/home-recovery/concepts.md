# R4 — Three recovery directions for founder review

All three concepts are built from the **same product truth** — the six-source
registry, the same copy, the same illustrative identity (K. Osei, PA-C, masked
NPI), the same CD-doctrine tokens and the three real self-hosted faces — so the
choice is a choice of **visual and interaction system**, not of product promise.

Mockups: `artifacts/home-recovery/concepts/concept-{a,b,c}.html` (static,
no-JS, real fonts, `data-motion` storyboard annotations on every moving
element). Captures: `concept-<x>-<frame>-{1440x900,390x844}.png`, frames =
opening · sources · permission · review · closing. Zero horizontal overflow at
both viewports, all three concepts, verified by harness.

Shared across all three (so they are not re-listed per concept): CD-9 type
scale; paper/ink/indigo color use with state hues confined to glyphs + 2px
rules; stamps not pills; mono law; glass on nav only; truth boundary verbatim;
ILLUSTRATIVE labeling on every resolved or workflow surface; reduced-motion =
the vertical document with single-shot opacity reveals removed.

Decision format (docs/ops/FOUNDER_VISUAL_GATE.md):
`FOUNDER VISUAL DECISION: GO — CONCEPT A|B|C` (+ optional KEEP/CHANGE/REMOVE/
MOTION/COPY/MOBILE/REFERENCE EMPHASIS lines).

---

## Concept A — RECORD IN MOTION (Zoox-led)

One product object — the evidence record — examined at scale across
full-viewport stages. The NPI ask is **row one of the document itself**. A
sliding chapter menu (01–04 in mono, active chapter ink-dominant, neighbors
clipped mid-slide) is the navigation system.

**Six-frame motion storyboard**
1. Arrival: record sheet (58% of stage, cropped off the right edge) settles
   1.5°→0 as two labeled fragments (source response, signed receipt) slide in
   behind; eyebrow clip-reveals.
2. Scroll → chapter rail slides `01 YOUR NUMBER` out left as `02 SOURCE
   RESPONSES` arrives; the record travels left, its NPPES row scaling up.
3. The NPPES row seats at display scale — stamp lands last (single-shot), the
   five remaining rows compress into a strip below.
4. Scroll → the record splits: TRAVELS stack advances up-left, HELD stack
   recedes down-right (scale .965, muted) — one motion event, then static.
5. The packet seals: rows collapse into the packet artifact; checkpoint stamp
   arrives beside it; boundary sentence inks in.
6. Closing: the record returns small, closed and centered; CTAs arrow-exchange
   on hover only.

**Component map:** `useFilmProgress` (unchanged) · new `ChapterRail` · canonical
`ExpandingEyebrow` · `FilmRecord` rebuilt at scale (registry-derived) ·
`ProductAction` CTAs · `PacketHandoff`/`HumanReviewCheckpoint` semantics in
frames 4–5 · `TruthBoundary`.
**Deletes:** `EvidenceAtmosphere` + `atmosphere.ts` (the record replaces the
decorative field), plus the whole shared kill-list (below).
**Perf cost:** transform/opacity only; one rAF; no canvas at all — cheaper than
today's homepage.
**Complexity:** medium — the split-stack scene and rail choreography are new,
everything else recomposes existing surfaces.
**Strongest advantage:** the most arresting opening of the three; no competitor
opens with a cropped document at scale; the ask-inside-the-record is the purest
possible statement of "this is yours, start it".
**Greatest risk:** scenes 2–4 lean on choreography — if the implementation
under-delivers the motion, A degrades toward the current film's repeated-frame
problem. Product depth (inspector-grade detail) is the shallowest of the three.

## Concept B — EVIDENCE OPERATING SYSTEM (Palantir + Medallion-led)

Enterprise-scale editorial gravity over real product depth. Less travel, more
product per scene. The one permitted full-bleed Ink chapter carries the
permission argument.

**Six-frame motion storyboard**
1. Arrival: display-xl headline inks in; the workspace band rises 8px into the
   fold-crop; inspector rows reveal top-down once.
2. Scroll → tab underline slides to SOURCE RESPONSES; the six rows resolve
   top-down (stamp last), selected row gains the accent wash.
3. The blocker expands: State License claim opens beneath the NPPES claim —
   "who acts next" line arrives last.
4. Scroll → the page surface gives way to the full-bleed graphite chapter; the
   two paper ledgers arrive as opaque objects (opacity only) on the dark field.
5. Back on paper: timeline rows ink in age-first (0 min → 2 min → checkpoint);
   the packet stands static beside them.
6. Closing: the ruled split seats; nothing moves after scroll stops.

**Component map:** `SourceWorkflowTabs` (canonical, first production mount) ·
`EvidenceInspector` semantics for the claim ledger ·
`ApplicationEvidenceTimeline` (first mount) · `HumanReviewCheckpoint` ·
`ConsentSeal` semantics in the graphite chapter · `ProductAction` ·
`TruthBoundary`. Minimal scroll machinery — `useFilmProgress` only for scene
reveals, or none.
**Deletes:** shared kill-list; also retires the film's horizontal-travel CSS
entirely (B is the least film-dependent).
**Perf cost:** lowest of the three — near-static composition, zero canvas, tab
underline + opacity reveals only.
**Complexity:** lowest — mostly composition, not choreography. The Ink chapter
is new but bounded by the CD-6 amendment's checklist.
**Strongest advantage:** deepest product truth per viewport — the claim
inspector, the blocker treatment, and the age-first timeline are the surfaces a
hospital forwards to counsel. Most credible to an institutional buyer.
**Greatest risk:** emotional temperature — it is the quietest of the three, and
on mobile the workspace band is a lot of table early in the journey. The
clinician-protagonist framing lives mostly in copy, not composition.

## Concept C — CINEMATIC ASK + EVIDENCE OS (hybrid)

The ask is the object. A centered writing-line summons the record; the same
capsule then visibly **forms → resolves → decides → travels → seals** across
the five chapters. The visual budget is spent exactly where CD-20 says to spend
it: the moment an NPI resolves.

**Six-frame motion storyboard**
1. Arrival: the writing-line draws in; the six source strips gather beneath it
   (≤1° tilt settling to 0, single-shot) under "EVIDENCE RECORD · AWAITING YOUR
   NUMBER".
2. On resolve (the budget moment): strips seat into one document, header
   acquires the masked identity, stamps land in sequence, the WHAT-JUST-
   HAPPENED narration inks in line by line — once, ~700ms total.
3. Scroll → the capsule re-dresses as the decision ledger; TRAVELS marks arrive
   in accent; the consent seal stamps.
4. The handoff: a hairline draws down-right to the smaller EMPLOYER VIEW frame;
   only the three traveling rows re-render there.
5. Review: chapter strip slides HUMAN REVIEW active; the checkpoint block
   arrives beside the packet; boundary aside is static.
6. Closing: the two display-xl lines seat around the sealed 300px record mark;
   CTAs arrow-exchange on hover only.

**Component map:** `useFilmProgress` (unchanged) · canonical `ExpandingEyebrow`
· `EvidenceCapsule` (restyled, one grammar across all five scenes) ·
`ConsentSeal` (first mount) · `PacketHandoff` (first mount) ·
`HumanReviewCheckpoint` (first mount) · chapter strip (shared with A's rail,
reduced) · `ProductAction` · `TruthBoundary`.
**Deletes:** shared kill-list; `EvidenceAtmosphere` (the forming capsule IS the
atmosphere); `FilmRecord`/`FilmFit`/`FilmSignature` collapse into the one
capsule grammar.
**Perf cost:** transform/opacity only; the gather animation is N=6 strip
transforms, single-shot; no canvas.
**Complexity:** medium-high — the persistent-object grammar across five scenes
is the hardest choreography of the three, but it is also the direct fix for the
P0 (the capsule finally gets one styled, owned grammar).
**Strongest advantage:** one object carrying the whole argument — the story the
company actually tells (recognize me → what returned → what travels → what
remains) rendered as a single visible document lifecycle. Best mobile opening
of the three (ask + button + first strips above the fold).
**Greatest risk:** the persistent capsule must genuinely persist in the
implementation — if scenes drift back to per-scene bespoke panels, C decays
into today's four-beige-cards film.

---

## Shared kill-list (all three concepts, Phase R12)

Whichever direction is chosen deletes: `HomePageClient.tsx` + `home-vitals.css`
+ `homepage-motion.css` + `story-rail.css` + `scene.css` from the route chain;
the orphaned `ask/` + `cinematic/` trees and their six orphaned stylesheets;
the duplicate home `ExpandingEyebrow` (canonicalized on the design-system
implementation with the Escape/hydration port); the `typography.css` double
import; the dead-file token-cascade wins. The P0 (unstyled `EvidenceCapsule`)
is fixed structurally in every direction — in C it is the centerpiece.

## R4.2 Founder review summary

| Dimension | A — Record in Motion | B — Evidence OS | C — Cinematic Ask |
| --- | --- | --- | --- |
| First impression | STRONG | STRONG | STRONG |
| Emotional quality | STRONG | ACCEPTABLE | STRONG |
| Product clarity | ACCEPTABLE | STRONG | STRONG |
| Visual distinctiveness | STRONG | ACCEPTABLE | STRONG |
| Enterprise credibility | ACCEPTABLE | STRONG | STRONG |
| Clinician ownership | STRONG | ACCEPTABLE | STRONG |
| Mobile quality | ACCEPTABLE | STRONG | STRONG |
| Motion ambition | STRONG | ACCEPTABLE | STRONG |
| Implementation risk | ACCEPTABLE | STRONG (lowest) | ACCEPTABLE |
| Performance risk | STRONG (low) | STRONG (lowest) | STRONG (low) |
| Code deletion opportunity | STRONG | STRONG | STRONG |
| **Recommendation** | — | — | **RECOMMENDED** |

**Recommendation: CONCEPT C**, with two named grafts if the founder agrees:
B's claim-inspector (SOURCE/RETRIEVAL/RECEIPT/LIMITATION ledger) becomes the
expanded state of C's resolved capsule rows, and A's sliding chapter rail is
the fuller version of C's chapter strip. C wins on the opening, on the
persistent-object continuity no competitor has, on mobile, and on being the
structural fix for the P0 — while B's depth is importable and A's rail is
importable. This is a recommendation, not a decision; the gate is yours.
