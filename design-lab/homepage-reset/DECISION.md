# UX-01 Verdict — FOUNDER DECISION (FINAL, WITH AMENDMENTS)

> **STATUS 2026-08-08 — FINAL.** This supersedes both the earlier same-day records in this file:
> the parallel-lane "B as presented, no hybrid" entry AND the "REOPENED — DO NOT ACT" banner.
> The founder issued the amended ruling below on 2026-08-08, resolving the reopening.
> **UX-01 — DIRECTION B GO, WITH AMENDMENTS.**

## The ruling (memorialized as issued)

**Direction B — Intelligent Product.**

1. **Product-forward brand.** VitalCV's primary brand expression will be product-forward:
   visitors should see VitalCV doing work rather than reading claims about what it might do.
2. **Registers, not a mandate.** The public experience *may* use a dark-first warm-graphite
   register, while evidence, printable artifacts, dense workflow surfaces, and contexts where
   legibility benefits *may* use intentionally designed light surfaces.
3. **The agent's visible work is brand.** The Start Agent's visible work — finding information,
   identifying what remains, preparing actions, pausing for consent, and completing work — is a
   core brand expression.
4. **The eyebrow is binding.** The wide, shallow Palantir/Zoox eyebrow is binding and receives
   its own UX-03 implementation and founder visual gate.
5. **What B does NOT authorize:** a 14–18 second blocking hero experience, permanent dark mode
   everywhere, or reuse of the prototype's exact implementation. Motion must communicate the
   Easy Button quickly and never make the user wait for the message.
6. **Evidence artifacts remain printable/light by default.**
7. **Product truth, consent, accessibility, and reduced-motion contracts remain unchanged.**

Chosen: **B's thesis — the product demonstration is the brand** — without turning
"dark page + autoplay" into holy scripture. The prototype
(`design-lab/homepage-reset/direction-b/index.html`) is the reference for the thesis, **not**
implementation canon.

## Companion rulings (same founder ruling, 2026-08-08)

- **#1165 — ACCEPTED AS EVIDENCE, HOLD MERGE UNTIL GOVERNANCE REBASE.** The census's
  measurements survive (993 custom properties, 94 collisions, 161 dead-class candidates,
  contrast failures, missing `<main>`, viewport voids, tiny microcopy). Before it lands: rename
  "UX-02 adopts …" language to "UX-02 candidate substrate / measured recommendation" wherever it
  describes choices like a radius scale or component patterns — the census establishes facts and
  recommends; it does not legislate. That is UX-00/UX-01 territory. Rebase after #1160 settles
  (main has advanced to `ab25931b6`; do not merge stale-head design docs without rebasing).
- **#1160 / UX-00 — STILL REVISE BEFORE MERGE** (head `9568a4db1` unchanged). Separate genuine
  experience invariants from Direction-B visual decisions and contextual guidance; incorporate
  the EC-14 ownership correction, EC-15 mapping correction, receipt/activity terminology fix,
  and the objective-vs-subjective CI distinction from the prior review.

## Execution sequence (founder-ordered)

1. **Record Direction B formally** — this file. DONE 2026-08-08.
2. **Revise UX-00** (#1160): invariants vs. Direction-B visuals vs. contextual guidance, plus the
   four corrections above.
3. **Back-fill EC-20** from this verdict — Geist/Geist Mono, dark-first *public register* (per
   amendment 2, not everywhere), light artifact treatment, exact accent/state separation — only
   after the constitution's layering is repaired.
4. **Rebase #1165** after #1160 settles (with the "candidate substrate" rename).
5. **Execute UX-02 from the census**: collapse the 993 custom properties, eliminate import-order
   roulette, fix contrast/microcopy/accessibility, consolidate styling infrastructure, implement
   Direction B's actual tokens.
6. **UX-03: the eyebrow**, independent founder visual gate. No "pretty close" — it must match the
   wide architectural Palantir/Zoox brief.
7. **Only after UX-03 GO** does the visual freeze lift and the homepage/NPI/agent/employer
   overhaul waves begin.

## Lineage

- 2026-08-07 — concept-selection wave (this lane): three directions built from main `0b62fc04b`;
  founder selected B in-session; board:
  https://claude.ai/code/artifact/a4b68d01-3415-479b-89ea-cce2c166e2e6 ; #1133 untouched, not
  inherited.
- 2026-08-08 (early) — parallel governance lane reopened the verdict pending hybrid
  consideration; no EC-20 back-fill occurred during the reopening (correctly).
- 2026-08-08 (this ruling) — **FINAL: DIRECTION B GO, WITH AMENDMENTS**, as memorialized above.
- Production branch `design/homepage-reset-direction-b` (worktree `/tmp/vitalcv-homepage-reset-b`,
  base `1bfa6bfc1`, canon commit `cef2dcc90`) carries the selection-wave canon; its copy of this
  file updates with this final ruling.
