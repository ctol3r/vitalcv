# Homepage composition manifest

**Established:** 2026-07-20 (deep-audit W0.2) · **Rewritten:** 2026-08-08 (UX-V1 production cutover) · **Amended:** 2026-08-14 (Direction D.7; WO-17) · **Rewritten:** 2026-08-15 (Direction A recomposition; amendment E)
**Rule:** every live homepage section has exactly one owner component, one motion
owner, a declared fallback, and a conversion job. A section that cannot name its
conversion job does not ship. No more than **one page-level in-page navigation
rail** may render at a time — enforced by
`apps/web/__tests__/homepage-composition-gate.test.tsx`.

The live composition is **Direction A** (amendment E,
`docs/design/VITALCV_EXPERIENCE_CONSTITUTION.md`), served by
`components/home/easy/EasyHome.tsx` (island `.ezh`): warm paper, ink, one hot
action colour (`--vt-home-e-action`, an instrument, never a state), Geist
display type, and **six drawn inline-SVG figures** in the register inks — every
value a blank bar, every figure self-labelled illustrative with a hidden
transcript, all complete in the server frame. There is no frost, no photograph,
no raster illustration, no canvas, and no WebGL on this route. Motion is
one-shot only: the Figure 1 row reveal and the payoff line's single-pass
cycling word (role → shift → hospital → state → **application**); nothing
loops. The page does not pin scrolling, rotate panels, or depend on JavaScript
to reveal the record and decision boundaries. The shared public chrome is
unchanged (A-3 geometry, A-1 chrome frost).

## Page-level systems (not sections)

| System | Owner | Motion owner | Fallback | Job |
| --- | --- | --- | --- | --- |
| Shared chrome | `components/layout/Eyebrow.tsx` (mounted by `RootChrome`) | Color transitions only — geometry constant | SSR light register matches the first warm-paper section; the takeover menu requires JS | Zero-height floating chrome: wordmark upper-left, one action + lookup + menu upper-right (bottom-pinned on mobile); no bar, no center content |
| Figure grammar | `components/home/easy/figures/` (+ `WorkSurface` as Figure 1); hoisted arrowhead markers in `figures/FigureMarkers.tsx` | Figure 1's one-shot row reveal; every other figure static | Wide + narrow viewBox pairs are both server-rendered; CSS shows one; effective text ≥ 11px at both evidence viewports (e2e-measured) | Show the mechanism — sources → profile, match, routing, boundary, reuse, watch — without asserting a real clinician, employer, credential, or result |
| In-page navigation | None | — | DOM order and anchors (`#npi`, `#how-it-works`) | No page-level carousel, rail, or chapter navigator |

## Sections, in DOM order

| # | Section | Owner component | Data source | Motion owner | Fallback | Conversion job |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Hero — “Enter your NPI. VitalCV does the rest.” + payoff cycling word + real NPI entry (the ink card) + **Figure 1** (sources → profile, one row honestly open) | `EasyHome` + `CyclingWord` + `NpiEntry` + `HeroStage` + `WorkSurface` | Amendment E copy table; live lookup via `useCareerLoop` | `CyclingWord` (single pass, settles on “application”); `WorkSurface` row reveal (one shot, safety-stripped) | SSR renders the settled word and the complete figure; reduced motion and no-JS get the finished frame; a real lookup replaces the illustration | Primary conversion: NPI → live profile → onboarding handoff; secondary: explore opportunities |
| 1a | Recognition (UX-05) — resolving narration, then the reveal: the REAL evidence rows (`buildEvidenceCapsule`) grouped returned / attention / unavailable, each with provenance behind a closed disclosure, plus the correction path | `NpiReveal` + `ResolvingNarration` (`data-npi-reveal`) | **Real returned records only** — `state.capsule` from the live bootstrap + trust-state pairing; EC-26 stateful, no fixture path | `useSourceCheckSequence` pacing floor, then a one-shot CSS-transition stagger; no spinner, no percentage, nothing loops | Reduced motion settles instantly (`is-instant`); unavailable/error states render their own honest composition | The magic moment: "VitalCV already did work for me" — unknowns at equal typographic confidence to answers |
| 2 | Roles — the live feed framed by **Figure 5** (match explanation: two fit lines, one named blocker; no employer, no count, no percentage) | `OpportunityHorizon` | `/api/opportunities?limit=3`; each row uses server-supplied source, URL, observation time, availability, and application mode — the feed truth contract is untouched | None | Server-visible loading/error/empty boundary and `/explore` path; no invented rows | Discover real work; external roles leave via “View original listing”, integrated roles may use “Apply with VitalCV” |
| 3 | Truth boundary | `EasyHome` (`data-home-truth-boundary`) | Static, enumerated | None | SSR-complete text | Nothing has been sent; institution review decides |
| 4 | Dark band — the seven pinned steps with **Figure 3** (the approval boundary) as the band's drawn stage and **Figure 4** (reuse) as step 7's expansion | `CareerMobilitySequence` | Static contract explanation; the seven step labels/details and both boundary sentences are pinned and unchanged | None | Every step, all seven counters, both figures, and both boundary sentences are server-rendered on the inverse ink band | Understand the approval boundary and the reuse loop in one visual sequence |
| 5 | Standing watch — “Most weeks, you do nothing.” + **Figure 6** | `StandingWatch` | Static; stated to the limit of what the product truthfully does (watch, refresh, flag) | None | SSR-complete | The clinician-does-nothing thesis, honestly bounded |
| 6 | Ownership + attribution — **Figure 2** (owner routing) + the four state cards + the ledger | `Attribution` | Static; the real lane vocabulary only | None | SSR-complete | Whose move is it, and how was a line established — never flattened into one green tick |
| 7 | Questions | `Questions` | Static truth-contract answers | Native disclosure only | All questions and answers remain semantic and keyboard accessible | Resolve the key trust and privacy objections |
| 8 | Employer doorway | `EasyHome` employer band | Static | None | SSR-complete | Subordinate second audience → `/employers` |
| 9 | Final action + footer | `EasyHome` start band + footer | `sourceCadenceSentence()` (derived from `lib/trust/sourceLanes.ts`) | None | SSR-complete | Return to real NPI entry (serif aside is the one Fraunces use); quiet exit links + source-freshness truth line (`data-home-source-cadence`) |

## Rollbacks

`PUBLIC_HOME_VARIANT=career-loop` (the One Real Loop, Wave 1075) and
`PUBLIC_HOME_VARIANT=film` (the evidence film, COMPETE-1) both still render,
each with preserved coverage. They serve under the shared eyebrow — the chrome
does not switch with the content variant. See
`docs/design/PARKED_VISUAL_ERAS.md`.

## Change protocol

Adding, removing, or re-ordering a section requires updating THIS manifest and
the composition-gate test in the same PR. A PR that changes homepage
composition without touching this file is incomplete.

While the 2026-08-15 homepage visual freeze is active
(`docs/ops/FOUNDER_VISUAL_GATE.md` §1a), a composition change must also cite the
freeze clause and be the Direction A recomposition or a PR it explicitly
sequences.
