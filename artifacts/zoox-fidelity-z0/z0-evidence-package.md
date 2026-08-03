# Z0 evidence package — the Living Evidence Record

Status: **complete, awaiting the next founder gate.**
Scale system and state behaviour approved 2026-08-03 (`FOUNDER CINEMATIC SCALE:
APPROVED`), including SEALED at 680 × 430.

This is component proof. It is **not** approval of the final homepage, the final
commercial narrative, or making the record the dominant homepage story, and no
work has moved from component proof into homepage implementation.

## Regenerate the whole package

```bash
node artifacts/zoox-fidelity-z0/treatments/build-b.mjs && node artifacts/zoox-fidelity-z0/treatments/build-scale.mjs && node apps/web/scripts/capture-evidence-record-frames.mjs && node apps/web/scripts/capture-evidence-record-storyboard.mjs && node apps/web/scripts/capture-evidence-record-evidence.mjs && node apps/web/scripts/capture-evidence-record-animatics.mjs && node apps/web/scripts/verify-evidence-record-scale.mjs && node apps/web/scripts/evidence-record-acceptance-matrix.mjs
```

## One composition module, no second copies

Everything below renders from `treatments/build-scale-scene.mjs` — viewport
table, argument field, crop offsets, and both storyboards. The review sheet, the
true-size frames, the before/after and all three animatics import it. The
scale-transition recording derives its width anchors from the same table rather
than repeating them, because a second copy of the numbers would disagree the
moment a viewport is retuned. That drift is the failure this programme exists to
correct.

## Contents

| Artifact | Where | What it proves |
|---|---|---|
| Five-viewport proof sheet | `treatments/b-scale.html` | 1366 / 1440 / 1536 / 1728 / 390 side by side |
| Desktop storyboard, 13 frames | `treatments/b-storyboard-desktop.html`, `frames/storyboard-desktop/` | the record's behaviour as narrative |
| Mobile storyboard, 9 frames | `treatments/b-storyboard-mobile.html`, `frames/storyboard-mobile/` | composed for the viewport, not compressed |
| Desktop animatic | `frames/animatic-desktop-1440.{gif,mp4}` | 212 frames, 8.8s — crop travels, object never resizes |
| Mobile animatic | `frames/animatic-mobile-390.{gif,mp4}` | 156 frames, 6.5s |
| Reduced-motion animatic | `frames/animatic-reduced-motion-1440.{gif,mp4}` | 117 frames, 14.6s — hard cuts, no travel |
| Scale transition | `frames/scale-transition-1366-1728.{gif,mp4}` | holds continuously, not only at the four sampled widths |
| 1440 before/after | `frames/1440-failure-before.png`, `-after.png` | the dead band rendered by the rules that caused it |
| Recognition strip | `frames/recognition-120px-all-eight.png` | eight faces at 120px, every word covered |
| Assertions | `apps/web/scripts/verify-evidence-record-scale.mjs` | 11 checks + a sweep of all 72 records |
| Acceptance matrix | `acceptance-matrix.md` | the founder's 12 demonstrations, machine-checked |
| Scale findings | `cinematic-scale-convergence.md` | the root cause and both dead bands |

## The storyboards

The narrative is the object's own behaviour, not a story told around it. It
arrives empty, takes an identity from the NPI, opens only the lanes actually
queried, grows past the frame as sources answer, opens a claim to its
provenance, lets the holder choose what travels, hands a subset over, and
closes. Captions describe what the record does; they introduce no claim the
object does not already carry.

Three beats carry the truth contract rather than the aesthetics:

- **Only what was asked** — four apertures stay closed because those lanes were
  not queried. Closed means "not asked", not "nothing found".
- **What VitalCV cannot read** — the unread lanes state their absence in the
  same voice as the read ones.
- **The recipient frame** — held rows are simply not in it, and their absence is
  not flagged. The recipient sees the same object, smaller and lighter; never a
  different card, never a score.

## Motion

The only motion the record is allowed is a change of **crop**. The object never
resizes, tweens, or dissolves between states; what changes is how much of it is
visible and which state it is in. The desktop and mobile animatics move the
record under a fixed stage. Nothing about the object's proportions animates.

**Reduced motion carries the complete argument.** Every state reachable in the
animated version is present as a hard cut, and the faces that exceed the
viewport appear at each reading position as separate cuts — which is what native
scrolling gives a reduced-motion user. Nothing is reachable only by animation,
so no claim is lost when motion is switched off. This is checked, not asserted:
D8 compares the state list of the reduced board against the animated one.

## What the assertions caught that measurement alone did not

Three defects passed every whole-record measurement and were found by looking at
the render. Each is now an assertion, so the next occurrence fails a gate:

1. **A ~90px void inside every row.** Provenance spanned two grid tracks, so
   both stretched to its height and the retrieval line was stranded. The
   record-level dead-band check read zero throughout. → intra-row top-alignment
   check.
2. **INSPECTED's opened claim overprinted itself.** It reuses `.evr-row`, so it
   inherited the hero grid and all seven of its detail lines were placed at
   column 2 / row 1, illegible. → general overprint check, plus a structural
   sweep across every sheet rather than the proof sheet alone, because the
   proof sheet carries only four faces and INSPECTED was not among them.
3. **The recognition test left the densest face readable.** INSPECTED's detail
   rows set colour inline, which outranked the `.covered` class rule. → the
   covered test now blanks descendants, and a coverage check walks every text
   node.

Two assertions were **wrong when first written**, and the corrections are
recorded because the correction is the finding: an absolute visible-height floor
demanded exactly the padding refinement 7 forbids, and a constant-aspect check
across all viewports could only have been satisfied by shrinking mobile type
below the readable floor. An assertion that contradicts approved doctrine is a
defect in the assertion.

## Invariants

Non-negotiable identity, enforced by the matrix:

- fixed top edge · aperture band · receipt edge · spine
- six sources, six apertures — the row count and the lane count agree
- claim, retrieval and provenance are three separate things, never one sentence
- closure behaviour: the record collapses from a fixed top edge

Deliberately **not** invariant:

- **Height** — content-driven. BLANK and SEALED fit the frame; DECIDING and
  RETURNED crop when their evidence exceeds the viewport. No minimum-height
  padding equalises the faces.
- **Aspect ratio on mobile** — the type floor holds text at design size, so
  mobile wraps more and is proportionally taller. Constant aspect is a claim
  about the desktop scales only.
- **Portrait proportion** — retired as an invariant by the SEALED ruling.

## Boundaries observed

- No production changes: zero diff from the merge base under any app or package
  source path (D10).
- No Z1 work: the homepage film components and route stylesheet are untouched
  (D11).
- Security lane unchanged: backend routes and workflows untouched; advisory
  GHSA-f9xv-h5c5-x537 remains draft and unpublished; the Railway access-log
  review is still blocked on access the founder holds (D12).
- No measurement taken before the unitless scaling correction is carried
  forward. Those numbers appear only as labelled historical "before" evidence
  in `cinematic-scale-convergence.md` §3.
