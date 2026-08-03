# Z0 handoff

Written so a fresh session can continue **without any conversational memory**.

```
CURRENT MAIN SHA:   78e9aea10c7ea318226de83587e77c3c662400ec
Z0 BRANCH:          design/zoox-fidelity-z0
Z0 PR:              (draft — see issue #1069 for the link)
ISSUE:              #1069  VitalCV Zoox-fidelity cinematic experience
```

## Measurement passes

**COMPLETED:** none synthesised into the repository yet.

**DISPATCHED, RESULTS NOT YET INCORPORATED:**
1. Desktop 1440×900 — `zoox.com/`, `/how-to-ride`, `/where-to-ride`,
   `/know-your-ride`. Brief: nav rest/scrolled geometry, sticky ranges,
   horizontal rails, clip/mask reveals, button + icon hover choreography,
   surface transitions, measured radii, reduced-motion handling.
2. Mobile 390×844 — `zoox.com/`, `/how-to-ride`; plus desktop `/community`,
   `/support`. Brief: nav overlay behaviour, which sticky elements survive at
   390px, whether rails stack, media switching (`srcset`/`currentSrc`), type
   scale, sub-44px touch targets, page height in viewport multiples.

**MISSING:** both syntheses. If the passes are gone, re-dispatch with the same
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

1. Does horizontal travel exist at all? The atlas found **zero** transformed
   sections at six scroll depths, which would mean the "sliding imagery" this
   program wants is **not** actually a Zoox behaviour and must be justified on
   VitalCV's own terms.
2. Real measured radii on media containers — Z1's 24–56px hierarchy is
   currently unanchored.
3. Button/icon hover choreography — never captured.
4. Whether interior media is scroll-scrubbed (5 canvases across 46 viewports on
   `/how-to-ride` is the signature, unconfirmed headlessly).

Question 1 is the important one: if it resolves to "no horizontal travel," the
honest move is to say so and defend VitalCV's rails independently, not to
attribute them to a reference that does not do it.

## Storyboard status by scene

Desktop 01–13: **all pending**. Mobile 01–09: **all pending**.
Living Evidence Record anatomy and eleven faces: **COMPLETE** — this is the
part a fresh session should not redo.

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

Then, in order:
1. Re-dispatch the two measurement passes and synthesise them into
   `zoox-fidelity-measurement.md` with confidence labels.
2. Build the storyboard as an **isolated HTML prototype** under
   `artifacts/zoox-fidelity-z0/` — not a public route — rendering the eleven
   faces and the 22 frames, then capture stills and an animatic (GIF/MP4, not
   `.webm`).
3. Post the package to #1069 and stop.

## HARD STOP

Do not begin Z1. Do not write product code. Z0 ends with a founder decision:

```
FOUNDER Z0 STORYBOARD: APPROVED
FOUNDER LIVING EVIDENCE RECORD: APPROVED
FOUNDER MEDIA DIRECTION: APPROVED
```
