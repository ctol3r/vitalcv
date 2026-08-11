# Reference R3 (Zoox) — element adoption record

> ## ⚠ CORRECTION — this document's Reject table cites superseded law
>
> **Added 2026-08-10, same day.** The measurements and the `--bs-track` analysis
> below are sound and stand. **The clause basis of the "Reject" section does not.**
>
> This record was written against a working-tree copy of
> `VITALCV_EXPERIENCE_CONSTITUTION.md` that was **545 lines behind `origin/main`**
> and still carried the pre-amendment EC-20 table. Amendments **A-1 and A-2 landed
> 2026-08-09**, the day before, and changed four of the rows cited here:
>
> | Rejected below as | Actual status on `origin/main` |
> |---|---|
> | Pills — "EC-20 LOCKED, pills retired" | **Permitted for word-labels** (A-2). Actions are square — that is the clause that rejects R3's *CTAs*, not a blanket pill ban |
> | Gradients — "EC-20 LOCKED, Gradient: None" | **One atmospheric wash per viewport** permitted behind a scene (A-1). Gradients on controls/labels remain barred |
> | Blur — "EC-20 LOCKED, Glass: None" | **Frost permitted on chrome and scene overlays** (A-1), built to degrade. Evidence surfaces stay solid |
> | Radii > 3px — "0–3px" | **Scene register scale is 10 / 20 / 24px + pill** (A-1); near-sharp is retained for evidence and operational surfaces |
>
> **Do not cite this document's Reject table under EC-21.** The rows it names are
> no longer the law it quotes. Rejections that survive on their own merits —
> sub-44px targets (EC-5), the absent reduced-motion path (EC-4), `outline: none`
> (EC-5), the floating-rounded-container eyebrow (EC-10 Class A) — are unaffected,
> as those clauses were not amended.
>
> The component layer was subsequently synthesised against current law in
> **`docs/design/zoox-r3-component-synthesis-2026-08-10.md`**, which supersedes the
> framing here.
>
> **Standing lesson:** read the controlling doc from `origin/main`, not from the
> branch you are on. A stale constitution fails silently — it converts permitted
> work into recorded rejections, and EC-21 then makes those citable as law.

**Date:** 2026-08-10
**Reference:** `https://zoox.com/` — captured stylesheet set (6 sheets, 3426 rules measured live)
**Authority:** `docs/design/VITALCV_EXPERIENCE_CONSTITUTION.md`
**Status:** architecture adopted into `apps/web/styles/band-system.css`; skin rejected.

---

## Verdict

**One idea in this reference is worth more than the rest of the file combined — and it ships
subtly broken. Adopting it meant fixing it.**

R3 computes grid column spans *arithmetically* rather than requiring grid parentage, so any
element anywhere in the tree can align to the page grid. That is a genuinely good answer to a
real problem (a figure breaking out of prose, a caption pinned under a 6-column asset), and it
is directly useful to **UX-02 item "precise grid"**, which is PENDING.

Their implementation resolves the container with `100svw`. **Viewport units count the
scrollbar.** Measured on their own page at 1280×800:

| | width |
|---|---|
| R3's painted 4-column span | **402.66px** |
| A true 4-column grid child | **397.67px** |
| Drift | **+4.99px** |

That is exactly `scrollbar (15px) × 4/12`. The error scales with the span, so the widest
elements — the ones whose misalignment is most visible — are the most wrong. It is invisible on
macOS overlay scrollbars and appears on Windows.

Our version derives the track from `100cqw` (container query unit = the container's content box,
scrollbar already excluded). Measured on `/design/band-system` at 1280×800 **with a 15px scrollbar
present**: a `.bs-span-4` outside any grid and a real `grid-column: span 4` child both paint
**384.33px**, both at `left: 32`, delta **0.00px** on width and right edge.

Everything else here is either a rejection or a small typographic pickup.

---

## Measured facts about the reference

Live, at 1280×800, extension chrome excluded:

| Property | Value |
|---|---|
| Root font-size | **10px** (`html { font-size: 10px }`) |
| Interactive controls | 42 |
| Controls under the 44px floor | **23 (55%)** |
| Smallest targets | social icons 24×24, "Support" 45×12, an input at 8×6 |
| `prefers-reduced-motion` blocks | **0 of 3426 rules** |
| `outline: none` rules | 11 |
| Painting gradients | 2 |
| Painting shadows | 3 |
| Elements with radius > 3px | 81 |

The zero is the notable one. R3 runs smooth-scroll hijacking, GSAP scroll sequences, and
clip-path transitions on nearly every section, and offers **no reduced-motion path at all**.

---

## Adopt

| Element | Where | Clause basis |
|---|---|---|
| Arithmetic column span without grid parentage | `--bs-track`, `.bs-span-1…12` | EC-20 grid + page width; serves UX-02 "precise grid" |
| Four-step rhythm scale with a mobile/desktop pair per step | `--bs-rhythm-xs…lg`, `.bs-pad-t-*` / `.bs-pad-b-*` | EC-20; serves UX-02 "spacing rhythm" (PENDING) |
| `text-wrap: balance` on headings | `.bs-heading` | EC-20 typography — evens the rag without a hand-placed `<br>`, so it survives translation |
| Dual-ring focus, **over media only** | `.bs-ring-media` | EC-5 visible focus |

**On the rhythm scale — the shape, not the numbers.** R3 emits the mobile/desktop pair inside
every block component's own padding classes: eight near-identical class bodies per component,
repeated across ~30 components. Here the pair lives once on the token and the utilities read it,
so a rhythm change is a token edit. The values proposed (24/40/56/96 mobile · 32/60/80/160
desktop) are **a proposal for UX-02, not a locked row** — item 3 is still PENDING and this
does not pre-empt it.

**On the focus ring — adopted narrowly, and the reason matters.** R3 rings every focused control
twice: dark outline plus a white pseudo-element border. Read closely that is a *workaround*.
Their focus colour is the hardcoded literal `#0d1212`, which would vanish on their own dark
register, so the second ring exists to rescue it. Our focus colour is `var(--bs-ink)`, rebound
per register, so one ring already contrasts in both. The second ring is redundant **except over
photography or video**, where neither register token is guaranteed contrast. That case is real,
so `.bs-ring-media` exists for it and nothing else.

---

## Reject

| Element | Clause | Note |
|---|---|---|
| Pills — radii 1.2rem–3.6rem throughout (81 painting elements) | **EC-20 LOCKED** — 0–3px, pills retired | Rejection law under EC-21 |
| Gradients — `GradientTag` (3 variants + oklch), conic-gradient progress rings, gradient scrims | **EC-20 LOCKED** — Gradient treatment: None | |
| Shadows — `0 3rem 3rem 0 rgba(23,33,30,.031)`, `0 0 18px rgba(0,0,0,.2)` | **EC-20 LOCKED** — card grammar, no shadows | |
| `filter: blur(12rem)` behind slide copy | **EC-20 LOCKED** — Glass treatment: None | |
| Floating rounded nav container | **EC-10 Class A** — bans the floating-rounded-container eyebrow *by name* | |
| Sub-44px targets (23 of 42) | **EC-5** | Same failure mode as R2 (69%); this is 55% |
| No reduced-motion path anywhere | **EC-4** — static and reduced-motion are first-class | |
| `outline: none` on `:focus:not(.focus-visible)` × 11 | **EC-5** — never remove the indicator | Legacy polyfill pattern |
| `font-kerning: none` + `font-feature-settings: "kern" off`, globally | EC-20 typography | Deliberate there; here it degrades the locked Geist pairing for no stated benefit |

---

## The 10px root trap

R3 sets `html { font-size: 10px }` so that `1rem = 10px` and every authored rem value reads as
"px ÷ 10". **Their rem values cannot be pasted into VitalCV.** Under our 16px root, a pasted
`1.2rem` renders 19.2px, not the intended 12px — a **60% overshoot**.

This is the same class of trap as R2's 18px root, in the opposite direction, and it is worth
stating as a standing rule rather than a one-off:

> **Read the reference's root font-size before copying any rem value.** R2 = 18px (pasted rems
> shrink ~11%). R3 = 10px (pasted rems inflate 60%). Neither matches ours.

Every value in `band-system.css` is authored against a 16px root.

---

## What shipped

`apps/web/styles/band-system.css` (scoped island under `.bandsys`, imported only by its own
route — it cannot alter an existing surface):

- `--bs-track` + `.bs-span-1…12` — container-relative column span
- `--bs-rhythm-xs…lg` + `.bs-pad-t-*` / `.bs-pad-b-*` — responsive rhythm on tokens
- `.bs-heading` — balanced rag, replaces two hand-styled `h1`s in the reference page
- `.bs-ring-media` — dual ring for controls over media, built from a pseudo-element (not
  `box-shadow`, which EC-20's card grammar bans — a focus ring is not the place to carve an
  exception the gate would then have to special-case)

`apps/web/app/design/band-system/BandSystemReference.tsx` gains band 04, an **alignment proof**:
a real grid child directly above a `.bs-span-4` with no grid parent, both `data-probe`-tagged so
the claim is measurable and not just visible.

`apps/web/__tests__/band-system-ec20.test.ts` gains two assertions:

- the track is container-derived, not viewport-derived (`100cqw` present, no `*vw` unit, and a
  `container-type: inline-size` exists to make the unit meaningful)
- each rhythm step is declared exactly twice (mobile + ≥60em), so the pair can't silently rot

**Injection-proven.** Swapping `100cqw` → `100svw` — the reference's actual bug — fails the new
test and nothing else: 9 passed, 1 failed. The file was restored and re-verified.

---

## Corrections logged against this workstream

| Claim | Correction |
|---|---|
| "6/6 band-system controls at exactly 44px" *(reported last round)* | **Wrong for 2 of 6.** Read off `toFixed(1)`-rounded numbers. The true height was **43.984375px** — `.bs-link`'s padding was *derived* to hit 44 exactly (22.4 + 10.8 + 10.8), but browsers quantise layout to 1/64px, so the used values summed to 43.984375. Fixed by declaring `min-block-size: 44px` rather than computing it. Re-measured unrounded: min height **44**, 6/6. |
| — | The static EC-20 test passed throughout that failure, exactly as its own docstring warned: it asserts the floor *declaration* exists, not that it *computes* to 44px. A rendered measurement is still required; the test is a tripwire, not a proof. |

**Method note.** Screenshots of the alignment band came back blank at a scrolled offset — the
known browser-pane repaint artifact. The alignment evidence here is *measured* (`getBoundingClientRect`
on tagged probes), which is the stronger claim anyway. Per `visual_verification_method`, the pane
is not the verification surface.
