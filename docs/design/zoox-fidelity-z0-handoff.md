# Z0 handoff

Written so a fresh session can continue **without any conversational memory**.

```
CURRENT MAIN SHA:   78e9aea10c7ea318226de83587e77c3c662400ec
Z0 BRANCH:          design/zoox-fidelity-z0
Z0 PR:              (draft — see issue #1069 for the link)
ISSUE:              #1069  VitalCV Zoox-fidelity cinematic experience
```

## Measurement passes — COMPLETE

Both synthesised into `zoox-fidelity-measurement.md`. **No measurement work is
outstanding. Do not re-measure Zoox.**

- **Pass 1** — desktop 1440x900: `/`, `/how-to-ride`, `/where-to-ride`,
  `/know-your-ride`.
- **Pass 2** — mobile 390x844: `/`, `/how-to-ride`; plus desktop `/community`,
  `/support`.

### The five durable conclusions

1. Horizontal scroll-linked translation **is present** on current live Zoox
   (up to 1,800px / 125vw, three of four routes).
2. Product pinning is achieved visually through **fixed + spacer** — a
   reference implementation detail, **not** a mandate.
3. Mobile uses **genuine recomposition** (separate component and media paths).
4. **Reduced-motion support is absent in the reference and must not be copied.**
5. **Horizontal motion remains available to VitalCV** when it explains the
   product. No founder decision outstanding.

## Files

**CREATED (committed on this branch):**
- `docs/design/zoox-fidelity-measurement.md` — baseline delta vs the existing
  atlas, confidence-labelling rules, and the reference-to-product matrix
- `docs/design/vitalcv-cinematic-storyboard.md` — **Living Evidence Record
  anatomy and the eleven faces (complete)**, scene list, implementation-risk map
- `docs/design/vitalcv-media-shot-list.md` — asset register with the standing
  data rule
- `docs/design/zoox-fidelity-z0-handoff.md` — this file

**INCOMPLETE:**
- Measurement doc: the per-interaction records are placeholders; the matrix has
  adaptations written but reference-side numbers pending
- Storyboard: **frames not drawn** (desktop 01–13, mobile 01–09)
- Shot list: specified, no assets produced

## Visual artifacts

`artifacts/zoox-fidelity-z0/{desktop-storyboard,mobile-storyboard,motion-animatic}/`
exist and are **empty**. Nothing has been drawn. This is the single largest
outstanding piece of Z0.

## Confirmed reference findings (from the existing atlas, still standing)

- One sticky element per page; ~9–13 keyframes; one scroll-snap rule sitewide
- Nav fixed 51px, transparent at every sampled depth, never gains a plate
- Home autoplays media; interior pages do not
- Zero metrics, logo walls or proof furniture anywhere
- **Zero `prefers-reduced-motion` blocks sitewide** — the reference's failure,
  which this program must not inherit
- Restraint is the mechanism: a 12.6-viewport effect from almost no scroll
  machinery

## Settled decisions — do not reopen

- **Horizontal movement: APPROVED**, gated on a four-purpose test — FORMATION
  (fragments converge) · INSPECTION (record moves beneath a stable lens) ·
  PERMISSION (subset separates) · HANDOFF (subset crosses to the recipient).
  Never horizontal movement merely because Zoox has it. Motion expressed
  **proportionally** (fraction of own width / media height / one icon-box).
- **No next-frame evidence preview.** The 8–14vw peek-ahead is removed. Each
  evidence state fully arrives, stabilises, reads, then transitions. A
  half-visible evidence record is an unreadable claim.
- **Keep VitalCV's sticky-stage architecture.** Do not rewrite it to fixed +
  spacer for code-level similarity. Target perceptual parity only.
- **Radius findings are MEDIA heuristics, not doctrine.** Radius may decrease
  as a cinematic frame expands; in two-up media, radius may equal the gap; clip
  geometry may carry the roundness. **Do not apply these to factual evidence
  surfaces.** Preserve: evidence facts 0–3px · controls 10px · nav chrome
  12–24px · media apertures ~24–56px · consent seal circular.
- **Reduced motion belongs in the DRIVER.** Any JS mapping scroll progress into
  transform, clip, scale, canvas frame or video time must check the preference
  **before publishing per-frame values** — CSS alone is not an acceptable
  fallback when JS continuously writes the property. Render the **settled,
  complete** state, never the closed start state. Respond to preference changes
  while the page is open.

## Storyboard status by scene

Desktop 01–13: **all pending**. Mobile 01–09: **all pending**.
Living Evidence Record anatomy and eleven faces: **PROVISIONALLY ACCEPTED by
the founder — do not restart them.** Explicitly *not* visually approved: the
written concept may still render badly, and it is not approved until the
founder sees the object.

## Media shot-list status

Register written, assets **not produced**. `EVR-POSTER-{01..11}` is the
acceptance artefact for the protagonist and is the highest-value thing to
produce first: it proves object continuity before a single scene is composed.

## Security lane

```
SECURITY CONTAINMENT:     LIVE
DEAD ROUTE REMOVAL:       PR #1067 open, all required checks were green
LOG REVIEW:               PENDING — blocked: API service name not resolvable
                          from the Railway CLI; owner: founder
DATABASE CLASSIFICATION:  COMPLETE — 2 records, both real, verified via public
                          NPPES; details in the private advisory only
NOTIFICATION ASSESSMENT:  PENDING — blocked on log review; needs counsel
NEXT ACTION:              founder supplies API log access, then complete the
                          exposure-window review and assess notification
```

No vulnerability detail belongs in #1069, in this branch, or in any visual PR.

## Exact next command

```bash
cd /tmp/vitalcv-homepage-recovery-approved 2>/dev/null || \
  git worktree add -b design/zoox-fidelity-z0-continue /tmp/vcv-z0 origin/main
git fetch origin && git checkout design/zoox-fidelity-z0 && git pull --rebase
```

**Do not create a new Z0 branch or PR.** Continue on this one, in this order:

1. ~~Collect both measurement-agent outputs.~~ **DONE — both synthesised.**
2. **Separate REFERENCE A (current live) from REFERENCE B (historical
   award-winning experience, per Dogstudio and reliable records). Never blend
   them.** Label every behaviour `CURRENT LIVE — MEASURED` / `CURRENT LIVE —
   OBSERVED` / `HISTORICAL EXPERIENCE — DOCUMENTED` / `HISTORICAL EXPERIENCE —
   INFERRED` / `NOT CONFIRMED`.
3. **STOP RESEARCHING ZOOX.** Measurement is accepted as complete.
   *(Method note retained only for reference:* At
   each sample inspect *all visible descendants* — not just sections — for
   bounding-box movement relative to the viewport, transform matrices, opacity,
   clip-path, mask properties, sticky/fixed state, canvas presence and size,
   video currentTime, image source changes, active classes and data
   attributes, and screenshot/frame differences. Sample continuously or at
   much smaller increments through the major sections, not six page depths.
   Also exercise: normal scroll · slow scroll · reverse scroll · pointer hover
   · button hover · keyboard focus · mobile touch · nav open and group change.
   **The goal is what the visitor perceives, not which implementation is used.**
4. Synthesise the measurement document.
5. Draw the thirteen desktop frames.
6. Draw the nine **independently composed** mobile frames.
7. Produce the playable animatic (GIF/MP4 — never a `.webm` the founder must
   download).
8. Complete the production-ready media shot list.
9. Post everything **inline** to #1070 and #1069.
10. Stop for founder approval.

Build the storyboard as an isolated HTML prototype under
`artifacts/zoox-fidelity-z0/` — never a public application route.

## HARD STOP

Do not begin Z1. Do not write product code. Z0 ends with a founder decision:

```
FOUNDER Z0 STORYBOARD: APPROVED
FOUNDER LIVING EVIDENCE RECORD: APPROVED
FOUNDER MEDIA DIRECTION: APPROVED
```
