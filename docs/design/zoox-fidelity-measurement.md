# Zoox fidelity measurement

Program: issue #1069 · Phase Z0 · **No product code.**

Measuring a reference, not copying one. Behaviour is recorded as numbers and
prose. No Zoox code, CSS, class name, font, image, video, copy line, colour
value, vehicle geometry, or exact layout is reproduced here or anywhere in this
program.

## Baseline: what is already measured

`docs/design/reference-experience-atlas.md` §R1 holds a measured six-page Zoox
harvest. **This document does not repeat it.** The atlas's own stated gaps are
precisely what a cinematic program needs, and they are what Z0 exists to fill:

| Atlas field | Atlas result | Z0 obligation |
| --- | --- | --- |
| SLIDING ELEMENTS | *"Not observed"* — 0 transformed sections at six scroll depths | Measure whether horizontal travel exists at all, and if so its distance, driver and easing |
| BUTTON / ICON INTERACTIONS | *"Not observed — requires pointer choreography"* | Hover a primary button and an icon; record distance, duration, easing, finite vs looping |
| MOBILE RECOMPOSITION | *"Not observed"* | Full 390×844 pass: nav overlay, which sticky elements survive, whether rails stack, media switching, type scale, touch targets |
| Media radii | not captured | Measured radii on media containers, scene frames, buttons, nav chrome — Z1 defines a 24–56px aperture hierarchy and it must be anchored to real numbers |
| REDUCED MOTION | *"0 blocks, 0 sheets blocked"* | Confirm or correct |

Atlas findings that already stand and are **not** re-litigated: one shared
stylesheet ~3,338–3,532 rules; 9–13 `@keyframes`; exactly one `scroll-snap`
rule sitewide; **exactly one sticky element per page**; nav fixed at 51px and
transparent at every sampled scroll depth; home autoplays, interior pages do
not; single type family; zero metrics or proof furniture anywhere.

The single most useful thing the atlas already establishes: **restraint is the
mechanism.** One sticky element and ~9 keyframes produce a 12.6-viewport
effect. The ambition lives in composition and media, not in scroll machinery.
That finding independently supports CD-11's one-scroll-owner rule and is the
principle this program should copy — the *approach*, not the artefacts.

## Confidence labelling

Every record below is tagged **MEASURED**, **OBSERVED BUT NOT PRECISELY
MEASURABLE**, **INFERRED**, or **NOT OBSERVED**. No duration, radius or easing
is invented. Where the reference cannot be reliably measured, the field says so
rather than guessing — a fabricated easing curve would be worse than an absent
one, because it would be built on and never questioned.

## New measurements

**STATUS: IN PROGRESS.** Two measurement passes were dispatched (desktop across
`/`, `/how-to-ride`, `/where-to-ride`, `/know-your-ride`; mobile 390×844 plus
`/community` and `/support` on desktop), instructed to measure via
`getComputedStyle` and scroll sampling rather than by eye. **Their results are
not yet synthesised into this document.**

Per-interaction records will use the full field set:

```
REFERENCE ROUTE / VIEWPORT / INTERACTION / USER PURPOSE / TRIGGER /
INITIAL STATE / ACTIVE STATE / FINAL STATE / ELEMENT WIDTH / ELEMENT HEIGHT /
BORDER RADIUS / TRANSLATION / SCALE / OPACITY / DURATION / EASING /
STICKY OFFSET / STICKY DISTANCE / NEXT-ELEMENT PREVIEW /
MOBILE RECOMPOSITION / LOW-MOTION RESULT / VITALCV TRANSLATION /
DETAILS NOT COPIED / CONFIDENCE
```

See `zoox-fidelity-z0-handoff.md` for exactly what is outstanding and how to
resume.

## Reference-to-product matrix

The decisive table. **Adaptations are written; the reference-side numbers are
pending the measurement passes and are marked as such rather than invented.**

| Reference behaviour | Why it works | VitalCV scene | Exact adaptation | Truth risk | Performance risk |
| --- | --- | --- | --- | --- | --- |
| Transparent nav that never gains a plate | Nav sits over full-bleed media, so there is always contrast behind it | Global nav | **Already shipped (#1068)** — but ours sits over flat paper, where transparency means *no plate*, and the plate is earned on scroll and on expand | None | None |
| Full-width menu expansion | Edge-to-edge surface reads as the bar unfolding, not a dropdown | Global nav | Shipped; Z3 adds group crossfade + featured preview | None | Low — opacity/height only |
| Group switching | One panel, contents swap | Nav panel | Crossfade between group contents; never two panels | None | Low |
| Product-dominated hero | The object is the argument | Hero | Living Evidence Record at 55–75vw with the NPI field embedded in it | **Medium** — typing must never assert a source result | Low |
| Sticky media chapter | One idea per pin, no wasted scroll | Source responses | Shipped; Z6 expands to four states, 240–320svh spacer | Low | Medium — must stay transform/opacity |
| Partially visible next frame | Signals more without a control | Source rail | 8–14vw preview of the next frame | None | Low |
| Mask / clip reveal | Content arrives as if uncovered | Recognition | Clip reveal on the record's apertures | **Medium** — a fact must not be readable before it is true | Low |
| Object continuity across scenes | The eye tracks one thing | All | The eleven faces; same silhouette, edge, spine | None | None |
| Surface transition between sections | Tonal shift carries argument | Human review | One full-bleed Ink chapter; evidence inside stays paper | Low | None |
| Finite arrow exchange | Direction without idle motion | Every CTA | Shipped in `ProductAction` | None | None |
| Mobile restructuring | Phone gets its own composition | All | Independently composed; stages collapse, rails stack | None | **Reduces** payload |
| Reduced-motion fallback | — | All | ⚠ **Reject the reference here.** Atlas measured 0 reduced-motion blocks sitewide. VitalCV requires a complete designed linear composition | None | None |

The last row matters: on accessibility the reference is the **negative**
example, and the program must not inherit it while inheriting its ambition.
