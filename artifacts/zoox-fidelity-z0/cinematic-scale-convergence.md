# Cinematic-scale convergence — Living Evidence Record

Status: **awaiting `FOUNDER CINEMATIC SCALE: APPROVED`**
Scope: Treatment B at 1366×768, 1440×900, 1536×864, 1728×1117, 390×844.
Nothing here ships. The record is not on the production homepage.

Regenerate everything:

```bash
node artifacts/zoox-fidelity-z0/treatments/build-b.mjs && node artifacts/zoox-fidelity-z0/treatments/build-scale.mjs && node apps/web/scripts/verify-evidence-record-scale.mjs && node apps/web/scripts/capture-evidence-record-frames.mjs && node apps/web/scripts/capture-evidence-record-evidence.mjs
```

---

## 1. The root cause was not composition

The 1440 dead region was a symptom. Underneath it, **the proportional scaling
system had never run at all.**

```css
--u: calc(var(--w) / 420);   /* --w is a LENGTH → --u is 2.14px, not 2.14 */
font-size: calc(15px * var(--u));   /* px × px → invalid → declaration dropped */
```

Dividing a length by a number yields a length. Multiplying px by px is invalid,
so the browser dropped **all 37 declarations** that used `--u`. Every size that
was supposed to scale — type, padding, aperture height, spine width, seal —
rendered at its fixed 420px base value at every record width. "One design at
four sizes" was a claim the stylesheet could not have been keeping.

Fix: the width arrives unitless as `--wn`; both the pixel width and the unit
derive from it.

```css
--w:  calc(var(--wn, 420) * 1px);
--u:  calc(var(--wn, 420) / 420);   /* UNITLESS — a multiplier must be a number */
```

This matters beyond this sheet: **every measurement taken before this fix
described an object that was not scaling.** Numbers from earlier passes in this
programme should not be carried forward.

## 2. What the working scale then revealed

With scaling live, the record's height is a function of how much evidence has
come back. At a 560px width:

| face | height | ratio | meaning |
|---|---|---|---|
| SEALED | 355 | 0.63 | closed |
| BLANK | 567 | 1.01 | nothing checked |
| DECIDING | 964 | 1.72 | choosing what travels |
| RETURNED | 1435 | 2.56 | six sources answered |

Six sources' worth of claim, retrieval and provenance, set at readable type, is
taller than a 900px viewport. That is the composition, not a defect to pad
away. **The object grows as sources answer and the stage crops it.** The frame
is full because the record overflows it rather than floating in it, and the
crop says the record continues — which is what the next scroll does.

BLANK and SEALED fit the frame; RETURNED and DECIDING are cropped. That
difference is legible and is the point.

## 3. The empty band, and the one my first fix created

**Original failure (1440×900).** Record 1008×726 with a 1008×295 empty band
inside it — 40.6% of the record's height. Cause: `min-height: calc(var(--w) *
0.72)` sized the object from its *width*, forcing 726px when its content needed
~430px, and `flex:1` on the body and rows stretched to fill the difference.

**The band I then introduced.** Removing the floor fixed the foot of the record
and the whole-record measurement read zero — but once type actually scaled, a
new void opened *inside every row*: ~90px between "Identity" and "Located in
the NPPES registry". Provenance spanned two grid tracks, so both stretched to
its six-line height and the retrieval line was stranded at the bottom of a
track it did not fill.

A whole-record measurement cannot see this. It was caught by looking at the
render, and only then written into an assertion. Provenance is now a *sibling*
of the assertion rather than a child of it, and all three parts sit in one grid
row with `align-items:start`.

| 1440 × 900 | before | after |
|---|---|---|
| record | 1008 × 726 | 680 × 1356 |
| empty band above receipt | 295px (40.6%) | 0px (0.0%) |
| first row height | 48px | 173px |
| type scaling | inactive | active |

Removing the intra-row void alone made RETURNED **22% shorter** at the same
width (aspect 2.56 → 1.99) without cutting a single word.

`frames/1440-failure-before.png` is not a redrawing — it reinstates the exact
defective declarations over the current stylesheet, so the failure is rendered
by the rules that caused it.

## 4. Space outside the record

Per the A/B distinction: space inside the record is a defect; space outside it
must be purposeful. What remains, and why:

- **RETURNED / DECIDING** — none. The record is cropped by the stage edge.
- **BLANK** (138–220px below) — the record is short because nothing has been
  checked. That is the state being expressed.
- **SEALED** (369px below) — the rows have collapsed. In motion this space is
  *created* by the record closing, and it is where the record just was. The top
  edge stays pinned across every face, so the object never jumps between
  states; it grows and closes from a fixed line.

## 5. Mobile is composed, not compressed

Text no longer scales *down* below the 420px design size:

```css
--ut: max(1, var(--u));   /* structure scales both ways; type only scales up */
```

Without this the mobile claim line fell to 12.5px — under the CD-15 readable
floor, and the definition of a shrunken desktop record. With it, mobile holds
15px and the record wraps more, so it is **taller relative to its width** than
desktop (2.90 vs 1.99). That is intended, and it means the constant-aspect
assertion is a claim about the *desktop* scales only. Mobile is instead held to
being the same object: same spine, same six apertures, same six rows, same
receipt edge, same top-edge-to-width ratio.

## 6. Assertions

`apps/web/scripts/verify-evidence-record-scale.mjs`, run against the sheet:

| assertion | result |
|---|---|
| no dead band inside the record | 0px on all 11 scenes |
| no row stretched beyond its content | 0px on all 11 scenes |
| no dead space *within* a row | every hero row top-aligned |
| claim and provenance never concatenate | clean on all rows |
| recognition test covers every word | no leaks |
| constant aspect across desktop scales | ≤0.9% spread per face |
| mobile is the same object | spine, 6 apertures, 6 rows, receipt |
| record commands the frame | ≥38% of stage height everywhere |
| type above the readable floor | ≥15px everywhere |
| record never overflows the stage sideways | 0px |
| argument never collides with the record | none |

Two of these were **wrong when first written** and are recorded here because
the correction is the finding:

- A `visible ≥ 380px` floor failed SEALED and mobile BLANK. It demanded exactly
  the padding refinement 7 forbids — a sealed record is a closed record. The
  assertion was wrong, not the design; it is now a share of the frame.
- A constant-aspect check across *all* viewports failed mobile at 45.6%. It
  would have been satisfied only by shrinking mobile type back down. Scoped to
  desktop, with a structural same-object check for mobile.

An assertion that contradicts approved doctrine is a defect in the assertion.

## 7. SEALED is landscape — settled

At 680px the sealed face is 680×430 (ratio 0.63): a wide closed panel rather
than the portrait silhouette named in B's identity. It cannot be both
content-driven and portrait at hero width without padding, which refinement 7
forbids.

**Founder ruling, 2026-08-03: accepted.** The landscape proportion is a
consequence of state, not an exception to hide. Refinement 7 outranks the
portrait description — the record must stay content-driven and must not be
padded to resemble RETURNED. SEALED remains unmistakably the same object
because it keeps the identity anchors: same width, same fixed top edge, same
aperture band, same material and border system, same receipt edge, same
closure logic. The change in silhouette *means* something — the evidence has
collapsed and the record has closed.

Portrait is therefore removed as an invariant of the object. The invariants are
the anchors listed above, plus the source structure and the
claim/retrieval/provenance separation.

## 8. Evidence set

Under `treatments/frames/` (regenerate with the commands above):

- `1366-blank` `1366-returned`
- `1440-blank` `1440-returned` `1440-deciding` `1440-sealed`
- `1536-returned` · `1728-returned` `1728-deciding`
- `390-blank` `390-returned`
- `recognition-120px-all-eight` — all eight faces at 120px, every word covered
- `1440-failure-before` / `1440-failure-after`
- `scale-transition-1366-1728.gif` / `.mp4` — 1366→1728→1366, 52 frames,
  record width interpolated continuously between the four anchors, proving the
  design holds between the sampled widths and not only at them

## 9. Not done

- Z1 has not started. The production homepage is untouched.
- The 13 desktop frames, 9 mobile frames and 3 animatics are gated behind
  `FOUNDER CINEMATIC SCALE: APPROVED`.
- Security lane is separate and unchanged: advisory GHSA-f9xv-h5c5-x537 remains
  draft and unpublished; the Railway access-log review is still blocked on
  access the founder holds.
