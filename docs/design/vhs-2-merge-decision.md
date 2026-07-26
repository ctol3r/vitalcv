# VHS-2.1 — GATE-0 Merge Decision (PR #741)

**Bundle:** VHS-2.1 GATE-0 — resolve active homepage work before any VHS-2 code.
**Finding date:** 2026-07-18. **Companion:** `docs/design/vhs-2-homepage-baseline.md`.

## GATE-0 status: PR #741 is MERGED

The bundle assumed PR [#741](https://github.com/ctol3r/vitalcv/pull/741) might be "merged, superseded, or still active." **It is MERGED** — `origin/main` HEAD is `55cbcd9f2`, which *is* #741 (`feat(home): loop pills, rolodex fix, and reader features`). Its nine files (HomePageClient, HeroLoopPills, ScrollFocusManifesto, FormSystemsDiagram, HomepageOutlinePanel, RotatingProofLine, StickyProductStory, homepage-motion.css, homepage-motion.spec) are the **current baseline**, not a competing branch.

**Consequence:** there is no branch-vs-branch conflict to reconcile. VHS-2 begins from `main` (as the bundle requires), and GATE-0 reduces to a **keep / adapt / replace** decision for each #741 element as it folds into the Evidence Field + horizontal rail. No competing redesign branch will be opened; all VHS-2 homepage edits land on top of `55cbcd9f2`.

## Per-element decision

| #741 element | File | Decision | Rationale & rail placement |
|---|---|---|---|
| **Career-loop pill row** (Wallet → MATCHA → Apply → Reuse) | `HeroLoopPills.tsx` | **KEEP → adapt** | Honest navigation (real destinations, names stages not outcomes). Stays as hero orientation; doubles as the loop overview that the rail chapters (Opportunity/Application/Acceptance/Start) expand. No copy change. |
| **Pinned product story / rolodex** (5 cards recognize→accept) | `StickyProductStory.tsx` (390 ln) | **KEEP — becomes the rail spine** | The strongest actual product sequence and already the scroll-linked story. Its guarded hooks (`data-home-sticky-product-story`, `data-home-loop`, `data-story-card`, `data-section-observe`) map 1:1 onto rail chapters Opportunity/Application/Acceptance. Preserve all hooks + `homepage-motion.spec` matrix3d/`data-active-step` contract. |
| **Floating block outline** (desktop xl+ scroll-spy) | `HomepageOutlinePanel.tsx` | **ADAPT — promote to the rail's chapter navigator** | VHS-2/VHS-1 both require a "visible, keyboard-operable chapter navigator/progress rail." This panel already IntersectionObserver-scroll-spies the sections — it *is* that navigator. Promote it from "additive orientation" to the rail's primary desktop progress control (real links/buttons, deep-linkable `#ids`), keep the mobile/no-JS vertical fallback. |
| **Reframe band + form/systems diagram** ("a résumé states; VitalCV proves") | `ScrollFocusManifesto.tsx`, `FormSystemsDiagram.tsx` | **KEEP → adapt** | On-message thesis for the Evidence/Application chapter. Keep the scroll-focus reading effect as *enhancement only*; it must render vertical-static under reduced-motion/no-JS (already `matchMedia`-gated — verify in 2.4). |
| **Rotating proof line** ("Carry your {identity→licensure→…} forward") | `RotatingProofLine.tsx` | **KEEP** | Reuse/Start-chapter accent; already reduced-motion + `sr-only`-complete-phrase safe. No change. |
| **Hero scroll narrative** | `ScrollTypeNarrative.tsx` | **ADAPT — fix at source (VHS-2 risk #2)** | Audit for duplicate animated + static prose so screen-reader and visual users get **one** coherent statement. This is a 2.2 fix, called out here so it isn't lost. |

## One-source-of-truth resolutions

- **Chapter navigator / progress rail →** `HomepageOutlinePanel` (adapted). It is the single desktop chapter nav; the sticky top rail (`data-home-section-rail`) remains the conventional in-DOM link list and the mobile fallback.
- **Story / rolodex →** `StickyProductStory` is the single scroll-linked product sequence and the rail's spatial spine. No second story mechanism.
- **Hero loop overview →** `HeroLoopPills` (single pill strip; not duplicated as a separate rail control).
- **Reframe →** `ScrollFocusManifesto` + `FormSystemsDiagram` compose one chapter; not repeated elsewhere.

## Risks carried into VHS-2.2/2.4

1. **Multiple scroll-motion systems now coexist** on the homepage — `StickyProductStory` (rolodex/matrix3d), `ScrollFocusManifesto` (scroll-focus), `HomepageOutlinePanel` (scroll-spy), `ScrollTypeNarrative` (hero). VHS-2.4's horizontal rail pins scroll; per the bundle's `home-vitals.css` warning, **old and new systems must not both animate the same element**. The rail must *drive* these as chapters, not layer a competing transform over them.
2. **`homepage-motion.spec.ts` (updated by #741)** guards the rolodex + captions + carousel + reduced-motion fallbacks — the rail keeps these or rewrites them deliberately (never weakens).
3. **The Evidence Field replaces the hero graph**, so `homepage-motion.spec`'s narrated-graph-caption block and `npi-truth-engine`'s reset-to-`[data-home-hero-graph]` assertion must be **rewritten to the Field's static poster**, not deleted (both guard "the pre-lookup preview is labeled and non-fabricated").

## Decision

**Proceed with VHS-2 from `main` @ `55cbcd9f2`.** Every #741 element is kept or adapted into the rail — none is discarded. The only net-new hero replacement is `CareerGraph → CareerEvidenceField` (VHS-2.2). No competing homepage branch is opened; VHS-2.2+ edits are additive on top of the merged #741 baseline, preserving every contract in the baseline doc.
