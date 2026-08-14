# Homepage composition manifest

**Established:** 2026-07-20 (deep-audit W0.2) · **Rewritten:** 2026-08-08 (UX-V1 production cutover) · **Amended:** 2026-08-14 (Direction D.1 ink-stage and career-loop synthesis; WO-17)
**Rule:** every live homepage section has exactly one owner component, one motion
owner, a declared fallback, and a conversion job. A section that cannot name its
conversion job does not ship. No more than **one page-level in-page navigation
rail** may render at a time — enforced by
`apps/web/__tests__/homepage-composition-gate.test.tsx`.

The live composition is Direction D.1
(`components/home/easy/EasyHome.tsx`, island `.ezh`): a normal vertical page in
warm paper and ink. A provenance-bound documentary scene supplies human stakes;
the existing server-visible record is composed as a tactile CV Wallet folio
inside a contained ink-ground clinical-observatory stage;
the live public opportunity feed makes work visible before sign-up; and a
seven-state tactile sequence explains record → opportunity → clinician choice →
exact packet → employer review → accepted head start → reuse in one hard-cut,
inverse editorial band with numbered physical objects. Green describes
evidence, never a generic action. The page does not pin scrolling, rotate
panels, require WebGL, or depend on JavaScript to reveal the record and decision
boundaries. The shared public chrome is unchanged.

## Page-level systems (not sections)

| System | Owner | Motion owner | Fallback | Job |
| --- | --- | --- | --- | --- |
| Shared chrome | `components/layout/Eyebrow.tsx` (mounted by `RootChrome`) | Color transitions only — geometry constant | SSR floating instruments; the takeover menu requires JS | Zero-height floating chrome: wordmark upper-left, one action + lookup + menu upper-right (bottom-pinned on mobile); no bar, no center content |
| Documentary media | `VisualScene` + the `journey_film/home_documentary` manifest entry | None | The poster, alt text, and adjacent transcript are server-rendered | Human stakes without asserting a real clinician identity, employer, credential, or result |
| In-page navigation | None | — | DOM order and anchors (`#npi`, `#how-it-works`) | No page-level carousel, rail, or chapter navigator |

## Sections, in DOM order

| # | Section | Owner component | Data source | Motion owner | Fallback | Conversion job |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Hero — “One career record. More ways forward.” + real NPI entry | `EasyHome` + `NpiEntry` + `HeroStage` | Static founder copy; live lookup via `useCareerLoop`; `VisualScene` manifest asset | None | SSR-complete form, contained ink-ground documentary stage, and solid tactile folio; a real lookup replaces the illustration | Primary conversion: NPI → live profile → onboarding handoff; secondary: explore opportunities |
| 1a | Recognition (UX-05) — resolving narration, then the reveal: identity assembles registry-framed, then the REAL evidence rows (`buildEvidenceCapsule`) grouped returned / attention / unavailable, each with provenance behind a closed disclosure, plus the correction path | `NpiReveal` + `ResolvingNarration` (`data-npi-reveal`) | **Real returned records only** — `state.capsule` from the live bootstrap + trust-state pairing; EC-26 stateful, no fixture path (the demo path carries `capsule: null`) | `useSourceCheckSequence` pacing floor (~1850ms) so the reveal never beats the data, then a one-shot CSS-transition stagger; no spinner, no percentage, nothing loops | Reduced motion settles instantly with no hidden frame (`is-instant`); unavailable/error states render their own honest composition | The magic moment: "VitalCV already did work for me" — with unknowns rendered at equal typographic confidence to answers |
| 2 | Opportunity horizon — real roles before sign-up | `OpportunityHorizon` | `/api/opportunities?limit=3`; each row uses server-supplied source, URL, observation time, availability, and application mode | None | Server-visible loading/error/empty boundary and `/explore` path; no invented rows | Discover real work; external roles leave via “View original listing”, integrated roles may use “Apply with VitalCV” |
| 3 | Truth boundary | `EasyHome` (`data-home-truth-boundary`) | Static, enumerated | None | SSR-complete text | Nothing has been sent; institution review decides |
| 4 | Career-mobility sequence | `CareerMobilitySequence` | Static contract explanation; no result or metric data | CSS transitions only; no loop or engine | Every state, all seven sequence counters, and both decision/consent boundaries are server-rendered on an inverse ink band | Understand the complete accepted-evidence loop in one visual sequence |
| 5 | Attribution — four responsibility boundaries | `Attribution` | Static | None | SSR-complete | VitalCV gathers / sources attest / clinician chooses / institution decides |
| 6 | Questions | `Questions` | Static truth-contract answers | Native disclosure only | All questions and answers remain semantic and keyboard accessible | Resolve the key trust and privacy objections |
| 7 | Employer doorway | `EasyHome` employer band | Static | None | SSR-complete | Subordinate second audience → `/employers` |
| 8 | Final action | `EasyHome` start band | Static | None | SSR-complete | Return to real NPI entry or explore opportunities |
| 9 | Footer composition | `EasyHome` footer | `sourceCadenceSentence()` (derived from `lib/trust/sourceLanes.ts`) | None | SSR-complete | Quiet exit links + source-freshness truth line (`data-home-source-cadence`) |

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
