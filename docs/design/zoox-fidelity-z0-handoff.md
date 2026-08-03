# Z0 handoff

Written so a fresh session can continue **without any conversational memory**.

```
CURRENT MAIN SHA:   78e9aea10c7ea318226de83587e77c3c662400ec
Z0 BRANCH:          design/zoox-fidelity-z0
Z0 PR:              (draft — see issue #1069 for the link)
ISSUE:              #1069  VitalCV Zoox-fidelity cinematic experience
```

## Measurement passes

**COMPLETED AND SYNTHESISED:** Pass 2 — mobile 390x844 (`/`, `/how-to-ride`)
plus desktop `/community` and `/support`. Written into
`zoox-fidelity-measurement.md` at commit `504012f7b`.

**DISPATCHED, RESULTS NOT YET INCORPORATED:**
1. Desktop 1440×900 — `zoox.com/`, `/how-to-ride`, `/where-to-ride`,
   `/know-your-ride`. Brief: nav rest/scrolled geometry, sticky ranges,
   horizontal rails, clip/mask reveals, button + icon hover choreography,
   surface transitions, measured radii, reduced-motion handling.
2. Mobile 390×844 — `zoox.com/`, `/how-to-ride`; plus desktop `/community`,
   `/support`. Brief: nav overlay behaviour, which sticky elements survive at
   390px, whether rails stack, media switching (`srcset`/`currentSrc`), type
   scale, sub-44px touch targets, page height in viewport multiples.

**MISSING:** Pass 1 synthesis (desktop `/`, `/how-to-ride`, `/where-to-ride`,
`/know-your-ride`) — dispatched, result not yet returned. If the passes are gone, re-dispatch with the same
briefs — they are reproduced in full in the issue thread and above.

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

## Unresolved reference questions

1. **Does scroll-linked / horizontal movement exist on current Zoox?**
   **NOT CONFIRMED** — an earlier revision wrongly wrote "resolved: no". The
   method sampled section-level transforms at six depths and found none; that
   does not establish absence. Portrait scrub canvases measured at 390 are
   themselves evidence of scroll-linked media progression outside that method.
   **VitalCV's horizontal evidence rails STAY**, justified by VitalCV's own
   product story (formation, inspection, permission, handoff) — not by a
   reference inventory match. No founder decision is outstanding on this.
2. ~~Media radii unanchored?~~ **RESOLVED.** Measured ladder: media 36px ·
   buttons/cards 16px · nav capsule 18px · qualifier tag 12px · media frames
   0px. Radius is a **clip variable**, not a border property.
3. Button/icon hover choreography — **captured** on the desktop secondary
   routes (two-arrow relay, 30px out / 20px in, 334ms in / 500ms out).
4. Whether interior media on `/how-to-ride` is scroll-scrubbed — **partially**:
   portrait scrub canvases confirmed at 390. Desktop scrub timing awaits Pass 1.

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

1. Collect both measurement-agent outputs (Pass 2 is already synthesised).
2. **Separate REFERENCE A (current live) from REFERENCE B (historical
   award-winning experience, per Dogstudio and reliable records). Never blend
   them.** Label every behaviour `CURRENT LIVE — MEASURED` / `CURRENT LIVE —
   OBSERVED` / `HISTORICAL EXPERIENCE — DOCUMENTED` / `HISTORICAL EXPERIENCE —
   INFERRED` / `NOT CONFIRMED`.
3. **Improve movement detection wherever the first pass was inconclusive.** At
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
