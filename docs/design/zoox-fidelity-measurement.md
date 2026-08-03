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

**Z0 MEASUREMENT IS COMPLETE.** Both passes are synthesised below. Every atlas
gap listed here has been closed, and three atlas statements are **SUPERSEDED**:

| Atlas statement | Status | Replaced by |
| --- | --- | --- |
| *"SLIDING ELEMENTS: not observed"* | **SUPERSEDED — WRONG** | Horizontal scroll-linked translation is present on 3 of 4 routes, up to 1,800px (125vw). See Pass 1 |
| *"exactly one sticky element per page"* | **SUPERSEDED — ARTEFACT** | The only `position: sticky` node on any route is a 0×0 element in the consent-manager shadow host. Zoox uses **zero sticky for product layout**; pinning is `fixed` + tall spacer |
| *"BUTTON / ICON INTERACTIONS: not observed"* | **CLOSED** | Measured: 334ms arrow travel of 100% own box; 500ms duplicate-slide icon swap. See Pass 1 P6/P7 |
| *"MOBILE RECOMPOSITION: not observed"* | **CLOSED** | Total recomposition — separate component trees. See Pass 2 |
| Media radii not captured | **CLOSED** | Full census, plus two radius laws. See Pass 1 P10 |
| *"0 reduced-motion blocks"* | **CONFIRMED, and strengthened** | 0 in CSS **and** 0 in JS; verified behaviourally pixel-for-pixel |

Atlas findings that still stand: one shared stylesheet ~3,338–3,532 rules;
9–13 `@keyframes`; one `scroll-snap` rule sitewide (unused by the rails); nav
fixed and transparent at every sampled depth; home autoplays, interior pages do
not; single type family; zero metrics or proof furniture anywhere.

## The five durable conclusions

1. **Horizontal scroll-linked translation is present on current live Zoox.**
2. **Product pinning is achieved visually through fixed positioning plus a
   spacer** — a reference implementation detail, *not* a mandate for VitalCV.
3. **Mobile uses genuine recomposition** — separate component and media paths.
4. **Reduced-motion support is absent in the reference and must not be copied.**
5. **Horizontal motion remains available to VitalCV** when it explains the
   product. No founder decision is outstanding on this.

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

## New measurements — PASS 2 (mobile 390x844 + desktop /community, /support)

**STATUS: SYNTHESISED.** Method: live `getComputedStyle` /
`getBoundingClientRect`, stylesheet rule enumeration, resource timing, HTTP
range checks, scripted scroll sampling. Nothing eyeballed.

**Standing caveat, applied honestly:** the automation pane throttles rAF to
~1.5fps. Durations declared in CSS are exact and marked MEASURED. Durations of
JS-driven tweens (overlay clip, button reveals, accordion height) are marked
**OBSERVED BUT NOT PRECISELY MEASURABLE** rather than guessed.

### CORRECTED 2026-08-03 — an over-claim, and how it resolved

An earlier revision asserted **"Zoox has NO horizontal rails, at any width, on
any route."** That was wrong, and the desktop pass has since refuted it
positively: **up to 1,800px (125vw) of scroll-scrubbed horizontal translation
on three of four routes.**

The error is recorded rather than deleted because the reasoning failure is
reusable: a null result from one detection method (section-level transform
sampling at six depths) was converted into a claim about the world. Movement
can arise through nested descendants, WebGL or canvas, video and image-sequence
progression, clip-path and masks, opacity state replacement, sticky
positioning, transforms *between* sample points, and interaction-triggered
states — none of which that method inspects. **A null result from one method is
not absence.**

### Two references, never blended

The fresh session must keep these apart and label every behaviour:

| Source | Definition |
| --- | --- |
| **REFERENCE A — CURRENT LIVE ZOOX** | What zoox.com visibly and measurably does today |
| **REFERENCE B — AWARD-WINNING ZOOX EXPERIENCE** | What Dogstudio and reliable historical records describe of the original immersive implementation (3D assets, real-time WebGL, scroll mechanics) |

Labels: `CURRENT LIVE — MEASURED` · `CURRENT LIVE — OBSERVED` ·
`HISTORICAL EXPERIENCE — DOCUMENTED` · `HISTORICAL EXPERIENCE — INFERRED` ·
`NOT CONFIRMED`.

Reference B is evidence about the historical award-winning experience. It is
**not** automatic proof of what the 2026 production site does, and it must not
be cited as though it were.

### VitalCV's horizontal movement — APPROVED, with a four-purpose test

> The document scrolls vertically. Individual media, evidence layers, record
> states, and navigation elements may travel horizontally **inside a scene**.

Horizontal movement must explain exactly one of four things, or it does not
ship:

| Purpose | What travels |
| --- | --- |
| **FORMATION** | Source fragments converge into the record |
| **INSPECTION** | The record moves beneath a stable review lens |
| **PERMISSION** | The travelling subset separates from held evidence |
| **HANDOFF** | The permitted subset crosses into the recipient frame |

**No horizontal movement merely because Zoox uses horizontal movement.**

Motion is expressed **proportionally**, never as arbitrary pixels — travel as a
fraction of the moving object's own width; parallax as a fraction of media
height; control-icon exchange as exactly one icon-box width. This is measured
Zoox discipline (gallery halves travel exactly 50% of their own width; parallax
is 9.1% of element height everywhere) and it is what survives responsive
resizing without a token per breakpoint.

### FOUNDER DECISION — no next-frame evidence preview

**The proposed 8–14vw preview of the next evidence frame is REMOVED.** Zoox's
measured completion-first behaviour is the right answer here, for a
VitalCV-specific reason: a half-visible media image creates curiosity, but **a
half-visible evidence record creates an unreadable claim** and implies
incomplete information.

Each evidence state must fully arrive, become stable and legible, communicate
its meaning, and only then transition.

Momentum is carried instead by: chapter-label movement · a neutral progress
hairline · aperture sequencing · the current object beginning its exit · masks
and clipping · source fragments converging · a recipient frame entering *after*
the record settles.

### Sticky vs fixed — do NOT rewrite the working system

Zoox's `fixed` + tall spacer is a reference implementation detail. **VitalCV's
existing sticky-stage architecture is preserved** unless a visual prototype
demonstrates it cannot produce the selected behaviour. The target is
*perceptual* parity: the scene appears pinned · the object progresses with
vertical scroll · the browser retains native scrolling · no horizontal overflow
· reduced motion can bypass the driver · mobile can stack the frames. Prefer
the simplest robust implementation that produces that result.

### What was measured, stated at its true strength

A **10% overscale reserve with vertical travel** — image at `scale(1.10)`
inside `overflow: hidden`, ~34px of vertical movement, container/content ratio
1.05, identical at both breakpoints.
CONFIDENCE: **CURRENT LIVE — MEASURED.**

### M2 — The menu is a clip dilation from the nav capsule's own footprint

The most transferable mechanic measured.

| Field | Value |
| --- | --- |
| INTERACTION | Mobile menu open |
| TRIGGER | 48x48 button, `aria-expanded` false→true |
| INITIAL STATE | Overlay already full-viewport, opacity 0, clipped to inset **top 12px / right 30% / bottom 90% / left 30%, radius 36px** — resolving to ~156x84px centred: the exact footprint of the nav capsule |
| FINAL STATE | Inset 0 all sides, radius 0, opacity 1 |
| TRANSLATION | **Zero.** `transform: none` throughout. All motion is clip geometry |
| DURATION / EASING | OBSERVED BUT NOT PRECISELY MEASURABLE (JS tween on custom properties) |
| MASK-CLIP | Four independently animated inset vars + animated radius. A second, independently clipped media panel inside starts at `scaleY(0.5)` from a top origin |
| LOW-MOTION RESULT | **None. Runs at full amplitude.** |
| CONFIDENCE | MEASURED (states), INFERRED (timing) |

**VITALCV TRANSLATION:** this is the grammar the Living Evidence Record needs
on mobile. A claim tapped in a list should **dilate from its own footprint**
into inspection and collapse back to it — not push a route in from the right.
Because the destination layout is final at frame 0, nothing reflows, and the
reduced-motion variant is a one-line branch to an instant swap.

### Mobile recomposition — the atlas gap, closed

**CONFIDENCE: MEASURED.** Not media queries: **separate component trees**
selected at runtime, with the desktop tree entirely absent from the mobile DOM.

| /how-to-ride | @1440 | @390 |
| --- | --- | --- |
| Document height | 33,308px = **37.0x** viewport | 11,089px = **13.1x** |
| Pinned stages | 1 (spacer 34.2 viewports) | 1 (spacer 1.0 viewport) |
| Masked sequence sections | 1 | **3** |
| Scrub canvas | 1728x1080 landscape | 231x500 + 331x500 **portrait** |
| Hero video | 3,755KB | 1,897KB (different encode) |

The homepage splits at **section** granularity — hero shared, content body
recomposed — so the boundary is drawn per-section, not per-page. Length parity
on block-composed pages (10.6x vs 10.8x) is expected; the pinned narrative
collapsing to 35% is the signature of real recomposition rather than squeezing.

### Radius is a CLIP variable, not a border property

**CONFIDENCE: MEASURED.** Buttons and tags have `border-radius: 0`; the 16px
and 12px roundness lives on an inner clipped wrapper — which is why it can be
animated at all. Measured ladder: large media **36px** · buttons/cards **16px**
· nav capsule **18px** · metadata tag **12px** · large media *frames* **0px**
(roundness applied to the media element, not the frame).

This anchors Z1's radius hierarchy to real numbers instead of invention.

### Motion tokens

**CONFIDENCE: MEASURED** (declaration counts across ~500KB CSS).
One curve carries half of all declarations: **cubic-bezier(0.2, 0, 0, 1)** (54
of ~110). Durations: 200ms (36), 500ms (36), 300ms (28), 100ms (14), **334ms**
(14), 667ms (4). Buttons are **334ms in, 500ms out** — faster in, slower out.
Image load fades 0→1 over **100ms**: a flash-guard, not a reveal.

### Two reveal geometries carry two meanings

**CONFIDENCE: MEASURED.**
- **Clip from centre** (`inset(50%)` → `inset(-1%+2px)`, with a deliberate 2–3px
  negative overshoot so the edge never grazes a subpixel boundary) = **arrival**.
- **Clip from a 12px corner seed**, growing diagonally = **qualifier attaching**.
- **Height + `overflow: hidden`** (no clip) = **disclosure**.

Three mechanics, three meanings, learnable without instruction. VitalCV should
adopt the split and make it lint-enforceable: a claim resolves from its centre,
a tier/freshness qualifier grows from a corner, expanding to show sources is a
height tween.

### Type scale

**CONFIDENCE: MEASURED.** **Zero `clamp()` in ~500KB of CSS.** Fixed steps at
768/1080. h1 40→32px, section 36→30px, sub-head 30→24px — a consistent 17–20%
step down. **The 12px uppercase eyebrow never scales.**

That last detail is the valuable one: a constant metadata voice means the
qualifier does not shrink relative to the claim it qualifies — exactly what a
truth surface needs, and testable at one size.

### Where the reference is the NEGATIVE example

| Finding | Measured | VitalCV response |
| --- | --- | --- |
| `prefers-reduced-motion` | **0 in CSS and 0 in JS**, across two independently bundled routes. Nothing anywhere queries the preference | Full designed linear composition, mandatory |
| `forced-colors` / `prefers-contrast` | 0 / 0 | Honour both |
| Touch targets @390 | **17 of 36 under 44px** — every secondary/tertiary control; social buttons 24px; footer legal 13px | Provenance controls are the ones that matter most; >=44px floor with padded hit areas |
| Media weight @390 | **~12.9MB**; homepage `-mobile-`/`-desktop-` files are **byte-identical** (matching Content-Length 7,797,664 and mid-file checksum) | Take the render-time source-selection mechanism; reject the budget |
| Footer canvas | Perpetually animating, every route, no escape | Reuse the existing engine, gate on reduced-motion AND intersection-observer pause |

The byte-identical asset pair is worth remembering: a naming convention that
*looks* like responsive discipline while shipping the same file twice is
exactly the class of thing that passes review and fails users.

### Scroll lock technique — worth adopting wholesale

**CONFIDENCE: MEASURED.** Root element `overflow: hidden` **plus** pausing the
scroll engine. `<body>` untouched — no `position: fixed`, no top offset, no
padding compensation. Scroll offset preserved exactly (verified at 800px).
For a record that "travels and arrives", losing scroll position on close is the
most damaging possible bug.

---

## New measurements — PASS 1 (desktop 1440x900: /, /how-to-ride, /where-to-ride, /know-your-ride)

**STATUS: SYNTHESISED.** Local Playwright/Chromium harness (the browser pane
kept reverting to a 390px viewport and was not trustworthy for desktop).
Machine-read `getComputedStyle` / `getBoundingClientRect` with per-frame rAF
recordings. All labels below are **CURRENT LIVE — MEASURED** unless stated.

### The over-claim is now positively refuted, not merely withdrawn

**Horizontal scroll-scrubbed translation EXISTS on three of the four routes**,
up to **1,800px = 125vw** of travel. My earlier "Zoox has no horizontal rails"
was wrong in substance, not only in epistemics. Measured:

| Element | Frame | Travel | % viewport width | Driving scroll |
| --- | --- | --- | --- | --- |
| Home travelling block | 1440x900 | 0 → +1,040px | **72.2vw** | ~1,800px (2.0vp), 0.58 px/px |
| how-to-ride incoming panel | 1440x900 | +1,800 → 0 | **125.0vw** | across a 36vp runway |
| how-to-ride outgoing panel | 1440x900 | 0 → −452px | 31.4vw | same |
| know-your-ride middle panel | 730x900 | −730 → −440 → −730 | 20.1vw each way | in-and-out |
| know-your-ride gallery halves | 682x770 | +341 → 0 | **23.7vw = exactly half their own width** | converge |

**Travel distance is a fixed fraction of the element's own width** — the
gallery halves move exactly 50% of their width. That is the discipline to take.

### Three atlas corrections

1. **"One sticky element per page" was an artefact.** The only `position:
   sticky` on any route is a 0x0 node inside the consent-manager shadow host.
   **Zoox uses zero sticky positioning for product layout** — pinning is
   `position: fixed` plus a tall spacer.
2. **"Sliding elements not observed" — wrong**, see above.
3. **"Nav transparent at every depth" — true but incomplete.** The bar never
   gains a plate or backdrop-filter, but it **clips itself down to a solid
   64x64px pill** on scroll.

### P1 — Navigation clips away rather than shrinking

Start: 1360x64 bar, 40px insets, 20px below viewport top, fully transparent.
End: clipped to `inset(0 calc(50% − 32px) round 16px)` — a centred 64px window
revealing a solid 64x64 logo plate; bar rises to 10px. **~830ms as four
staggered 334ms linear stages.** Menu button +100px out, control −100px, links
±30px. **Bar radius 24px, clip radius 16px — the chrome tightens as it
shrinks.** Nothing is hidden; the chrome is *masked away* to one identity token.

### P2 — The menu is a two-stage clip wipe with a live preview

Panel 738x880 at 16px radius, clipped to `inset(0 100% 0 0)`. Stage 1 settles
at 50% → 369px, the link column only. Stage 2, **on hover intent**, settles at
0% → 738px, revealing a **331x804 video preview, one per primary link, four
stacked in one slot**, paused at rest and user-initiated. Exponential decay,
**τ ≈ 175ms** (90% by ~250ms, settled ~615ms). **Radius held at 16px
throughout** — the corners never square off mid-wipe, which is what makes it
read as one object widening.

### P3 — Pinned scenes: the ratio, not the technique

Home: 3,600px section = 4.00 viewports of runway buying **exactly 1.00 viewport
of pin** — a 4:1 spend. `/how-to-ride` spends 37vp; **`/where-to-ride` has no
pin at all**. The restraint is route-scoped and deliberate.

### P4 — No next-frame preview anywhere

**Zero peek-ahead affordance on any of the four routes.** Frames are full-bleed
or exactly two-up. Grid is consistent: gutter 20px · two-up frames 682px
(47.4vw) · **gap 36px** · media radius **36px**.

⚠ **This contradicts the program brief**, which specifies an 8–14vw next-frame
preview for the source stage. Zoox does the opposite: each arrival completes
before the next begins. Worth a decision — a half-visible evidence card is an
unreadable claim.

### P10 — Two radius laws, both currently unstated in CD

1. **Radius is inversely proportional to frame size.** The same component
   measured **56px radius clipped small → 26px expanded to 1400px wide**; nav
   tightens 24 → 16px as it condenses.
2. **Radius equals gap.** Two-up frames sit at a 36px gap with a 36px radius —
   the negative space between two frames is exactly the corner they present to
   each other.

Census: 36px media/scene frames (dominant) · 24px nav chrome · 20px chips ·
18px inputs · **16px buttons and controls (30 occurrences, the most common)** ·
12px icon buttons · 0px on video elements themselves (the *container* carries
the radius).

### P6/P7 — Interaction tokens

Button hover: arrow travels **+20px = 100% of its own box**, 334ms, symmetric
on unhover (~320ms), `cubic-bezier(0.2, 0, 0, 1)`. Fill swells 2–3px via
**clip, not transform**, so the radius stays geometrically exact.
Icon hover: two identical icons one box-width apart both translate **+22px =
100% of own width** over 500ms — a duplicate-slide swap, never a cross-fade.
During a cross-fade both glyphs are simultaneously half-true, which on a trust
surface is the wrong reading. **Nothing loops anywhere.**

### P9 — Surface transitions: there are none

Across every sampled depth on every route, **zero elements animated
`background-color`.** Chapters are hard cuts on flat opaque fills. A 37-viewport
page with 125vw of horizontal travel spends *nothing* on surface interpolation.

**This settles a live VitalCV question:** an interpolating background leaves the
surface's semantic state undefined at every intermediate scroll position — a
reader who screenshots mid-transition captures a surface that means nothing.
Hard boundaries also keep CD-6's dark-surface confinement enforceable, because
you cannot half-enter a dark chapter.

### P8 — One parallax ratio for everything

Images held at `scale(1.1)` with translateY swinging **−45.6px on a 502px frame
and −33.8px on a 372px frame — both exactly 9.1% of the element's own height.**
One ratio, no per-component tuning, expressible as a single custom property.
Text rise ladder 10/20/30px by weight. **Reject** the display-word
`scaleY(0.174)` unfold on evidence surfaces: distorting a numeral or a date
mid-animation makes a machine-returned value momentarily unreadable.

### P11 — Reduced motion, confirmed behaviourally

Two contexts side by side, `no-preference` vs `reduce`, five scroll depths.
**Every value identical to the pixel.** Rail translate 0 / 119.6 / 585.9 /
1039.3 / 1040px in both; clip strings byte-identical. 0 media-query blocks,
0 blocked sheets — authoritative.

**The transferable warning:** because the scene motion runs through JS
per-frame writes, a reduced-motion path here *could not be added in CSS at
all*. Any VitalCV port of P1–P5 must put the check **in the driver, where the
scroll value is mapped to a transform or clip** — a stylesheet guard would be
orphaned by construction. And the correct reduced-motion end state is the
**settled** state, never the start state: a record that never opens is worse
than one that opens instantly.

### Two motion engines, running side by side

- **Chrome and controls:** declared CSS transitions, **334ms and 500ms on
  `cubic-bezier(0.2, 0, 0, 1)`**, plus 300ms `cubic-bezier(1, 0, 1, 0.6)` for
  colour only.
- **Scenes, nav morph, menu:** JS per-frame writes with `transition-duration:
  0s` — either a **linear 334ms tween** (nav) or a **critically-damped
  exponential lerp, τ ≈ 175ms, ~95% at 520ms, ~99.9% at 630ms** (menu, hero).

Nothing overshoots. Nothing loops.

---

## Measurement status: COMPLETE

Both passes are synthesised above. No measurement work is outstanding. Residual
items, recorded honestly and deliberately not chased — they do not gate the
storyboard: `/know-your-ride` tab-switch choreography was not timed; desktop
scrub-canvas frame timing was not captured under rAF throttling; home page
height varies 8.6k–13.6k px with media load (9,536px / 10.6vp is a settled
load).

## Reference-to-product matrix

The decisive table. **Adaptations are written; the reference-side numbers are
pending the measurement passes and are marked as such rather than invented.**

| Reference behaviour | Why it works | VitalCV scene | Exact adaptation | Truth risk | Performance risk |
| --- | --- | --- | --- | --- | --- |
| Transparent nav that never gains a plate | Nav sits over full-bleed media, so there is always contrast behind it | Global nav | **Already shipped (#1068)** — but ours sits over flat paper, where transparency means *no plate*, and the plate is earned on scroll and on expand | None | None |
| Full-width menu expansion | Edge-to-edge surface reads as the bar unfolding, not a dropdown | Global nav | Shipped; Z3 adds group crossfade + featured preview | None | Low — opacity/height only |
| Group switching | One panel, contents swap | Nav panel | Crossfade between group contents; never two panels | None | Low |
| Product-dominated hero | The object is the argument | Hero | Living Evidence Record at 55–75vw with the NPI field embedded in it | **Medium** — typing must never assert a source result | Low |
| Sticky media chapter | One idea per pin, no wasted scroll. Measured ratio: 4 viewports of runway buys 1 viewport of pin; the quietest route spends none | Source responses | Shipped; Z6 expands to four states. **Keep VitalCV's sticky architecture** — Zoox's fixed+spacer is an implementation detail, not a mandate. Target perceptual parity | Low | Medium — must stay transform/opacity |
| ~~Partially visible next frame~~ | **REJECTED.** Measured: Zoox shows no peek-ahead anywhere. Completion-first is correct here | Source rail | **No partial next card.** Momentum via chapter-label movement, a neutral progress hairline, aperture sequencing, the current object exiting, and the recipient frame entering *after* the record settles | **Would be high** — a half-visible evidence record is an unreadable claim | Low |
| Mask / clip reveal | Content arrives as if uncovered | Recognition | Clip reveal on the record's apertures | **Medium** — a fact must not be readable before it is true | Low |
| Object continuity across scenes | The eye tracks one thing | All | The eleven faces; same silhouette, edge, spine | None | None |
| Surface transition between sections | Tonal shift carries argument | Human review | One full-bleed Ink chapter; evidence inside stays paper | Low | None |
| Finite arrow exchange | Direction without idle motion | Every CTA | Shipped in `ProductAction` | None | None |
| Mobile restructuring | Phone gets its own composition | All | Independently composed; stages collapse, rails stack | None | **Reduces** payload |
| Reduced-motion fallback | — | All | ⚠ **Reject the reference here.** Atlas measured 0 reduced-motion blocks sitewide. VitalCV requires a complete designed linear composition | None | None |

The last row matters: on accessibility the reference is the **negative**
example, and the program must not inherit it while inheriting its ambition.
