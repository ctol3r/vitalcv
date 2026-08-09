# Homepage composition manifest

**Established:** 2026-07-20 (deep-audit W0.2) · **Rewritten:** 2026-08-08 (UX-V1 production cutover) · **Amended:** 2026-08-08 (D-01A homepage visual slice) · **Amended:** 2026-08-09 (roles band; UX-04 process story — glow placement now follows EC-20 A-1's "at most once per viewport" rather than D-01A's "work surface only"; UX-05 recognition — section 1a)
**Rule:** every live homepage section has exactly one owner component, one motion
owner, a declared fallback, and a conversion job. A section that cannot name its
conversion job does not ship. No more than **one page-level in-page navigation
rail** may render at a time — enforced by
`apps/web/__tests__/homepage-composition-gate.test.tsx`.

The live composition is UX-V1 (`components/home/easy/EasyHome.tsx`, island
`.ezh`, Direction B as amended by the UX-01 verdict, restyled by D-01A under
`docs/design/VITALCV_2026_VISUAL_LANGUAGE.md`): a normal vertical page in the
dark warm-graphite register. D-01A's standing rules: the primary action is the
warm-paper inverse (green is evidence, never an action); the island's colours
resolve through the `--vt-scene-*` register in `styles/themes/index.css`; the
indigo atmospheric glow sits only behind scene compositions — the work
surface, plus a single travelling glow that lights the playing process-story
chapter — at most one per viewport per EC-20 as amended A-1, never on a
control, carrying no meaning; focus rings are
indigo. Product explanation must not pin scrolling,
rotate through panels, or require a carousel control. The page composes its own
final CTA + footer band; the shared Footer is suppressed on `/` only.

## Page-level systems (not sections)

| System | Owner | Motion owner | Fallback | Job |
| --- | --- | --- | --- | --- |
| Shared chrome | `components/layout/Eyebrow.tsx` (mounted by `RootChrome`) | Color transitions only — geometry constant | SSR floating instruments; the takeover menu requires JS | Zero-height floating chrome: wordmark upper-left, one action + lookup + menu upper-right (bottom-pinned on mobile); no bar, no center content |
| Beat narration | `WorkSurface` dispatches `HOME_BEAT_EVENT`; the chrome no longer listens | The work-surface timeline | The surface narrates itself | The chrome carries no narration — the reference grammar has no center content |
| In-page navigation | None | — | DOM order and anchors (`#npi`, `#how-it-works`) | No page-level carousel, rail, or chapter navigator |

## Sections, in DOM order

| # | Section | Owner component | Data source | Motion owner | Fallback | Conversion job |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Hero — "Enter your NPI. VitalCV does the rest." + real NPI entry | `EasyHome` (hero block) + `NpiEntry` | Static copy; live lookup via `useCareerLoop` (bootstrap + trust-state + MATCHA, unchanged) | None on copy | SSR-complete form pre-hydration; results render only after a real lookup | THE primary conversion: NPI → profile → onboarding handoff |
| 1a | Recognition (UX-05) — resolving narration, then the reveal: identity assembles registry-framed, then the REAL evidence rows (`buildEvidenceCapsule`) grouped returned / attention / unavailable, each with provenance behind a closed disclosure, plus the correction path | `NpiReveal` + `ResolvingNarration` (`data-npi-reveal`) | **Real returned records only** — `state.capsule` from the live bootstrap + trust-state pairing; EC-26 stateful, no fixture path (the demo path carries `capsule: null`) | `useSourceCheckSequence` pacing floor (~1850ms) so the reveal never beats the data, then a one-shot CSS-transition stagger; no spinner, no percentage, nothing loops | Reduced motion settles instantly with no hidden frame (`is-instant`); unavailable/error states render their own honest composition | The magic moment: "VitalCV already did work for me" — with unknowns rendered at equal typographic confidence to answers |
| 2 | Work surface — the 5-beat Profile in Motion explainer (D-01A): the layered profile record builds from named sources, what remains ranks by owner, VitalCV works and stops at a visible consent gate, and the story ends at the employer's review desk — which never resolves | `WorkSurface` | None — abstracted illustration, labelled illustrative | JS-scheduled class timeline (~10.5s, plays once, replayable); no @keyframes, no scroll coupling; beat-5 space is grid-reserved at first paint (opacity reveals only — the D-00 CLS fix) | Server renders the COMPLETED frame; reduced motion annotates it in flow (numerals above each beat, not overlaying it) | Comprehension in under ~5s: VitalCV builds the record, the clinician approves what leaves it, the employer reviews and decides |
| 3 | Truth boundary | `EasyHome` (`data-home-truth-boundary`) | Static, enumerated | None | SSR-complete text | Nothing has been sent; institution review decides |
| 4 | Process story — "What VitalCV is", the deep five-chapter explainer (UX-04): each EC-27 beat (Identify → Build → Choose → Apply → Carry forward) gets its own chapter with explanatory copy and a larger scene; chapter five ends at the employer's review desk, which never resolves | `ProcessStory` (`data-home-process-story`) | None — abstracted illustration, labelled illustrative per chapter | Per-chapter CSS-transition stagger under an `is-play` class, triggered once by IntersectionObserver; no @keyframes, no loops, no scroll coupling; per-chapter Replay (≥44px). A single travelling `--vt-scene-glow` lights only the playing chapter (`is-glow`, handed off by the observer; SSR lights chapter one) — at most one glow visible regardless of viewport geometry (EC-20 as amended A-1) | Server renders every chapter COMPLETE (`is-play` in SSR); reduced motion and no-JS get the finished frames + always-visible chapter numerals and legends | Comprehension in depth: a visitor who wants to understand what VitalCV actually is gets the whole product and process without leaving `/` |
| 5 | Ownership — four work-state panels | `EasyHome` ownership grid | Static | None | SSR-complete | The agent model: VitalCV handles / your approval / you / the employer decides |
| 6 | Roles — credential-aware job matching ("A job board that reads your credentials, not your keywords") | `EasyHome` match band | Static; illustrative match readout, no volume claims | None | SSR-complete | Matching as the product: scored on the record, explained per match, blockers before applying |
| 7 | Outcome — "you start sooner" + role→first-day track | `EasyHome` outcome band | Static; illustrative track | CSS transition on the fill only | SSR-complete final state | The profile is not the destination; the job is |
| 8 | Employer doorway — light band | `EasyHome` employer band | Static | None (the eyebrow inverts over it via `data-header-theme`) | SSR-complete | Subordinate second audience → `/employers` |
| 9 | Final action | `EasyHome` start band | Static | None | SSR-complete | Return to the real entry (`#npi`) |
| 10 | Footer composition | `EasyHome` footer | `sourceCadenceSentence()` (derived from `lib/trust/sourceLanes.ts`) | None | SSR-complete | Quiet exit links + the source-freshness truth line (`data-home-source-cadence`) |

## Rollbacks

`PUBLIC_HOME_VARIANT=career-loop` (the One Real Loop, Wave 1075) and
`PUBLIC_HOME_VARIANT=film` (the evidence film, COMPETE-1) both still render,
each with preserved coverage. They serve under the UX-V1 eyebrow — the chrome
does not switch with the content variant. See
`docs/design/PARKED_VISUAL_ERAS.md`.

## Change protocol

Adding, removing, or re-ordering a section requires updating THIS manifest and
the composition-gate test in the same PR. A PR that changes homepage
composition without touching this file is incomplete.
