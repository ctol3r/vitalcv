# Homepage composition manifest

**Established:** 2026-07-20 (deep-audit W0.2) · **Rewritten:** 2026-08-08 (UX-V1 production cutover) · **Amended:** 2026-08-14 (Direction D.7; WO-17) · **Rewritten:** 2026-08-15 (Direction A recomposition; amendment E) · **Amended:** 2026-08-16 (E.1 simple bottom half; E.2 clinical theme and motion) · **Rewritten:** 2026-08-16 (the founder's Homepage v4; amendment F)
**Rule:** every live homepage section has exactly one owner component, one motion
owner, a declared fallback, and a conversion job. A section that cannot name its
conversion job does not ship. No more than **one page-level in-page navigation
rail** may render at a time — enforced by
`apps/web/__tests__/homepage-composition-gate.test.tsx`.

The live composition is the **founder's Homepage v4** (amendment F,
`docs/design/VITALCV_EXPERIENCE_CONSTITUTION.md`; the design verbatim at
`design-lab/homepage-2026-08-v4/`), served by
`components/home/easy/EasyHome.tsx` (island `.ezh`): warm paper `#EDEAE3` with
raised/inset paper surfaces, hairline-ruled document composition, indigo
signal `#4338CA`, Fraunces display, Geist text, and **Geist Mono for machine
facts** — if it is mono, a source returned it. Five evidence-geometry figure
groups in the register inks: every value a blank bar, every NPI masked, every
figure self-labelled illustrative with a hidden transcript, all complete in
the server frame. There is no frost, no photograph, no raster, no canvas, and
no WebGL on this route. Motion has two mechanisms, both confined to
illustration art (`.ezh-fig-art`, aria-hidden) or the live feed, and both
fully killed by reduced motion: (1) one-shot ENTRANCES on E.2's system — the
hero folio tile arrivals, the reveal's one-shot stagger, `useSectionReveals`
section entrances over an SSR-complete page, and `ezh-row-in` for
late-mounted feed rows; (2) ambient LOOPS (amendment F.1, founder "Allow
ambient loops" 2026-08-16, EC-29 amended in the same PR) — the hero cadence
line traces, the trust-flow packet travels, accent connectors dash-march, and
illustration marker glyphs tick, all inside figures only. The live feed's
"Listed as open" status pulse (EC-29's separate system-status exception)
stays. Reduced motion stops EVERY animation on the route. The page does not pin scrolling, rotate panels, or depend on
JavaScript to reveal the record or the decision boundaries. The shared public
chrome is unchanged (A-3 geometry, A-1 chrome frost) — the v4 file's floating
glass rail was NOT ported and awaits its own founder chrome ruling (EC-10).

## Page-level systems (not sections)

| System | Owner | Motion owner | Fallback | Job |
| --- | --- | --- | --- | --- |
| Shared chrome | `components/layout/Eyebrow.tsx` (mounted by `RootChrome`) | Color transitions only — geometry constant | SSR light register matches the warm-paper page; the takeover menu requires JS | Zero-height floating chrome: wordmark upper-left, one action + lookup + menu upper-right (bottom-pinned on mobile); no bar, no center content |
| State grammar | `components/home/easy/stateVocabulary.tsx` (`StateStamp`) | None | Glyph + word in ink; hue only on glyph and left rule (EC-4) | Five states, no others: ● Source-confirmed · ◐ Snapshot (cadence in the value) · ▲ Needs you · ⊘ Access required · ○ Not checked |
| Figure grammar | The five `data-home-figure` groups (`hero-folio`, `trust-flow`, `arc-beats`, `packet-shape`, `requirement-ledger`) | One-shot tile arrivals (hero) + **ambient illustration loops (F.1): `ezh-il-draw` on the hero cadence line, `ezh-il-travel` on the trust-flow packet, `ezh-il-dash` on accent connectors, `ezh-il-tick` on marker glyphs** — figures only (EC-4), reduced-motion-killed | Wide + narrow viewBox pairs both server-rendered; CSS shows one; effective text ≥ 11px at 390/375/360 (e2e-measured) | Show the mechanism — sources → record → consent → review — without asserting a real clinician, employer, credential, source response, or result |
| Section entrances (E.2, adopted by F) | `components/home/easy/useSectionReveals.ts` (arms `data-ezh-motion` on the `.ezh` root; sections opt in via `data-ezh-reveal`) | One-shot IntersectionObserver reveal per section; safety timer force-completes; MutationObserver catches late mounts | SSR-complete page — the hidden state exists only while armed; no-JS and reduced motion never arm | Engaging motion without a scroll owner: the document remains the page's only scroll driver (EC-4) |
| In-page navigation | None | — | DOM order and anchors (`#npi`, `#record`, `#flow`, `#arc`, `#packet`, `#employers`, `#limits`) | No page-level carousel, rail, or chapter navigator |

## Sections, in DOM order

| # | Section | Owner component | Data source | Motion owner | Fallback | Conversion job |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Hero — “Get hired. Start working sooner.” + the NPI underline field (where the whole visual budget goes) + **hero folio figure** | `EasyHome` (`NpiEntry`) + `HeroFolio` + `heroLoop.ts` | Amendment F copy table; live lookup via `useCareerLoop` | `HeroFolio` one-shot tile arrivals (safety-stripped) + the ambient cadence-line trace (F.1); reduced motion stops both | SSR renders the complete folio; no-JS keeps the full frame; organization/unavailable outcomes answer in the entry column | Primary conversion: NPI → live record → onboarding handoff; secondary: explore opportunities |
| 2 | Resolution scene — the eight-row idle ledger (real registry, nothing read), the read log, the tally (“Counts are of lanes, not a score.”), next actions; **real rows replace the idle ledger on resolve** (recognition moment, UX-05) | `ResolutionScene` + `NpiReveal` + `ResolvingNarration` (`data-home-resolution`, `data-npi-reveal`) | **Real returned records only** — `state.capsule` from the live bootstrap + trust-state pairing (EC-26 stateful; no fixture path); idle rows derive from the real source registry with nothing read | `useSourceCheckSequence` pacing floor, then the reveal's one-shot CSS-transition stagger; no spinner, no percentage, nothing loops | Idle ledger is SSR-complete and honestly “Not checked”; reduced motion settles instantly (`is-instant`); unavailable/error compose their own honest states | The magic moment: “VitalCV already did work for me” — unknowns at equal typographic confidence |
| 3 | Trust flow — four hops (sources → your record → consent gate → employer exceptions queue), one barred source | `EasyHome` section + `TrustFlowFigure` | Illustrative process figure over the real lane registry; transcript carries the meaning | None — static by design | Both viewBox variants SSR'd; adjacent transcript + legend | Teach the consent boundary: nothing moves without the clinician; the decision stays with the employer |
| 4 | The arc — “One record, once — then every job after it.” Five beats (record · readiness · roles · apply with proof · start) + axis + duration honesty note | `ArcBeats` (`data-home-arc`, `data-home-duration-note`) | Static; no fabricated counts, dates, or ids; “Durations are pilot targets, not returned data” | None | SSR-complete | The reuse thesis in one sweep — why one record beats every folder |
| 5 | Roles — the live opportunity feed as the arc's Roles-beat expansion | `OpportunityHorizon` | `/api/opportunities?limit=3`; server-supplied source, URL, observation time, availability, application mode — the feed truth contract is untouched | None | Server-visible loading/error/empty boundary and `/explore` path; no invented rows | Discover real work; external roles leave via “View original listing”, integrated roles may use “Apply with VitalCV” — never “job board” |
| 6 | Truth boundary | `EasyHome` (`data-home-truth-boundary`) | Static, enumerated | None | SSR-complete text | Nothing has been sent; institution review decides |
| 7 | The exact packet — its shape, “what it refuses to decide”, the five-state legend, the reviewer mono note | `PacketArtifact` (`data-home-figure="packet-shape"`, `data-home-state-legend`) | Illustrative shape over real lanes; blank bars; “This is not a real submission”; quiet link → `/verify` | None | SSR-complete | Teach what an employer receives and what stays undecided — the trust asymmetry (EC-11.2) |
| 8 | Employers — four claims + the illustrative requirement ledger | `EmployerLedger` (`data-home-figure="requirement-ledger"`) | Static; no real role, no employer name | None | SSR-complete | Subordinate second audience → `/pilot` and `/employers` |
| 9 | Honest limits — three columns (access-gated · batch-published · not-yet-asked) | `EasyHome` limits section | Static truth boundaries over the real registry | None | SSR-complete | Publish the boundary of what we read before a visitor discovers it |
| 10 | Close + footer | `EasyHome` close band + footer | `sourceCadenceSentence()` (derived from `lib/trust/sourceLanes.ts`) | None | SSR-complete | Return to the real NPI entry; quiet exit links + source-freshness truth line (`data-home-source-cadence`) |

## Rollbacks

`PUBLIC_HOME_VARIANT=career-loop` (the One Real Loop, Wave 1075) and
`PUBLIC_HOME_VARIANT=film` (the evidence film, COMPETE-1) both still render,
each with preserved coverage. They serve under the shared eyebrow — the chrome
does not switch with the content variant. The amendment E/E.1 composition was
rewritten in place (the same island precedent as E replacing D.7); rolling back
to it is a git revert of the amendment F squash commit, recorded in
`docs/design/PARKED_VISUAL_ERAS.md`.

## Change protocol

Adding, removing, or re-ordering a section requires updating THIS manifest and
the composition-gate test in the same PR. A PR that changes homepage
composition without touching this file is incomplete.

**Amendment F (2026-08-16).** Founder directive, verbatim: *"Implement:
VitalCV Homepage v4.html"*. The full register, the copy of record, and the
thirteen port-manifest deviations standing law required are recorded in
`docs/design/VITALCV_EXPERIENCE_CONSTITUTION.md` § amendment F. The text-node
ceiling is **285** (measured 259 + headroom), superseding E.1's 110 — the
founder's composition is deliberately denser, and additions are still funded
by cuts.
