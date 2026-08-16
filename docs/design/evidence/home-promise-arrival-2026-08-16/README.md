# ThreePromises — sequenced arrival (2026-08-16)

Founder-selected motion reference, applied to the live Direction A homepage.

**Creative owner:** Claude (single owner, per FOUNDER_VISUAL_GATE §2).
**Authority:** founder decision 2026-08-16 — "apply the reference motion to the
live Direction A page," chosen over lifting the freeze for a new direction.
Freeze §1a permits work the Direction A recomposition sequences; this changes no
composition, register value, copy, or section order.

## What the reference actually does, measured

`huddle.works`, read in a browser rather than described:

| Property | Measured |
| --- | --- |
| Mechanic | native CSS `position: sticky`, four cards, `top` staggered 0 / 64 / 128 / 0 |
| Card height | 648px each, equal |
| Radius | 40px top on the first, 51.2px on the middle pair, bottom rounded on the last — the stack reads as ONE bound object |
| Scroll engine | none — `scroll-behavior: auto`, `body` transform `none`, no fixed transform wrapper |
| Canvas / video / keyframes | 0 / 0 / 0 |
| Transitions | 0.2s color · 0.4s background+shadow · 0.6s radius+border |
| `prefers-reduced-motion` rules | **0** |

Two conclusions. First, its durations already sit inside VitalCV's EC-29 bands
(200ms state transition, ~400ms transformation, 600ms narrative), so this needed
no new values — only tokens. Second, the reference has **no reduced-motion
provision at all**; VitalCV law requires one, so the implementation adds what
the reference lacks rather than porting it faithfully.

## Why the pinning mechanic was NOT ported

The stacking effect requires the card stack to exceed the viewport, so scrolling
has distance to move cards through. Measured against this content:

| Viewport | Stack height | Viewport height | Scroll distance available |
| --- | --- | --- | --- |
| mobile 390×844 | 767px (253 + 229 + 253 + gaps) | 844px | **0px** |
| desktop 1280×800 | section 481px | 800px | **0px** |

The three promise cards fit inside one screen at every supported width. Pinning
would have to be bought with padding — adding empty scroll distance to a page
amendment E.1 deliberately cut in half ("boring, text-heavy, confusing,
complicated and constipated"). The literal mechanic does not transfer.

What transfers is the **grammar**: accumulation. Three things arriving in
sequence and settling into one row — which is what the section already says
("Three things. That's the whole idea."). Motion explains the content rather
than decorating it (EC-10).

Also deliberately not ported: a hover/material settle on the cards. They are
non-interactive `<article>` elements, so hover feedback there is decorative, and
the founder's 2026-08-15 direction rejects decorative motion regardless of craft.

## Implementation

- Values are EC-29 **tokens**, never literals: `--duration-normal` (320ms,
  product-transformation band) with `--vt-ease-system`; stagger is
  `calc(--duration-stagger × 2)` and `× 4` (50ms sibling offset, band-exempt).
- Follows **this island's** entrance contract (`WorkSurface`'s
  static → armed → run → done), not the platform `Reveal` primitive — `Reveal`'s
  animation lives in the parked Calm Wave stylesheet, and importing a parked era
  into the amendment E register is what PARKED_VISUAL_ERAS forbids.
- No keyframes, no z-index, no scroll ownership (design-lint XS-1a/b/c pass).
- The server frame renders the FINISHED row; script only arms the enhancement.

## Measured behaviour (production build, `next start`)

| Condition | Stages reached | Min opacity | Staggered | Final |
| --- | --- | --- | --- | --- |
| Desktop normal | static → run | 0 | yes | all 1.00 |
| Reduced motion | **static only** | **1** | no | all 1.00 |
| Mobile 390 | static → armed → run | 0 | yes | all 1.00 |
| No-JS | static, text present | — | — | all visible |

Reduced motion never arms, so nothing is ever hidden — the finished row is the
composition, not a fallback (XS-7 / EC-25).

Frame-by-frame during the real transition (no slowdown):

| frame | card 1 | card 2 | card 3 |
| --- | --- | --- | --- |
| 2 | 0.70 | 0.00 | 0.00 |
| 3 | 0.91 | 0.42 | 0.00 |
| 4 | 0.98 | 0.88 | 0.22 |
| 5 | 1.00 | 0.98 | 0.88 |

## Files

- `before-desktop-1280.png` — baseline, before the change
- `promises-{desktop-1280,wide-1728,tablet-768,mobile-390}.png` — finished frame
- `promises-desktop-1280-reduced.png` · `-nojs.png` — the two accessibility frames
- `motion-frame-{early,mid,late}.png` — the arrival, mid-flight

Regenerate against a production build (never a dev build — it renders
differently and has produced misleading design evidence before):

```
node scripts/design-evidence/capture-promises-motion.mjs <outDir> <baseUrl>
node scripts/design-evidence/probe-promises-motion.mjs <baseUrl>
node scripts/design-evidence/filmstrip-promises-motion.mjs <outDir> <baseUrl>
```
