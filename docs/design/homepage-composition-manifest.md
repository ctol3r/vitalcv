# Homepage composition manifest

**Established:** 2026-07-20 (deep-audit W0.2) · **Rewritten:** 2026-08-08 (UX-V1 production cutover) · **Amended:** 2026-08-14 (Direction D.7; WO-17) · **Rewritten:** 2026-08-15 (Direction A recomposition; amendment E) · **Amended:** 2026-08-16 (E.1 simple bottom half; E.2 clinical theme and motion)
**Rule:** every live homepage section has exactly one owner component, one motion
owner, a declared fallback, and a conversion job. A section that cannot name its
conversion job does not ship. No more than **one page-level in-page navigation
rail** may render at a time — enforced by
`apps/web/__tests__/homepage-composition-gate.test.tsx`.

The live composition is **Direction A** (amendment E,
`docs/design/VITALCV_EXPERIENCE_CONSTITUTION.md`), served by
`components/home/easy/EasyHome.tsx` (island `.ezh`): warm paper, ink, one hot
action colour (`--vt-home-e-action`, an instrument, never a state), Geist
display type, and **two drawn inline-SVG figures** in the register inks — every
value a blank bar, every figure self-labelled illustrative with a hidden
transcript, all complete in the server frame, drawn in the E.2 clinical
pictogram vocabulary (registry building, shield, flag, ID badge, watch, plus-in-
building — objects only, never facts). There is no frost, no photograph,
no raster illustration, no canvas, and no WebGL on this route. Motion is
one-shot (amendment E.2): section entrances armed by an IntersectionObserver
over an SSR-complete page with a safety-timer force-complete, figure
line-draws, the Figure 1 row reveal, the payoff line's single-pass cycling
word (role → shift → hospital → state → **application**), and 80–150ms
hover/press micro-states. The one lawful loop is the live feed's "Listed as
open" status pulse (EC-29's system-status exception); nothing else loops. The
page does not pin scrolling, rotate panels, or depend on JavaScript to reveal
the record and decision boundaries. The shared public chrome is unchanged
(A-3 geometry, A-1 chrome frost).

## Page-level systems (not sections)

| System | Owner | Motion owner | Fallback | Job |
| --- | --- | --- | --- | --- |
| Shared chrome | `components/layout/Eyebrow.tsx` (mounted by `RootChrome`) | Color transitions only — geometry constant | SSR light register matches the first warm-paper section; the takeover menu requires JS | Zero-height floating chrome: wordmark upper-left, one action + lookup + menu upper-right (bottom-pinned on mobile); no bar, no center content |
| Figure grammar | `components/home/easy/figures/` (+ `WorkSurface` as Figure 1); hoisted arrowhead markers in `figures/FigureMarkers.tsx` | Figure 1's one-shot row reveal + line-draw on its arming machinery; the match figure line-draws once when its section reveals (E.2) | Wide + narrow viewBox pairs are both server-rendered; CSS shows one; effective text ≥ 11px at both evidence viewports (e2e-measured); resting state is the complete solid drawing | Show the mechanism — sources → profile (drawn as a clinician's ID badge), and how a match reads — without asserting a real clinician, employer, credential, or result. (The routing/boundary/reuse/watch figures retired with their sections, amendment E.1.) |
| Section entrances (E.2) | `components/home/easy/useSectionReveals.ts` (arms `data-ezh-motion` on the `.ezh` root; sections opt in via `data-ezh-reveal`) | One-shot IntersectionObserver reveal per section; safety timer force-completes; MutationObserver catches late mounts | SSR-complete page — the hidden state exists only while armed; no-JS and reduced motion never arm | Engaging motion without a scroll owner: the document remains the page's only scroll driver (EC-4) |
| In-page navigation | None | — | DOM order and anchors (`#npi`, `#how-it-works`) | No page-level carousel, rail, or chapter navigator |

## Sections, in DOM order

| # | Section | Owner component | Data source | Motion owner | Fallback | Conversion job |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Hero — “Enter your NPI. VitalCV does the rest.” + payoff cycling word + real NPI entry (the ink card) + **Figure 1** (source pills → the profile as a clinician’s ID badge, one row honestly open) | `EasyHome` + `CyclingWord` + `NpiEntry` + `HeroStage` + `WorkSurface` | Amendment E copy table (hero sub superseded by E.2: one sentence); live lookup via `useCareerLoop` | `CyclingWord` (single pass, settles on “application”); `WorkSurface` badge swing settle + chart-row slide/fade + connector line-draw (one shot, safety-stripped — Option 1 “Chart & Badge”); NPI digit-count pop (100ms, real counts only — E.2) | SSR renders the settled word and the complete figure; reduced motion and no-JS get the finished frame; a real lookup replaces the illustration | Primary conversion: NPI → live profile → onboarding handoff; secondary: explore opportunities |
| 1a | Recognition (UX-05) — resolving narration, then the reveal: the REAL evidence rows (`buildEvidenceCapsule`) grouped returned / attention / unavailable, each with provenance behind a closed disclosure, plus the correction path | `NpiReveal` + `ResolvingNarration` (`data-npi-reveal`) | **Real returned records only** — `state.capsule` from the live bootstrap + trust-state pairing; EC-26 stateful, no fixture path | `useSourceCheckSequence` pacing floor, then a one-shot CSS-transition stagger; no spinner, no percentage, nothing loops | Reduced motion settles instantly (`is-instant`); unavailable/error states render their own honest composition | The magic moment: "VitalCV already did work for me" — unknowns at equal typographic confidence to answers |
| 2 | Roles — the live feed framed by **Figure 5** (match explanation: two fit lines, one named blocker; no employer, no count, no percentage) | `OpportunityHorizon` | `/api/opportunities?limit=3`; each row uses server-supplied source, URL, observation time, availability, and application mode — the feed truth contract is untouched | Section entrance (one shot); late-mounted rows arrive once (`ezh-row-in`); figure line-draw on reveal; row hover ink/panel shift; the “Listed as open” dot’s slow status pulse — the route’s ONE lawful loop (EC-29) | Server-visible loading/error/empty boundary and `/explore` path; no invented rows | Discover real work; external roles leave via “View original listing”, integrated roles may use “Apply with VitalCV” |
| 3 | Truth boundary | `EasyHome` (`data-home-truth-boundary`) | Static, enumerated | Section entrance (one shot) | SSR-complete text | Nothing has been sent; institution review decides |
| 4 | Three promises — "Three things. That's the whole idea." Three benefit cards (record moves with you · you approve every share · VitalCV keeps watch), each with a clinical E.2 glyph (ID badge · consent toggle · watch-with-stethoscope) | `ThreePromises` | Static; every claim one sentence (E.2), benefit-led, inside the truth contract | Section entrance (one shot); card hover border/ink shift (no shadows) | SSR-complete; glyphs are aria-hidden pictograms depicting no fact | The whole bottom-half story at a glance — simple, positive, done (amendment E.1) |
| 5 | Quick answers — three flat one-line Q/As (credentialing boundary, cost, no-account look) | `EasyHome` `.ezh-qa` | Static truth-contract answers | Section entrance (one shot); row hover ink shift | Flat `<dl>`, no accordions, keyboard-transparent | Resolve the three objections that block the first NPI entry |
| 6 | Employer doorway — one warm row | `EasyHome` employer band | Static | Section entrance (one shot); CTA hover fill + glyph nudge | SSR-complete | Subordinate second audience → `/employers` |
| 7 | Final action + footer | `EasyHome` start band + footer | `sourceCadenceSentence()` (derived from `lib/trust/sourceLanes.ts`) | Section entrance on the start band (one shot); footer static | SSR-complete | Return to real NPI entry (serif aside is the one Fraunces use); quiet exit links + source-freshness truth line (`data-home-source-cadence`) |

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

**Amendment E.1 (2026-08-16).** Founder directive, verbatim: *"simple, practical,
easy, positivity, and fun. not: boring, text-heavy, confusing, complicated."* The
seven-step dark band, the standing watch, the attribution ledger, and the
five-item FAQ were retired from `/` — true things a visitor did not need. Their
jobs compress into the Three promises band and the Quick answers lines below.
Hero, Recognition, Roles, and the truth boundary stand unchanged from E.

**Amendment E.2 (2026-08-16).** Founder directive, verbatim: *"its better for
sure. but its lacking the clinic/clinician/hospital theme. again less text more
higher level and simplified visuals. the whole thing needs to be interactive
and animated, trendy, clean, polished, fun, smart engaging motion throughout."*
Theme selected from a three-option rendered bake-off: **Option 1 "Chart &
Badge"** (*"i think option 1 is headed in the right direction. not perfect but
[better] than the two others."*); Option 2 (EKG/pulse-line connective motif)
and Option 3 (drawn clinician characters) were considered and not selected.
No section was added, removed, or re-ordered — E.1's composition stands. What
changed: the clinical drawn-object vocabulary (Figure 1 becomes an ID badge
with accent band and swing-on settle, its chart rows filling from labelled
source pills; promise glyphs and the role card gain 2px-stroke object
pictograms; cross-in-shield used sparingly), another text pass (one-sentence
hero sub, promise bodies, Roles subhead, and Quick answers; the prose
text-node ceiling tightens 110 → 90), and the one-shot motion system recorded
per section in the Motion owner column above. Law: constitution amendment
E.2, same PR.
