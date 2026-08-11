# Reference R3 (Zoox) — component synthesis

**Date:** 2026-08-10
**Reference:** `https://zoox.com/` — captured stylesheet set
**Authority:** `docs/design/VITALCV_EXPERIENCE_CONSTITUTION.md` **as amended A-1 and A-2 (2026-08-09)**, read from `origin/main`
**Status:** shipped to `apps/web/styles/band-system-components.css`, scoped island, design-reference route only
**Supersedes the framing of:** `docs/design/zoox-r3-element-adoption-2026-08-10.md` (same day, earlier round)

---

## Why this round exists

The earlier R3 round took the reference's token and utility layer and turned down
most of its surface character: pills, gradients, frost and soft radii were all
recorded as rejections against "LOCKED" EC-20 rows.

**Those rows had been amended the day before.** That round was written against a
working-tree copy of the constitution **545 lines behind `origin/main`**, which
still carried the pre-amendment text. Read against main, the position is close to
inverted:

| Reference trait | Earlier round | Actual status on `origin/main` |
|---|---|---|
| Soft radii 10 / 20 / 24px, pills | "EC-20 LOCKED — 0–3px, pills retired" | **Authorised.** A-1 gives the scene register `--vt-shape-control` 10px, `--vt-shape-card` 20px, `--vt-shape-panel` 24px, `--vt-shape-pill` 9999px |
| Frost / blur surfaces | "EC-20 LOCKED — Glass: None" | **Authorised** on chrome and scene overlays, built from `color-mix` so it degrades |
| Atmospheric gradient | "EC-20 LOCKED — Gradient: None" | **Authorised** — one per viewport, behind a scene, carrying no meaning |
| Pill on a label | rejected with the CTA | **Authorised.** A-2: a word-label may be a pill |

The lesson is the one already burned into this repo in another form: *read the
controlling doc from `origin/main`, not from the branch you happen to be on.* A
stale constitution does not fail loudly — it silently converts permitted work
into recorded rejections, which EC-21 then makes citable as law.

---

## The synthesis

The components below are the reference's compositions, bound to VitalCV tokens.
Shape and surface are **tokens**, not values baked per component, so one set of
components serves both characters:

```
.bandsys        --bs-shape-action 0 · control/card/panel/label 2px   (near-sharp)
.bandsys-scene  --bs-shape-action 0 · control 10 · card 20 · panel 24 · label pill
                --bs-surface  → --vt-frost-bg   (frost, guarded by @supports)
```

Identical markup renders near-sharp graphite in the base registers and R3-warm in
the scene register. Nothing below is a second component.

| Component | Taken from R3 | Note |
|---|---|---|
| `.bs-action` | `Cta` — trailing arrow exits right, second arrives from left, label slides to meet it | Composition intact. Fixed-width glyph rails instead of R3's negative margin, which pulls the label's box under the arrow |
| `.bs-iconbtn` | `SquareIcon` — both icons driven from one custom property, slot 2 at `translate − 100%` | Adopted whole. The 24 / 32px **marks** are kept; the **target** is expanded to 44px around them |
| `.bs-segment` | `Pills` — one travelling indicator instead of N per-option grounds | Adopted, hardened. See below |
| `.bs-row` | `ItemList` — ground fades, label travels | Gated on `hover: hover`, not R3's `min-width: 1080px`, which is the wrong axis for a pointer question |
| `.bs-disclosure` | `Collapsable` — `:has(+ … [open])` divider coordination | Moved onto `<details>`, so it opens with no script; R3 needs a `data-open` attribute a script must set |
| `.bs-field` | `FormInput` — label parks at `1lh` | Adopted, hardened. See below |
| `.bs-tag` | `Tag` | Takes `--vt-shape-pill` in the scene register — A-2 permits it precisely because it is a label |
| `.bs-surface` | the floating frosted container | Frost token wired, **blur withheld** — see below. No shadow |
| `.bs-reveal` | the clip-path inset wipe used across R3's sections | Rebuilt on `animation-timeline: view()` — no JS, no observer to miss a late mount |
| `.bs-skeleton` | `SkeletonCard` | Flat tint, no shimmer |

### The one genuine divergence

**A-2 makes silhouette carry meaning: square means you can act on it, rounded means
it names something.** So an action takes radius 0 even in the scene register, while
R3 rounds its CTAs to 16px. Everything else about R3's action — the arrow
overtaking the label, the inverse fill, the timing — comes across intact.

Measured across all three registers, at 1280 and 390: `border-radius: 0px` on
`.bs-action`, `.bs-iconbtn`, `.bs-segment__option`; `9999px` on `.bs-tag` in the
scene register.

A-2 is founder-ratified and EC-22 reserves amendment to the founder, so **making
the CTA round is an amendment request, not a stylesheet edit.** Flagging it as the
one open question rather than deciding it here.

---

## Two mechanisms carried across hardened

Neither changes how anything looks. Both are defects in the reference.

### 1. The segmented control is unreadable before its script runs

R3's `.pill.active` sets only `color: var(--active-text-color)` — `#fff` on the
default register. The ground beneath it comes **exclusively** from `.activeBlob`, a
JS-measured, JS-positioned element. Before that script runs — first paint,
hydration error, JS disabled, blob mid-measure — the selected option is white text
on a white ground. Not unanimated: **unreadable**. EC-4 requires no-JS to be a
first-class composition.

The fix inverts which layer is the fallback:

- CSS alone draws the selected option — 2px ink rule, weight 500, `aria-current`.
- JS opts **in** by adding `.bs-segment--armed`, which retires the static rule and
  hands the job to the travelling bar.

Same end state, never both at once, and the failure mode becomes "does not
animate" rather than "cannot be read".

**Measured with JavaScript disabled** (Playwright, `javaScriptEnabled: false`):

```
segmentArmed:          false          ← script never ran
activeBorderColor:     rgb(242,241,237)  ← indicator painted
activeWeight:          500
indicatorOpacity:      0              ← travelling bar correctly absent
detailsWorksWithoutScript: true
```

### 2. The floating label must not rename the control

The `1lh` parking trick is the good idea and is adopted. The known failure of the
pattern is not: the label gets swapped for a `placeholder` or moved into
`aria-label`, and the control's accessible name changes between empty and filled.
Here the `<label for>` stays in the accessibility tree at all times and only its
**position** animates. `:placeholder-shown` drives the rest state, so no `.active`
class needs maintaining (R3 tracks it in React).

Measured: accessible name `"NPI number"` when empty, `"Full name"` when filled —
stable in both states.

### And one thing that cannot be synthesised, only added

R3 ships **zero `prefers-reduced-motion` blocks across its entire stylesheet set**
while running scroll hijacking, GSAP sequences and clip transitions on nearly every
section. There is nothing to adopt there. Every component here resolves to a
complete, legible rest state with motion removed, and `.bs-reveal` is gated on
`prefers-reduced-motion: no-preference` rather than undone afterwards.

---

## Verification

Rendered, not inferred. The browser pane reported `innerWidth: 0` and could not lay
the page out — the known pane artifact — so all geometry is measured under
Playwright, per `visual_verification_method`.

| Check | Result |
|---|---|
| Interactive targets ≥44px — 3 registers × 1280 and 390 | **16 targets per register, 0 under floor** |
| Icon instrument | mark `24px`, target `44px` |
| Action radius, every register incl. scene | `0px` |
| Tag radius, scene register | `9999px` |
| Surface, scene register | radius `24px`, `backdrop-filter: blur(14px)` |
| Horizontal overflow at 390px (EC-6) | none — `scrollWidth === innerWidth` |
| Field accessible name, empty vs filled | stable |
| No-JS composition | segment readable, `<details>` opens, rules drawn |
| React hydration / warnings | none |
| Reveal — fully-visible band is fully revealed | yes, at 900px and 3000px viewports |
| Reveal — focus ring inside a revealed band | not cropped; clip clears the box by 8px |
| Gate tests | 23/23 (`band-system-ec20`, `band-system-components`) |

### Two defects found in `.bs-reveal` after first writing this record

Both were mine, both found by measuring rather than reasoning, and both are the
same underlying mistake: assuming a clip-path reveal's *end* state is harmless.

1. **The clip cropped focus rings.** `animation-fill-mode: both` persists the end
   state, so ending on `inset(0)` leaves every revealed band permanently clipping
   the outline of any control near its edge. Invisible on this page — band padding
   happens to give 27px of slack — and it would have surfaced the first time
   someone placed a control flush to a band edge. Fixed by ending the wipe
   *outside* the border box: negative `inset()` values are valid and honoured
   (verified: `inset(-8px)` computes as authored). Pinned by a gate test.

2. **A fully-visible band could sit unreadable.** With `animation-range: entry 8%
   cover 26%`, a band measured at a 3000px viewport painted **93.8% clipped while
   entirely on screen**. Scrolling finishes it, so it was not stranded here — but
   on a page shorter than the viewport there is no scroll available to finish it.
   Fixed with `animation-range: entry 0% entry 100%`, which makes "fully visible"
   and "fully revealed" the same condition. Re-measured at 3000px: 2 fully-visible
   bands, 0 not fully revealed.

The general point worth carrying: a `cover`-based range couples reveal completion
to how much of the viewport an element occupies, which is not a property the
author controls. An `entry`-based range couples it to visibility, which is.

### Frost is wired but withheld — deliberately, and not on the amended row

A-1 permits frost on a scene surface, and this file originally carried
`backdrop-filter: blur(14px)`. **`__tests__/glass-ratchet.test.ts` caught it** (148
against a baseline of 147).

The ratchet's failure message cites EC-20 *"Glass treatment: None"* — the row A-1
superseded — so the guard is, strictly, enforcing retired doctrine. That was not a
licence to widen it. `docs/design/glass-retirement-scope-2026-08-10.md` is an
**active workstream from the same day**: three painting glass surfaces in root
chrome fixed, ~147 held flat, the tail sequenced. Its strongest basis is not the
amended row at all — **EC-10 is Class A and bans the blurred-navbar form by name.**

So the blur was removed rather than the baseline widened. Nothing is lost: A-1
builds frost from `color-mix` specifically so it degrades to a solid translucent
panel, and `--bs-surface` still binds `--vt-frost-bg`, making this one line to
restore once the retirement settles. On this island the token currently resolves to
its fallback, because the scene root's token layer is not imported here.

**Widening another lane's ratchet to land your own work is the anti-pattern**, even
when the amended clause would permit the work.

### A broken comment passed every gate

Making that edit, a comment block was closed early, leaving ~18 lines of prose as
bare CSS followed by an unmatched delimiter. Every rule after it stopped parsing and
`.bs-surface` rendered nothing — **while all 45 assertions across five gate files
passed**, because the comment-stripping regex consumed the mess. Only loading the
page caught it.

A structural test now asserts balanced comment delimiters and braces
(injection-proven: reintroducing the early close fails exactly that assertion). The
lesson generalises past this file: **a content gate that scans a stylesheet cannot
tell you the stylesheet still parses**, and every gate here strips comments first,
which is precisely what hides this failure.

**Injection-proven.** Reproducing R3's actual defect — reducing the static
`aria-current` rule to a colour change only — fails exactly one test, *draws the
selected segment option without script (EC-4)*, and nothing else: 11 passed, 1
failed. File restored and re-verified by checksum.

---

## One fix to the primitives layer

`.bs-rule--reveal` in `band-system.css` defaulted to `transform: scaleX(0)` and
relied on script adding `.is-revealed`. With scripting off, the rule never drew —
the same stranding class as the opacity-0 scene that shipped invisible with every
gate green. Resolved with `@media (scripting: none)`, which avoids the flash an
arm-after-hydration approach would cause. Measured with JS disabled: `matrix(1, 0,
0, 1, 0, 0)` — drawn.

That media query covers JS *disabled*, not JS *errored*. Content that must survive
a failed hydration should use `.bs-reveal`, whose animation is scroll-driven and
needs no script at all.

---

## Design Handoff References

EC-3 · EC-4 · EC-5 · EC-6 · EC-20 (as amended A-1, A-2) · EC-21 · EC-22
